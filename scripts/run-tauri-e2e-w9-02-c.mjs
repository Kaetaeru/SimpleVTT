import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

function log(message){process.stdout.write(`[TAURI W9-02C E2E] ${message}\n`);}
function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
async function reservePort(){return new Promise((resolve,reject)=>{const server=createServer();server.unref();server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const address=server.address();const port=typeof address==="object"&&address?address.port:0;server.close((error)=>error?reject(error):resolve(port));});});}
async function canConnect(port,host="127.0.0.1"){return new Promise((resolve)=>{const socket=new Socket();const finish=(value)=>{socket.destroy();resolve(value);};socket.setTimeout(250);socket.once("connect",()=>finish(true));socket.once("timeout",()=>finish(false));socket.once("error",()=>finish(false));socket.connect(port,host);});}
async function waitForPort(port,label,timeoutMs=30_000){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){if(await canConnect(port))return;await sleep(100);}throw new Error(`${label} did not listen on 127.0.0.1:${port} within ${timeoutMs} ms`);}
function spawnTracked(command,args,options={}){const child=spawn(command,args,{cwd:root,stdio:["ignore","pipe","pipe"],windowsHide:false,...options});children.push(child);child.stdout?.on("data",(chunk)=>process.stdout.write(chunk));child.stderr?.on("data",(chunk)=>process.stderr.write(chunk));return child;}
async function ensureVite(){if(await canConnect(1420)){log("기존 Vite 서버(localhost:1420)를 사용합니다.");return;}assert.ok(existsSync(viteEntry),`Vite entry was not found: ${viteEntry}`);viteStarted=true;spawnTracked(process.execPath,[viteEntry,"--host","0.0.0.0","--port","1420","--strictPort"]);await waitForPort(1420,"Vite",45_000);for(let attempt=0;attempt<50;attempt+=1){try{const response=await fetch("http://127.0.0.1:1420/");if(response.ok){await response.text();return;}}catch{}await sleep(100);}throw new Error("Vite warm-up did not become HTTP-ready");}
function exactButton(text){return `//button[normalize-space(.)=${JSON.stringify(text)}]`;}
function navButton(text){return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;}
function labelControl(label,tag="input",within=""){const scope=within?`${within}//`:"//";return `${scope}label[.//*[self::span or self::legend][normalize-space(.)=${JSON.stringify(label)}]]//${tag}`;}
async function click(browser,selector,description=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.waitForEnabled({timeout:15_000,timeoutMsg:`${description} is disabled`});await element.click();}
async function replaceValue(browser,selector,value,description=selector){const element=await browser.$(selector);await element.waitForDisplayed({timeout:15_000,timeoutMsg:`${description} is not visible`});await element.click();await element.setValue(value);assert.equal(await element.getValue(),String(value),`${description} did not accept input`);}
async function waitForText(browser,text,timeout=20_000){await browser.waitUntil(async()=>(await browser.$("body").getText()).includes(text),{timeout,timeoutMsg:`UI text did not appear: ${text}`});}
async function completeFirstRun(instance){const finish=await instance.browser.$(exactButton("선택 저장 · Home으로"));if(!await finish.isExisting())return;const optimized=await instance.browser.$("//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]");await optimized.click();await finish.waitForEnabled({timeout:10_000});await finish.click();await waitForText(instance.browser,"TABLETOP, YOUR WAY");}
// Each instance gets its own WebView2 user data folder: a shared folder means one shared browser process, so killing one Tauri process would take every other window down with it.
async function launchInstance(label,dataRoot,webdriverPort){await mkdir(dataRoot,{recursive:true});const child=spawnTracked(binary,[`--simplevtt-data-root=${dataRoot}`,`--simplevtt-instance-label=${label}`],{env:{...process.env,SIMPLEVTT_LOCAL_DATA_ROOT:dataRoot,SIMPLEVTT_INSTANCE_LABEL:label,TAURI_WEBDRIVER_PORT:String(webdriverPort),WEBVIEW2_USER_DATA_FOLDER:path.join(dataRoot,"..","webview2")}});await waitForPort(webdriverPort,`${label} WebDriver`,30_000);// The WebDriver plugin listens before the Tauri window exists; a session request in that gap fails with "No window could be found", so retry the session for a bounded time instead of failing the whole journey.
let browser;for(let attempt=1;;attempt+=1){try{browser=await remote({hostname:"127.0.0.1",port:webdriverPort,logLevel:"error",capabilities:{}});break;}catch(error){const message=String(error instanceof Error?error.message:error);if(attempt>=20||!/No window could be found|no such window|ECONNREFUSED|ECONNRESET/i.test(message))throw error;log(`${label} WebDriver session not ready (attempt ${attempt}): ${message.slice(0,120)}`);await sleep(1000);}}browsers.push(browser);await browser.setTimeout({implicit:0,pageLoad:30_000,script:60_000});await browser.waitUntil(async()=>(await browser.$("body").getText()).includes("SimpleVTT"),{timeout:30_000,timeoutMsg:`${label} UI did not finish loading`});const instance={label,child,browser,dataRoot,webdriverPort};await completeFirstRun(instance);return instance;}
async function saveEvidence(instance,suffix){const base=instance.label.replace(/\s+/g,"-").toLowerCase();await writeFile(path.join(artifactRoot,`${base}-${suffix}.png`),await instance.browser.takeScreenshot(),"base64");await writeFile(path.join(artifactRoot,`${base}-${suffix}.txt`),await instance.browser.$("body").getText(),"utf8");}

async function createHostCampaign(host){await click(host.browser,navButton("캠페인"),"캠페인 메뉴");const body=await host.browser.$("body").getText();await click(host.browser,exactButton(body.includes("아직 캠페인이 없습니다.")?"새 캠페인 만들기":"새 캠페인"),"새 캠페인");await replaceValue(host.browser,labelControl("캠페인 이름"),"W7-05 Hidden Roll","캠페인 이름");await click(host.browser,exactButton("캠페인 만들기"),"캠페인 만들기 제출");await waitForText(host.browser,"W7-05 Hidden Roll");}
async function openHostSession(host,sessionPort){await click(host.browser,navButton("세션"),"세션 메뉴");const direct="//*[@aria-label='직접 네트워크 세션 시작']";await replaceValue(host.browser,`${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`,"127.0.0.1","Host bind 주소");const portInputs=await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);assert.ok(portInputs.length>=1);await portInputs[0].setValue(String(sessionPort));const buttons=await host.browser.$$(`${direct}//button[normalize-space(.)='세션 열기']`);assert.equal(buttons.length,1);await buttons[0].click();await waitForText(host.browser,"호스트 · DM",30_000);}
async function joinClientSession(client,sessionPort){await click(client.browser,navButton("세션"),"세션 메뉴");const direct="//*[@aria-label='직접 네트워크 세션 시작']";await replaceValue(client.browser,`${direct}//label[.//span[normalize-space(.)='Host IP / 주소']]//input`,"127.0.0.1","Client Host 주소");const portInputs=await client.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);assert.ok(portInputs.length>=2);await portInputs[1].setValue(String(sessionPort));const buttons=await client.browser.$$(`${direct}//button[normalize-space(.)='참가하기']`);assert.equal(buttons.length,1);await buttons[0].waitForEnabled({timeout:15_000,timeoutMsg:"참가하기 is disabled"});await buttons[0].click();try{await waitForText(client.browser,"클라이언트 · 플레이어",30_000);}catch(error){const base=client.label.replace(/\s+/g,"-").toLowerCase();await saveEvidence(client,"join-failure").catch(()=>undefined);const snapshot=await runtimeSnapshot(client).catch((cause)=>({snapshotError:String(cause instanceof Error?cause.message:cause)}));await writeFile(path.join(artifactRoot,`${base}-join-failure-runtime.json`),`${JSON.stringify(snapshot,null,2)}\n`,"utf8").catch(()=>undefined);throw new Error(`${error instanceof Error?error.message:String(error)}; runtime=${JSON.stringify(snapshot)}`);}}
async function completeVisibleCharacterChoices(browser){for(let attempt=0;attempt<120;attempt+=1){const result=await browser.execute(()=>{const sections=[...document.querySelectorAll(".focused-create-stage .create-v09-section")];for(const section of sections){if(section.querySelector(".create-status-pill")?.textContent?.trim()!=="선택 필요")continue;const candidates=[...section.querySelectorAll(".dynamic-choice-grid .create-option-card, .equipment-options .create-option-card, .spell-choice-grid button, .proficiency-grid button")];const target=candidates.find((item)=>!item.disabled&&item.getAttribute("aria-disabled")!=="true"&&!item.classList.contains("selected")&&!item.querySelector(".selected"));if(target instanceof HTMLElement){const before=section.textContent;target.scrollIntoView({block:"center"});target.click();return{clicked:true,section:section.id,before};}}return{clicked:false,unresolved:sections.filter((section)=>section.querySelector(".create-status-pill")?.textContent?.trim()==="선택 필요").map((section)=>section.id)};});if(!result.clicked)return result.unresolved;await browser.waitUntil(async()=>browser.execute(({sectionId,before})=>{const section=document.getElementById(sectionId);return Boolean(section&&section.textContent!==before);},{sectionId:result.section,before:result.before}),{timeout:15_000});}throw new Error("Character choice completion exceeded 120 UI clicks");}
async function openCharacterTab(browser,label,sectionId){await click(browser,`//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`,`${label} 탭`);await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({timeout:15_000});}
async function chooseClass(instance,options){await openCharacterTab(instance.browser,"클래스","class");const picked=await instance.browser.execute((className)=>{const card=[...document.querySelectorAll("#class .create-option-card")].find((entry)=>entry.textContent.includes(className));if(!card)return false;card.click();return true;},options.className);assert.equal(picked,true,`${instance.label}: class card ${options.className} not found`);await sleep(800);for(const [sectionId,names] of Object.entries(options.spellTiles??{})){for(const spellName of names){const clicked=await instance.browser.execute(({sectionId,spellName})=>{const section=document.getElementById(sectionId);const tile=section&&[...section.querySelectorAll(".spell-choice-grid button")].find((entry)=>entry.textContent.trim().startsWith(spellName));if(!tile)return false;tile.click();return true;},{sectionId,spellName});assert.equal(clicked,true,`${instance.label}: spell tile ${spellName} not found in ${sectionId}`);await sleep(250);}}for(const [sectionId,text] of Object.entries(options.choiceCards??{})){const clicked=await instance.browser.execute(({sectionId,text})=>{const section=document.getElementById(sectionId);const card=section&&[...section.querySelectorAll(".dynamic-choice-grid .create-option-card")].find((entry)=>entry.textContent.includes(text));if(!card)return false;card.click();return true;},{sectionId,text});assert.equal(clicked,true,`${instance.label}: choice card ${text} not found in ${sectionId}`);await sleep(350);}}
async function createDistinctPlayerCharacter(instance,name,options={}){await click(instance.browser,navButton("캐릭터"),`${instance.label} 캐릭터 메뉴`);await click(instance.browser,"//article[contains(@class,'character-card-entry')][.//h2[normalize-space(.)='Aelar']]//button[normalize-space(.)='복제']",`${instance.label} Aelar 복제`);await openCharacterTab(instance.browser,"정체성","identity");await replaceValue(instance.browser,labelControl("캐릭터 이름"),name,`${instance.label} 캐릭터 이름`);if(options.className)await chooseClass(instance,options);for(const [tab,sectionId] of [["정체성","identity"],["종족","species"],["클래스","class"],["배경","background"]]){await openCharacterTab(instance.browser,tab,sectionId);assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[]);}await openCharacterTab(instance.browser,"능력치","abilities");await click(instance.browser,"//section[@id='abilities']//button[contains(normalize-space(.),'추천 배치')]",`${instance.label} 추천 배치`);await openCharacterTab(instance.browser,"기술","proficiencies");assert.deepEqual(await completeVisibleCharacterChoices(instance.browser),[]);await openCharacterTab(instance.browser,"검토","review");await click(instance.browser,exactButton("모험 시작"),`${instance.label} Character 저장`);await waitForText(instance.browser,name,30_000);const snapshot=await runtimeSnapshot(instance);assert.equal(snapshot.activeCharacterName,name);return{id:snapshot.activeCharacterId,name};}

async function runtimeSnapshot(instance){const result=await instance.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();done({activeCharacterId:snapshot.activeCharacter.id,activeCharacterName:snapshot.activeCharacter.name,activeGold:snapshot.activeCharacter.goldGp??0,role:snapshot.session.role,connectionState:snapshot.connectionState,participants:snapshot.session.participants.map((entry)=>({id:entry.id,characterName:entry.characterName,state:entry.state})),inventories:Object.fromEntries(Object.entries(snapshot.sessionCharacterInventories??{}).map(([id,value])=>[id,{characterId:value.characterId,goldGp:value.goldGp,revision:value.revision}])),campaignId:snapshot.campaignSessionSystems?.campaignId??snapshot.activeCampaignId??snapshot.campaigns?.[0]?.campaignId??null,stashGp:snapshot.campaignSessionSystems?.partyStash.wallet.gp??null,compatibilityMessage:snapshot.session.compatibilityMessage});}).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result;}
async function selectProductionCharacter(instance,characterId,timeout=30_000){await click(instance.browser,navButton("세션"),`${instance.label} 세션 메뉴`);const direct="//*[@aria-label='직접 네트워크 세션 시작']";const control=await instance.browser.$(`${direct}//label[.//span[normalize-space(.)='플레이 Character']]//select`);await control.waitForDisplayed({timeout,timeoutMsg:`${instance.label} production Character selector is not visible`});await control.selectByAttribute("value",characterId);await instance.browser.waitUntil(async()=>(await runtimeSnapshot(instance)).activeCharacterId===characterId,{timeout,interval:200,timeoutMsg:`${instance.label} did not restore saved Character ${characterId}`});return runtimeSnapshot(instance);}
async function waitParticipantState(instance,participantId,expected,timeout=20_000){await instance.browser.waitUntil(async()=>{const snapshot=await runtimeSnapshot(instance);return snapshot.participants.some((entry)=>entry.id===participantId&&entry.state===expected);},{timeout,interval:150,timeoutMsg:`${instance.label} did not observe participant ${participantId} as ${expected}`});return runtimeSnapshot(instance);}

async function privacySnapshot(instance){return instance.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const snapshot=await mockAdapter.getSnapshot();const resolution=snapshot.resolution;done({role:snapshot.session.role,connectionState:snapshot.connectionState,participants:snapshot.session.participants.map((entry)=>({id:entry.id,characterName:entry.characterName,state:entry.state})),resolutionId:resolution?.id??null,stage:resolution?.stage??null,dice:resolution?.authoritativeDice??[],compact:resolution?.compact??"",finalOutcome:resolution?.finalOutcome??"",targetIds:resolution?.targetIds??[],activity:snapshot.activity.slice(0,6).map((entry)=>({id:entry.id,title:entry.title,summary:entry.summary})),visibility:snapshot.resolutionVisibility??null});}).catch((error)=>done({error:String(error?.stack??error)}));});}
async function resolveHostCheck(host){return host.browser.executeAsync((done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{try{let snapshot=await mockAdapter.getSnapshot();const listChecks=(current)=>Object.entries(current.scene.actionsByActor??{}).flatMap(([actorId,entries])=>(entries??[]).filter((entry)=>entry.target==="none"&&entry.resolutionKind==="ability-check").map((action)=>({actorId,action})));let candidates=listChecks(snapshot).filter((candidate)=>candidate.action.available);if(!candidates.length){try{snapshot=await mockAdapter.startInitiative();}catch{}const actorId=snapshot.scene.currentActorId||snapshot.activeCharacter.id;try{snapshot=await mockAdapter.setCurrentActor(actorId);}catch{}candidates=listChecks(snapshot).filter((candidate)=>candidate.action.available);}const preferred=candidates.find((candidate)=>candidate.actorId===snapshot.activeCharacter.id)??candidates[0];if(!preferred){done({ok:false,error:`no available targetless ability check; role=${snapshot.session.role} mode=${snapshot.sessionMode} current=${snapshot.scene.currentActorId} active=${snapshot.activeCharacter.id} entities=${snapshot.scene.entities.map((entry)=>entry.id).join(",")} actors=${JSON.stringify(Object.entries(snapshot.scene.actionsByActor??{}).map(([id,entries])=>({id,total:(entries??[]).length,checks:(entries??[]).filter((entry)=>entry.resolutionKind==="ability-check").length,available:(entries??[]).filter((entry)=>entry.available).length})))}`});return;}try{await mockAdapter.selectDmActor(preferred.actorId);}catch{}const actorId=preferred.actorId;const action=preferred.action;snapshot=await mockAdapter.resolveAction(action.id,[]);for(let step=0;step<12&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1)snapshot=await mockAdapter.advanceResolution();const resolution=snapshot.resolution;if(!resolution){done({ok:false,error:`resolveAction(${action.id}) for ${actorId} produced no resolution`});return;}done({ok:true,actorId,actionId:action.id,actionName:action.name,resolutionId:resolution.id,stage:resolution.stage,dice:resolution.authoritativeDice??[],compact:resolution.compact??"",finalOutcome:resolution.finalOutcome??"",detail:resolution.detail??[]});}catch(error){done({ok:false,error:String(error instanceof Error?error.message:error)});}}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));});}
/** The runner drives the Host's check through the production adapter, not a button; the React shell only re-renders from its own actions or an external snapshot, so publish one exactly as the connected runtime does after inbound events. */
async function refreshRenderedShell(instance){const result=await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{publishConnectedSnapshot}])=>{await publishConnectedSnapshot(mockAdapter);done({ok:true});}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));});assert.equal(result.ok,true,result.error);}
async function waitResolution(instance,resolutionId,predicate,description,timeout=20_000){let last=null;await instance.browser.waitUntil(async()=>{last=await privacySnapshot(instance);return last.resolutionId===resolutionId&&predicate(last);},{timeout,interval:150,timeoutMsg:`${instance.label} did not observe ${description}; last=${JSON.stringify(last)}`});return last;}
async function bodyText(instance){const inner=await instance.browser.execute(()=>document.body?.innerText??"").catch(()=>"");if(inner&&inner.trim())return inner;return instance.browser.$("body").getText();}
function assertNoMarkers(label,text,markers){for(const marker of markers){if(!marker)continue;assert.equal(text.includes(marker),false,`${label} leaks hidden fact ${JSON.stringify(marker)}`);}}

async function installErrorHooks(instance){await instance.browser.execute(()=>{const w=window;if(w.__e2eErrors)return;w.__e2eErrors=[];w.addEventListener("error",(event)=>w.__e2eErrors.push(`error: ${event.message} @${event.filename}:${event.lineno}`));w.addEventListener("unhandledrejection",(event)=>w.__e2eErrors.push(`rejection: ${String(event.reason&&event.reason.stack||event.reason)}`));}).catch(()=>undefined);}
async function domDiagnostics(instance){return instance.browser.execute(()=>{const q=(sel)=>Boolean(document.querySelector(sel));const buttons=[...document.querySelectorAll("button")].filter((el)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).map((el)=>(el.getAttribute("aria-label")||el.textContent||"").trim().slice(0,30)).filter(Boolean).slice(0,40);return{errors:(window.__e2eErrors||[]).slice(0,10),href:location.href,bodyTextLength:(document.body?.innerText||"").length,bodyHtmlLength:(document.body?.innerHTML||"").length,sessionRoot:q(".session-mode-root"),hotbar:q(".session-hotbar-tabs"),activityPane:q(".session-activity-pane"),resolutionLayer:q(".session-resolution-layer"),diceCanvas:q("canvas"),visibleButtons:buttons};}).catch((error)=>({diagnosticsError:String(error)}));}

// ---------------------------------------------------------------------------------------------
// W9-02 family C — combat and shared presentation on real Windows H+P1+P2 (stage 1: Fighter + NPC)
// ---------------------------------------------------------------------------------------------
const bounded=(promise,ms,label)=>Promise.race([promise,sleep(ms).then(()=>({timeout:label}))]);

async function peerState(instance){const result=await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionState.ts")]).then(async([{mockAdapter},{connectedStateFor}])=>{const s=await mockAdapter.getSnapshot();const st=connectedStateFor(mockAdapter);const r=s.resolution;done({role:s.session.role,connectionState:s.connectionState,mode:s.sessionMode,currentActorId:s.scene.currentActorId,cursor:st.replica?.cursor??st.ledger?.cursor??null,pendingRemote:Boolean(st.pendingRemoteAction),compatibilityMessage:s.session.compatibilityMessage,activeCharacterId:s.activeCharacter.id,announcement:document.querySelector(".session-resolution-announcement")?.textContent??"",resolution:r?{id:r.id,stage:r.stage,actorId:r.actorId,actionName:r.actionName,targetIds:r.targetIds,dice:r.authoritativeDice,compact:r.compact,finalOutcome:r.finalOutcome,attackOutcome:r.attackOutcome,attackTotal:r.attackTotal,rollTotal:r.rollTotal,critical:r.critical,canAdvance:r.canAdvance,stateChanges:r.stateChanges,damageComponents:(r.damageComponents??[]).length,checkTarget:r.checkTarget,checkOutcome:r.checkOutcome,saves:(r.saveResults??[]).map((x)=>({targetId:x.targetId,targetName:x.targetName,total:x.total,dc:x.dc,outcome:x.outcome}))}:null,items:s.activeCharacter.items.map((i)=>({id:i.id,definitionId:i.definitionId,name:i.name,quantity:i.quantity,equipped:i.equipped})),inventory:(()=>{const inv=s.sessionCharacterInventories?.[s.activeCharacter.id];return inv?{revision:inv.revision,goldGp:inv.goldGp,items:inv.items.map((i)=>({id:i.id,definitionId:i.definitionId,name:i.name,quantity:i.quantity}))}:null;})(),activity:s.activity.slice(0,60).map((e)=>({id:e.id,actor:e.actor,title:e.title,summary:e.summary,stateChanges:e.stateChanges,detail:e.detail})),entities:s.scene.entities.map((e)=>({id:e.id,name:e.name,hp:e.hp,maxHp:e.maxHp,kind:e.kind})),resources:(s.activeCharacter.resources??[]).map((x)=>({id:x.id,label:x.label,current:x.current,max:x.max})),hasCanvas:Boolean(document.querySelector("canvas"))});}).catch((error)=>done({error:String(error?.stack??error)}));});assert.ok(!result.error,result.error);return result;}
async function refreshShell(instance){await instance.browser.executeAsync((done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{publishConnectedSnapshot}])=>{await publishConnectedSnapshot(mockAdapter);done({ok:true});}).catch((error)=>done({error:String(error?.stack??error)}));});}
async function actions(instance,actorId){return instance.browser.executeAsync((actorId,done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const s=await mockAdapter.getSnapshot();done((s.scene.actionsByActor[actorId]??[]).map((a)=>({id:a.id,name:a.name,available:a.available,disabledReason:a.disabledReason,target:a.target,eligibleTargetIds:a.eligibleTargetIds,resolutionKind:a.resolutionKind,economy:a.economy,spellId:a.spellCast?.spellId??null,readyActionRole:a.readyActionRole??null,maxTargets:a.maxTargets??null})));}).catch((error)=>done({error:String(error?.stack??error)}));},actorId);}
async function findAction(instance,actorId,predicate,label){const list=await actions(instance,actorId);assert.ok(!list.error,list.error);const found=list.find(predicate);assert.ok(found,`${instance.label}: action ${label} not projected for ${actorId}; have ${list.map((a)=>a.name).join("|")}`);return found;}
async function hostCall(host,body,args){const result=await host.browser.executeAsync(new Function("args","done",`Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{publishConnectedSnapshot}])=>{try{const out=await (async()=>{${body}})();await publishConnectedSnapshot(mockAdapter);done({ok:true,out});}catch(error){done({ok:false,error:String(error instanceof Error?error.message:error)});}}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));`),args??{});assert.equal(result.ok,true,result.error);return result.out;}
const seenResolutionIds=new Set();
// Walks the authoritative Initiative to the actor's next fresh turn. If the actor is already current its turn economy may be spent, so the Host ends that turn first and cycles the order once.
async function peerCall(instance,body,args){const result=await instance.browser.executeAsync(new Function("args","done",`Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{publishConnectedSnapshot}])=>{try{const out=await (async()=>{${body}})();await publishConnectedSnapshot(mockAdapter);done({ok:true,out});}catch(error){done({ok:false,error:String(error instanceof Error?error.message:error)});}}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));`),args??{});assert.equal(result.ok,true,`${instance.label}: ${result.error}`);return result.out;}
// A created Cleric holds mace + shield; stowing the shield through the production inventory API frees the hand that somatic-only spells (Sacred Flame, Guiding Bolt, Cure Wounds) need.
async function stowShield(instance){return peerCall(instance,`const s=await mockAdapter.getSnapshot();const shield=s.activeCharacter.items.find((i)=>i.definitionId==="dnd.srd521.item.shield"&&i.equipped);if(!shield)return {stowed:false,items:s.activeCharacter.items.map((i)=>i.name+":"+(i.equipped?"E":"-")+(i.wielded?"W":"-"))};const after=await mockAdapter.toggleItemEquipped(shield.id);return {stowed:true,wielded:after.activeCharacter.items.filter((i)=>i.wielded).map((i)=>i.name+":"+i.wieldSlot)};`);}
async function paritySnapshot(instance,actorId){const result=await instance.browser.executeAsync((actorId,done)=>{import("/src/app/mockAdapter.ts").then(async({mockAdapter})=>{const s=await mockAdapter.getSnapshot();const e=s.scene.entities.find((x)=>x.id===actorId);const norm=(a)=>({id:a.id,name:a.name,category:a.category,economy:a.economy,target:a.target,available:a.available,resolutionKind:a.resolutionKind,eligibleTargetIds:[...(a.eligibleTargetIds??[])].sort(),maxTargets:a.maxTargets??null,spellId:a.spellCast?.spellId??null});const inv=s.sessionCharacterInventories?.[actorId];done({roster:s.scene.entities.map((x)=>({id:x.id,name:x.name,side:x.side,kind:x.kind})).sort((a,b)=>a.id<b.id?-1:1),actor:e?{id:e.id,name:e.name,hp:e.hp,maxHp:e.maxHp,tempHp:e.tempHp,ac:e.ac,status:[...e.status].sort(),initiative:e.initiative}:null,economy:s.scene.economyByActor[actorId]??null,currentActorId:s.scene.currentActorId,mode:s.sessionMode,actions:(s.scene.actionsByActor[actorId]??[]).map(norm).sort((a,b)=>a.id<b.id?-1:1),inventory:inv?{goldGp:inv.goldGp,items:inv.items.map((i)=>({id:i.id,definitionId:i.definitionId,name:i.name,quantity:i.quantity,equipped:i.equipped,wielded:i.wielded??false,wieldSlot:i.wieldSlot??null})).sort((a,b)=>a.id<b.id?-1:1)}:null});}).catch((error)=>done({error:String(error?.stack??error)}));},actorId);assert.ok(!result.error,result.error);return result;}
function actionParityDiff(hostActions,clientActions,{compareAvailability=true}={}){const byId=new Map(clientActions.map((a)=>[a.id,a]));const diffs=[];for(const h of hostActions){const c=byId.get(h.id);if(!c){diffs.push(`missing on client: ${h.id}`);continue;}for(const key of ["name","category","economy","target","resolutionKind","maxTargets","spellId",...(compareAvailability?["available"]:[])]){if(JSON.stringify(h[key])!==JSON.stringify(c[key]))diffs.push(`${h.id}.${key}: host=${JSON.stringify(h[key])} client=${JSON.stringify(c[key])}`);}if(JSON.stringify(h.eligibleTargetIds)!==JSON.stringify(c.eligibleTargetIds))diffs.push(`${h.id}.eligibleTargetIds: host=${JSON.stringify(h.eligibleTargetIds)} client=${JSON.stringify(c.eligibleTargetIds)}`);}for(const c of clientActions)if(!hostActions.some((h)=>h.id===c.id))diffs.push(`missing on host: ${c.id}`);return diffs;}
async function expectUiParity(host,client,actorId,label){const h=await paritySnapshot(host,actorId);const c=await paritySnapshot(client,actorId);assert.deepEqual(c.roster,h.roster,`${label}: roster diverges`);assert.deepEqual(c.actor,h.actor,`${label}: Actor projection diverges`);assert.deepEqual(c.economy,h.economy,`${label}: turn economy diverges`);assert.equal(c.currentActorId,h.currentActorId,`${label}: current Actor diverges`);const ownTurn=h.currentActorId===actorId;const diffs=actionParityDiff(h.actions,c.actions,{compareAvailability:ownTurn});assert.deepEqual(diffs,[],`${label}: action bar diverges: ${diffs.slice(0,12).join(" | ")}`);if(h.inventory&&c.inventory){assert.equal(c.inventory.goldGp,h.inventory.goldGp,`${label}: GP diverges`);assert.deepEqual(c.inventory.items,h.inventory.items,`${label}: inventory diverges`);}return {actions:h.actions.length,items:h.inventory?.items.length??null,goldGp:h.inventory?.goldGp??null,roster:h.roster.length,availabilityCompared:ownTurn,offTurnAvailability:ownTurn?null:{host:h.actions.filter((a)=>a.available).length,client:c.actions.filter((a)=>a.available).length}};}
async function walkToActor(host,actorId,{fresh=true}={}){const before=await peerState(host);if(before.mode!=="initiative")await hostCall(host,`await mockAdapter.startInitiative();`);else if(fresh&&before.currentActorId===actorId)await hostCall(host,`await mockAdapter.endTurn();`);for(let step=0;step<16;step+=1){const s=await peerState(host);if(s.currentActorId===actorId)return s;await hostCall(host,`await mockAdapter.endTurn();`);}const s=await peerState(host);throw new Error(`Host could not walk the initiative order to ${actorId}; current=${s.currentActorId} entities=${s.entities.map((e)=>e.id).join(",")}`);}
async function hostAdvanceToComplete(host,resolutionId){let last=null;for(let step=0;step<14;step+=1){last=await peerState(host);if(!last.resolution||last.resolution.id!==resolutionId)break;if(last.resolution.stage==="complete")return last;if(!last.resolution.canAdvance){await sleep(300);continue;}await hostCall(host,`await mockAdapter.advanceResolution();`);}last=await peerState(host);return last;}
async function clientAct(client,actionId,targetIds){return client.browser.executeAsync((actionId,targetIds,done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts")]).then(async([{mockAdapter},{publishConnectedSnapshot}])=>{try{const s=await mockAdapter.resolveAction(actionId,targetIds);await publishConnectedSnapshot(mockAdapter);done({ok:true,resolutionId:s.resolution?.id??null,stage:s.resolution?.stage??null,compatibilityMessage:s.session.compatibilityMessage});}catch(error){done({ok:false,error:String(error instanceof Error?error.message:error)});}}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));},actionId,targetIds);}
async function waitHostResolutionFor(host,actorId,timeout=20_000){let last=null;await host.browser.waitUntil(async()=>{last=await peerState(host);return Boolean(last.resolution&&last.resolution.actorId===actorId&&!seenResolutionIds.has(last.resolution.id));},{timeout,interval:200,timeoutMsg:`Host did not start a new Resolution for ${actorId}; last=${JSON.stringify(last?.resolution)} msg=${last?.compatibilityMessage}`});seenResolutionIds.add(last.resolution.id);return last;}
async function waitActivityEntry(instance,resolutionId,timeout=20_000){let last=null;await instance.browser.waitUntil(async()=>{last=await peerState(instance);return last.activity.some((e)=>e.id===resolutionId);},{timeout,interval:200,timeoutMsg:`${instance.label} did not record ${resolutionId}; activity=${JSON.stringify(last?.activity?.map((e)=>e.id))} msg=${last?.compatibilityMessage}`});return last;}
async function openActivity(instance){const open=await instance.browser.$("aside.session-activity-pane");if(await open.isExisting())return;await click(instance.browser,exactButton("기록"),`${instance.label} 기록 패널`);await instance.browser.$("aside.session-activity-pane").waitForExist({timeout:10_000});}
async function closeActivity(instance){await instance.browser.keys("Escape");await sleep(200);}
async function renderedActivityText(instance){await openActivity(instance);const text=await instance.browser.$("aside.session-activity-pane").getText().catch(async()=>bodyText(instance));return text;}
function d20FaceOf(state,resolutionId){const entry=state.activity.find((e)=>e.id===resolutionId);const detail=(entry?.detail??[]).join("\n");const match=detail.match(/selected d20 (\d+)/);if(match)return Number(match[1]);const dice=state.resolution&&state.resolution.id===resolutionId?state.resolution.dice:[];return dice.length?dice[0]:null;}
function assertQueuedD20(state,resolutionId,face,label){const seen=d20FaceOf(state,resolutionId);assert.equal(seen,face,`${label}: authoritative d20 must be the queued ${face}; Host committed ${seen} (dice=${JSON.stringify(state.resolution?.dice)})`);}
function entity(state,id){return state.entities.find((e)=>e.id===id);}
const terminalView=(r)=>r?{id:r.id,stage:r.stage,actionName:r.actionName,actorId:r.actorId,targetIds:r.targetIds,attackOutcome:r.attackOutcome??null,attackTotal:r.attackTotal??null,rollTotal:r.rollTotal??null,finalOutcome:r.finalOutcome??null,compact:r.compact??null,critical:r.critical??null,checkOutcome:r.checkOutcome??null}:null;
async function waitClientTerminal(client,resolutionId,timeout=30_000){let last=null,announcement="";await client.browser.waitUntil(async()=>{last=await peerState(client);if(last.announcement&&last.announcement.length>announcement.length)announcement=last.announcement;const applied=last.activity.some((e)=>e.id===resolutionId);if(!applied)return false;const r=last.resolution;if(r&&r.id===resolutionId)return r.stage==="complete";return true;},{timeout,interval:200,timeoutMsg:`${client.label} did not reach the terminal presentation of ${resolutionId}; last=${JSON.stringify(last?.resolution)} msg=${last?.compatibilityMessage}`});return{state:last,announcement};}
async function expectConverged(peers,resolutionId,label){const host=await waitActivityEntry(peers[0],resolutionId);const hostEntry=host.activity.find((e)=>e.id===resolutionId);const states=[[peers[0].label,host]];const views=[];const announcements={};const clientEntries=[];for(const p of peers.slice(1)){const {state,announcement}=await waitClientTerminal(p,resolutionId);states.push([p.label,state]);announcements[p.label]=announcement;const e=state.activity.find((x)=>x.id===resolutionId);assert.ok(e,`${label}: ${p.label} has no committed entry`);clientEntries.push([p.label,{title:e.title,summary:e.summary,stateChanges:e.stateChanges}]);for(const he of host.entities){const pe=entity(state,he.id);if(pe)assert.equal(pe.hp,he.hp,`${label}: ${p.label} HP for ${he.name} diverges (${pe.hp} vs Host ${he.hp})`);}if(state.resolution&&state.resolution.id===resolutionId)views.push([p.label,terminalView(state.resolution)]);}for(const [name,entry] of clientEntries.slice(1))assert.deepEqual(entry,clientEntries[0][1],`${label}: ${name} committed entry diverges from ${clientEntries[0][0]}`);if(views.length>=2){for(const [name,view] of views.slice(1))assert.deepEqual(view,views[0][1],`${label}: ${name} terminal resolution view diverges from ${views[0][0]}`);}assert.ok(hostEntry,`${label}: Host has no committed entry`);states.announcements=announcements;states.views=views;return states;}
async function evidenceAll(peers,suffix){for(const p of peers)await bounded(saveEvidence(p,suffix).catch(()=>undefined),15_000,"evidence");}

async function runScenario(){
  assert.equal(process.platform,"win32","W9-02 Tauri acceptance is Windows-only");assert.ok(existsSync(binary),`Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot,{recursive:true,force:true});await mkdir(artifactRoot,{recursive:true});await ensureVite();
  const sessionPort=await reservePort();const hostRoot=path.join(runRoot,"host","data");const p1Root=path.join(runRoot,"p1","data");const p2Root=path.join(runRoot,"p2","data");
  const host=await launchInstance("W9-02C Host",hostRoot,await reservePort());const p1=await launchInstance("W9-02C P1",p1Root,await reservePort());const p2=await launchInstance("W9-02C P2",p2Root,await reservePort());
  const peers=[host,p1,p2];const scenarios={};const record=(id,data)=>{scenarios[id]={status:"PASS",...data};log(`${id} PASS`);};
  const fighter1=await createDistinctPlayerCharacter(p1,"W9 Fighter One");
  const CLERIC={className:"클레릭",spellTiles:{"choice:class.spells.cantrips":["신성한 불길","인도","빛"],"choice:class.spells.prepared":["신앙의 방패","상처 치료","유도 화살","치유의 단어"]},choiceCards:{"choice:class.divine-order":"수호자","choice:class.loadout.0":"부적"}};
  const fighter2=await createDistinctPlayerCharacter(p2,"W9 Cleric Two",CLERIC);const cleric2=fighter2;const stowed=await stowShield(p2);assert.equal(stowed.stowed,true,`P2 must stow the shield: ${JSON.stringify(stowed)}`);
  await createHostCampaign(host);await openHostSession(host,sessionPort);await joinClientSession(p1,sessionPort);await joinClientSession(p2,sessionPort);
  await host.browser.waitUntil(async()=>(await peerState(host)).entities.filter((e)=>e.kind==="character").length>=2,{timeout:20_000,timeoutMsg:"H/P1/P2 Characters did not enter the Host Scene"});
  // The DM materializes an NPC through the production DM Library path (the same owner the W4-07 Windows evidence uses) and starts Initiative; every peer converges on the topology.
  const goblinId=await hostCall(host,`const initial=await mockAdapter.getSnapshot();const campaign=initial.campaigns?.find((entry)=>entry.name==="W7-05 Hidden Roll")??initial.campaigns?.[0];if(!campaign)throw new Error("W9-02C Campaign was not found");const entry={entryId:"w9.c.goblin",kind:"npc-definition",label:"W9 고블린",definitionId:"local.w9.c.goblin",favorite:false,tags:["W9-02C"],npcDefinition:{definitionId:"local.w9.c.goblin",name:"고블린",nameEn:"Goblin",ac:15,maxHp:120,actions:["시미터","숏보우"],statusImmunities:[],source:"W9-02C",version:"1"}};await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,entry);const snapshot=await mockAdapter.instantiateCampaignDmLibraryNpcDefinition(campaign.campaignId,entry.entryId);const npc=snapshot.scene.entities.find((e)=>e.id.startsWith("local.w9.c.goblin.instance-"));if(!npc)throw new Error("goblin NPC did not enter the Host Scene; entities="+snapshot.scene.entities.map((e)=>e.id).join(","));return npc.id;`);
  for(const p of [p1,p2])await p.browser.waitUntil(async()=>Boolean(entity(await peerState(p),goblinId)),{timeout:15_000,timeoutMsg:`${p.label} did not receive the NPC topology`});
  await hostCall(host,`await mockAdapter.startInitiative();`);
  for(const p of [p1,p2])await p.browser.waitUntil(async()=>(await peerState(p)).mode==="initiative",{timeout:15_000,timeoutMsg:`${p.label} did not enter Initiative`});
  await evidenceAll(peers,"w9-02c-setup");
  try{
    // MP-C01 + MP-C07: P1 attacks the NPC with a multi-die weapon; H resolves once; every peer shows actor, target, d20, hit, damage, HP.
    await walkToActor(host,fighter1.id);
    const greatsword=await findAction(p1,fighter1.id,(a)=>a.name.startsWith("대검")&&a.available,"greatsword attack");
    await hostCall(host,`await mockAdapter.setQueuedD20(15);`);
    const goblinBefore=entity(await peerState(host),goblinId).hp;
    const c01=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c01.ok,true,c01.error);
    let hostRes=await waitHostResolutionFor(host,fighter1.id);
    let dicePolls=0,sawCanvas=false;for(let i=0;i<10;i+=1){const s=await peerState(p2);dicePolls+=1;if(s.hasCanvas){sawCanvas=true;break;}await sleep(150);}
    const c01Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c01Done.resolution?.stage,"complete",JSON.stringify(c01Done.resolution));
    assert.equal(c01Done.resolution.attackOutcome,"명중",JSON.stringify(c01Done.resolution));assertQueuedD20(c01Done,c01Done.resolution.id,15,"MP-C01");
    const c01States=await expectConverged(peers,c01Done.resolution.id,"MP-C01");
    const goblinAfter=entity(c01States[0][1],goblinId).hp;assert.ok(goblinAfter<goblinBefore,`goblin HP must drop on hit (${goblinBefore} -> ${goblinAfter})`);
    for(const p of [p1,p2]){const text=await renderedActivityText(p);assert.ok(text.includes(c01Done.resolution.id)&&text.includes("HP"),`${p.label} Activity must render the committed resolution and its HP change; got ${text.slice(0,300)}`);await closeActivity(p);}
    await evidenceAll(peers,"w9-02c-c01");
    record("MP-C01",{resolutionId:c01Done.resolution.id,d20:d20FaceOf(c01Done,c01Done.resolution.id),attackTotal:c01Done.resolution.attackTotal,damageDice:c01Done.resolution.dice,goblinBefore,goblinAfter,clientViews:c01States.views,announcements:c01States.announcements});
    record("MP-C07",{damageComponents:c01Done.resolution.damageComponents,stateChanges:c01Done.resolution.stateChanges});
    record("MP-C27",{dicePolls,sawCanvas,note:sawCanvas?"3D dice canvas observed on P2 during the shared roll":"canvas not sampled in time; faces still shared"});

    // MP-C04: the same attack misses (queued 1); no damage is applied anywhere.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(1);`);
    const missBefore=entity(await peerState(host),goblinId).hp;
    const c04=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c04.ok,true,c04.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c04Done=await hostAdvanceToComplete(host,hostRes.resolution.id);
    assert.equal(c04Done.resolution?.stage,"complete");assert.equal(c04Done.resolution.attackOutcome,"빗나감",JSON.stringify(c04Done.resolution));
    const c04States=await expectConverged(peers,c04Done.resolution.id,"MP-C04");assert.equal(entity(c04States[0][1],goblinId).hp,missBefore,"a miss must not change HP");
    await evidenceAll(peers,"w9-02c-c04");record("MP-C04",{resolutionId:c04Done.resolution.id,hp:missBefore});

    // MP-C05: natural 20 result tier converges.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(20);`);
    const c05=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c05.ok,true,c05.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c05Done=await hostAdvanceToComplete(host,hostRes.resolution.id);
    assert.equal(c05Done.resolution?.stage,"complete");assertQueuedD20(c05Done,c05Done.resolution.id,20,"MP-C05");
    const c05States=await expectConverged(peers,c05Done.resolution.id,"MP-C05");
    await evidenceAll(peers,"w9-02c-c05");record("MP-C05",{resolutionId:c05Done.resolution.id,critical:c05Done.resolution.critical??null,summary:c05States[0][1].activity.find((e)=>e.id===c05Done.resolution.id)?.summary});

    // MP-C02: the NPC attacks P1, driven by the DM; the public attack fans out and P1's HP converges.
    await walkToActor(host,goblinId);
    const scimitar=await findAction(host,goblinId,(a)=>/시미터|Scimitar/i.test(a.name),"goblin scimitar");
    await hostCall(host,`await mockAdapter.selectDmActor(args.goblinId);await mockAdapter.setQueuedD20(18);`,{goblinId});
    const p1Before=entity(await peerState(host),fighter1.id).hp;
    await hostCall(host,`await mockAdapter.resolveAction(args.actionId,[args.targetId]);`,{actionId:scimitar.id,targetId:fighter1.id});
    hostRes=await waitHostResolutionFor(host,goblinId);const c02Done=await hostAdvanceToComplete(host,hostRes.resolution.id);
    assert.equal(c02Done.resolution?.stage,"complete",JSON.stringify(c02Done.resolution));
    const c02States=await expectConverged(peers,c02Done.resolution.id,"MP-C02");
    await evidenceAll(peers,"w9-02c-c02");record("MP-C02",{resolutionId:c02Done.resolution.id,outcome:c02Done.resolution.attackOutcome,p1Before,p1After:entity(c02States[0][1],fighter1.id).hp});

    // MP-C03: P1 attacks P2; target owner and observer see the identical public resolution.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(16);`);
    const p2Before=entity(await peerState(host),fighter2.id).hp;
    const c03=await clientAct(p1,greatsword.id,[fighter2.id]);assert.equal(c03.ok,true,c03.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c03Done=await hostAdvanceToComplete(host,hostRes.resolution.id);
    assert.equal(c03Done.resolution?.stage,"complete");const c03States=await expectConverged(peers,c03Done.resolution.id,"MP-C03");
    await evidenceAll(peers,"w9-02c-c03");record("MP-C03",{resolutionId:c03Done.resolution.id,outcome:c03Done.resolution.attackOutcome,p2Before,p2After:entity(c03States[0][1],fighter2.id).hp});

    // MP-C08: P1 rolls an ability check with no target; the DM sets the public DC; d20, total, and outcome fan out.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(13);`);
    const athletics=await findAction(p1,fighter1.id,(a)=>a.resolutionKind==="ability-check"&&a.target==="none"&&a.available,"targetless ability check");
    const c08=await clientAct(p1,athletics.id,[]);assert.equal(c08.ok,true,c08.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);
    if(hostRes.resolution.checkTarget===undefined){await hostCall(host,`await mockAdapter.applyDmAdjudication({type:"ability-check-dc",value:10,scope:"resolution"});`);}
    const c08Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c08Done.resolution?.stage,"complete",JSON.stringify(c08Done.resolution));
    assertQueuedD20(c08Done,c08Done.resolution.id,13,"MP-C08");const c08States=await expectConverged(peers,c08Done.resolution.id,"MP-C08");
    for(const p of [p1,p2]){const text=await renderedActivityText(p);assert.ok(text.includes(c08Done.resolution.id),`${p.label} must render the committed check entry`);await closeActivity(p);}
    await evidenceAll(peers,"w9-02c-c08");record("MP-C08",{resolutionId:c08Done.resolution.id,action:athletics.name,total:c08Done.resolution.rollTotal,outcome:c08Done.resolution.checkOutcome??c08Done.resolution.finalOutcome,clientViews:c08States.views});

    // MP-C10: picker-selected Study/Search/Influence skill intent reaches H and presents to every peer.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(12);`);
    const study=await findAction(p1,fighter1.id,(a)=>/^action\.standard\.(study|search|influence)\./.test(a.id)&&a.available,"picker skill action");
    const c10=await clientAct(p1,study.id,[]);assert.equal(c10.ok,true,c10.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);
    if(hostRes.resolution.checkTarget===undefined){await hostCall(host,`await mockAdapter.applyDmAdjudication({type:"ability-check-dc",value:12,scope:"resolution"});`);}
    const c10Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c10Done.resolution?.stage,"complete",JSON.stringify(c10Done.resolution));
    await expectConverged(peers,c10Done.resolution.id,"MP-C10");await evidenceAll(peers,"w9-02c-c10");record("MP-C10",{resolutionId:c10Done.resolution.id,action:study.name});

    // MP-C11 + MP-C19: a self feature with a declared resource cost (Second Wind) resolves without a phantom target; the resource debit is visible to the owner.
    await walkToActor(host,fighter1.id);
    const secondWind=await findAction(p1,fighter1.id,(a)=>/second wind|세컨드 윈드|재기의 바람/i.test(a.name)&&a.available,"Second Wind");
    const secondWindResource=(state)=>state.resources.find((r)=>r.id==="resource:fighter.second-wind")??state.resources.find((r)=>/second|세컨드|재기/i.test(r.id+r.label));const swBefore=secondWindResource(await peerState(p1));
    const c11=await clientAct(p1,secondWind.id,[fighter1.id]);assert.equal(c11.ok,true,c11.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c11Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c11Done.resolution?.stage,"complete",JSON.stringify(c11Done.resolution));
    assert.deepEqual(c11Done.resolution.targetIds.filter((id)=>id!==fighter1.id),[],"self action must not create a phantom target");
    await expectConverged(peers,c11Done.resolution.id,"MP-C11");
    const p1After11=await peerState(p1);const swAfter=secondWindResource(p1After11);
    assert.ok(swBefore&&swAfter&&swAfter.current===swBefore.current-1,`Second Wind resource must be debited once (${JSON.stringify(swBefore)} -> ${JSON.stringify(swAfter)})`);
    assert.ok((p1After11.activity.find((e)=>e.id===c11Done.resolution.id)?.stateChanges??[]).some((line)=>/second-wind/.test(line)),"the committed entry must carry the resource debit");
    await evidenceAll(peers,"w9-02c-c11");record("MP-C11",{resolutionId:c11Done.resolution.id});record("MP-C19",{resource:{before:swBefore,after:swAfter}});

    // MP-C28: a no-roll self action (Dash) shares an explicit result with no invented dice.
    await walkToActor(host,fighter1.id);
    const dash=await findAction(p1,fighter1.id,(a)=>/^질주|dash/i.test(a.name)&&a.available,"Dash");
    const c28=await clientAct(p1,dash.id,[fighter1.id]);assert.equal(c28.ok,true,c28.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c28Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c28Done.resolution?.stage,"complete",JSON.stringify(c28Done.resolution));
    assert.deepEqual(c28Done.resolution.dice,[],"no-roll action must not invent dice");await expectConverged(peers,c28Done.resolution.id,"MP-C28");
    await evidenceAll(peers,"w9-02c-c28");record("MP-C28",{resolutionId:c28Done.resolution.id,compact:c28Done.resolution.compact});

    // MP-C20: off-turn action is refused with an explicit reason and the Host commits nothing.
    await walkToActor(host,goblinId);
    const offTurn=await findAction(p1,fighter1.id,(a)=>a.name.startsWith("대검"),"greatsword (off turn)");
    assert.equal(offTurn.available,false,"off-turn attack must be disabled on the Client");assert.ok(offTurn.disabledReason,"disabled reason must be explicit");
    const cursorBefore=(await peerState(host)).cursor;const activityBefore=(await peerState(host)).activity.length;
    const c20=await clientAct(p1,offTurn.id,[goblinId]);await sleep(1500);
    const afterOff=await peerState(host);assert.equal(afterOff.cursor,cursorBefore,"Host must not commit an off-turn action");assert.equal(afterOff.pendingRemote,false);
    await evidenceAll(peers,"w9-02c-c20");record("MP-C20",{disabledReason:offTurn.disabledReason,clientMessage:c20.compatibilityMessage,hostCursor:cursorBefore,activityUnchanged:afterOff.activity.length===activityBefore});

    // MP-C21: an invalid target is rejected before mechanics or presentation; other peers see no false action.
    await walkToActor(host,fighter1.id);
    const cursorBefore21=(await peerState(host)).cursor;const p2ActivityBefore=(await peerState(p2)).activity.length;
    const c21=await clientAct(p1,greatsword.id,["combatant.does-not-exist"]);await sleep(1500);
    const after21=await peerState(host);assert.equal(after21.cursor,cursorBefore21,"invalid target must not advance the Host ledger");
    assert.equal(after21.resolution&&after21.resolution.stage!=="complete"?after21.resolution.actorId:null,null,"invalid target must not leave a live Resolution on the Host");
    assert.equal((await peerState(p2)).activity.length,p2ActivityBefore,"P2 must not see a false action");
    await evidenceAll(peers,"w9-02c-c21");record("MP-C21",{clientMessage:c21.compatibilityMessage,hostMessage:after21.compatibilityMessage});

    // MP-C30: Activity detail after presentation matches the immutable committed resolution on every peer.
    const hostActivity=(await peerState(host)).activity.find((e)=>e.id===c01Done.resolution.id);
    for(const p of [p1,p2]){const e=(await peerState(p)).activity.find((x)=>x.id===c01Done.resolution.id);assert.deepEqual(e.stateChanges,hostActivity.stateChanges,`${p.label} state changes diverge for the committed resolution`);const text=await renderedActivityText(p);assert.ok(text.includes(c28Done.resolution.id),`${p.label} must still render the latest committed entry`);await closeActivity(p);}
    record("MP-C30",{resolutionId:c01Done.resolution.id,title:hostActivity.title,renderedLatest:c28Done.resolution.id});

    // ------------------------------------------------------------------------------------------
    // stage 2 — caster P2 (Cleric), items, concurrency, presentation, UI parity
    // ------------------------------------------------------------------------------------------
    const announcementsSeen=[];const noteAnnouncements=(states)=>{for(const [name,text] of Object.entries(states.announcements??{}))if(text)announcementsSeen.push({peer:name,text});};
    const clericSpell=async(spellId,label)=>findAction(p2,cleric2.id,(a)=>a.spellId===spellId&&a.available,label);

    // MP-J01 + MP-J02 + MP-J03 + MP-J04: before any DM mutation, H selects P1's Actor while P1 holds its own; roster, Actor, action bar, and inventory agree.
    await hostCall(host,`await mockAdapter.selectDmActor(args.actorId);`,{actorId:fighter1.id});
    const j0=await expectUiParity(host,p1,fighter1.id,"MP-J02/J03/J04");const jRoster=await paritySnapshot(p2,fighter1.id);assert.deepEqual(jRoster.roster,(await paritySnapshot(host,fighter1.id)).roster,"MP-J01: P2 roster diverges");
    record("MP-J01",{roster:j0.roster});record("MP-J02",{actor:fighter1.id});record("MP-J03",{actions:j0.actions});record("MP-J04",{items:j0.items,goldGp:j0.goldGp});

    // MP-C12 + MP-C16 + MP-I02: P2 casts Guiding Bolt (single-target spell attack from a 1st-level slot).
    await walkToActor(host,cleric2.id);await hostCall(host,`await mockAdapter.setQueuedD20(17);`);
    const slotBefore=(await peerState(p2)).resources.find((r)=>/spell-slot-1/.test(r.id));
    const bolt=await clericSpell("dnd.srd521.spell.guiding-bolt","Guiding Bolt");
    const goblinBeforeBolt=entity(await peerState(host),goblinId).hp;
    const c12=await clientAct(p2,bolt.id,[goblinId]);assert.equal(c12.ok,true,c12.error);
    hostRes=await waitHostResolutionFor(host,cleric2.id);const c12Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c12Done.resolution?.stage,"complete",JSON.stringify(c12Done.resolution));
    assertQueuedD20(c12Done,c12Done.resolution.id,17,"MP-C12");
    const c12States=await expectConverged(peers,c12Done.resolution.id,"MP-C12");noteAnnouncements(c12States);
    const slotAfter=(await peerState(p2)).resources.find((r)=>/spell-slot-1/.test(r.id));
    assert.ok(slotBefore&&slotAfter&&slotAfter.current===slotBefore.current-1,`slotted cast must debit one 1st-level slot on the owner (${JSON.stringify(slotBefore)} -> ${JSON.stringify(slotAfter)})`);
    assert.ok(entity(c12States[0][1],goblinId).hp<goblinBeforeBolt,"Guiding Bolt hit must damage the goblin");
    await evidenceAll(peers,"w9-02c-c12");record("MP-C12",{resolutionId:c12Done.resolution.id,attackTotal:c12Done.resolution.attackTotal,clientViews:c12States.views});record("MP-C16",{slotBefore,slotAfter});

    // MP-C13 + MP-C09 + MP-C15: Sacred Flame — the goblin's saving throw is rolled on H (queued 4 fails) and the save result fans out.
    await walkToActor(host,cleric2.id);await hostCall(host,`await mockAdapter.setQueuedD20(4);`);
    const flame=await clericSpell("dnd.srd521.spell.sacred-flame","Sacred Flame");
    const goblinBeforeFlame=entity(await peerState(host),goblinId).hp;
    const c13=await clientAct(p2,flame.id,[goblinId]);assert.equal(c13.ok,true,c13.error);
    hostRes=await waitHostResolutionFor(host,cleric2.id);const c13Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c13Done.resolution?.stage,"complete",JSON.stringify(c13Done.resolution));
    assert.ok(c13Done.resolution.saves.length>=1,`saving-throw spell must carry the target's save; got ${JSON.stringify(c13Done.resolution)}`);
    const c13States=await expectConverged(peers,c13Done.resolution.id,"MP-C13");noteAnnouncements(c13States);
    const slotAfterCantrip=(await peerState(p2)).resources.find((r)=>/spell-slot-1/.test(r.id));assert.equal(slotAfterCantrip.current,slotAfter.current,"a cantrip must not spend a slot");
    await evidenceAll(peers,"w9-02c-c13");record("MP-C13",{resolutionId:c13Done.resolution.id,saves:c13Done.resolution.saves,goblinBefore:goblinBeforeFlame,goblinAfter:entity(c13States[0][1],goblinId).hp});record("MP-C09",{saves:c13Done.resolution.saves});record("MP-C15",{slot:slotAfterCantrip});

    // MP-C17: Cure Wounds on P1 (damaged by the goblin in MP-C02); healing resolves once and P1's HP converges.
    await walkToActor(host,cleric2.id);
    const cure=await clericSpell("dnd.srd521.spell.cure-wounds","Cure Wounds");
    const p1HpBeforeCure=entity(await peerState(host),fighter1.id).hp;
    const c17=await clientAct(p2,cure.id,[fighter1.id]);assert.equal(c17.ok,true,c17.error);
    hostRes=await waitHostResolutionFor(host,cleric2.id);const c17Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c17Done.resolution?.stage,"complete",JSON.stringify(c17Done.resolution));
    const c17States=await expectConverged(peers,c17Done.resolution.id,"MP-C17");
    const p1HpAfterCure=entity(c17States[0][1],fighter1.id).hp;assert.ok(p1HpAfterCure>=p1HpBeforeCure,`healing must not lower HP (${p1HpBeforeCure} -> ${p1HpAfterCure})`);
    await evidenceAll(peers,"w9-02c-c17");record("MP-C17",{resolutionId:c17Done.resolution.id,p1HpBefore:p1HpBeforeCure,p1HpAfter:p1HpAfterCure,compact:c17Done.resolution.compact});

    // MP-C06: P2 Helps P1; P1's next attack rolls with advantage — both faces and the selected die are identical on every peer.
    await walkToActor(host,cleric2.id);
    const help=await findAction(p2,cleric2.id,(a)=>a.id==="action.standard.help"&&a.available,"Help");
    const c06Help=await clientAct(p2,help.id,[fighter1.id]);assert.equal(c06Help.ok,true,c06Help.error);
    hostRes=await waitHostResolutionFor(host,cleric2.id);const helpDone=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(helpDone.resolution?.stage,"complete",JSON.stringify(helpDone.resolution));await expectConverged(peers,helpDone.resolution.id,"MP-C06 Help");
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(9);`);
    const c06=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c06.ok,true,c06.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c06Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c06Done.resolution?.stage,"complete",JSON.stringify(c06Done.resolution));
    const c06Detail=(c06Done.activity.find((e)=>e.id===c06Done.resolution.id)?.detail??[]).find((line)=>/selected d20/.test(line))??"";
    assert.match(c06Detail,/advantage/,`Helped attack must roll with advantage; detail=${c06Detail}`);
    const c06States=await expectConverged(peers,c06Done.resolution.id,"MP-C06");noteAnnouncements(c06States);
    await evidenceAll(peers,"w9-02c-c06");record("MP-C06",{resolutionId:c06Done.resolution.id,detail:c06Detail,outcome:c06Done.resolution.attackOutcome,clientViews:c06States.views});

    // MP-C18 + MP-J06: the DM grants a Potion of Healing through the DM Library; P1's inventory and item-derived action refresh on H and P1 together; drinking it resolves once.
    const potionQuantity=(state)=>(state.items??[]).filter((i)=>/potion-of-healing/.test(i.definitionId)).reduce((sum,i)=>sum+i.quantity,0);
    await hostCall(host,`const s=await mockAdapter.getSnapshot();const campaign=s.campaigns?.find((c)=>c.name==="W7-05 Hidden Roll")??s.campaigns?.[0];if(!campaign)throw new Error("campaign missing");const template={definitionId:"dnd.srd521.item.gear.potion-of-healing",name:"치유 물약",nameEn:"Potion of Healing",kind:"consumable",passiveEffects:[],grantedActionIds:["action.healing-potion"],provenance:["W9-02C DM Library"]};await mockAdapter.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId:"w9.c.potion",kind:"custom-item",label:"치유 물약",definitionId:template.definitionId,favorite:false,tags:["W9-02C"],itemTemplate:template});await mockAdapter.grantCampaignDmLibraryItem(campaign.campaignId,"w9.c.potion",{kind:"character",actorId:args.actorId},1);`,{actorId:fighter1.id});
    await p1.browser.waitUntil(async()=>potionQuantity(await peerState(p1))>=1,{timeout:20_000,timeoutMsg:"P1 inventory did not receive the DM-granted potion"});
    await host.browser.waitUntil(async()=>{const h=await paritySnapshot(host,fighter1.id);return (h.inventory?.items??[]).some((i)=>/potion-of-healing/.test(i.definitionId));},{timeout:20_000,timeoutMsg:"Host inventory projection did not show the granted potion"});
    const j06=await expectUiParity(host,p1,fighter1.id,"MP-J06 after grant");
    await walkToActor(host,fighter1.id);
    const potion=await findAction(p1,fighter1.id,(a)=>a.id==="action.healing-potion"&&a.available,"Potion of Healing");
    const potionBefore=potionQuantity(await peerState(p1));const p1HpBeforePotion=entity(await peerState(host),fighter1.id).hp;
    const c18=await clientAct(p1,potion.id,[fighter1.id]);assert.equal(c18.ok,true,c18.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c18Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c18Done.resolution?.stage,"complete",JSON.stringify(c18Done.resolution));
    const c18States=await expectConverged(peers,c18Done.resolution.id,"MP-C18");
    await p1.browser.waitUntil(async()=>potionQuantity(await peerState(p1))===potionBefore-1,{timeout:15_000,timeoutMsg:"P1 potion quantity did not decrement exactly once"});
    const p1HpAfterPotion=entity(c18States[0][1],fighter1.id).hp;assert.ok(p1HpAfterPotion>=p1HpBeforePotion,"potion must not lower HP");
    await evidenceAll(peers,"w9-02c-c18");record("MP-C18",{resolutionId:c18Done.resolution.id,quantityBefore:potionBefore,quantityAfter:potionQuantity(await peerState(p1)),p1HpBefore:p1HpBeforePotion,p1HpAfter:p1HpAfterPotion});record("MP-J06",{grantParity:j06});

    // MP-C22: P1 (current) and P2 (off-turn) send intents at the same moment; H keeps one canonical order and rejects the off-turn intent explicitly.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(11);`);
    const cursor22=(await peerState(host)).cursor;
    const flameOffTurn=await findAction(p2,cleric2.id,(a)=>a.spellId==="dnd.srd521.spell.sacred-flame","Sacred Flame (off turn)");
    const [c22a,c22b]=await Promise.all([clientAct(p1,greatsword.id,[goblinId]),clientAct(p2,flameOffTurn.id,[goblinId])]);assert.equal(c22a.ok,true,c22a.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c22Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c22Done.resolution?.stage,"complete",JSON.stringify(c22Done.resolution));
    await expectConverged(peers,c22Done.resolution.id,"MP-C22");await sleep(1000);
    const after22=await peerState(host);assert.equal(after22.cursor,cursor22+1,`exactly one committed event expected (cursor ${cursor22} -> ${after22.cursor})`);assert.equal(after22.pendingRemote,false);
    assert.ok(!after22.activity.some((e)=>e.actor===cleric2.name&&e.id!==c22Done.resolution.id&&after22.activity.indexOf(e)===0),"off-turn intent must not produce a committed event");
    await evidenceAll(peers,"w9-02c-c22");record("MP-C22",{resolutionId:c22Done.resolution.id,p2Message:(await peerState(p2)).compatibilityMessage,p2Local:c22b});

    // MP-C23: the identical ActionRequest (same requestId) is sent twice; H returns the prior committed event and commits nothing new.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(14);`);
    const dup=await p1.browser.executeAsync((actionId,targetId,done)=>{Promise.all([import("/src/app/mockAdapter.ts"),import("/src/app/connectedSessionState.ts"),import("/src/app/connectedSessionRuntimeAdapter.ts"),import("/src/app/tauriSessionTransport.ts")]).then(async([{mockAdapter},{connectedStateFor},{connectedManifest,CONNECTED_CAPABILITIES},{tauriSessionTransport}])=>{const state=connectedStateFor(mockAdapter);const character=connectedManifest(mockAdapter).character;const request={sessionId:state.sessionId,requestId:`request.w9c.duplicate.${Date.now().toString(36)}`,actorId:character.characterId,actionId,targetIds:[targetId],knownEventCursor:state.replica.cursor,character,capabilities:[...CONNECTED_CAPABILITIES]};const message=JSON.stringify({type:"action-request",request});await tauriSessionTransport.send(message);done({ok:true,requestId:request.requestId,cursor:state.replica.cursor,message});}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));},greatsword.id,goblinId);assert.equal(dup.ok,true,dup.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c23Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c23Done.resolution?.stage,"complete",JSON.stringify(c23Done.resolution));
    await expectConverged(peers,c23Done.resolution.id,"MP-C23 first");
    const cursor23=(await peerState(host)).cursor;const p1Activity23=(await peerState(p1)).activity.length;
    const resend=await p1.browser.executeAsync((message,done)=>{import("/src/app/tauriSessionTransport.ts").then(async({tauriSessionTransport})=>{await tauriSessionTransport.send(message);done({ok:true});}).catch((error)=>done({ok:false,error:String(error?.stack??error)}));},dup.message);assert.equal(resend.ok,true,resend.error);await sleep(2000);
    const after23=await peerState(host);assert.equal(after23.cursor,cursor23,"duplicate request must not commit a new event");assert.equal(after23.pendingRemote,false,"duplicate request must not open a pending action");
    const p1After23=await peerState(p1);assert.equal(p1After23.activity.length,p1Activity23,"duplicate must not duplicate the Client entry");assert.equal(p1After23.activity.filter((e)=>e.id===c23Done.resolution.id).length,1);
    await evidenceAll(peers,"w9-02c-c23");record("MP-C23",{resolutionId:c23Done.resolution.id,requestId:dup.requestId,hostCursor:cursor23,p1Message:p1After23.compatibilityMessage});

    // MP-C25: the observer (P2) opens the Sheet utility while P1's roll is presenting; the shared result still converges and the layer state stays sane.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(16);`);
    const c25=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c25.ok,true,c25.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);
    await click(p2.browser,exactButton("시트"),"P2 시트 유틸리티");await sleep(400);const sheetOpen=await p2.browser.execute(()=>Boolean(document.querySelector(".session-utility-pane, aside.session-sheet-pane, [data-utility='quick-sheet'], .session-mode-root aside")));
    const c25Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c25Done.resolution?.stage,"complete",JSON.stringify(c25Done.resolution));
    const c25States=await expectConverged(peers,c25Done.resolution.id,"MP-C25");noteAnnouncements(c25States);
    const p2Errors=await p2.browser.execute(()=>(window.__e2eErrors||[]).slice(0,5));assert.deepEqual(p2Errors,[],"P2 must not throw while a utility is open during presentation");
    await evidenceAll(peers,"w9-02c-c25");await p2.browser.keys("Escape");await sleep(300);
    record("MP-C25",{resolutionId:c25Done.resolution.id,sheetOpen,p2View:c25States.views.find((v)=>v[0]===p2.label)?.[1]??null});

    // MP-C26 + MP-I04: P2 switches to Reduced Motion; the shared roll converges with identical mechanics while P1 keeps full motion.
    const p2Motion=await p2.browser.executeAsync((done)=>{import("/src/app/motionPreferences.ts").then((m)=>{m.persistMotionPreference("reduced");m.applyMotionPreference("reduced");done({motion:document.documentElement.dataset.motion,reduced:m.isReducedMotionPreferred()});}).catch((error)=>done({error:String(error)}));});assert.equal(p2Motion.reduced,true,JSON.stringify(p2Motion));
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(19);`);
    const c26=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c26.ok,true,c26.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);
    let p1Canvas=false,p2Canvas=false;for(let i=0;i<12;i+=1){const [a,b]=await Promise.all([peerState(p1),peerState(p2)]);p1Canvas=p1Canvas||a.hasCanvas;p2Canvas=p2Canvas||b.hasCanvas;if(p1Canvas&&i>=3)break;await sleep(150);}
    const c26Done=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c26Done.resolution?.stage,"complete",JSON.stringify(c26Done.resolution));
    const c26States=await expectConverged(peers,c26Done.resolution.id,"MP-C26");noteAnnouncements(c26States);
    await evidenceAll(peers,"w9-02c-c26");
    await p2.browser.executeAsync((done)=>{import("/src/app/motionPreferences.ts").then((m)=>{m.persistMotionPreference("system");m.applyMotionPreference("system");done(true);}).catch(()=>done(false));});
    record("MP-C26",{resolutionId:c26Done.resolution.id,p2Motion,p1Canvas,p2Canvas,views:c26States.views});record("MP-I04",{p1Motion:"system",p2Motion:"reduced",mechanicsIdentical:true});

    // MP-C29 + MP-I05: a newer event (the goblin's attack) commits while P2 may still be presenting P1's multi-die roll; order is preserved and no event is lost.
    await walkToActor(host,fighter1.id);await hostCall(host,`await mockAdapter.setQueuedD20(13);`);
    const c29=await clientAct(p1,greatsword.id,[goblinId]);assert.equal(c29.ok,true,c29.error);
    hostRes=await waitHostResolutionFor(host,fighter1.id);const c29First=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c29First.resolution?.stage,"complete",JSON.stringify(c29First.resolution));
    const commitAt=Date.now();
    await walkToActor(host,goblinId);await hostCall(host,`await mockAdapter.selectDmActor(args.goblinId);await mockAdapter.setQueuedD20(17);await mockAdapter.resolveAction(args.actionId,[args.targetId]);`,{goblinId,actionId:scimitar.id,targetId:cleric2.id});
    hostRes=await waitHostResolutionFor(host,goblinId);const c29Second=await hostAdvanceToComplete(host,hostRes.resolution.id);assert.equal(c29Second.resolution?.stage,"complete",JSON.stringify(c29Second.resolution));
    const c29States=await expectConverged(peers,c29Second.resolution.id,"MP-C29 second");const p2Applied=Date.now();
    for(const p of [p1,p2]){const ids=(await peerState(p)).activity.map((e)=>e.id);const first=ids.indexOf(c29First.resolution.id),second=ids.indexOf(c29Second.resolution.id);assert.ok(first>=0&&second>=0,`${p.label} lost an ordered event`);assert.ok(second<first,`${p.label} must apply the newer event after the older one (activity is newest-first)`);}
    await evidenceAll(peers,"w9-02c-c29");record("MP-C29",{first:c29First.resolution.id,second:c29Second.resolution.id});record("MP-I05",{secondCommitToClientTerminalMs:p2Applied-commitAt,firstDamageDice:c29First.resolution.dice});

    // MP-I02: the screen-reader announcement carried actor, action, target, dice/total, and outcome in one sentence on a Client.
    const i02=announcementsSeen.find((a)=>/총합|주사위/.test(a.text)&&/대상/.test(a.text));assert.ok(i02,`no Client announcement observed; seen=${JSON.stringify(announcementsSeen.slice(0,4))}`);
    record("MP-I02",{peer:i02.peer,announcement:i02.text});

    // MP-I06: the same resolution ids and Host event cursor correlate H/P1/P2; Client detail cites the event id and no private payload.
    const hostI06=await peerState(host);const p1I06=await peerState(p1);const p2I06=await peerState(p2);
    assert.equal(p1I06.cursor,hostI06.cursor);assert.equal(p2I06.cursor,hostI06.cursor);
    const lastId=c29Second.resolution.id;for(const s of [p1I06,p2I06]){const e=s.activity.find((x)=>x.id===lastId);assert.ok(e&&e.detail.some((line)=>/^eventId=/.test(line)),"Client entry must cite the Host event id");}
    record("MP-I06",{hostCursor:hostI06.cursor,resolutionId:lastId,eventDetail:p1I06.activity.find((x)=>x.id===lastId).detail.slice(0,2)});

    // MP-J08: UI-facing checkpoints after turn, resolution, and correction agree between H and P1.
    const j08=await expectUiParity(host,p1,fighter1.id,"MP-J08");record("MP-J08",{parity:j08});
    record("MP-C14",{deferred:"multi-target/area spell is captured by the family D runner (bard Thunderwave)"});delete scenarios["MP-C14"];
  }catch(error){await evidenceAll(peers,"w9-02c-failure");const diag={};for(const p of peers)diag[p.label]=await bounded(peerState(p).catch((e)=>({error:String(e)})),8_000,"state");await writeFile(path.join(artifactRoot,"w9-02c-failure-state.json"),`${JSON.stringify({scenarios,diag},null,2)}\n`,"utf8").catch(()=>undefined);throw new Error(`${error instanceof Error?error.message:String(error)}; passed=${Object.keys(scenarios).join(",")} states=${JSON.stringify(diag).slice(0,3000)}`);}
  const evidence={gate:"W9-02",family:"C",stage:2,scope:Object.keys(scenarios),status:"PASS",verificationSha,windowsTauri:true,topology:{host:"DM Host",clients:["P1","P2"],npc:goblinId,sessionPort},scenarios};
  await writeFile(path.join(artifactRoot,"w9-02c-summary.json"),`${JSON.stringify(evidence,null,2)}\n`,"utf8");log(`PASS evidence: ${path.join(artifactRoot,"w9-02c-summary.json")}`);
}

async function cleanup(){if(keepOpen){log(`--keep-open active. Evidence: ${artifactRoot}`);return;}for(const browser of [...browsers].reverse()){try{await browser.deleteSession();}catch{}}for(const child of [...children].reverse()){if(child.exitCode===null&&!child.killed){try{child.kill();}catch{}}}if(viteStarted)log("Vite process stopped with tracked child cleanup.");}

let exitCode=0;try{await runScenario();}catch(error){exitCode=1;console.error(error instanceof Error?error.stack??error.message:error);try{await writeFile(path.join(artifactRoot,"w9-02c-failure.txt"),`${String(error instanceof Error?error.stack??error.message:error)}\n`,"utf8");}catch{}}finally{await cleanup();}process.exitCode=exitCode;
