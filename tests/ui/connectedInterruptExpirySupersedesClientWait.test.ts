import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { AppSnapshot, CharacterSheet, InterruptView } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { advanceConnectedResolutionPresentation, applyConnectedInterruptPrompt, applyConnectedResolutionPresentation, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { expireConnectedInterrupt } from "../../src/app/connectedActionRoutingAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type MutableApp={scene:AppSnapshot["scene"];activeCharacter:CharacterSheet};
type PresentationWire={type:"resolution-presentation";sessionId:string;presentation:ConnectedResolutionPresentationV1};
type PromptWire={type:"resolution-interrupt-prompt";sessionId:string;resolutionId:string;presentationSequence:number;interrupt:InterruptView};

function prepareClient(adapter:MockAdapter,sessionId:string,characterId:string) {
  const app=adapter as unknown as MutableApp;
  app.activeCharacter={...app.activeCharacter,id:characterId,name:app.scene.entities.find((entry)=>entry.id===characterId)?.name??characterId};
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family D, MP-D06): after the Host's authoritative timeout declined the
// owner's private prompt on a missed attack, the Host finished the Resolution but the owner (and the observer) stayed
// parked on the interrupt presentation — the attack-result/complete presentations carry no dice, so they were queued
// behind the interrupt wait forever.
test("presentations that follow a declined or expired interrupt supersede the Clients' interrupt wait",async()=>{
  const sessionId="session.interrupt-expiry-supersedes";
  const ownerPeer="peer.mira",observerPeer="peer.aelar";
  const host=new MockAdapter();
  const hostApp=host as unknown as MutableApp;
  const mira=hostApp.scene.entities.find((entry)=>entry.id==="char.mira");
  assert.ok(mira);
  mira.reactions=[{id:"reaction.mira.shield",name:"방패",trigger:"공격에 명중될 때",cost:"반응 1 · 주문 슬롯 1",effect:"이번 공격에 대한 AC +5",source:"Mira private spell",acBonus:5}];
  await host.setSessionMode("initiative");
  await host.setCurrentActor("combatant.goblin-a");
  await host.setQueuedD20(20);
  const state=connectedStateFor(host);
  state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const base=connectedManifest(host);
  state.peerManifests.set(ownerPeer,{...base,character:{characterId:"char.mira",sourceRevision:0,runtimeRevision:0}});
  state.peerManifests.set(observerPeer,{...base,character:{characterId:"char.aelar",sourceRevision:0,runtimeRevision:0}});
  const broadcasts:string[]=[],direct:Array<{peer:string;message:string}>=[];
  const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    let snapshot=await host.resolveAction("action.scimitar",["char.mira"]);
    snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"interrupt");
    const resolutionId=snapshot.resolution!.id;

    const owner=new MockAdapter(),observer=new MockAdapter();
    prepareClient(owner,sessionId,"char.mira");prepareClient(observer,sessionId,"char.aelar");
    const presentations=()=>broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire).filter((entry)=>entry.type==="resolution-presentation");
    let applied=0;
    const feed=async()=>{for(const wire of presentations().slice(applied)){applyConnectedResolutionPresentation(owner,wire.presentation);applyConnectedResolutionPresentation(observer,wire.presentation);applied+=1;}};
    await feed();
    // The UI plays queued presentations one after another; park both Clients on the interrupt stage.
    for(const client of [owner,observer]){for(let step=0;step<4&&(await client.getSnapshot()).resolution?.stage!=="interrupt";step+=1)advanceConnectedResolutionPresentation(client);}
    const prompt=direct.map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message) as PromptWire})).find((entry)=>entry.wire.type==="resolution-interrupt-prompt");
    assert.ok(prompt&&prompt.peer===ownerPeer);
    assert.equal(applyConnectedInterruptPrompt(owner,prompt.wire).status,"applied");
    assert.equal((await owner.getSnapshot()).resolution?.interrupt?.optionName,"방패","the owner holds the private prompt");
    assert.equal((await owner.getSnapshot()).resolution?.stage,"interrupt");
    assert.equal((await observer.getSnapshot()).resolution?.stage,"interrupt");

    // The Host's authoritative timeout declines the prompt and finishes the Resolution.
    assert.equal((await expireConnectedInterrupt(host,resolutionId)).status,"declined");
    for(let step=0;step<8;step+=1){const current=await host.getSnapshot();if(!current.resolution||current.resolution.stage==="complete"||!current.resolution.canAdvance)break;await host.advanceResolution();}
    assert.equal((await host.getSnapshot()).resolution?.stage,"complete");
    // The first presentation after the decline (attack-result) carries no dice stage: it must install over the
    // interrupt wait instead of queueing behind it.
    const next=presentations()[applied];assert.ok(next,"the Host must present what follows the declined prompt");
    assert.notEqual(next.presentation.resolution.stage,"interrupt");
    for(const [label,client] of [["owner",owner],["observer",observer]] as const){const status=applyConnectedResolutionPresentation(client,next.presentation);assert.equal(status.status,"replaced",`${label}: the follow-on presentation must supersede the interrupt wait (${JSON.stringify(status)})`);assert.equal((await client.getSnapshot()).resolution?.stage,next.presentation.resolution.stage,`${label} must show the follow-on stage immediately`);}
    applied+=1;
    await feed();

    for(const [label,client] of [["owner",owner],["observer",observer]] as const){
      const view=await client.getSnapshot();
      assert.equal(view.resolution?.id,resolutionId,`${label} still shows the same Resolution`);
      assert.notEqual(view.resolution?.stage,"interrupt",`${label} must leave the interrupt wait once the Host presents what follows`);
      assert.equal(view.resolution?.interrupt,undefined,`${label} must not keep a prompt the Host already declined`);
      assert.equal(connectedStateFor(client).privateInterruptsByResolution.has(resolutionId),false,`${label} drops the stored private prompt`);
    }
  }finally{if(state.interruptTimeout)clearTimeout(state.interruptTimeout);tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
});
