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
      done({activeCharacterId:snapshot.activeCharacter.id,activeCharacterName:snapshot.activeCharacter.name,role:snapshot.session.role,connectionState:snapshot.connectionState,currentActorId:snapshot.scene.currentActorId,entities:snapshot.scene.entities.map((entry)=>({id:entry.id,name:entry.name,kind:entry.kind,hp:entry.hp,maxHp:entry.maxHp,side:entry.side})),resolution:snapshot.resolution?{id:snapshot.resolution.id,stage:snapshot.resolution.stage,finalOutcome:snapshot.resolution.finalOutcome,provenance:snapshot.resolution.provenance,stateChanges:snapshot.resolution.stateChanges}:null,participants:snapshot.session.participants.map((entry)=>({id:entry.id,characterName:entry.characterName,state:entry.state})),compatibilityMessage:snapshot.session.compatibilityMessage});
    }).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);return result;
}

function entityHp(snapshot,entityId){return snapshot.entities.find((entry)=>entry.id===entityId)?.hp??null;}
function entityById(snapshot,entityId){return snapshot.entities.find((entry)=>entry.id===entityId)??null;}

async function waitForEntity(instance,entityId){
  await instance.browser.waitUntil(async()=>{const snapshot=await runtimeSnapshot(instance);return snapshot.entities.some((entry)=>entry.id===entityId);},{timeout:20_000,interval:150,timeoutMsg:`${instance.label} did not receive entity ${entityId}`});
  return runtimeSnapshot(instance);
}

async function waitForEntityHp(instance,entityId,hp){
  await instance.browser.waitUntil(async()=>entityHp(await runtimeSnapshot(instance),entityId)===hp,{timeout:20_000,interval:150,timeoutMsg:`${instance.label} did not converge ${entityId} to HP ${hp}`});
  return runtimeSnapshot(instance);
}

async function snapshotLeakFlags(instance,needles){
  const result=await instance.browser.executeAsync((values,done)=>{
    import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{
      const serialized=JSON.stringify(await mockAdapter.getSnapshot());done({flags:Object.fromEntries(values.map((value)=>[value,serialized.includes(value)]))});
    }).catch((error)=>done({error:String(error?.stack??error)}));
  },needles);
  assert.ok(!result.error,result.error);return result.flags;
}

async function clientOwnsActor(instance,actorId){
  const result=await instance.browser.executeAsync((id,done)=>{
    import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();done({owns:snapshot.characters.some((entry)=>entry.id===id),activeCharacterId:snapshot.activeCharacter.id});}).catch((error)=>done({error:String(error?.stack??error)}));
  },actorId);
  assert.ok(!result.error,result.error);return result;
}

async function materializeHostLibraryActors(host,p1,p2){
  const privateNeedles=["W4-G01-PRIVATE-SOURCE","W4-G01-PRIVATE-TAG","W4-G02-PRIVATE-SOURCE","W4-G02-PRIVATE-TAG"];
  const result=await host.browser.executeAsync((done)=>{
    (async()=>{
      const {mockAdapter}=await import("/src/app/mockAdapter.ts");
      const initial=await mockAdapter.getSnapshot();const campaign=initial.campaigns?.find((entry)=>entry.name==="W4-07 Windows 검증 캠페인");if(!campaign)throw new Error("W4-07 Campaign was not found");
      const npcEntry={entryId:"w4.g01.npc",kind:"npc-definition",label:"W4 공개 경비병",definitionId:"local.w4.g01.guard",favorite:true,tags:["W4-G01-PRIVATE-TAG"],npcDefinition:{definitionId:"local.w4.g01.guard",name:"W4 공개 경비병",nameEn:"W4 Public Guard",ac:16,maxHp:18,actions:["창"],statusImmunities:[],source:"W4-G01-PRIVATE-SOURCE",version:"1"}};
      const pcEntry={entryId:"w4.g02.pc",kind:"pc-preset",label:"W4 호위 기사",definitionId:"local.w4.g02.guard",favorite:true,tags:["W4-G02-PRIVATE-TAG"],pcPreset:{definitionId:"local.w4.g02.guard",name:"W4 호위 기사",level:3,ac:17,maxHp:28,actions:["장검"],statusImmunities:[],source:"W4-G02-PRIVATE-SOURCE",version:"1"}};
      await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,npcEntry);await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,pcEntry);
      const before=await mockAdapter.getSnapshot();
      let snapshot=await mockAdapter.instantiateCampaignDmLibraryNpcDefinition(campaign.campaignId,npcEntry.entryId);const npc=snapshot.scene.entities.find((entry)=>entry.id.startsWith("local.w4.g01.guard.instance-"));
      snapshot=await mockAdapter.instantiateCampaignDmLibraryPcPreset(campaign.campaignId,pcEntry.entryId);const pc=snapshot.scene.entities.find((entry)=>entry.id.startsWith("local.w4.g02.guard.instance-"));
      const finalCampaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaign.campaignId);const npcSource=finalCampaign?.dmLibrary.entries.find((entry)=>entry.entryId===npcEntry.entryId);const pcSource=finalCampaign?.dmLibrary.entries.find((entry)=>entry.entryId===pcEntry.entryId);
      return {campaignId:campaign.campaignId,npcActor:npc?{id:npc.id,name:npc.name,kind:npc.kind,side:npc.side,hp:npc.hp,maxHp:npc.maxHp}:null,pcActor:pc?{id:pc.id,name:pc.name,kind:pc.kind,side:pc.side,hp:pc.hp,maxHp:pc.maxHp}:null,characterIdsBefore:before.characters.map((entry)=>entry.id),characterIdsAfter:snapshot.characters.map((entry)=>entry.id),npcSource:{source:npcSource?.npcDefinition?.source,tags:npcSource?.tags,favorite:npcSource?.favorite},pcSource:{source:pcSource?.pcPreset?.source,tags:pcSource?.tags,favorite:pcSource?.favorite}};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);assert.ok(result.npcActor,"G01 NPC did not materialize");assert.ok(result.pcActor,"G02 PC preset did not materialize");
  assert.equal(result.npcActor.kind,"combatant");assert.equal(result.npcActor.side,"enemy");assert.equal(result.npcActor.hp,18);assert.equal(result.npcActor.maxHp,18);assert.equal(result.npcSource.source,"W4-G01-PRIVATE-SOURCE");assert.deepEqual(result.npcSource.tags,["W4-G01-PRIVATE-TAG"]);assert.equal(result.npcSource.favorite,true);
  assert.equal(result.pcActor.kind,"combatant");assert.equal(result.pcActor.side,"ally");assert.equal(result.pcActor.hp,28);assert.equal(result.pcActor.maxHp,28);assert.equal(result.pcSource.source,"W4-G02-PRIVATE-SOURCE");assert.deepEqual(result.pcSource.tags,["W4-G02-PRIVATE-TAG"]);assert.equal(result.pcSource.favorite,true);assert.deepEqual(result.characterIdsAfter,result.characterIdsBefore,"G02 must not create a Player-owned Character");
  const p1Npc=await waitForEntity(p1,result.npcActor.id);const p2Npc=await waitForEntity(p2,result.npcActor.id);const p1Pc=await waitForEntity(p1,result.pcActor.id);const p2Pc=await waitForEntity(p2,result.pcActor.id);
  const p1Leaks=await snapshotLeakFlags(p1,privateNeedles);const p2Leaks=await snapshotLeakFlags(p2,privateNeedles);for(const value of privateNeedles){assert.equal(p1Leaks[value],false,`P1 leaked private DM Library metadata: ${value}`);assert.equal(p2Leaks[value],false,`P2 leaked private DM Library metadata: ${value}`);}
  const p1Ownership=await clientOwnsActor(p1,result.pcActor.id);const p2Ownership=await clientOwnsActor(p2,result.pcActor.id);assert.equal(p1Ownership.owns,false,"P1 must not own G02 PC-preset Actor as a Character");assert.equal(p2Ownership.owns,false,"P2 must not own G02 PC-preset Actor as a Character");
  return {...result,p1Npc:entityById(p1Npc,result.npcActor.id),p2Npc:entityById(p2Npc,result.npcActor.id),p1Pc:entityById(p1Pc,result.pcActor.id),p2Pc:entityById(p2Pc,result.pcActor.id),p1Leaks,p2Leaks,p1Ownership,p2Ownership};
}

async function materializeHostCustomJson(host,p1,p2){
  const result=await host.browser.executeAsync((done)=>{
    (async()=>{
      const [{mockAdapter},{parseCampaignDmLibraryJson}]=await Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/campaignDmLibraryImport.ts")]);
      const initial=await mockAdapter.getSnapshot();const campaign=initial.campaigns?.find((entry)=>entry.name==="W4-07 Windows 검증 캠페인");if(!campaign)throw new Error("W4-07 Campaign was not found");
      let sequence=0;const context={campaignId:campaign.campaignId,campaignName:campaign.name,createEntryId:()=>`w4.g03.generated.${++sequence}`};
      const imageDataUrl="data:image/png;base64,AA==";
      const entries=parseCampaignDmLibraryJson(JSON.stringify([
        {kind:"custom-item",entryId:"w4.g03.item",label:"폭풍 왕관",definitionId:"local.w4.g03.storm-crown",favorite:true,tags:["W4-G03-ITEM"],itemTemplate:{name:"폭풍 왕관",nameEn:"Storm Crown",kind:"magic",attunementRequired:true,charges:{current:3,max:5},passiveEffects:["번개 저항"],grantedActionIds:["action.storm-bolt"],provenance:["W4-G03-PROVENANCE"]}},
        {kind:"npc-definition",entryId:"w4.g03.npc",label:"달 사제",definitionId:"local.w4.g03.moon-priest",npcDefinition:{definitionId:"local.w4.g03.moon-priest",name:"달 사제",nameEn:"Moon Priest",ac:14,maxHp:27,actions:["월광 광선"],statusImmunities:["매혹"],source:"W4-G03-NPC-SOURCE",version:"2"}},
        {kind:"image",entryId:"w4.g03.image",label:"비밀 지도",favorite:true,tags:["W4-G03-IMAGE"],imageAsset:{mimeType:"image/png",dataUrl:imageDataUrl,byteLength:1,fileName:"w4-secret-map.png"}},
      ]),context);
      for(const entry of entries)await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,entry);
      let snapshot=await mockAdapter.getSnapshot();const currentCampaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaign.campaignId);const item=currentCampaign?.dmLibrary.entries.find((entry)=>entry.entryId==="w4.g03.item");const npc=currentCampaign?.dmLibrary.entries.find((entry)=>entry.entryId==="w4.g03.npc");const image=currentCampaign?.dmLibrary.entries.find((entry)=>entry.entryId==="w4.g03.image");
      snapshot=await mockAdapter.instantiateCampaignDmLibraryNpcDefinition(campaign.campaignId,"w4.g03.npc");const actor=snapshot.scene.entities.find((entry)=>entry.id.startsWith("local.w4.g03.moon-priest.instance-"));
      const rejected={};
      for(const [key,payload] of Object.entries({script:{kind:"custom-item",label:"실행 아이템",definitionId:"local.w4.g03.exec",itemTemplate:{name:"실행 아이템",kind:"magic",passiveEffects:[],grantedActionIds:[],provenance:[],script:"globalThis.pwned=true"}},onSpawn:{kind:"npc-definition",label:"실행 NPC",definitionId:"local.w4.g03.exec-npc",npcDefinition:{definitionId:"local.w4.g03.exec-npc",name:"실행 NPC",ac:10,maxHp:5,actions:[],statusImmunities:[],onSpawn:"eval(payload)"}},html:{kind:"image",label:"HTML",imageAsset:{dataUrl:"data:text/html;base64,PHNjcmlwdD4="}}})){
        try{parseCampaignDmLibraryJson(JSON.stringify(payload),context);rejected[key]="NOT_REJECTED";}catch(error){rejected[key]=String(error instanceof Error?error.message:error);}
      }
      return {item:{attunementRequired:item?.itemTemplate?.attunementRequired,charges:item?.itemTemplate?.charges,grantedActionIds:item?.itemTemplate?.grantedActionIds,provenance:item?.itemTemplate?.provenance},npc:{source:npc?.npcDefinition?.source,version:npc?.npcDefinition?.version,maxHp:npc?.npcDefinition?.maxHp},image:image?.imageAsset,actor:actor?{id:actor.id,name:actor.name,kind:actor.kind,side:actor.side,hp:actor.hp,maxHp:actor.maxHp}:null,rejected};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);assert.deepEqual(result.item.charges,{current:3,max:5});assert.equal(result.item.attunementRequired,true);assert.deepEqual(result.item.grantedActionIds,["action.storm-bolt"]);assert.deepEqual(result.item.provenance,["W4-G03-PROVENANCE"]);
  assert.equal(result.npc.source,"W4-G03-NPC-SOURCE");assert.equal(result.npc.version,"2");assert.equal(result.npc.maxHp,27);assert.deepEqual(result.image,{mimeType:"image/png",dataUrl:"data:image/png;base64,AA==",byteLength:1,fileName:"w4-secret-map.png"});
  assert.ok(result.actor,"G03 NPC did not materialize");assert.equal(result.actor.maxHp,27);assert.equal(result.actor.hp,27);assert.equal(result.actor.side,"enemy");for(const value of Object.values(result.rejected)){assert.notEqual(value,"NOT_REJECTED","G03 unsafe JSON must reject");}
  const p1Npc=await waitForEntity(p1,result.actor.id);const p2Npc=await waitForEntity(p2,result.actor.id);return {...result,p1Actor:entityById(p1Npc,result.actor.id),p2Actor:entityById(p2Npc,result.actor.id)};
}

async function materializeHostRangedNpc(host,p1,p2){
  const result=await host.browser.executeAsync((done)=>{
    import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{
      const snapshot=await mockAdapter.instantiateCombatant("combatant.goblin");
      const actor=snapshot.scene.entities.find((entry)=>entry.id.startsWith("combatant.goblin.instance-"));
      const action=actor?snapshot.scene.actionsByActor[actor.id]?.find((entry)=>entry.resolutionKind==="attack"&&entry.runtimeAttack&&entry.runtimeAttack.rangeFeet>5):undefined;
      done(actor&&action?{actorId:actor.id,actorName:actor.name,actionId:action.id,actionName:action.name,rangeFeet:action.runtimeAttack.rangeFeet,hp:actor.hp}:{error:"Host goblin ranged action was not materialized"});
    }).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);await waitForEntity(p1,result.actorId);await waitForEntity(p2,result.actorId);return result;
}

async function runHostRangedAttack(host,{actorId,actionId,targetId,distanceFeet}){
  const result=await host.browser.executeAsync((input,done)=>{
    (async()=>{
      const [{mockAdapter},{connectedInternal},{setSpatialRelation,spatialPairKey},{resolveRuntimeAttackTargetingFact}]=await Promise.all([
        import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts"),import("/src/app/spatialRuntimeContracts.ts"),import("/src/app/realRuntimeAttackFactProvider.ts"),
      ]);
      const app=connectedInternal(mockAdapter);const key=spatialPairKey(input.actorId,input.targetId);app.scene.spatialByPair??={};
      if(input.distanceFeet===null)delete app.scene.spatialByPair[key];
      else setSpatialRelation(app.scene,{sourceId:input.actorId,targetId:input.targetId,distanceFeet:input.distanceFeet,visible:true,cover:"none",targetCanSeeAttacker:true,withinReach:true,provenance:`module:w4-07-windows:spatial:${input.distanceFeet}`});
      await mockAdapter.endInitiative();await mockAdapter.startInitiative();await mockAdapter.setCurrentActor(input.actorId);await mockAdapter.setQueuedD20(19);
      const fact=resolveRuntimeAttackTargetingFact(app.scene,input.actorId,input.targetId);const before=(await mockAdapter.getSnapshot()).scene.entities.find((entry)=>entry.id===input.targetId)?.hp??null;
      let snapshot=await mockAdapter.resolveAction(input.actionId,[input.targetId]);
      for(let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance;step+=1)snapshot=await mockAdapter.advanceResolution();
      snapshot=await mockAdapter.getSnapshot();const after=snapshot.scene.entities.find((entry)=>entry.id===input.targetId)?.hp??null;
      return {fact,beforeHp:before,afterHp:after,resolution:snapshot.resolution?{id:snapshot.resolution.id,stage:snapshot.resolution.stage,finalOutcome:snapshot.resolution.finalOutcome,provenance:snapshot.resolution.provenance,stateChanges:snapshot.resolution.stateChanges}:null,compatibilityMessage:snapshot.session.compatibilityMessage};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  },{actorId,actionId,targetId,distanceFeet});
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

  const library=await materializeHostLibraryActors(host,p1,p2);
  const customJson=await materializeHostCustomJson(host,p1,p2);
  const npc=await materializeHostRangedNpc(host,p1,p2);

  const g08=await runHostRangedAttack(host,{actorId:npc.actorId,actionId:npc.actionId,targetId:p1Character.id,distanceFeet:null});
  assert.equal(g08.fact.authority,"manual-unconstrained");assert.equal("distanceFeet" in g08.fact,false,"G08 must not fabricate distance");assert.equal(g08.resolution?.stage,"complete",JSON.stringify(g08));assert.ok(g08.afterHp<g08.beforeHp,"G08 ranged attack should not be falsely rejected without a provider");
  const p1AfterG08=await waitForEntityHp(p1,p1Character.id,g08.afterHp);const p2AfterG08=await waitForEntityHp(p2,p1Character.id,g08.afterHp);

  const g09Rejected=await runHostRangedAttack(host,{actorId:npc.actorId,actionId:npc.actionId,targetId:p1Character.id,distanceFeet:90});
  assert.equal(g09Rejected.fact.authority,"authoritative");assert.equal(g09Rejected.fact.distanceFeet,90);assert.ok(g09Rejected.fact.provenance.includes("module:w4-07-windows:spatial:90"));assert.equal(g09Rejected.afterHp,g09Rejected.beforeHp,"out-of-range provider fact must not mutate HP");assert.equal(g09Rejected.resolution?.stage,"complete",JSON.stringify(g09Rejected));assert.match(g09Rejected.resolution?.finalOutcome??"",/^적용 거부: beyond range 80 ft$/);assert.deepEqual(g09Rejected.resolution?.stateChanges??[],[]);
  assert.equal(entityHp(await runtimeSnapshot(p1),p1Character.id),g09Rejected.beforeHp);assert.equal(entityHp(await runtimeSnapshot(p2),p1Character.id),g09Rejected.beforeHp);

  const g09Accepted=await runHostRangedAttack(host,{actorId:npc.actorId,actionId:npc.actionId,targetId:p1Character.id,distanceFeet:20});
  assert.equal(g09Accepted.fact.authority,"authoritative");assert.equal(g09Accepted.fact.distanceFeet,20);assert.ok(g09Accepted.fact.provenance.includes("module:w4-07-windows:spatial:20"));assert.equal(g09Accepted.resolution?.stage,"complete",JSON.stringify(g09Accepted));assert.ok(g09Accepted.afterHp<g09Accepted.beforeHp,"in-range provider fact must allow Host mechanics validation");
  const p1AfterG09=await waitForEntityHp(p1,p1Character.id,g09Accepted.afterHp);const p2AfterG09=await waitForEntityHp(p2,p1Character.id,g09Accepted.afterHp);

  for(const instance of [host,p1,p2])await saveEvidence(instance,"g01-g03-g08-g09");
  const evidence={gate:"W4-07",scope:["MP-G01","MP-G02","MP-G03","MP-G08","MP-G09"],status:"PASS",verificationSha,windowsTauri:true,topology:{host:"DM Host",p1:p1Character.id,p2:p2Character.id,participantCount:(await runtimeSnapshot(host)).participants.length,hostActor:npc},scenarios:{"MP-G01":{status:"PASS",hostActor:library.npcActor,p1Actor:library.p1Npc,p2Actor:library.p2Npc,privateMetadataLeak:{p1:library.p1Leaks,p2:library.p2Leaks}},"MP-G02":{status:"PASS",hostActor:library.pcActor,p1Actor:library.p1Pc,p2Actor:library.p2Pc,hostCharacterIdsUnchanged:library.characterIdsBefore.length===library.characterIdsAfter.length,p1OwnsActor:library.p1Ownership.owns,p2OwnsActor:library.p2Ownership.owns},"MP-G03":{status:"PASS",item:customJson.item,npc:customJson.npc,image:customJson.image,hostActor:customJson.actor,p1Actor:customJson.p1Actor,p2Actor:customJson.p2Actor,unsafeRejected:customJson.rejected},"MP-G08":{status:"PASS",authority:g08.fact.authority,beforeHp:g08.beforeHp,afterHp:g08.afterHp,p1Hp:entityHp(p1AfterG08,p1Character.id),p2Hp:entityHp(p2AfterG08,p1Character.id)},"MP-G09":{status:"PASS",rejected:{distanceFeet:g09Rejected.fact.distanceFeet,provenance:g09Rejected.fact.provenance,finalOutcome:g09Rejected.resolution?.finalOutcome??"host resolution rejected before commit",hp:g09Rejected.afterHp},accepted:{distanceFeet:g09Accepted.fact.distanceFeet,provenance:g09Accepted.fact.provenance,finalOutcome:g09Accepted.resolution?.finalOutcome,beforeHp:g09Accepted.beforeHp,afterHp:g09Accepted.afterHp,p1Hp:entityHp(p1AfterG09,p1Character.id),p2Hp:entityHp(p2AfterG09,p1Character.id)}}}};
  await writeFile(path.join(artifactRoot,"w4-07-g01-g03-g08-g09.json"),JSON.stringify(evidence,null,2),"utf8");
  log(`MP-G01/G02/G03/G08/G09 Windows H+P1+P2 acceptance PASS · ${artifactRoot}`);
}

async function cleanup(){
  if(keepOpen){log(`--keep-open 지정됨 · 테스트 창과 ${viteStarted?"Vite 서버":"기존 Vite 서버"}를 유지합니다.`);return;}
  for(const browser of browsers.reverse()){try{await Promise.race([browser.deleteSession(),new Promise((resolve)=>setTimeout(resolve,3_000))]);}catch{}}
  for(const child of children.reverse()){if(!child.pid||child.exitCode!==null)continue;spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}
}

let exitCode=0;
try{await runScenario();}catch(error){exitCode=1;log(`실패: ${error instanceof Error?error.stack??error.message:String(error)}`);for(const [index,browser] of browsers.entries()){try{await writeFile(path.join(artifactRoot,`failure-${index+1}.png`),await browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`failure-${index+1}.txt`),await browser.$("body").getText(),"utf8");}catch{}}log(`실패 증거: ${artifactRoot}`);}finally{await cleanup();}
process.exitCode=exitCode;
