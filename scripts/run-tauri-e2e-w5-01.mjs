import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { remote } from "webdriverio";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const binary=path.join(root,".live-dev","tauri-e2e-target","debug","simplevtt.exe");
const viteEntry=path.join(root,"node_modules","vite","bin","vite.js");
const runId=new Date().toISOString().replace(/[:.]/g,"-");
const runRoot=path.join(root,".live-dev","tauri-e2e",`${runId}-w5-01`);
const artifactRoot=path.join(runRoot,"artifacts");
const verificationSha=process.env.V1_VERIFICATION_SHA??process.env.GITHUB_SHA??"local";
const children=[];const browsers=[];
const direct="//*[@aria-label='직접 네트워크 세션 시작']";

function log(message){process.stdout.write(`[TAURI W5-01] ${message}\n`);}
async function reservePort(){return new Promise((resolve,reject)=>{const server=createServer();server.unref();server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const a=server.address();const p=typeof a==="object"&&a?a.port:0;server.close((e)=>e?reject(e):resolve(p));});});}
async function canConnect(port){return new Promise((resolve)=>{const socket=new Socket();const done=(v)=>{socket.destroy();resolve(v);};socket.setTimeout(250);socket.once("connect",()=>done(true));socket.once("timeout",()=>done(false));socket.once("error",()=>done(false));socket.connect(port,"127.0.0.1");});}
async function waitForPort(port,label,timeout=30_000){const end=Date.now()+timeout;while(Date.now()<end){if(await canConnect(port))return;await new Promise((r)=>setTimeout(r,100));}throw new Error(`${label} did not listen on ${port}`);}
function spawnTracked(command,args,options={}){const child=spawn(command,args,{cwd:root,stdio:["ignore","pipe","pipe"],windowsHide:false,...options});children.push(child);child.stdout?.on("data",(c)=>process.stdout.write(c));child.stderr?.on("data",(c)=>process.stderr.write(c));return child;}
async function ensureVite(){if(await canConnect(1420))return;assert.ok(existsSync(viteEntry));spawnTracked(process.execPath,[viteEntry,"--host","0.0.0.0","--port","1420","--strictPort"]);await waitForPort(1420,"Vite",45_000);}
function exactButton(text){return `//button[normalize-space(.)=${JSON.stringify(text)}]`;}
function navButton(text){return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;}
function labelControl(label,tag="input",within=""){const scope=within?`${within}//`:"//";return `${scope}label[.//span[normalize-space(.)=${JSON.stringify(label)}]]//${tag}`;}
async function click(browser,selector,description=selector){const el=await browser.$(selector);await el.waitForDisplayed({timeout:20_000,timeoutMsg:`${description} is not visible`});await el.waitForEnabled({timeout:20_000,timeoutMsg:`${description} is disabled`});await el.click();}
async function replaceValue(browser,selector,value,description=selector){const el=await browser.$(selector);await el.waitForDisplayed({timeout:20_000,timeoutMsg:`${description} is not visible`});await el.click();await el.setValue(value);assert.equal(await el.getValue(),String(value),`${description} did not accept input`);}
async function waitForText(browser,text,timeout=30_000){await browser.waitUntil(async()=>(await browser.$("body").getText()).includes(text),{timeout,timeoutMsg:`UI text did not appear: ${text}`});}

async function launchInstance(label,dataRoot,webdriverPort){
  await mkdir(dataRoot,{recursive:true});
  const child=spawnTracked(binary,[`--simplevtt-data-root=${dataRoot}`,`--simplevtt-instance-label=${label}`],{env:{...process.env,SIMPLEVTT_LOCAL_DATA_ROOT:dataRoot,SIMPLEVTT_INSTANCE_LABEL:label,TAURI_WEBDRIVER_PORT:String(webdriverPort)}});
  await waitForPort(webdriverPort,`${label} WebDriver`);
  const browser=await remote({hostname:"127.0.0.1",port:webdriverPort,logLevel:"error",capabilities:{}});browsers.push(browser);
  await browser.waitUntil(async()=>{const body=await browser.$("body").getText();if(body.includes("TABLETOP, YOUR WAY"))return true;return (await browser.$(exactButton("선택 저장 · Home으로"))).isExisting();},{timeout:30_000});
  const finish=await browser.$(exactButton("선택 저장 · Home으로"));
  if(await finish.isExisting()){await click(browser,"//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]");await finish.waitForEnabled({timeout:10_000});await finish.click();}
  await waitForText(browser,"TABLETOP, YOUR WAY");
  return{label,browser,dataRoot,webdriverPort,child,stopped:false};
}
async function stopInstance(instance){if(instance.stopped)return;try{await instance.browser.deleteSession();}catch{}if(instance.child.pid&&instance.child.exitCode===null)spawnSync("taskkill.exe",["/PID",String(instance.child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});instance.stopped=true;}

async function completeVisibleCharacterChoices(browser){
  for(let attempt=0;attempt<120;attempt+=1){
    const r=await browser.execute(()=>{for(const section of document.querySelectorAll(".focused-create-stage .create-v09-section")){if(section.querySelector(".create-status-pill")?.textContent?.trim()!=="선택 필요")continue;const items=[...section.querySelectorAll(".dynamic-choice-grid .create-option-card, .equipment-options .create-option-card, .spell-choice-grid button, .proficiency-grid button")].filter((x)=>!x.disabled&&x.getAttribute("aria-disabled")!=="true"&&!x.classList.contains("selected")&&!x.querySelector(".selected"));const target=items[0];if(target instanceof HTMLElement){const before=section.textContent;target.scrollIntoView({block:"center"});target.click();return{clicked:true,id:section.id,before};}}return{clicked:false,unresolved:[...document.querySelectorAll(".focused-create-stage .create-v09-section")].filter((s)=>s.querySelector(".create-status-pill")?.textContent?.trim()==="선택 필요").map((s)=>s.id)};});
    if(!r.clicked)return r.unresolved;
    await browser.waitUntil(async()=>browser.execute(({id,before})=>document.getElementById(id)?.textContent!==before,{id:r.id,before:r.before}),{timeout:15_000});
  }
  throw new Error("Character choices exceeded 120 UI clicks");
}
async function openCharacterTab(browser,label,id){await click(browser,`//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`);await browser.$(`//section[@id=${JSON.stringify(id)}]`).waitForDisplayed({timeout:15_000});}
async function createSavedPlayerCharacter(instance,name){
  await click(instance.browser,navButton("캐릭터"));
  await click(instance.browser,"//article[contains(@class,'character-card-entry')][.//h2[normalize-space(.)='Aelar']]//button[normalize-space(.)='복제']");
  await openCharacterTab(instance.browser,"정체성","identity");await replaceValue(instance.browser,labelControl("캐릭터 이름"),name);
  for(const [tab,id] of [["정체성","identity"],["종족","species"],["클래스","class"],["배경","background"]]){await openCharacterTab(instance.browser,tab,id);assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[]);}
  await openCharacterTab(instance.browser,"능력치","abilities");await click(instance.browser,"//section[@id='abilities']//button[contains(normalize-space(.),'파이터 추천 배치')]");
  await openCharacterTab(instance.browser,"기술","proficiencies");assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[]);
  await openCharacterTab(instance.browser,"검토","review");await click(instance.browser,exactButton("모험 시작"));await waitForText(instance.browser,name);
  return (await runtimeDetails(instance)).activeCharacter;
}
async function createHostCampaign(host){const name="W5-01 Windows Campaign";await click(host.browser,navButton("캠페인"));const body=await host.browser.$("body").getText();await click(host.browser,exactButton(body.includes("아직 캠페인이 없습니다.")?"새 캠페인 만들기":"새 캠페인"));await replaceValue(host.browser,labelControl("캠페인 이름"),name);await click(host.browser,exactButton("캠페인 만들기"));await waitForText(host.browser,name);return name;}

async function runtimeDetails(instance){
  const r=await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts"),import("/src/app/connectedSessionState.ts"),import("/src/app/characterSessionProjectionRegistry.ts"),import("/src/app/sessionImageHandoutRuntimeAdapter.ts")]).then(([{mockAdapter},connected,stateModule,registry,handout])=>{const s=connected.connectedInternal(mockAdapter);const state=stateModule.connectedStateFor(mockAdapter);const h=handout.getSessionImageHandoutState(mockAdapter);done({role:s.session.role,lifecycle:s.session.lifecycle,connectionState:s.connectionState,compatibility:s.session.compatibility,compatibilityMessage:s.session.compatibilityMessage,name:s.session.name,address:s.session.address,sessionMode:s.sessionMode,round:s.scene.round,currentActorId:s.scene.selectedActorId,participants:s.session.participants.map((p)=>({id:p.id,name:p.name,characterName:p.characterName,state:p.state,ready:Boolean(p.ready)})),activeCharacter:{id:s.activeCharacter.id,name:s.activeCharacter.name,rulesProfileId:s.activeCharacter.rulesProfileId},characters:s.characters.map((c)=>({id:c.id,name:c.name})),activeCampaignId:s.activeCampaignId??null,campaignSessionSnapshot:s.campaignSessionSnapshot?{campaignId:s.campaignSessionSnapshot.campaignId}:null,sessionId:state.sessionId??null,sessionStarted:Boolean(state.sessionStarted),peerBindings:state.peerParticipants?.size??0,projectedCharacterIds:registry.projectedCharacterIds(mockAdapter),resolutionId:s.resolution?.id??null,handoutAsset:h.asset?.fileName??null});}).catch((e)=>done({error:String(e?.stack??e)}));});
  assert.ok(!r.error,r.error);return r;
}
async function waitParticipantState(instance,name,state){await instance.browser.waitUntil(async()=>(await runtimeDetails(instance)).participants.some((p)=>p.characterName===name&&p.state===state),{timeout:25_000,interval:150,timeoutMsg:`${name} did not become ${state}`});}

async function directPortInputs(browser){const inputs=await browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);assert.ok(inputs.length>=2,"direct network host/join port inputs missing");return inputs;}
async function openCampaignBoundHost(host,networkPort){
  await click(host.browser,navButton("세션"));await host.browser.$(direct).waitForDisplayed({timeout:20_000});
  await replaceValue(host.browser,labelControl("세션 이름","input",direct),"W5-01 Topology Session");
  await replaceValue(host.browser,labelControl("Bind / Listen IP","input",direct),"127.0.0.1");
  const ports=await directPortInputs(host.browser);await ports[0].setValue(String(networkPort));
  await click(host.browser,`${direct}//button[normalize-space(.)='세션 열기']`);
  await host.browser.waitUntil(async()=>{const s=await runtimeDetails(host);return s.role==="host"&&s.lifecycle==="preparing"&&s.connectionState==="connected";},{timeout:30_000});
}
async function prepareJoin(client,networkPort,characterName){
  await click(client.browser,navButton("세션"));await client.browser.$(direct).waitForDisplayed({timeout:20_000});
  const select=await client.browser.$(`${direct}//label[.//span[normalize-space(.)='플레이 Character']]//select`);await select.waitForDisplayed({timeout:15_000});
  const options=await select.$$("option");let index=-1;for(let i=0;i<options.length;i+=1){if((await options[i].getText()).trim()===characterName){index=i;break;}}assert.ok(index>=0,`${client.label} Character ${characterName} missing`);await select.selectByIndex(index);
  await replaceValue(client.browser,labelControl("Host IP / 주소","input",direct),"127.0.0.1");const ports=await directPortInputs(client.browser);await ports[1].setValue(String(networkPort));
}
async function joinPrepared(client){await click(client.browser,`${direct}//button[normalize-space(.)='참가하기']`);}
async function joinClient(client,networkPort,characterName){await prepareJoin(client,networkPort,characterName);await joinPrepared(client);await client.browser.waitUntil(async()=>{const s=await runtimeDetails(client);return s.role==="client"&&s.connectionState==="connected"&&s.compatibility!=="incompatible";},{timeout:30_000});}
async function saveEvidence(instance,suffix){const base=instance.label.replace(/\s+/g,"-").toLowerCase();try{await writeFile(path.join(artifactRoot,`${base}-${suffix}.png`),await instance.browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`${base}-${suffix}.txt`),await instance.browser.$("body").getText(),"utf8");}catch{}}

async function run(){
  assert.equal(process.platform,"win32");assert.ok(existsSync(binary));await mkdir(artifactRoot,{recursive:true});await ensureVite();
  const host=await launchInstance("W5 Host",path.join(runRoot,"host"),await reservePort());const p1=await launchInstance("W5 P1",path.join(runRoot,"p1"),await reservePort());const p2=await launchInstance("W5 P2",path.join(runRoot,"p2"),await reservePort());const rejected=await launchInstance("W5 Reject",path.join(runRoot,"reject"),await reservePort());
  const p1Character=await createSavedPlayerCharacter(p1,"W5 P1 Hero");const p2Character=await createSavedPlayerCharacter(p2,"W5 P2 Hero");const rejectedCharacter=await createSavedPlayerCharacter(rejected,"W5 Reject Hero");const campaignName=await createHostCampaign(host);const networkPort=await reservePort();

  await openCampaignBoundHost(host,networkPort);const a01=await runtimeDetails(host);assert.equal(a01.activeCampaignId,a01.campaignSessionSnapshot?.campaignId);assert.equal(a01.role,"host");assert.equal(a01.lifecycle,"preparing");assert.equal(a01.connectionState,"connected");assert.ok(a01.address);

  await click(rejected.browser,navButton("세션"));await rejected.browser.$(direct).waitForDisplayed({timeout:20_000});await replaceValue(rejected.browser,labelControl("Host IP / 주소","input",direct),"127.0.0.1");let rejectPorts=await directPortInputs(rejected.browser);await rejectPorts[1].setValue(String(networkPort));const invalidJoin=await rejected.browser.$(`${direct}//button[normalize-space(.)='참가하기']`);assert.equal(await invalidJoin.isEnabled(),false);const a04Host=await runtimeDetails(host);assert.equal(a04Host.participants.length,a01.participants.length);

  const rejectSelect=await rejected.browser.$(`${direct}//label[.//span[normalize-space(.)='플레이 Character']]//select`);const rejectOptions=await rejectSelect.$$("option");let rejectIndex=-1;for(let i=0;i<rejectOptions.length;i+=1){if((await rejectOptions[i].getText()).trim()===rejectedCharacter.name){rejectIndex=i;break;}}assert.ok(rejectIndex>=0);await rejectSelect.selectByIndex(rejectIndex);
  const mismatch=await rejected.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(([{mockAdapter},{connectedInternal}])=>{connectedInternal(mockAdapter).activeCharacter.rulesProfileId="rules.w5.incompatible";done(true);}).catch((e)=>done({error:String(e?.stack??e)}));});assert.equal(mismatch,true);await joinPrepared(rejected);await rejected.browser.waitUntil(async()=>{const s=await runtimeDetails(rejected);return s.compatibility==="incompatible"&&s.connectionState==="disconnected";},{timeout:30_000});const a05Rejected=await runtimeDetails(rejected);const a05Host=await runtimeDetails(host);assert.equal(a05Host.participants.length,a01.participants.length);

  await joinClient(p1,networkPort,p1Character.name);await waitParticipantState(host,p1Character.name,"connected");const a02Host=await runtimeDetails(host);const a02P1=await runtimeDetails(p1);assert.equal(a02Host.characters.some((c)=>c.id===p1Character.id),false);assert.ok(a02Host.projectedCharacterIds.includes(p1Character.id));assert.ok(a02P1.characters.some((c)=>c.id===p1Character.id));const p1ProjectionBefore=[...a02Host.projectedCharacterIds];
  await joinClient(p2,networkPort,p2Character.name);await waitParticipantState(host,p2Character.name,"connected");const a03Host=await runtimeDetails(host);const a03P1=await runtimeDetails(p1);const a03P2=await runtimeDetails(p2);const hostIds=a03Host.participants.map((p)=>p.id).sort();assert.deepEqual(a03P1.participants.map((p)=>p.id).sort(),hostIds);assert.deepEqual(a03P2.participants.map((p)=>p.id).sort(),hostIds);assert.ok(a03Host.projectedCharacterIds.includes(p1Character.id)&&p1ProjectionBefore.includes(p1Character.id));

  await click(p1.browser,exactButton("Ready"));await click(p2.browser,exactButton("Ready"));await host.browser.waitUntil(async()=>(await runtimeDetails(host)).participants.filter((p)=>p.id!=="host").every((p)=>p.ready),{timeout:20_000});await click(host.browser,exactButton("플레이 시작"));for(const i of [host,p1,p2])await i.browser.waitUntil(async()=>(await runtimeDetails(i)).lifecycle==="live",{timeout:30_000});const [a06Host,a06P1,a06P2]=await Promise.all([host,p1,p2].map(runtimeDetails));assert.equal(a06P1.sessionMode,a06Host.sessionMode);assert.equal(a06P2.sessionMode,a06Host.sessionMode);assert.equal(a06P1.round,a06Host.round);assert.equal(a06P2.round,a06Host.round);assert.equal(a06P1.currentActorId,a06Host.currentActorId);assert.equal(a06P2.currentActorId,a06Host.currentActorId);

  const a10Before=await runtimeDetails(p1);await click(p1.browser,exactButton("← 제품"));await p1.browser.$("//*[@data-connected-surface='product']").waitForDisplayed({timeout:20_000});await click(p1.browser,navButton("홈"));const a10Product=await runtimeDetails(p1);assert.equal(a10Product.sessionId,a10Before.sessionId);assert.equal(a10Product.connectionState,"connected");assert.equal(a10Product.lifecycle,"live");await click(p1.browser,exactButton("플레이로 돌아가기"));await p1.browser.$("//*[@data-connected-surface='play']").waitForDisplayed({timeout:20_000});const a10After=await runtimeDetails(p1);assert.equal(a10After.sessionId,a10Before.sessionId);assert.equal(a10After.round,a10Before.round);assert.equal(a10After.currentActorId,a10Before.currentActorId);

  await click(p2.browser,"//header[contains(@class,'session-reference-play-chrome')]//button[normalize-space(.)='세션']");await p2.browser.$("aside[aria-label='Player 세션 연결']").waitForDisplayed({timeout:20_000});await click(p2.browser,"//aside[@aria-label='Player 세션 연결']//button[normalize-space(.)='세션 나가기']");await waitParticipantState(host,p2Character.name,"disconnected");const a07Host=await runtimeDetails(host);const a07P2=await runtimeDetails(p2);assert.ok(a07Host.participants.some((p)=>p.characterName===p2Character.name&&p.state==="disconnected"));assert.ok(a07P2.characters.some((c)=>c.id===p2Character.id));

  await click(host.browser,"//aside[@aria-label='Host 라이브 세션 상태']//button[normalize-space(.)='세션 종료']");await host.browser.waitUntil(async()=>{const s=await runtimeDetails(host);return s.role==="offline"&&s.lifecycle!=="live";},{timeout:30_000});await p1.browser.waitUntil(async()=>{const s=await runtimeDetails(p1);return s.lifecycle!=="live"&&s.connectionState==="disconnected";},{timeout:30_000});await click(host.browser,navButton("캠페인"));await waitForText(host.browser,campaignName);await host.browser.$("//article[.//h3[normalize-space(.)='세션 기록']]//strong[normalize-space(.)='1회']").waitForDisplayed({timeout:30_000});const a08Host=await runtimeDetails(host);const a08P1=await runtimeDetails(p1);

  await saveEvidence(host,"a01-a08");await saveEvidence(p1,"a01-a08");await saveEvidence(p2,"a01-a08");await saveEvidence(rejected,"a04-a05");const hostDataRoot=host.dataRoot;await stopInstance(host);const restarted=await launchInstance("W5 Host Restart",hostDataRoot,await reservePort());await click(restarted.browser,navButton("캠페인"));await waitForText(restarted.browser,campaignName);await restarted.browser.$("//article[.//h3[normalize-space(.)='세션 기록']]//strong[normalize-space(.)='1회']").waitForDisplayed({timeout:30_000});const a09=await runtimeDetails(restarted);assert.equal(a09.role,"offline");assert.equal(a09.sessionStarted,false);assert.equal(a09.peerBindings,0);assert.equal(a09.projectedCharacterIds.length,0);assert.equal(a09.resolutionId,null);assert.equal(a09.handoutAsset,null);assert.equal(a09.participants.filter((p)=>p.id!=="host").length,0);await saveEvidence(restarted,"a09-restart");

  const evidence={gate:"W5-01",scope:Array.from({length:10},(_,i)=>`MP-A${String(i+1).padStart(2,"0")}`),status:"PASS",verificationSha,windowsTauri:true,scenarios:{"MP-A01":{status:"PASS",campaignId:a01.activeCampaignId,sessionId:a01.sessionId,address:a01.address},"MP-A02":{status:"PASS",characterId:p1Character.id,hostDurableCopy:false,ephemeralProjection:true,playerDurableOwner:true},"MP-A03":{status:"PASS",participantIds:hostIds,p1ProjectionPreserved:true},"MP-A04":{status:"PASS",joinBlocked:true,hostRosterUnchanged:true},"MP-A05":{status:"PASS",compatibility:a05Rejected.compatibility,message:a05Rejected.compatibilityMessage,hostRosterUnchanged:true},"MP-A06":{status:"PASS",mode:a06Host.sessionMode,round:a06Host.round,currentActorId:a06Host.currentActorId},"MP-A07":{status:"PASS",hostParticipantState:"disconnected",durableCharacterPreserved:true},"MP-A08":{status:"PASS",hostLifecycle:a08Host.lifecycle,clientLifecycle:a08P1.lifecycle,campaignSummary:"1회"},"MP-A09":{status:"PASS",role:a09.role,peerBindings:a09.peerBindings,projectedCharacters:a09.projectedCharacterIds.length,staleParticipants:0,staleResolution:a09.resolutionId,staleHandout:a09.handoutAsset,campaignSummary:"1회"},"MP-A10":{status:"PASS",sessionId:a10After.sessionId,connectionState:a10After.connectionState,round:a10After.round,currentActorId:a10After.currentActorId}},characters:{p1:p1Character,p2:p2Character,rejected:rejectedCharacter}};await writeFile(path.join(artifactRoot,"w5-01.json"),JSON.stringify(evidence,null,2),"utf8");log(`MP-A01..MP-A10 Windows topology acceptance PASS · ${artifactRoot}`);
}
async function cleanup(){for(const browser of browsers.reverse()){try{await browser.deleteSession();}catch{}}for(const child of children.reverse()){if(child.pid&&child.exitCode===null)spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}}
let exitCode=0;try{await run();}catch(error){exitCode=1;log(`FAILED: ${error instanceof Error?error.stack??error.message:String(error)}`);for(const [i,browser] of browsers.entries()){try{await writeFile(path.join(artifactRoot,`failure-${i+1}.png`),await browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`failure-${i+1}.txt`),await browser.$("body").getText(),"utf8");}catch{}}}finally{await cleanup();}process.exitCode=exitCode;
