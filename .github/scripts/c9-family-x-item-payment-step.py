from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch anchor in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"regex patch count {count} in {path}: {pattern[:80]!r}")
    p.write_text(text)


domain = "src/domain/commonPlayOperationRuntime.ts"
replace_once(
    domain,
    'export type CommonPlayPayment=CommonPlayResourcePayment|CommonPlayEconomyPayment;',
    '''export type CommonPlayItemPayment={
  kind:"item";
  selector:{from:"items";definitionId:string};
  quantity:LiteralNumberExpression;
  consumed:true;
  consumeAt:"commit";
  refundOnCancel:true;
};

export type CommonPlayPayment=CommonPlayResourcePayment|CommonPlayEconomyPayment|CommonPlayItemPayment;''',
)
replace_once(
    domain,
    '  actionKind?:ActionUseKind;\n}',
    '  itemPaymentResourceIds?:Record<number,string>;\n  actionKind?:ActionUseKind;\n}',
)
replace_once(
    domain,
    'const ECONOMY_PAYMENT_KEYS=new Set(["kind","bucket","amount","consumeAt","refundOnCancel"]);',
    '''const ECONOMY_PAYMENT_KEYS=new Set(["kind","bucket","amount","consumeAt","refundOnCancel"]);
const ITEM_PAYMENT_KEYS=new Set(["kind","selector","quantity","consumed","consumeAt","refundOnCancel"]);
const ITEM_PAYMENT_SELECTOR_KEYS=new Set(["from","where","min","max"]);
const ITEM_PAYMENT_PREDICATE_KEYS=new Set(["op","left","right"]);''',
)
replace_once(
    domain,
    'function parsePayment(value:unknown,label:string):CommonPlayPayment {',
    '''function parseItemPaymentSelector(value:unknown,label:string):CommonPlayItemPayment["selector"] {
  const selector=object(value,label);
  supportedKeys(selector,ITEM_PAYMENT_SELECTOR_KEYS,label);
  if(selector.from!=="items") throw new DomainEvaluationError(`${label}.from must be items for portable Common Play item payment`);
  if(selector.min!==1||selector.max!==1) throw new DomainEvaluationError(`${label} must select exactly one item stack with min=1 and max=1`);
  const where=object(selector.where,`${label}.where`);
  supportedKeys(where,ITEM_PAYMENT_PREDICATE_KEYS,`${label}.where`);
  if(where.op!=="eq") throw new DomainEvaluationError(`${label}.where must use eq for portable Common Play item payment`);
  const left=object(where.left,`${label}.where.left`);
  const right=object(where.right,`${label}.where.right`);
  const leftIsDefinition=Object.keys(left).length===1&&left.ref==="item.definitionId";
  const rightIsDefinition=Object.keys(right).length===1&&right.ref==="item.definitionId";
  const leftValue=Object.keys(left).length===1&&typeof left.value==="string"?left.value:undefined;
  const rightValue=Object.keys(right).length===1&&typeof right.value==="string"?right.value:undefined;
  const definitionId=leftIsDefinition?rightValue:rightIsDefinition?leftValue:undefined;
  if(!definitionId) throw new DomainEvaluationError(`${label}.where must compare item.definitionId to one literal string`);
  return {from:"items",definitionId:nonEmptyString(definitionId,`${label}.where.definitionId`)};
}

function parsePayment(value:unknown,label:string):CommonPlayPayment {''',
)
replace_once(
    domain,
    '  if(payment.kind==="economy") {',
    '''  if(payment.kind==="item") {
    supportedKeys(payment,ITEM_PAYMENT_KEYS,label);
    const selector=parseItemPaymentSelector(payment.selector,`${label}.selector`);
    const quantity=literalExpression(payment.quantity,`${label}.quantity`);
    if(quantity.value<=0) throw new DomainEvaluationError(`${label}.quantity must be a positive integer`);
    if(payment.consumed!==true) throw new DomainEvaluationError(`${label}.consumed must be true for portable Common Play item payment`);
    if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`${label}.consumeAt must be commit for portable Common Play item payment`);
    if(payment.refundOnCancel!==undefined&&payment.refundOnCancel!==true) throw new DomainEvaluationError(`${label}.refundOnCancel must be true when present`);
    return {kind:"item",selector,quantity,consumed:true,consumeAt:"commit",refundOnCancel:true};
  }
  if(payment.kind==="economy") {''',
)
regex_once(
    domain,
    r'export function compileCommonPlayPayments\([\s\S]*?\n}\n\nfunction hpOperationTarget',
    '''export function compileCommonPlayPayments(
  payments:CommonPlayPayment[]|undefined,
  input:CommonPlayOperationExecutionInput,
):ResolutionOperation[] {
  const operations:ResolutionOperation[]=[];
  for(const {payment,index} of (payments??[])
    .map((payment,index)=>({payment,index}))
    .sort((left,right)=>Number(right.payment.kind==="economy")-Number(left.payment.kind==="economy"))) {
    if(payment.kind==="economy") {
      operations.push({
        id:`${input.resolutionId}:payment:${index}`,kind:"use-economy",actorId:input.actorId,slot:payment.bucket,
        bonusActionGranted:payment.bucket==="bonus-action"||undefined,actionKind:input.actionKind,
      });
      continue;
    }
    const resourceId=payment.kind==="resource"?payment.resource:input.itemPaymentResourceIds?.[index];
    if(!resourceId) throw new DomainEvaluationError(`Common Play item payment ${index} requires one pre-resolved item stack`);
    operations.push({
      id:`${input.resolutionId}:payment:${index}`,kind:"spend-resource",actorId:input.actorId,resourceId,
      amount:literalInteger(payment.kind==="resource"?payment.amount:payment.quantity,payment.kind==="resource"?"resource payment amount":"item payment quantity"),
    });
  }
  return operations;
}

function hpOperationTarget''',
)

adapter = "src/app/installedCommonPlayRuntimeAdapter.ts"
replace_once(
    adapter,
    'function seedReferencedResources(\n',
    '''const itemQuantityResourceId=(itemId:string)=>`phase09:item:${itemId}:quantity`;

function itemPaymentRuntimeContext(internal:AdapterState,state:RulesRuntimeState,definition:CommonPlayOperationDefinition) {
  const payments=definition.payments??[];
  if(!payments.some((payment)=>payment.kind==="item")) return {state,itemPaymentResourceIds:undefined as Record<number,string>|undefined,ephemeralResourceIds:[] as string[]};
  const next=structuredClone(state);
  const combatant=next.combatants[internal.activeCharacter.id];
  if(!combatant) throw new Error(`Common Play item payment actor is missing: ${internal.activeCharacter.id}`);
  const itemPaymentResourceIds:Record<number,string>={};
  const ephemeralResourceIds:string[]=[];
  for(const [index,payment] of payments.entries()) {
    if(payment.kind!=="item") continue;
    const matches=internal.activeCharacter.items.filter((item)=>item.definitionId===payment.selector.definitionId);
    if(matches.length!==1) throw new Error(`Common Play item payment selector must resolve exactly one stack: ${payment.selector.definitionId}`);
    const item=matches[0];
    const resourceId=itemQuantityResourceId(item.id);
    combatant.resources=combatant.resources.filter((resource)=>resource.id!==resourceId);
    combatant.resources.push({id:resourceId,label:`${item.name} quantity`,current:item.quantity,maximum:item.quantity});
    itemPaymentResourceIds[index]=resourceId;
    ephemeralResourceIds.push(resourceId);
  }
  return {state:next,itemPaymentResourceIds,ephemeralResourceIds};
}

function stripItemPaymentRuntimeResources(state:RulesRuntimeState,actorId:string,resourceIds:string[]) {
  const combatant=state.combatants[actorId];
  if(combatant&&resourceIds.length) combatant.resources=combatant.resources.filter((resource)=>!resourceIds.includes(resource.id));
}

function seedReferencedResources(
''',
)
replace_once(
    adapter,
    '  interactionId?:string,\n):import("../domain/commonPlayOperationRuntime").CommonPlayOperationExecutionInput {',
    '  interactionId?:string,\n  itemPaymentResourceIds?:Record<number,string>,\n):import("../domain/commonPlayOperationRuntime").CommonPlayOperationExecutionInput {',
)
replace_once(
    adapter,
    '    actionKind:entryPoint.test?.kind==="attack-roll"?"attack" as const:action.category==="spell"?"magic" as const:"other" as const,',
    '    ...(itemPaymentResourceIds?{itemPaymentResourceIds}:{}),\n    actionKind:entryPoint.test?.kind==="attack-roll"?"attack" as const:action.category==="spell"?"magic" as const:"other" as const,',
)
replace_once(
    adapter,
    '    operationEntryPoint=entryPoint;\n    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId));',
    '    operationEntryPoint=entryPoint;\n    const itemContext=itemPaymentRuntimeContext(internal,state,lowered.definition);\n    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,itemContext.state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId,itemContext.itemPaymentResourceIds));',
)
replace_once(
    adapter,
    '      state,effectDefinitions,pending,actorEntity.kind==="character"?"character":"monster",',
    '      itemContext.state,effectDefinitions,pending,actorEntity.kind==="character"?"character":"monster",',
)
replace_once(
    adapter,
    '      state,effectDefinitions,damagePending,Object.fromEntries(internal.scene.entities.map((entity)=>[entity.id,entity.kind==="character"?"character":"monster"])),',
    '      itemContext.state,effectDefinitions,damagePending,Object.fromEntries(internal.scene.entities.map((entity)=>[entity.id,entity.kind==="character"?"character":"monster"])),',
)
replace_once(
    adapter,
    '      resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,automaticPending),\n    );\n  } else if(lowered.kind==="save-damage") {',
    '      resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,itemContext.state,automaticPending),\n    );\n    if(committed.status==="committed") stripItemPaymentRuntimeResources(committed.state,actor.id,itemContext.ephemeralResourceIds);\n  } else if(lowered.kind==="save-damage") {',
)

m1 = Path(".github/workflows/m1-common-play-resource-economy.yml")
text = m1.read_text()
test_line = '      - "tests/ui/installedCommonPlayItemPaymentProduction.test.ts"\n'
anchor = '      - "tests/ui/phase09CommonPlayResourcePersistence.test.ts"\n'
if test_line not in text:
    if text.count(anchor) < 2:
        raise SystemExit("missing M1 path anchors")
    text = text.replace(anchor, anchor + test_line, 2)
command_anchor = 'tests/ui/phase09CommonPlayResourcePersistence.test.ts'
if 'tests/ui/installedCommonPlayItemPaymentProduction.test.ts tests/ui/fighterActionSurgeRuntimeAdapter.test.ts' not in text:
    old = command_anchor + ' tests/ui/fighterActionSurgeRuntimeAdapter.test.ts'
    if old not in text:
        raise SystemExit("missing M1 command anchor")
    text = text.replace(old, command_anchor + ' tests/ui/installedCommonPlayItemPaymentProduction.test.ts tests/ui/fighterActionSurgeRuntimeAdapter.test.ts', 1)
m1.write_text(text)

Path("tests/ui/installedCommonPlayItemPaymentProduction.test.ts").write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const ITEM_ID="item.potion.aelar";
const ITEM_DEFINITION_ID="item.potion-of-healing";
type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const BASE:Identity={moduleId:"homebrew.family-x-item-payment",contentId:"option.family-x-item-payment",mechanicId:"external.unknown.family-x-item-payment",entryPointId:"consume",displayName:"Portable Item Payment"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-x",contentId:"option.renamed-family-x",mechanicId:"external.renamed.family-x",entryPointId:"pay",displayName:"Renamed Portable Item Payment"};

function payload(identity:Identity) {
  return JSON.stringify({schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family X Item Payment Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:identity.contentId,category:"option",presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable item quantity payment probe"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:identity.mechanicId,payments:[{kind:"item",selector:{from:"items",where:{op:"eq",left:{ref:"item.definitionId"},right:{value:ITEM_DEFINITION_ID}},min:1,max:1},quantity:{value:1},consumed:true,consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:identity.entryPointId,invocation:"manual",operations:[]}]}}]}]});
}
async function install(adapter:MockAdapter,identity:Identity) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}
function persisted(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters.find((entry)=>entry.characterId===characterId)?.runtime.items.find((item)=>item.id===ITEM_ID)?.quantity;
}
async function restarted(store:MemoryCharacterLibraryStore) {
  const adapter=new MockAdapter();setCharacterLibraryStoreForTests(adapter,store);return (await adapter.getSnapshot()).activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity;
}

test("unknown installed Common Play item payment persists through restart and event-native Undo",async()=>{
  const store=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  const actionId=await install(adapter,BASE);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,2);
  await adapter.resolveAction(actionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,1);
  assert.equal(persisted(adapter,characterId),1);
  assert.equal(await restarted(store),1);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,2);
  assert.equal(persisted(adapter,characterId),2);
  assert.equal(await restarted(store),2);
});

test("portable item payment is invariant to external package and mechanic identity",async()=>{
  const adapter=new MockAdapter();
  const actionId=await install(adapter,RENAMED);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const characterId=(await adapter.getSnapshot()).activeCharacter.id;
  await adapter.resolveAction(actionId,[characterId]);
  assert.equal((await adapter.getSnapshot()).activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,1);
});
''')
