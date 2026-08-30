from __future__ import annotations

import json
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


runtime_path = Path("src/domain/commonPlayOperationRuntime.ts")
runtime = runtime_path.read_text(encoding="utf-8")
runtime = replace_once(
    runtime,
    '  responder:"actor"|"target"|"actor-owner"|"target-owner";',
    '  responder:"actor"|"target"|"actor-owner"|"target-owner"|"dm"|"host";',
    "interaction responder type",
)
runtime = replace_once(
    runtime,
    '  if(interaction.responder!=="actor"&&interaction.responder!=="target"&&interaction.responder!=="actor-owner"&&interaction.responder!=="target-owner") throw new DomainEvaluationError(`${label}.responder must be actor, target, actor-owner, or target-owner for portable Common Play interaction`);',
    '  if(interaction.responder!=="actor"&&interaction.responder!=="target"&&interaction.responder!=="actor-owner"&&interaction.responder!=="target-owner"&&interaction.responder!=="dm"&&interaction.responder!=="host") throw new DomainEvaluationError(`${label}.responder must be actor, target, actor-owner, target-owner, dm, or host for portable Common Play interaction`);',
    "interaction responder validation",
)
runtime_path.write_text(runtime, encoding="utf-8")

schema_path = Path("schemas/common-play-contract.schema.json")
schema = json.loads(schema_path.read_text(encoding="utf-8"))
matched = 0
old_responders = ["actor", "target", "actor-owner", "target-owner"]
full_responders = [*old_responders, "dm", "host"]

def extend_responder(value):
    global matched
    if isinstance(value, dict):
        enum = value.get("enum")
        if enum == old_responders:
            value["enum"] = full_responders
            matched += 1
        elif enum == full_responders:
            matched += 1
        for child in value.values():
            extend_responder(child)
    elif isinstance(value, list):
        for child in value:
            extend_responder(child)

extend_responder(schema)
if matched != 1:
    raise SystemExit(f"interaction responder schema: expected one compatible enum, matched {matched}")
schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

adapter_path = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
adapter = adapter_path.read_text(encoding="utf-8")
old = '''  const selectedTargetResponder=interaction.responder==="target"||interaction.responder==="target-owner";
  const interactionResponder=selectedTargetResponder
    ?prepared.selectedTargets.length===1?prepared.selectedTargets[0]:undefined
    :prepared.actorEntity;
  if(!interactionResponder) {
    return failAction(prepared.internal,prepared.actor.id,actionId,actionName,targetIds,resolutionId,`${interaction.responder} interaction requires exactly one selected target`);
  }
'''
new = '''  const selectedTargetResponder=interaction.responder==="target"||interaction.responder==="target-owner";
  const authorityResponder=interaction.responder==="dm"||interaction.responder==="host";
  const interactionResponder=authorityResponder
    ?{id:`authority:${interaction.responder}`,name:interaction.responder==="dm"?"DM":"Host"}
    :selectedTargetResponder
      ?prepared.selectedTargets.length===1?prepared.selectedTargets[0]:undefined
      :prepared.actorEntity;
  if(!interactionResponder) {
    return failAction(prepared.internal,prepared.actor.id,actionId,actionName,targetIds,resolutionId,`${interaction.responder} interaction requires exactly one selected target`);
  }
'''
adapter = replace_once(adapter, old, new, "authority interaction responder")
adapter_path.write_text(adapter, encoding="utf-8")

test_path = Path("tests/ui/c9FamilyQAuthorityInteractionProduction.test.ts")
test_path.write_text('''import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";

type Responder="dm"|"host";
type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string};
const ORIGINAL:Identity={moduleId:"homebrew.authority-consent",contentId:"option.authority-consent",mechanicId:"external.unknown.authority-consent",entryPointId:"ask-authority"};
const RENAMED:Identity={moduleId:"third-party.renamed-authority",contentId:"option.renamed-authority",mechanicId:"portable.renamed-authority",entryPointId:"invoke-renamed-authority"};

function payload(identity:Identity,responder:Responder){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
  source:{document:"Authority Consent Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
  content:[{id:identity.contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Authority Consent",locales:{en:{name:"Authority Consent",description:"Portable DM/Host consent probe"}}},mechanics:[{kind:"common-play",config:{
    schemaVersion:"0.2-draft",id:identity.mechanicId,
    entryPoints:[{id:identity.entryPointId,invocation:"manual",interaction:{id:`${responder}-consent`,kind:"consent",responder,mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},targeting:{from:"targets",min:1,max:1},operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"target"}]}],
  }}]}]
});}

async function install(adapter:MockAdapter,identity:Identity,responder:Responder){
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity,responder));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}

async function run(identity:Identity,responder:Responder){
  const sessionId=`session.${identity.moduleId}.${responder}`,host=new MockAdapter();
  const actionId=await install(host,identity,responder);
  const internal=host as unknown as {activeCharacter:{id:string};scene:{entities:Array<{id:string;name:string;hp:number}>}};
  const actorId=internal.activeCharacter.id;
  const target=internal.scene.entities.find((entity)=>entity.id!==actorId&&entity.hp>0);
  assert.ok(target);
  const targetHpBefore=target.hp;
  await host.startInitiative();await host.setCurrentActor(actorId);

  const state=connectedStateFor(host);state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const peerManifest=structuredClone(connectedManifest(host));
  state.peerManifests.set("peer.actor",peerManifest);
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];
  const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[target.id]);
    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.interrupt?.responderId,`authority:${responder}`);
    assert.equal(snapshot.resolution?.interrupt?.responderName,responder==="dm"?"DM":"Host");
    assert.ok(!direct.map((entry)=>JSON.parse(entry.message)).some((wire)=>wire.type==="resolution-interrupt-prompt"),JSON.stringify(direct));
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===target.id)?.hp,targetHpBefore);

    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    const beforeUnauthorized=direct.length;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.actor",message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    const errors=direct.slice(beforeUnauthorized).map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(errors.at(-1)?.code,"interrupt-not-authorized",JSON.stringify(errors));
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt");

    await host.respondToInterrupt(true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===target.id)?.hp,targetHpBefore-1);
    assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
    return {responderId:`authority:${responder}`,hpDelta:-1};
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
}

for(const responder of ["dm","host"] as const)test(`${responder} consent stays host-authoritative, rejects remote Character responses, and is identity invariant`,async()=>{
  assert.deepEqual(await run(ORIGINAL,responder),await run(RENAMED,responder));
});
''', encoding="utf-8")

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry.get("family") == "Q")
row["currentState"] = (
    "Portable boolean consent supports actor, target, actor-owner, target-owner, DM, and Host responders through the existing blocking Resolution interrupt. "
    "Character-owned prompts route only to the authoritative owning peer; DM/Host prompts remain host-local and reject remote Character responses. Unknown installed Common Play "
    "preserves decline-before-commit, revalidation, atomic commit, connected broadcast, and identity-independent responder semantics. Rich choice/multiple-option payloads and the remaining reconnect/revision-stale response matrix remain incomplete."
)
for key, evidence in (
    ("implementationEvidence", "commonPlayOperationRuntime.ts and common-play-contract.schema.json represent dm|host alongside actor/target owner consent without content-name dispatch; installedCommonPlayRuntimeAdapter.ts projects authority:dm|authority:host responders through the existing blocking interrupt"),
    ("productionEvidence", "c9FamilyQAuthorityInteractionProduction.test.ts unknown installed DM and Host consent remains host-local, rejects remote Character responses, and commits downstream damage only after local authority approval"),
    ("identityInvarianceEvidence", "c9FamilyQAuthorityInteractionProduction.test.ts repeats DM/Host responder semantics after complete external module/content/mechanic/entry identity rename"),
    ("connectedEvidenceIfRelevant", "c9FamilyQAuthorityInteractionProduction.test.ts proves no peer interrupt prompt is routed for authority responders, remote Character response is rejected, and accepted host-local approval broadcasts the authoritative event batch"),
):
    if evidence not in row[key]: row[key].append(evidence)
row["remainingNamedSeams"] = [
    "choice and multiple-option interaction payloads are not yet represented by the boolean consent contract",
    "actor-owner and target-owner reconnect and revision-stale response evidence remain incomplete",
]
ledger_path.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
