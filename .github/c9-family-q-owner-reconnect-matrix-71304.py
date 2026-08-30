import json
from pathlib import Path


test_path = Path("tests/ui/installedCommonPlayActorOwnerInteractionProduction.test.ts")
text = test_path.read_text()
old_import = 'import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";'
new_import = 'import { connectedManifest, resumeConnectedInterruptPromptForCharacter } from "../../src/app/connectedSessionRuntimeAdapter";'
if new_import not in text:
    if old_import not in text:
        raise SystemExit("actor-owner import anchor missing")
    text = text.replace(old_import, new_import, 1)

marker = "actor-owner pending consent resumes on owner reconnect and rejects the stale peer"
if marker not in text:
    text += r'''

test("actor-owner pending consent resumes on owner reconnect and rejects the stale peer",async()=>{
  const sessionId="session.actor-owner-reconnect",host=new MockAdapter();const actionId=await install(host);
  const internal=host as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};
  internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);
  internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  await host.startInitiative();await host.setCurrentActor(internal.activeCharacter.id);const before=await host.getSnapshot();
  const state=connectedStateFor(host);state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));state.peerManifests.set("peer.owner",connectedManifest(host));
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[internal.activeCharacter.id]);let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    state.peerManifests.delete("peer.owner");
    const reboundPeer="peer.owner.reconnected";state.peerManifests.set(reboundPeer,connectedManifest(host));
    const directBeforeReconnect=direct.length;
    assert.deepEqual(await resumeConnectedInterruptPromptForCharacter(host,reboundPeer,internal.activeCharacter.id),{status:"sent"});
    const resumed=direct.slice(directBeforeReconnect).map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message)})).find((entry)=>entry.wire.type==="resolution-interrupt-prompt");
    assert.equal(resumed?.peer,reboundPeer,JSON.stringify(direct.slice(directBeforeReconnect)));
    assert.equal(resumed?.wire.resolutionId,resolutionId);assert.equal(resumed?.wire.interrupt.id,promptId);
    const directBeforeStale=direct.length;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    const stale=direct.slice(directBeforeStale).map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(stale.at(-1)?.code,"interrupt-not-pending",JSON.stringify(stale));
    snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"interrupt");assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp);assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,true);
    assert.equal(await routeConnectedInterruptResponse(host,{peer:reboundPeer,message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp+5);assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,false);assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});
'''
test_path.write_text(text)

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
data = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in data["rows"] if entry["family"] == "Q")
row["currentState"] = row["currentState"].replace(
    "Rich choice/multiple-option and the remaining DM/Host responder and reconnect/stale-replay matrix remain incomplete.",
    "Owner reconnect plus stale/revision response rejection are production-proven; rich choice/multiple-option and the remaining DM/Host responder routing remain incomplete.",
)
production = "4f007c12506a3e33c4cf983410205b559130d526 feat(c9): resume owner consent after reconnect; target-owner reconnect rebinding preserves the pending interrupt and rejects the stale peer before authoritative commit"
connected = "installedCommonPlayActorOwnerInteractionProduction.test.ts and c9FamilyQTargetOwnerInteractionProduction.test.ts prove actor-owner and target-owner pending consent prompts resume on a rebound Character peer, reject the stale peer, and commit exactly once from the rebound owner"
if production not in row["productionEvidence"]:
    row["productionEvidence"].append(production)
if connected not in row["connectedEvidenceIfRelevant"]:
    row["connectedEvidenceIfRelevant"].append(connected)
row["remainingNamedSeams"] = [
    entry
    for entry in row["remainingNamedSeams"]
    if entry != "actor-owner and target-owner reconnect and revision-stale response evidence remain incomplete"
]
ledger_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
