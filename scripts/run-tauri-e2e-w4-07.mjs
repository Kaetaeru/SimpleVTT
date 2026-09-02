import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { remote } from "webdriverio";

const scriptDirectory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptDirectory,"..");
const binary=path.join(root,".live-dev","tauri-e2e-target","debug","simplevtt.exe");
const viteEntry=path.join(root,"node_modules","vite","bin","vite.js");
const runId=new Date().toISOString().replace(/[:.]/g,"-");
const runRoot=path.join(root,".live-dev","tauri-e2e",runId);
const artifactRoot=path.join(runRoot,"artifacts");
const verificationSha=process.env.V1_VERIFICATION_SHA??process.env.GITHUB_SHA??"local";
const keepOpen=process.argv.includes("--keep-open");
const children=[];
const browsers=[];
let viteStarted=false;

function log(message){process.stdout.write(`[TAURI W4-07 E2E] ${message}\n`);}

async function reservePort(){
  return new Promise((resolve,reject)=>{
    const server=createServer();server.unref();server.once("error",reject);
    server.listen(0,"127.0.0.1",()=>{
      const address=server.address();const port=typeof address==="object"&&address?address.port:0;
      server.close((error)=>error?reject(error):resolve(port));
    });
  });
}

async function canConnect(port,host="127.0.0.1"){
  return new Promise((resolve)=>{
    const socket=new Socket();const finish=(value)=>{socket.destroy();resolve(value);};
    socket.setTimeout(250);socket.once("connect",()=>finish(true));socket.once("timeout",()=>finish(false));socket.once("error",()=>finish(false));socket.connect(port,host);
  });
}

async function waitForPort(port,label,timeoutMs=30_000){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){if(await canConnect(port))return;await new Promise((resolve)=>setTimeout(resolve,100));}
  throw new Error(`${label} did not listen on 127.0.0.1:${port} within ${timeoutMs} ms`);
}

function spawnTracked(command,args,options={}){
  const child=spawn(command,args,{cwd:root,stdio:["ignore","pipe","pipe"],windowsHide:false,...options});
  children.push(child);child.stdout?.on("data",(chunk)=>process.stdout.write(chunk));child.stderr?.on("data",(chunk)=>process.stderr.write(chunk));return child;
}

async function ensureVite(){
  if(await canConnect(1420)){log("기존 Vite 서버(localhost:1420)를 사용합니다.");return;}
  assert.ok(existsSync(viteEntry),`Vite entry was not found: ${viteEntry}`);viteStarted=true;
  spawnTracked(process.execPath,[viteEntry,"--host","0.0.0.0","--port","1420","--strictPort"]);
  await waitForPort(1420,"Vite",45_000);
  let response;
  for(let attempt=0;attempt<50&&!response?.ok;attempt+=1){try{response=await fetch("http://127.0.0.1:1420/");}catch{await new Promise((resolve)=>setTimeout(resolve,100));}}
  assert.ok(response?.ok,"Vite warm-up did not become HTTP-ready");await response.text();
}

function exactButton(text){return `//button[normalize-space(.)=${JSON.stringify(text)}]`;}
function navButton(text){return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;}
function labelControl(label,tag="input",within=""){const scope=within?`${within}//`:"//";return `${scope}label[.//*[self::span or self::legend][normalize-space(.)=${JSON.stringify(label)}]]//${tag}`;}

async function click(browser,selector,description=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.waitForEnabled({timeout:15_000,timeoutMsg:`${description} is disabled`});await element.click();}
async function replaceValue(browser,selector,value,description=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.click();await element.setValue(value);assert.equal(await element.getValue(),String(value),`${description} did not accept input`);}
async function waitForText(browser,text,timeout=20_000){await browser.waitUntil(async()=>(await browser.$("body").getText()).includes(text),{timeout,timeoutMsg:`UI text did not appear: ${text}`});}

async function completeFirstRun(instance){
  const finish=await instance.browser.$(exactButton("선택 저장 · Home으로"));if(!await finish.isExisting())return;
  const optimized=await instance.browser.$("//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]");await optimized.click();await finish.waitForEnabled({timeout:10_000});await finish.click();await waitForText(instance.browser,"TABLETOP, YOUR WAY");
}

async function launchInstance(label,dataRoot,webdriverPort){
  await mkdir(dataRoot,{recursive:true});
  const child=spawnTracked(binary,[`--simplevtt-data-root=${dataRoot}`,`--simplevtt-instance-label=${label}`],{env:{...process.env,SIMPLEVTT_LOCAL_DATA_ROOT:dataRoot,SIMPLEVTT_INSTANCE_LABEL:label,TAURI_WEBDRIVER_PORT:String(webdriverPort)}});
  await waitForPort(webdriverPort,`${label} WebDriver`,30_000);
  const browser=await remote({hostname:"127.0.0.1",port:webdriverPort,logLevel:"error",capabilities:{}});browsers.push(browser);
  await browser.setTimeout({implicit:0,pageLoad:30_000,script:60_000});
  await browser.waitUntil(async()=>(await browser.$("body").getText()).includes("SimpleVTT"),{timeout:30_000,timeoutMsg:`${label} UI did not finish loading`});
  const instance={label,child,browser,dataRoot,webdriverPort};await completeFirstRun(instance);return instance;
}

async function saveEvidence(instance,suffix){
  const base=instance.label.replace(/\s+/g,"-").toLowerCase();
  const screenshot=await instance.browser.takeScreenshot();
  await writeFile(path.join(artifactRoot,`${base}-${suffix}.png`),screenshot,"base64");
  await writeFile(path.join(artifactRoot,`${base}-${suffix}.txt`),await instance.browser.$("body").getText(),"utf8");
}

async function createHostCampaign(host){
  await click(host.browser,navButton("캠페인"),"캠페인 메뉴");const body=await host.browser.$("body").getText();
  await click(host.browser,exactButton(body.includes("아직 캠페인이 없습니다.")?"새 캠페인 만들기":"새 캠페인"),"새 캠페인");
  await replaceValue(host.browser,labelControl("캠페인 이름"),"W4-07 Windows 검증 캠페인","캠페인 이름");await click(host.browser,exactButton("캠페인 만들기"),"캠페인 만들기 제출");await waitForText(host.browser,"W4-07 Windows 검증 캠페인");
}

async function openHostSession(host,sessionPort){
  await click(host.browser,navButton("세션"),"세션 메뉴");const direct="//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(host.browser,`${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`,"127.0.0.1","Host bind 주소");
  const portInputs=await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);assert.ok(portInputs.length>=1,"Host port input was not found");await portInputs[0].setValue(String(sessionPort));
  const buttons=await host.browser.$$(`${direct}//button[normalize-space(.)='세션 열기']`);assert.equal(buttons.length,1);await buttons[0].click();await waitForText(host.browser,"호스트 · DM",30_000);
}

async function joinClientSession(client,sessionPort){
  await click(client.browser,navButton("세션"),"세션 메뉴");const direct="//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(client.browser,`${direct}//label[.//span[normalize-space(.)='Host IP / 주소']]//input`,"127.0.0.1","Client Host 주소");
  const portInputs=await client.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);assert.ok(portInputs.length>=2,"Client port input was not found");await portInputs[1].setValue(String(sessionPort));
  const buttons=await client.browser.$$(`${direct}//button[normalize-space(.)='참가하기']`);assert.equal(buttons.length,1);await buttons[0].click();await waitForText(client.browser,"클라이언트 · 플레이어",30_000);
}

async function completeVisibleCharacterChoices(browser){
  for(let attempt=0;attempt<120;attempt+=1){
    const result=await browser.execute(()=>{
      const sections=[...document.querySelectorAll(".focused-create-stage .create-v09-section")];
      for(const section of sections){
        if(section.querySelector(".create-status-pill")?.textContent?.trim()!=="선택 필요")continue;
        const candidates=[...section.querySelectorAll(".dynamic-choice-grid .create-option-card, .equipment-options .create-option-card, .spell-choice-grid button, .proficiency-grid button")];
        const target=candidates.find((item)=>!item.disabled&&item.getAttribute("aria-disabled")!=="true"&&!item.classList.contains("selected")&&!item.querySelector(".selected"));
        if(target instanceof HTMLElement){const before=section.textContent;target.scrollIntoView({block:"center"});target.click();return{clicked:true,section:section.id,before};}
      }
      return{clicked:false,unresolved:sections.filter((section)=>section.querySelector(".create-status-pill")?.textContent?.trim()==="선택 필요").map((section)=>section.id)};
    });
    if(!result.clicked)return result.unresolved;
    await browser.waitUntil(async()=>browser.execute(({sectionId,before})=>{const section=document.getElementById(sectionId);return Boolean(section&&section.textContent!==before);},{sectionId:result.section,before:result.before}),{timeout:15_000,timeoutMsg:`Character choice did not commit in ${result.section}`});
  }
  throw new Error("Character choice completion exceeded 120 UI clicks");
}

async function openCharacterTab(browser,label,sectionId){
  await click(browser,`//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`,`${label} 탭`);
  await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({timeout:15_000});
}

async function createDistinctPlayerCharacter(instance,name){
  await click(instance.browser,navButton("캐릭터"),`${instance.label} 캐릭터 메뉴`);
  const duplicate="//article[contains(@class,'character-card-entry')][.//h2[normalize-space(.)='Aelar']]//button[normalize-space(.)='복제']";
  await click(instance.browser,duplicate,`${instance.label} Aelar 복제`);
  await openCharacterTab(instance.browser,"정체성","identity");await replaceValue(instance.browser,labelControl("캐릭터 이름"),name,`${instance.label} 캐릭터 이름`);
  for(const [tab,sectionId] of [["정체성","identity"],["종족","species"],["클래스","class"],["배경","background"]]){
    await openCharacterTab(instance.browser,tab,sectionId);assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[],`${instance.label} ${tab} dependent choices remain unresolved`);
  }
  await openCharacterTab(instance.browser,"능력치","abilities");await click(instance.browser,"//section[@id='abilities']//button[contains(normalize-space(.),'파이터 추천 배치')]",`${instance.label} 파이터 추천 배치`);
  await openCharacterTab(instance.browser,"기술","proficiencies");assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[],`${instance.label} proficiency choices remain unresolved`);
  await openCharacterTab(instance.browser,"검토","review");await click(instance.browser,exactButton("모험 시작"),`${instance.label} Character 저장`);await waitForText(instance.browser,name,30_000);
  const snapshot=await runtimeSnapshot(instance);assert.notEqual(snapshot.activeCharacterId,"char.aelar");assert.equal(snapshot.activeCharacterName,name);return{id:snapshot.activeCharacterId,name};
}

async function runtimeSnapshot(instance){
  const result=await instance.browser.executeAsync((done)=>{
    import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{
      const snapshot=await mockAdapter.getSnapshot();
      const target=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
      done({activeCharacterId:snapshot.activeCharacter.id,activeCharacterName:snapshot.activeCharacter.name,role:snapshot.session.role,connectionState:snapshot.connectionState,targetHp:target?.hp??null,resolution:snapshot.resolution?{id:snapshot.resolution.id,stage:snapshot.resolution.stage,finalOutcome:snapshot.resolution.finalOutcome,provenance:snapshot.resolution.provenance}:null,participants:snapshot.session.participants.map((entry)=>({id:entry.id,characterName:entry.characterName,state:entry.state}))});
    }).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);return result;
}

async function waitForTargetHp(instance,hp){
  await instance.browser.waitUntil(async()=>{const snapshot=await runtimeSnapshot(instance);return snapshot.targetHp===hp;},{timeout:20_000,interval:150,timeoutMsg:`${instance.label} did not converge to target HP ${hp}`});
  return runtimeSnapshot(instance);
}

async function runHostShortbow(host,distanceFeet){
  const result=await host.browser.executeAsync((distance,done)=>{
    (async()=>{
      const [{mockAdapter},{connectedInternal},{setSpatialRelation,spatialPairKey},{resolveRuntimeAttackTargetingFact}]=await Promise.all([
        import("/src/app/mockAdapter.ts"),
        import("/src/app/connectedSessionRuntimeAdapter.ts"),
        import("/src/app/spatialRuntimeContracts.ts"),
        import("/src/app/realRuntimeAttackFactProvider.ts"),
      ]);
      const app=connectedInternal(mockAdapter);const sourceId="char.aelar";const targetId="combatant.goblin-a";const key=spatialPairKey(sourceId,targetId);
      app.scene.spatialByPair??={};
      if(distance===null) delete app.scene.spatialByPair[key];
      else setSpatialRelation(app.scene,{sourceId,targetId,distanceFeet:distance,visible:true,cover:"none",targetCanSeeAttacker:true,withinReach:true,provenance:`module:w4-07-windows:spatial:${distance}`});
      await mockAdapter.endInitiative();await mockAdapter.startInitiative();await mockAdapter.setCurrentActor(sourceId);await mockAdapter.setQueuedD20(11);
      const fact=resolveRuntimeAttackTargetingFact(app.scene,sourceId,targetId);const before=(await mockAdapter.getSnapshot()).scene.entities.find((entry)=>entry.id===targetId)?.hp??null;
      let snapshot=await mockAdapter.resolveAction("action.shortbow",[targetId]);
      for(let step=0;step<8&&snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance;step+=1)snapshot=await mockAdapter.advanceResolution();
      snapshot=await mockAdapter.getSnapshot();const after=snapshot.scene.entities.find((entry)=>entry.id===targetId)?.hp??null;
      return {fact,beforeHp:before,afterHp:after,resolution:snapshot.resolution?{id:snapshot.resolution.id,stage:snapshot.resolution.stage,finalOutcome:snapshot.resolution.finalOutcome,provenance:snapshot.resolution.provenance,stateChanges:snapshot.resolution.stateChanges}:null};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  },distanceFeet);
  assert.ok(!result.error,result.error);return result;
}

async function runScenario(){
  assert.equal(process.platform,"win32","W4-07 Tauri acceptance is Windows-only");assert.ok(existsSync(binary),`Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot,{recursive:true,force:true});await mkdir(artifactRoot,{recursive:true});await ensureVite();
  const sessionPort=await reservePort();
  const host=await launchInstance("W4-07 Host",path.join(runRoot,"host","data"),await reservePort());
  const p1=await launchInstance("W4-07 P1",path.join(runRoot,"p1","data"),await reservePort());
  const p2=await launchInstance("W4-07 P2",path.join(runRoot,"p2","data"),await reservePort());
  const p1Character=await createDistinctPlayerCharacter(p1,"W4 G08 Player");
  const p2Character=await createDistinctPlayerCharacter(p2,"W4 G09 Observer");
  await createHostCampaign(host);await openHostSession(host,sessionPort);await joinClientSession(p1,sessionPort);await joinClientSession(p2,sessionPort);
  await host.browser.waitUntil(async()=>{const snapshot=await runtimeSnapshot(host);return snapshot.participants.filter((entry)=>entry.state==="connected").length>=3;},{timeout:20_000,timeoutMsg:"H/P1/P2 participant topology did not converge"});

  const g08=await runHostShortbow(host,null);
  assert.equal(g08.fact.authority,"manual-unconstrained");assert.equal("distanceFeet" in g08.fact,false,"G08 must not fabricate distance");assert.equal(g08.resolution?.stage,"complete");assert.ok(g08.afterHp<g08.beforeHp,"G08 ranged attack should not be falsely rejected without a provider");
  const p1AfterG08=await waitForTargetHp(p1,g08.afterHp);const p2AfterG08=await waitForTargetHp(p2,g08.afterHp);

  const g09Rejected=await runHostShortbow(host,90);
  assert.equal(g09Rejected.fact.authority,"authoritative");assert.equal(g09Rejected.fact.distanceFeet,90);assert.ok(g09Rejected.fact.provenance.includes("module:w4-07-windows:spatial:90"));assert.equal(g09Rejected.resolution?.finalOutcome,"적용 거부");assert.equal(g09Rejected.afterHp,g09Rejected.beforeHp,"out-of-range provider fact must not mutate HP");
  assert.equal((await runtimeSnapshot(p1)).targetHp,g09Rejected.beforeHp);assert.equal((await runtimeSnapshot(p2)).targetHp,g09Rejected.beforeHp);

  const g09Accepted=await runHostShortbow(host,20);
  assert.equal(g09Accepted.fact.authority,"authoritative");assert.equal(g09Accepted.fact.distanceFeet,20);assert.ok(g09Accepted.fact.provenance.includes("module:w4-07-windows:spatial:20"));assert.equal(g09Accepted.resolution?.stage,"complete");assert.ok(g09Accepted.afterHp<g09Accepted.beforeHp,"in-range provider fact must allow Host mechanics validation");
  const p1AfterG09=await waitForTargetHp(p1,g09Accepted.afterHp);const p2AfterG09=await waitForTargetHp(p2,g09Accepted.afterHp);

  for(const instance of [host,p1,p2])await saveEvidence(instance,"g08-g09");
  const evidence={gate:"W4-07",scope:["MP-G08","MP-G09"],status:"PASS",verificationSha,windowsTauri:true,topology:{host:"char.aelar",p1:p1Character.id,p2:p2Character.id,participantCount:(await runtimeSnapshot(host)).participants.length},scenarios:{"MP-G08":{status:"PASS",authority:g08.fact.authority,beforeHp:g08.beforeHp,afterHp:g08.afterHp,p1Hp:p1AfterG08.targetHp,p2Hp:p2AfterG08.targetHp},"MP-G09":{status:"PASS",rejected:{distanceFeet:g09Rejected.fact.distanceFeet,provenance:g09Rejected.fact.provenance,finalOutcome:g09Rejected.resolution?.finalOutcome,hp:g09Rejected.afterHp},accepted:{distanceFeet:g09Accepted.fact.distanceFeet,provenance:g09Accepted.fact.provenance,finalOutcome:g09Accepted.resolution?.finalOutcome,beforeHp:g09Accepted.beforeHp,afterHp:g09Accepted.afterHp,p1Hp:p1AfterG09.targetHp,p2Hp:p2AfterG09.targetHp}}}};
  await writeFile(path.join(artifactRoot,"w4-07-g08-g09.json"),JSON.stringify(evidence,null,2),"utf8");
  log(`MP-G08/G09 Windows H+P1+P2 acceptance PASS · ${artifactRoot}`);
}

async function cleanup(){
  if(keepOpen){log(`--keep-open 지정됨 · 테스트 창과 ${viteStarted?"Vite 서버":"기존 Vite 서버"}를 유지합니다.`);return;}
  for(const browser of browsers.reverse()){try{await Promise.race([browser.deleteSession(),new Promise((resolve)=>setTimeout(resolve,3_000))]);}catch{}}
  for(const child of children.reverse()){if(!child.pid||child.exitCode!==null)continue;spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}
}

let exitCode=0;
try{await runScenario();}catch(error){exitCode=1;log(`실패: ${error instanceof Error?error.stack??error.message:String(error)}`);for(const [index,browser] of browsers.entries()){try{await writeFile(path.join(artifactRoot,`failure-${index+1}.png`),await browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`failure-${index+1}.txt`),await browser.$("body").getText(),"utf8");}catch{}}log(`실패 증거: ${artifactRoot}`);}finally{await cleanup();}
process.exitCode=exitCode;
