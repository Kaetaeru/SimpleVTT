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
const runRoot=path.join(root,".live-dev","tauri-e2e",`${runId}-w4-07-handout`);
const artifactRoot=path.join(runRoot,"artifacts");
const verificationSha=process.env.V1_VERIFICATION_SHA??process.env.GITHUB_SHA??"local";
const children=[];
const browsers=[];
let viteStarted=false;

function log(message){process.stdout.write(`[TAURI W4-07 HANDOUT] ${message}\n`);}

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

async function click(browser,selector,description=selector){
  const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.waitForEnabled({timeout:15_000,timeoutMsg:`${description} is disabled`});await element.click();
}

async function replaceValue(browser,selector,value,description=selector){
  const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.click();await element.setValue(value);assert.equal(await element.getValue(),String(value),`${description} did not accept input`);
}

async function waitForText(browser,text,timeout=20_000){
  await browser.waitUntil(async()=>(await browser.$("body").getText()).includes(text),{timeout,timeoutMsg:`UI text did not appear: ${text}`});
}

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
  await writeFile(path.join(artifactRoot,`${base}-${suffix}.png`),await instance.browser.takeScreenshot(),"base64");
  await writeFile(path.join(artifactRoot,`${base}-${suffix}.txt`),await instance.browser.$("body").getText(),"utf8");
}

async function setDistinctCharacter(instance,id,name){
  const result=await instance.browser.executeAsync((input,done)=>{
    Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{connectedInternal}])=>{
      const snapshot=await mockAdapter.getSnapshot();
      const character={...structuredClone(snapshot.activeCharacter),id:input.id,name:input.name,saveState:"saved"};
      const app=connectedInternal(mockAdapter);app.activeCharacter=structuredClone(character);app.characters=[...app.characters.filter((entry)=>entry.id!==input.id),structuredClone(character)];
      done({id:app.activeCharacter.id,name:app.activeCharacter.name});
    }).catch((error)=>done({error:String(error?.stack??error)}));
  },{id,name});
  assert.ok(!result.error,result.error);assert.equal(result.id,id);assert.equal(result.name,name);return result;
}

async function setupHostPrivateCampaign(host){
  const result=await host.browser.executeAsync((done)=>{
    (async()=>{
      await import("/src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts");
      const {mockAdapter}=await import("/src/app/mockAdapter.ts");
      const campaignId="campaign.w4.g04-g07.windows";
      const folderId="folder.g06.windows.private";
      const folderLabel="G06 WINDOWS HIDDEN VAULT";
      const entryId="dm-note.g06.windows.secret";
      const entryLabel="G06 WINDOWS HIDDEN NOTE";
      const noteText="G06-WINDOWS-NOTE-TEXT-SENTINEL";
      const tag="G06-WINDOWS-PRIVATE-TAG";
      await mockAdapter.createCampaign({campaignId,name:"W4-07 G04-G07 Windows Campaign"});
      await mockAdapter.upsertCampaignDmLibraryFolder(campaignId,{folderId,label:folderLabel});
      await mockAdapter.upsertCampaignDmLibraryEntry(campaignId,{entryId,kind:"note",label:entryLabel,folderId,favorite:true,tags:[tag],noteText});
      const snapshot=await mockAdapter.getSnapshot();const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaignId);const note=campaign?.dmLibrary.entries.find((entry)=>entry.entryId===entryId);
      return {campaignId,folderId,folderLabel,entryId,entryLabel,noteText,tag,hostHasNote:note?.noteText===noteText,hostFavorite:note?.favorite===true};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);assert.equal(result.hostHasNote,true);assert.equal(result.hostFavorite,true);return result;
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

async function runtimeSnapshot(instance){
  const result=await instance.browser.executeAsync((done)=>{
    import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();done({role:snapshot.session.role,connectionState:snapshot.connectionState,participants:snapshot.session.participants.map((entry)=>({id:entry.id,state:entry.state,characterName:entry.characterName}))});}).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);return result;
}

async function waitForTopology(host,count){
  await host.browser.waitUntil(async()=>{const snapshot=await runtimeSnapshot(host);return snapshot.participants.filter((entry)=>entry.state==="connected").length>=count;},{timeout:20_000,interval:150,timeoutMsg:`Host did not converge to ${count} connected participants`});
}

async function handoutState(instance){
  const result=await instance.browser.executeAsync((done)=>{
    Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/sessionImageHandoutRuntimeAdapter.ts")]).then(([{mockAdapter},handout])=>{const state=handout.getSessionImageHandoutState(mockAdapter);done({sessionId:state.sessionId,revision:state.revision,dismissed:state.dismissed,error:state.error,asset:state.asset?{fileName:state.asset.fileName,mimeType:state.asset.mimeType,byteLength:state.asset.byteLength,dataUrl:state.asset.dataUrl}:null});}).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);return result;
}

async function waitForHandout(instance,fileName){
  await instance.browser.waitUntil(async()=>{const state=await handoutState(instance);return fileName===null?state.asset===null:state.asset?.fileName===fileName;},{timeout:20_000,interval:150,timeoutMsg:`${instance.label} handout did not converge to ${String(fileName)}`});
  return handoutState(instance);
}

async function revealHandout(host){
  const result=await host.browser.executeAsync((done)=>{
    (async()=>{
      const [{mockAdapter},handout,{parseLocalImageDataUrl,HANDOUT_IMAGE_MAX_BYTES},{connectedStateFor}]=await Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/sessionImageHandoutRuntimeAdapter.ts"),import("/src/app/localImageAsset.ts"),import("/src/app/connectedSessionState.ts")]);
      const before=connectedStateFor(mockAdapter).ledger?.cursor??null;const asset=parseLocalImageDataUrl("data:image/webp;base64,UklGRg==","clue.webp",HANDOUT_IMAGE_MAX_BYTES);const state=await handout.revealSessionImageHandout(mockAdapter,asset);const after=connectedStateFor(mockAdapter).ledger?.cursor??null;
      return {before,after,revision:state.revision,asset:{fileName:state.asset?.fileName,mimeType:state.asset?.mimeType,byteLength:state.asset?.byteLength}};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);assert.equal(result.before,result.after,"G04 reveal must remain presentation-only");assert.equal(result.asset.fileName,"clue.webp");return result;
}

async function withdrawHandout(host){
  const result=await host.browser.executeAsync((done)=>{
    (async()=>{const [{mockAdapter},handout]=await Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/sessionImageHandoutRuntimeAdapter.ts")]);const state=await handout.withdrawSessionImageHandout(mockAdapter);return {revision:state.revision,asset:state.asset};})().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  });
  assert.ok(!result.error,result.error);assert.equal(result.asset,null);return result;
}

async function disconnectClient(client){
  const result=await client.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{await mockAdapter.stopSession();done({stopped:true});}).catch((error)=>done({error:String(error?.stack??error)}));});
  assert.ok(!result.error,result.error);assert.equal(result.stopped,true);await client.browser.waitUntil(async()=>!(await client.browser.$("body").getText()).includes("클라이언트 · 플레이어"),{timeout:20_000,timeoutMsg:`${client.label} did not leave connected state`});
}

async function snapshotLeakFlags(instance,needles){
  const result=await instance.browser.executeAsync((values,done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const serialized=JSON.stringify(await mockAdapter.getSnapshot());done({flags:Object.fromEntries(values.map((value)=>[value,serialized.includes(value)]))});}).catch((error)=>done({error:String(error?.stack??error)}));},needles);
  assert.ok(!result.error,result.error);return result.flags;
}

async function selectPinnedContent(host){
  const result=await host.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();const entry=snapshot.catalog.find((item)=>item.category==="feat")??snapshot.catalog[0];done(entry?{id:entry.id,nameEn:entry.nameEn,description:entry.description}:{error:"No catalog entry available"});}).catch((error)=>done({error:String(error?.stack??error)}));});
  assert.ok(!result.error,result.error);return result;
}

async function driftAndLookup(instance,pinned){
  const result=await instance.browser.executeAsync((input,done)=>{
    (async()=>{
      const [{mockAdapter},{connectedInternal},{connectedStateFor}]=await Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts"),import("/src/app/connectedSessionState.ts")]);
      const app=connectedInternal(mockAdapter);const ambient=app.catalog.find((entry)=>entry.id===input.id);if(!ambient)throw new Error(`Ambient content missing: ${input.id}`);ambient.nameEn="G07 Changed Content";ambient.description="G07 ambient catalog changed after Session start";
      const before=connectedStateFor(mockAdapter).ledger?.cursor??null;const lookup=await mockAdapter.lookupSessionContent(input.id);const after=connectedStateFor(mockAdapter).ledger?.cursor??null;return {ambientName:ambient.nameEn,lookup:lookup?{id:lookup.id,nameEn:lookup.nameEn,description:lookup.description}:null,before,after};
    })().then(done).catch((error)=>done({error:String(error?.stack??error)}));
  },pinned);
  assert.ok(!result.error,result.error);assert.equal(result.ambientName,"G07 Changed Content");assert.equal(result.lookup?.nameEn,pinned.nameEn,`${instance.label} lookup must use pinned Session content`);assert.notEqual(result.lookup?.description,"G07 ambient catalog changed after Session start");assert.equal(result.before,result.after,"G07 lookup must not create a shared event");return result;
}

async function runScenario(){
  assert.equal(process.platform,"win32","W4-07 handout acceptance is Windows-only");assert.ok(existsSync(binary),`Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot,{recursive:true,force:true});await mkdir(artifactRoot,{recursive:true});await ensureVite();
  const sessionPort=await reservePort();
  const host=await launchInstance("W4-07 Handout Host",path.join(runRoot,"host","data"),await reservePort());
  const p1=await launchInstance("W4-07 Handout P1",path.join(runRoot,"p1","data"),await reservePort());
  const p2=await launchInstance("W4-07 Handout P2",path.join(runRoot,"p2","data"),await reservePort());
  await setDistinctCharacter(p1,"char.w4.g04.p1","W4 G04 Player");await setDistinctCharacter(p2,"char.w4.g04.p2","W4 G04 Observer");
  const privateFixture=await setupHostPrivateCampaign(host);
  await openHostSession(host,sessionPort);await joinClientSession(p1,sessionPort);await joinClientSession(p2,sessionPort);await waitForTopology(host,3);

  assert.equal((await handoutState(p1)).asset,null,"G04 P1 must not receive a handout before explicit reveal");assert.equal((await handoutState(p2)).asset,null,"G04 P2 must not receive a handout before explicit reveal");
  const reveal=await revealHandout(host);const p1Reveal=await waitForHandout(p1,"clue.webp");const p2Reveal=await waitForHandout(p2,"clue.webp");

  await disconnectClient(p1);await joinClientSession(p1,sessionPort);const p1Restored=await waitForHandout(p1,"clue.webp");
  assert.equal(p1Restored.dismissed,false,"G05 active reconnect must restore/reopen the Host reveal");

  const withdrawal=await withdrawHandout(host);const p1Withdrawn=await waitForHandout(p1,null);const p2Withdrawn=await waitForHandout(p2,null);
  await disconnectClient(p1);await joinClientSession(p1,sessionPort);const p1WithdrawnReconnect=await waitForHandout(p1,null);assert.equal(p1WithdrawnReconnect.asset,null,"G05 withdrawn reconnect must not restore the old asset");

  const privateNeedles=[privateFixture.folderId,privateFixture.folderLabel,privateFixture.entryId,privateFixture.entryLabel,privateFixture.noteText,privateFixture.tag,"\"dmLibrary\"","\"noteText\"","\"recentEntryIds\""];
  const p1Leaks=await snapshotLeakFlags(p1,privateNeedles);const p2Leaks=await snapshotLeakFlags(p2,privateNeedles);for(const value of privateNeedles){assert.equal(p1Leaks[value],false,`G06 P1 leaked private Campaign value/shape: ${value}`);assert.equal(p2Leaks[value],false,`G06 P2 leaked private Campaign value/shape: ${value}`);}

  const pinned=await selectPinnedContent(host);const g07Host=await driftAndLookup(host,pinned);const g07P1=await driftAndLookup(p1,pinned);const g07P2=await driftAndLookup(p2,pinned);

  for(const instance of [host,p1,p2])await saveEvidence(instance,"g04-g07");
  const evidence={gate:"W4-07",scope:["MP-G04","MP-G05","MP-G06","MP-G07"],status:"PASS",verificationSha,windowsTauri:true,topology:{host:"DM Host",p1:"char.w4.g04.p1",p2:"char.w4.g04.p2",participantCount:(await runtimeSnapshot(host)).participants.length},scenarios:{"MP-G04":{status:"PASS",preReveal:{p1:null,p2:null},reveal:{host:reveal,p1:p1Reveal,p2:p2Reveal},withdraw:{host:withdrawal,p1:p1Withdrawn,p2:p2Withdrawn}},"MP-G05":{status:"PASS",activeReconnect:p1Restored,withdrawnReconnect:p1WithdrawnReconnect},"MP-G06":{status:"PASS",hostPrivateFixture:{hostHasNote:privateFixture.hostHasNote,hostFavorite:privateFixture.hostFavorite},p1Leaks,p2Leaks},"MP-G07":{status:"PASS",pinned,g07Host,g07P1,g07P2}}};
  await writeFile(path.join(artifactRoot,"w4-07-g04-g07.json"),JSON.stringify(evidence,null,2),"utf8");
  log(`MP-G04/G05/G06/G07 Windows H+P1+P2 acceptance PASS · ${artifactRoot}`);
}

async function cleanup(){
  for(const browser of browsers.reverse()){try{await Promise.race([browser.deleteSession(),new Promise((resolve)=>setTimeout(resolve,3_000))]);}catch{}}
  for(const child of children.reverse()){if(!child.pid||child.exitCode!==null)continue;spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}
}

let exitCode=0;
try{await runScenario();}catch(error){exitCode=1;log(`실패: ${error instanceof Error?error.stack??error.message:String(error)}`);for(const [index,browser] of browsers.entries()){try{await writeFile(path.join(artifactRoot,`failure-${index+1}.png`),await browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`failure-${index+1}.txt`),await browser.$("body").getText(),"utf8");}catch{}}log(`실패 증거: ${artifactRoot}`);}finally{await cleanup();}
process.exitCode=exitCode;
