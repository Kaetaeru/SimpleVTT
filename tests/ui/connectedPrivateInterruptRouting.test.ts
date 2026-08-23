import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CharacterSheet, InterruptView, SceneVm } from "../../src/app/contracts";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import {
  advanceConnectedResolutionPresentation,
  applyConnectedInterruptPrompt,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { expireConnectedInterrupt } from "../../src/app/connectedActionRoutingAdapter";

type MutableApp={scene:SceneVm;activeCharacter:CharacterSheet};
type PresentationWire={type:"resolution-presentation";sessionId:string;presentation:ConnectedResolutionPresentationV1};
type PromptWire={type:"resolution-interrupt-prompt";sessionId:string;resolutionId:string;presentationSequence:number;interrupt:InterruptView};

function prepareClient(adapter:MockAdapter,sessionId:string,characterId:string) {
  const app=adapter as unknown as MutableApp;
  app.activeCharacter={...app.activeCharacter,id:characterId,name:app.scene.entities.find((entry)=>entry.id===characterId)?.name??characterId};
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
}

test("public peers see only interrupt waiting while the eligible owner receives and answers the private prompt",async()=>{
  const sessionId="session.private-interrupt";
  const ownerPeer="peer.mira";
  const observerPeer="peer.aelar";
  const host=new MockAdapter();
  const hostApp=host as unknown as MutableApp;
  const mira=hostApp.scene.entities.find((entry)=>entry.id==="char.mira");
  assert.ok(mira);
  mira.reactions=[{id:"reaction.mira.shield",name:"방패",trigger:"공격에 명중될 때",cost:"반응 1 · 주문 슬롯 1",effect:"이번 공격에 대한 AC +5",source:"Mira private spell",acBonus:5}];
  await host.setSessionMode("initiative");
  await host.setCurrentActor("combatant.goblin-a");
  await host.setQueuedD20(20);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId=sessionId;
  state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const baseManifest=connectedManifest(host);
  state.peerManifests.set(ownerPeer,{...baseManifest,character:{characterId:"char.mira",sourceRevision:0,runtimeRevision:0}});
  state.peerManifests.set(observerPeer,{...baseManifest,character:{characterId:"char.aelar",sourceRevision:0,runtimeRevision:0}});

  const broadcasts:string[]=[];
  const direct:Array<{peer:string;message:string}>=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    let snapshot=await host.resolveAction("action.scimitar",["char.mira"]);
    snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"interrupt");

    const publicMessages=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire).filter((entry)=>entry.type==="resolution-presentation");
    const publicInterrupt=publicMessages.find((entry)=>entry.presentation.resolution.stage==="interrupt");
    assert.ok(publicInterrupt);
    assert.equal(publicInterrupt.presentation.resolution.interrupt,undefined);
    const publicText=JSON.stringify(publicInterrupt);
    assert.doesNotMatch(publicText,/방패|주문 슬롯|Mira private spell/);
    assert.match(publicInterrupt.presentation.resolution.compact,/비공개 반응 응답 대기/);

    const prompts=direct.map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message) as PromptWire})).filter((entry)=>entry.wire.type==="resolution-interrupt-prompt");
    assert.equal(prompts.length,1);
    assert.equal(prompts[0].peer,ownerPeer);
    assert.equal(prompts[0].wire.interrupt.responderId,"char.mira");

    const owner=new MockAdapter();
    const observer=new MockAdapter();
    prepareClient(owner,sessionId,"char.mira");
    prepareClient(observer,sessionId,"char.aelar");
    for(const message of publicMessages){
      applyConnectedResolutionPresentation(owner,message.presentation);
      applyConnectedResolutionPresentation(observer,message.presentation);
    }
    advanceConnectedResolutionPresentation(owner);
    advanceConnectedResolutionPresentation(observer);
    assert.equal((await owner.getSnapshot()).resolution?.interrupt,undefined,"public envelope must not reveal the owner prompt");
    assert.equal(applyConnectedInterruptPrompt(owner,prompts[0].wire).status,"applied");
    assert.equal(applyConnectedInterruptPrompt(observer,prompts[0].wire).status,"rejected");
    assert.equal((await owner.getSnapshot()).resolution?.interrupt?.optionName,"방패");
    assert.equal((await observer.getSnapshot()).resolution?.interrupt,undefined);

    const response={sessionId,resolutionId:snapshot.resolution!.id,promptId:"reaction.mira.shield",accept:true};
    assert.equal(await routeConnectedInterruptResponse(host,{peer:observerPeer,message:""},response),true);
    assert.equal((await host.getSnapshot()).resolution?.stage,"interrupt","spoofed observer response must not advance authority");
    assert.ok(direct.some((entry)=>entry.peer===observerPeer&&JSON.parse(entry.message).code==="interrupt-not-authorized"));

    assert.equal(await routeConnectedInterruptResponse(host,{peer:ownerPeer,message:""},response),true);
    const after=await host.getSnapshot();
    assert.equal(after.resolution?.stage,"attack-result");
    assert.equal(after.resolution?.interrupt,undefined);
    assert.equal(after.scene.economyByActor["char.mira"]?.reaction,false);
    assert.ok(broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire).some((entry)=>entry.type==="resolution-presentation"&&entry.presentation.resolution.stage==="attack-result"));
  }finally{
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});

test("expired owner interrupt is authoritatively declined once and public play resumes",async()=>{
  const sessionId="session.private-interrupt-timeout",peer="peer.mira.timeout";
  const host=new MockAdapter();const app=host as unknown as MutableApp;const mira=app.scene.entities.find((entry)=>entry.id==="char.mira")!;
  mira.reactions=[{id:"reaction.timeout",name:"비공개 방어",trigger:"명중",cost:"반응",effect:"AC +5",source:"private",acBonus:5}];
  await host.setSessionMode("initiative");await host.setCurrentActor("combatant.goblin-a");await host.setQueuedD20(20);
  const state=connectedStateFor(host);state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));state.peerManifests.set(peer,{...connectedManifest(host),character:{characterId:"char.mira",sourceRevision:0,runtimeRevision:0}});
  const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async()=>1;tauriSessionTransport.sendTo=async()=>1;
  try{let snapshot=await host.resolveAction("action.scimitar",["char.mira"]);snapshot=await host.advanceResolution();assert.equal(snapshot.resolution?.stage,"interrupt");assert.equal((await expireConnectedInterrupt(host,snapshot.resolution!.id)).status,"declined");snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"attack-result");assert.equal(snapshot.resolution?.interrupt,undefined);assert.equal((await expireConnectedInterrupt(host,snapshot.resolution!.id)).status,"ignored");}
  finally{if(state.interruptTimeout)clearTimeout(state.interruptTimeout);tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
