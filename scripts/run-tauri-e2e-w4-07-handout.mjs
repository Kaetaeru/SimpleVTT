import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { remote } from "webdriverio";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const binary=path.join(root,".live-dev","tauri-e2e-target","debug","simplevtt.exe");
const viteEntry=path.join(root,"node_modules","vite","bin","vite.js");
const runId=new Date().toISOString().replace(/[:.]/g,"-");
const runRoot=path.join(root,".live-dev","tauri-e2e",`${runId}-w4-07-handout`);
const artifactRoot=path.join(runRoot,"artifacts");
const verificationSha=process.env.V1_VERIFICATION_SHA??process.env.GITHUB_SHA??"local";
const children=[];const browsers=[];

function log(message){process.stdout.write(`[TAURI W4-07 HANDOUT] ${message}\n`);}
async function reservePort(){return new Promise((resolve,reject)=>{const server=createServer();server.unref();server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const address=server.address();const port=typeof address==="object"&&address?address.port:0;server.close((error)=>error?reject(error):resolve(port));});});}
async function canConnect(port){return new Promise((resolve)=>{const socket=new Socket();const done=(value)=>{socket.destroy();resolve(value);};socket.setTimeout(250);socket.once("connect",()=>done(true));socket.once("timeout",()=>done(false));socket.once("error",()=>done(false));socket.connect(port,"127.0.0.1");});}
async function waitForPort(port,label,timeoutMs=30_000){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){if(await canConnect(port))return;await new Promise((resolve)=>setTimeout(resolve,100));}throw new Error(`${label} did not listen on ${port}`);}
function spawnTracked(command,args,options={}){const child=spawn(command,args,{cwd:root,stdio:["ignore","pipe","pipe"],windowsHide:false,...options});children.push(child);child.stdout?.on("data",(chunk)=>process.stdout.write(chunk));child.stderr?.on("data",(chunk)=>process.stderr.write(chunk));return child;}
async function ensureVite(){if(await canConnect(1420))return;spawnTracked(process.execPath,[viteEntry,"--host","0.0.0.0","--port","1420","--strictPort"]);await waitForPort(1420,"Vite",45_000);}
function exactButton(text){return `//button[normalize-space(.)=${JSON.stringify(text)}]`;}
function navButton(text){return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;}
function labelControl(label){return `//label[.//*[self::span or self::legend][normalize-space(.)=${JSON.stringify(label)}]]//input`;}
async function click(browser,selector,label=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${label} is not visible`});await element.waitForEnabled({timeout:15_000,timeoutMsg:`${label} is disabled`});await element.click();}
async function replaceValue(browser,selector,value,label=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${label} is not visible`});await element.setValue(value);assert.equal(await element.getValue(),String(value));}
async function waitForText(browser,text,timeout=30_000){await browser.waitUntil(async()=>(await browser.$("body").getText()).includes(text),{timeout,timeoutMsg:`UI text did not appear: ${text}`});}
async function isDisplayed(instance,selector){const element=await instance.browser.$(selector);return await element.isExisting()&&await element.isDisplayed();}
async function waitDisplayed(instance,selector,label){await instance.browser.$(selector).waitForDisplayed({timeout:20_000,timeoutMsg:`${label} did not appear`});}
async function waitAbsent(instance,selector,label){await instance.browser.waitUntil(async()=>!await isDisplayed(instance,selector),{timeout:20_000,interval:150,timeoutMsg:`${label} remained visible`});}

async function launchInstance(label,dataRoot,webdriverPort){
  await mkdir(dataRoot,{recursive:true});
  spawnTracked(binary,[`--simplevtt-data-root=${dataRoot}`,`--simplevtt-instance-label=${label}`],{env:{...process.env,SIMPLEVTT_LOCAL_DATA_ROOT:dataRoot,SIMPLEVTT_INSTANCE_LABEL:label,TAURI_WEBDRIVER_PORT:String(webdriverPort)}});
  await waitForPort(webdriverPort,`${label} WebDriver`);
  const browser=await remote({hostname:"127.0.0.1",port:webdriverPort,logLevel:"error",capabilities:{}});browsers.push(browser);
  await browser.waitUntil(async()=>{const body=await browser.$("body").getText();if(body.includes("TABLETOP, YOUR WAY"))return true;const finish=await browser.$(exactButton("선택 저장 · Home으로"));return finish.isExisting();},{timeout:30_000,timeoutMsg:`${label} did not reach Home or first-run setup`});
  const finish=await browser.$(exactButton("선택 저장 · Home으로"));if(await finish.isExisting()){await click(browser,"//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]");await finish.waitForEnabled({timeout:10_000});await finish.click();}
  await waitForText(browser,"TABLETOP, YOUR WAY");await waitForText(browser,"2 저장된 캐릭터");
  return{label,browser,dataRoot,webdriverPort};
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
async function openCharacterTab(browser,label,sectionId){await click(browser,`//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`,`${label} 탭`);await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({timeout:15_000});}
async function createSavedPlayerCharacter(instance,name){
  await click(instance.browser,navButton("캐릭터"),`${instance.label} 캐릭터 메뉴`);
  await click(instance.browser,"//article[contains(@class,'character-card-entry')][.//h2[normalize-space(.)='Aelar']]//button[normalize-space(.)='복제']",`${instance.label} Aelar 복제`);
  await openCharacterTab(instance.browser,"정체성","identity");await replaceValue(instance.browser,labelControl("캐릭터 이름"),name,`${instance.label} 캐릭터 이름`);
  for(const [tab,sectionId] of [["정체성","identity"],["종족","species"],["클래스","class"],["배경","background"]]){await openCharacterTab(instance.browser,tab,sectionId);assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[],`${instance.label} ${tab} dependent choices remain unresolved`);}
  await openCharacterTab(instance.browser,"능력치","abilities");await click(instance.browser,"//section[@id='abilities']//button[contains(normalize-space(.),'파이터 추천 배치')]",`${instance.label} 파이터 추천 배치`);
  await openCharacterTab(instance.browser,"기술","proficiencies");assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[],`${instance.label} proficiency choices remain unresolved`);
  await openCharacterTab(instance.browser,"검토","review");await click(instance.browser,exactButton("모험 시작"),`${instance.label} Character 저장`);await waitForText(instance.browser,name,30_000);
}
async function saveEvidence(instance){const base=instance.label.replace(/\s+/g,"-").toLowerCase();await writeFile(path.join(artifactRoot,`${base}-g04-g07.png`),await instance.browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`${base}-g04-g07.txt`),await instance.browser.$("body").getText(),"utf8");}

async function createHostCampaign(host){
  await click(host.browser,navButton("캠페인"),"캠페인 메뉴");const body=await host.browser.$("body").getText();
  await click(host.browser,exactButton(body.includes("아직 캠페인이 없습니다.")?"새 캠페인 만들기":"새 캠페인"),"새 캠페인");
  await replaceValue(host.browser,labelControl("캠페인 이름"),"W4-07 G04-G07 Windows Campaign","캠페인 이름");await click(host.browser,exactButton("캠페인 만들기"));await waitForText(host.browser,"W4-07 G04-G07 Windows Campaign");
}
async function setupPrivateFixture(host){
  const result=await host.browser.executeAsync((done)=>{(async()=>{await import("/src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts");const {mockAdapter}=await import("/src/app/mockAdapter.ts");const snapshot=await mockAdapter.getSnapshot();const campaign=snapshot.campaigns?.find((entry)=>entry.name==="W4-07 G04-G07 Windows Campaign");if(!campaign)throw new Error("Selected Campaign fixture missing");const folderId="folder.g06.windows.private",folderLabel="G06 WINDOWS HIDDEN VAULT",entryId="dm-note.g06.windows.secret",entryLabel="G06 WINDOWS HIDDEN NOTE",noteText="G06-WINDOWS-NOTE-TEXT-SENTINEL",tag="G06-WINDOWS-PRIVATE-TAG";await mockAdapter.upsertCampaignDmLibraryFolder(campaign.campaignId,{folderId,label:folderLabel});await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId,kind:"note",label:entryLabel,folderId,favorite:true,tags:[tag],noteText});const after=await mockAdapter.getSnapshot();const note=after.campaigns?.find((entry)=>entry.campaignId===campaign.campaignId)?.dmLibrary.entries.find((entry)=>entry.entryId===entryId);return{campaignId:campaign.campaignId,folderId,folderLabel,entryId,entryLabel,noteText,tag,hostHasNote:note?.noteText===noteText,hostFavorite:note?.favorite===true};})().then(done).catch((error)=>done({error:String(error?.stack??error)}));});
  assert.ok(!result.error,result.error);assert.equal(result.hostHasNote,true);assert.equal(result.hostFavorite,true);return result;
}
async function openHostSession(host,port){await click(host.browser,navButton("세션"));const direct="//*[@aria-label='직접 네트워크 세션 시작']";await replaceValue(host.browser,`${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`,"127.0.0.1");const inputs=await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);await inputs[0].setValue(String(port));const buttons=await host.browser.$$(`${direct}//button[normalize-space(.)='세션 열기']`);assert.equal(buttons.length,1);await buttons[0].click();await waitForText(host.browser,"호스트 · DM");}
async function joinClient(client,port){await click(client.browser,navButton("세션"));const direct="//*[@aria-label='직접 네트워크 세션 시작']";const character=await client.browser.$(`${direct}//label[contains(normalize-space(.),'플레이 Character')]//select`);await character.waitForDisplayed({timeout:15_000,timeoutMsg:"Client Character select is not visible"});const options=await character.$$("option");let selectedIndex=-1;for(let index=0;index<options.length;index+=1){if(await options[index].getAttribute("value")){selectedIndex=index;break;}}assert.ok(selectedIndex>=0,"Client saved Character option was not found");await character.selectByIndex(selectedIndex);assert.notEqual(await character.getValue(),"");await replaceValue(client.browser,`${direct}//label[.//span[normalize-space(.)='Host IP / 주소']]//input`,"127.0.0.1");const inputs=await client.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);await inputs[1].setValue(String(port));const buttons=await client.browser.$$(`${direct}//button[normalize-space(.)='참가하기']`);assert.equal(buttons.length,1);await buttons[0].waitForEnabled({timeout:15_000,timeoutMsg:"Client join button stayed disabled"});await buttons[0].click();await waitForText(client.browser,"클라이언트 · 플레이어");}
async function runtimeSnapshot(instance){const result=await instance.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();done({participants:snapshot.session.participants.map((entry)=>({id:entry.id,state:entry.state}))});}).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result;}
async function waitForTopology(host,count){await host.browser.waitUntil(async()=>(await runtimeSnapshot(host)).participants.filter((entry)=>entry.state==="connected").length>=count,{timeout:20_000});}

async function handoutState(instance){const result=await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/sessionImageHandoutRuntimeAdapter.ts")]).then(([{mockAdapter},handout])=>{const state=handout.getSessionImageHandoutState(mockAdapter);done({revision:state.revision,dismissed:state.dismissed,asset:state.asset?{fileName:state.asset.fileName,mimeType:state.asset.mimeType,byteLength:state.asset.byteLength}:null});}).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result;}
async function waitForHandout(instance,fileName){await instance.browser.waitUntil(async()=>{const state=await handoutState(instance);return fileName===null?state.asset===null:state.asset?.fileName===fileName;},{timeout:20_000,interval:150});return handoutState(instance);}
async function ledgerCursor(instance){const result=await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionState.ts")]).then(([{mockAdapter},{connectedStateFor}])=>done({cursor:connectedStateFor(mockAdapter).ledger?.cursor??null})).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result.cursor;}
async function disconnect(client){await click(client.browser,"//header[contains(@class,'session-reference-play-chrome')]//button[normalize-space(.)='세션']",`${client.label} 세션 연결`);await client.browser.$("aside[aria-label='Player 세션 연결']").waitForDisplayed({timeout:15_000});await click(client.browser,exactButton("세션 나가기"),`${client.label} 세션 나가기`);await client.browser.$("//nav[@aria-label='주요 메뉴']").waitForDisplayed({timeout:20_000,timeoutMsg:`${client.label} did not return to product shell after leaving Session`});}
async function leakFlags(instance,needles){const result=await instance.browser.executeAsync((values,done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const text=JSON.stringify(await mockAdapter.getSnapshot());done({flags:Object.fromEntries(values.map((value)=>[value,text.includes(value)]))});}).catch((error)=>done({error:String(error?.stack??error)}));},needles);assert.ok(!result.error,result.error);return result.flags;}
async function pinnedContent(host){const result=await host.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();const entry=snapshot.catalog.find((item)=>item.category==="feat")??snapshot.catalog[0];done(entry?{id:entry.id,nameEn:entry.nameEn,description:entry.description}:{error:"No catalog entry"});}).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result;}
async function driftAndLookup(instance,pinned){const result=await instance.browser.executeAsync((input,done)=>{(async()=>{await import("/src/app/sessionContentParityRuntimeAdapter.ts");const [{mockAdapter},{connectedInternal},{connectedStateFor}]=await Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts"),import("/src/app/connectedSessionState.ts")]);const app=connectedInternal(mockAdapter);const ambient=app.catalog.find((entry)=>entry.id===input.id);if(!ambient)throw new Error("Ambient entry missing");ambient.nameEn="G07 Changed Content";ambient.description="G07 ambient catalog changed after Session start";const before=connectedStateFor(mockAdapter).ledger?.cursor??null;const lookup=await mockAdapter.lookupSessionContent(input.id);return{lookup:lookup?{id:lookup.id,nameEn:lookup.nameEn,description:lookup.description}:null,before,after:connectedStateFor(mockAdapter).ledger?.cursor??null};})().then(done).catch((error)=>done({error:String(error?.stack??error)}));},pinned);assert.ok(!result.error,result.error);assert.equal(result.lookup?.nameEn,pinned.nameEn);assert.notEqual(result.lookup?.description,"G07 ambient catalog changed after Session start");assert.equal(result.before,result.after);return result;}

async function run(){
  assert.equal(process.platform,"win32");assert.ok(existsSync(binary));await rm(runRoot,{recursive:true,force:true});await mkdir(artifactRoot,{recursive:true});await ensureVite();
  const port=await reservePort();const host=await launchInstance("W4-07 Handout Host",path.join(runRoot,"host","data"),await reservePort());const p1=await launchInstance("W4-07 Handout P1",path.join(runRoot,"p1","data"),await reservePort());const p2=await launchInstance("W4-07 Handout P2",path.join(runRoot,"p2","data"),await reservePort());
  await createSavedPlayerCharacter(p1,"W4-07 P1");await createSavedPlayerCharacter(p2,"W4-07 P2");
  await createHostCampaign(host);const privateFixture=await setupPrivateFixture(host);
  await openHostSession(host,port);await joinClient(p1,port);await joinClient(p2,port);await waitForTopology(host,3);
  assert.equal((await handoutState(p1)).asset,null);assert.equal((await handoutState(p2)).asset,null);

  await click(host.browser,"//header[contains(@class,'session-reference-play-chrome')]//button[normalize-space(.)='세션']","Host 세션 도구");await click(host.browser,exactButton("이미지 보여주기"),"Host Handout 열기");await host.browser.$("aside[aria-label='DM Handout 도구']").waitForDisplayed({timeout:15_000});
  const handoutBase64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9xkAAAAASUVORK5CYII=";const injected=await host.browser.execute((selector,encoded)=>{const input=document.querySelector(selector);if(!(input instanceof HTMLInputElement))return{ok:false,error:"file input missing"};const binary=atob(encoded);const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);const file=new File([bytes],"g04-handout.png",{type:"image/png"});const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return{ok:true,fileName:input.files?.[0]?.name??null};},"aside[aria-label='DM Handout 도구'] input[type='file']",handoutBase64);assert.deepEqual(injected,{ok:true,fileName:"g04-handout.png"});await waitDisplayed(host,".session-handout-preview","Host private handout preview");
  assert.equal(await isDisplayed(p1,".session-handout-viewer"),false,"G04 Host preview leaked to P1 before reveal");assert.equal(await isDisplayed(p2,".session-handout-viewer"),false,"G04 Host preview leaked to P2 before reveal");const ledgerBeforeReveal=await ledgerCursor(host);
  await click(host.browser,exactButton("플레이어에게 공개"),"Handout 공개");const p1Reveal=await waitForHandout(p1,"g04-handout.png");const p2Reveal=await waitForHandout(p2,"g04-handout.png");await waitDisplayed(p1,".session-handout-viewer","P1 rendered handout viewer");await waitDisplayed(p2,".session-handout-viewer","P2 rendered handout viewer");const p1Src=await p1.browser.$(".session-handout-viewer img").getAttribute("src");const p2Src=await p2.browser.$(".session-handout-viewer img").getAttribute("src");assert.ok(p1Src?.startsWith("data:image/png;base64,"));assert.equal(p2Src,p1Src,"G04 rendered Player assets diverged");assert.equal(await ledgerCursor(host),ledgerBeforeReveal,"G04 presentation reveal changed mechanics ledger");
  await disconnect(p1);await joinClient(p1,port);const activeReconnect=await waitForHandout(p1,"g04-handout.png");assert.equal(activeReconnect.dismissed,false);await waitDisplayed(p1,".session-handout-viewer","G05 active reconnect viewer");assert.equal(await p1.browser.$(".session-handout-viewer img").getAttribute("src"),p1Src,"G05 active reconnect restored a different asset");
  await click(host.browser,exactButton("공유 철회"),"Handout 공유 철회");const p1Withdraw=await waitForHandout(p1,null);const p2Withdraw=await waitForHandout(p2,null);await waitAbsent(p1,".session-handout-viewer","P1 withdrawn handout viewer");await waitAbsent(p2,".session-handout-viewer","P2 withdrawn handout viewer");await disconnect(p1);await joinClient(p1,port);const withdrawnReconnect=await waitForHandout(p1,null);await waitAbsent(p1,".session-handout-viewer","G05 withdrawn reconnect viewer");assert.equal(await ledgerCursor(host),ledgerBeforeReveal,"G04/G05 presentation flow changed mechanics ledger");

  const needles=[privateFixture.folderId,privateFixture.folderLabel,privateFixture.entryId,privateFixture.entryLabel,privateFixture.noteText,privateFixture.tag,"\"dmLibrary\"","\"noteText\"","\"recentEntryIds\""];const p1Leaks=await leakFlags(p1,needles);const p2Leaks=await leakFlags(p2,needles);for(const value of needles){assert.equal(p1Leaks[value],false,`P1 leaked ${value}`);assert.equal(p2Leaks[value],false,`P2 leaked ${value}`);}
  const pinned=await pinnedContent(host);const g07Host=await driftAndLookup(host,pinned);const g07P1=await driftAndLookup(p1,pinned);const g07P2=await driftAndLookup(p2,pinned);
  for(const instance of [host,p1,p2])await saveEvidence(instance);
  const evidence={gate:"W4-07",scope:["MP-G04","MP-G05","MP-G06","MP-G07"],status:"PASS",verificationSha,windowsTauri:true,topology:{participantCount:(await runtimeSnapshot(host)).participants.length},scenarios:{"MP-G04":{status:"PASS",hostPreviewPrivate:true,renderedPlayerLayer:".session-handout-viewer",p1Reveal,p2Reveal,p1SrcPrefix:p1Src?.slice(0,22),sameRenderedAsset:p2Src===p1Src,p1Withdraw,p2Withdraw,mechanicsLedgerUnchanged:true},"MP-G05":{status:"PASS",activeReconnect,activeReconnectRendered:true,withdrawnReconnect,withdrawnReconnectRendered:false},"MP-G06":{status:"PASS",hostPrivateFixture:{hostHasNote:privateFixture.hostHasNote,hostFavorite:privateFixture.hostFavorite},p1Leaks,p2Leaks},"MP-G07":{status:"PASS",pinned,g07Host,g07P1,g07P2}}};
  await writeFile(path.join(artifactRoot,"w4-07-g04-g07.json"),JSON.stringify(evidence,null,2),"utf8");log(`MP-G04/G05/G06/G07 Windows H+P1+P2 acceptance PASS · ${artifactRoot}`);
}
async function cleanup(){for(const browser of browsers.reverse()){try{await browser.deleteSession();}catch{}}for(const child of children.reverse()){if(child.pid&&child.exitCode===null)spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}}
let exitCode=0;try{await run();}catch(error){exitCode=1;log(`실패: ${error instanceof Error?error.stack??error.message:String(error)}`);for(const [index,browser] of browsers.entries()){try{await writeFile(path.join(artifactRoot,`failure-${index+1}.png`),await browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`failure-${index+1}.txt`),await browser.$("body").getText(),"utf8");}catch{}}}finally{await cleanup();}process.exitCode=exitCode;
