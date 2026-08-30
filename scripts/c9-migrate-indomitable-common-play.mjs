import fs from "node:fs";

function replaceOnce(path,needle,replacement){
  const text=fs.readFileSync(path,"utf8");
  if(!text.includes(needle))throw new Error(`${path}: expected patch anchor missing`);
  fs.writeFileSync(path,text.replace(needle,replacement));
}

replaceOnce(
  "src/domain/commonPlayReactionDefinitionRuntime.ts",
  'import { DomainEvaluationError, type SemanticPredicate } from "./profileEngine";',
  'import { DomainEvaluationError, evaluateExpression, type ExpressionNode, type SemanticPredicate } from "./profileEngine";',
);
replaceOnce(
  "src/domain/commonPlayReactionDefinitionRuntime.ts",
  'type ReactionLoweringOptions={ resolveResourceDie?:(resourceId:string)=>number|undefined };',
  'type ReactionLoweringOptions={ resolveResourceDie?:(resourceId:string)=>number|undefined; resolveNumericReference?:(ref:string)=>number|undefined };',
);
replaceOnce(
  "src/domain/commonPlayReactionDefinitionRuntime.ts",
`function literalNumber(value:unknown,label:string) {
  const expression=object(value,label);
  if(Object.keys(expression).some((key)=>key!=="value")||typeof expression.value!=="number"||!Number.isFinite(expression.value)) {
    throw new DomainEvaluationError(\`${'${label}'} must be a finite literal number expression\`);
  }
  return {value:expression.value};
}`,
`function literalNumber(value:unknown,label:string) {
  const expression=object(value,label);
  if(Object.keys(expression).some((key)=>key!=="value")||typeof expression.value!=="number"||!Number.isFinite(expression.value)) {
    throw new DomainEvaluationError(\`${'${label}'} must be a finite literal number expression\`);
  }
  return {value:expression.value};
}

const NUMERIC_EXPRESSION_OPERATORS=new Set(["add","subtract","multiply","divide","min","max","floor","ceil"]);
function resolvedNumber(value:unknown,label:string,options:ReactionLoweringOptions) {
  const parse=(candidate:unknown,currentLabel:string):ExpressionNode=>{
    const expression=object(candidate,currentLabel);
    if("value" in expression){
      if(Object.keys(expression).some((key)=>key!=="value")||typeof expression.value!=="number"||!Number.isFinite(expression.value))throw new DomainEvaluationError(\`${'${currentLabel}'} must contain a finite numeric value\`);
      return {value:expression.value};
    }
    if("ref" in expression){
      if(Object.keys(expression).some((key)=>key!=="ref")||typeof expression.ref!=="string"||!expression.ref)throw new DomainEvaluationError(\`${'${currentLabel}'} must contain a non-empty numeric ref\`);
      return {ref:expression.ref};
    }
    if(typeof expression.op!=="string"||!NUMERIC_EXPRESSION_OPERATORS.has(expression.op)||!Array.isArray(expression.args)||!expression.args.length||Object.keys(expression).some((key)=>key!=="op"&&key!=="args"))throw new DomainEvaluationError(\`${'${currentLabel}'} must be a supported numeric expression\`);
    return {op:expression.op as ExpressionNode extends {op:infer T}?T:never,args:expression.args.map((entry,index)=>parse(entry,\`${'${currentLabel}'}.args[${'${index}'}]\`))};
  };
  const resolved=evaluateExpression(parse(value,label),(ref)=>{
    const numeric=options.resolveNumericReference?.(ref);
    if(numeric===undefined)throw new DomainEvaluationError(\`${'${label}'} has unresolved numeric reference: ${'${ref}'}\`);
    if(!Number.isFinite(numeric))throw new DomainEvaluationError(\`${'${label}'} resolved non-finite numeric reference: ${'${ref}'}\`);
    return numeric;
  });
  return {value:resolved};
}`,
);
replaceOnce(
  "src/domain/commonPlayReactionDefinitionRuntime.ts",
  '      const value=literalNumber(raw.value,`${label}.operations[${operationIndex}].value`);',
  '      const value=resolvedNumber(raw.value,`${label}.operations[${operationIndex}].value`,options);',
);

replaceOnce(
  "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
`function catalogEntryMatchesSubclass(entry:CatalogEntry,subclassId:string) {
  const token=subclassId.trim();
  return entry.category==="subclass"&&Boolean(token)&&(
    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token
  );
}`,
`function catalogEntryMatchesSubclass(entry:CatalogEntry,subclassId:string) {
  const token=subclassId.trim();
  return entry.category==="subclass"&&Boolean(token)&&(
    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token
  );
}

const ACTOR_CLASS_LEVEL_REF="actor.class-level:";
function ownerNumericReference(sheet:CharacterSheet,ref:string) {
  if(!ref.startsWith(ACTOR_CLASS_LEVEL_REF))return undefined;
  const classId=ref.slice(ACTOR_CLASS_LEVEL_REF.length);
  if(!classId)return undefined;
  return sheet.classLevels?.find((entry)=>entry.classId===classId)?.level;
}`,
);
replaceOnce(
  "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
  '        const definition=lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:(resourceId)=>owner.sheet.resources.find((resource)=>resource.id===resourceId)?.dieSides});',
  '        const definition=lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:(resourceId)=>owner.sheet.resources.find((resource)=>resource.id===resourceId)?.dieSides,resolveNumericReference:(ref)=>ownerNumericReference(owner.sheet,ref)});',
);

for(const path of ["src/app/productionPlayRuntimeAdapter.ts","src/app/characterSessionProjectionReconstruction.ts"]){
  let text=fs.readFileSync(path,"utf8");
  const before=text;
  text=text.replace(/^\s*const indomitable=.*FIGHTER_INDOMITABLE_RESOURCE_ID.*\r?\n/m,"");
  text=text.replace(/^\s*if\(fighterLevel>=9&&indomitable\)actions\.at\(-1\)!\.runtimeD20FollowUps=.*\r?\n/m,"");
  text=text.replace(/, FIGHTER_INDOMITABLE_RESOURCE_ID/g,"");
  if(text===before)throw new Error(`${path}: Indomitable named projection anchors missing`);
  fs.writeFileSync(path,text);
}

const modulePath="content/modules/dnd-srd-5.2.1.classes/module.json";
const module=JSON.parse(fs.readFileSync(modulePath,"utf8"));
const fighter=module.content.find((entry)=>entry.id==="dnd.srd521.class.fighter");
if(!fighter)throw new Error("canonical Fighter class entry missing");
let levelNine=fighter.progressionContributions?.find((entry)=>entry.threshold===9&&entry.track==="class.fighter.level");
if(!levelNine){
  levelNine={track:"class.fighter.level",threshold:9,grants:[]};
  fighter.progressionContributions.push(levelNine);
  fighter.progressionContributions.sort((left,right)=>left.threshold-right.threshold);
}
if(!levelNine.grants.includes("fighter.indomitable"))levelNine.grants.push("fighter.indomitable");
if(module.content.some((entry)=>entry.id==="fighter.indomitable"))throw new Error("fighter.indomitable portable content already exists");
const tacticalIndex=module.content.findIndex((entry)=>entry.id==="fighter.tactical-mind");
const indomitable={
  id:"fighter.indomitable",
  category:"option",
  presentation:{originalName:"Indomitable",defaultLocale:"ko-KR",locales:{"ko-KR":{name:"불굴",summary:"실패한 내성을 다시 굴리고 자신의 파이터 레벨을 더한다."}}},
  relationships:[{kind:"parent",target:"dnd.srd521.class.fighter"}],
  mechanics:[{kind:"common-play",config:{
    $schema:"https://simplevtt.local/schemas/common-play-contract.schema.json",
    schemaVersion:"0.2-draft",
    id:"fighter.indomitable",
    payments:[{kind:"resource",resource:"resource:fighter.indomitable",amount:{value:1},consumeAt:"commit"}],
    interceptors:[{
      id:"indomitable-save",
      timing:"d20.outcome-determined",
      interaction:{id:"use-indomitable",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
      operation:"recalculate",
      slot:"d20.roll",
      families:["saving-throw"],
      outcomes:["failure"],
      operations:[
        {kind:"roll.modify",mode:"reroll",dice:"1d20"},
        {kind:"roll.modify",mode:"add-flat",value:{ref:"actor.class-level:dnd.srd521.class.fighter"}},
      ],
    }],
  }}],
};
module.content.splice(tacticalIndex>=0?tacticalIndex+1:module.content.indexOf(fighter)+1,0,indomitable);
fs.writeFileSync(modulePath,JSON.stringify(module)+"\n");

replaceOnce(
  "tests/ui/fighterIndomitableFollowUpRuntime.test.ts",
  'snapshot=await adapter.advanceResolution();assert.equal(snapshot.resolution?.interrupt?.id,"follow-up.d20-modification",JSON.stringify({resolution:snapshot.resolution,resources:snapshot.activeCharacter.resources}));\n  await adapter.setQueuedD20(10);snapshot=await adapter.respondToInterrupt(true);assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"성공");',
  'snapshot=await adapter.advanceResolution();assert.equal(snapshot.resolution?.interrupt?.optionName,"불굴",JSON.stringify({resolution:snapshot.resolution,resources:snapshot.activeCharacter.resources}));const baseModifier=snapshot.resolution!.saveResults[0]!.total-snapshot.resolution!.saveResults[0]!.d20;\n  await adapter.setQueuedD20(10);snapshot=await adapter.respondToInterrupt(true);assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"성공");assert.equal(snapshot.resolution?.saveResults[0]?.total,10+baseModifier+9);',
);

const reactionTest="tests/domain/commonPlayReactionDefinitionRuntime.test.ts";
let reactionText=fs.readFileSync(reactionTest,"utf8");
const testAnchor='test("existing attack outcome recalculation remains lowerable",()=>{';
if(!reactionText.includes(testAnchor))throw new Error(`${reactionTest}: insertion anchor missing`);
reactionText=reactionText.replace(testAnchor,`test("portable d20 numeric expressions resolve from authoritative owner progression references",()=>{\n  const definition=portableReaction();\n  definition.interceptors![0].operations=[{kind:"roll.modify",mode:"add-flat",value:{ref:"actor.class-level:dnd.srd521.class.fighter"}}];\n  const lowered=lowerCommonPlayReactionDefinition(definition,{resolveNumericReference:(ref)=>ref==="actor.class-level:dnd.srd521.class.fighter"?9:undefined})!;\n  assert.deepEqual(lowered.interceptors[0].operations,[{kind:"roll.modify",mode:"add-flat",value:{value:9}}]);\n  assert.throws(()=>lowerCommonPlayReactionDefinition(definition),/unresolved numeric reference/);\n});\n\n${testAnchor}`);
fs.writeFileSync(reactionTest,reactionText);

const ledgerPath="docs/rules/v1-mechanism-coverage-ledger.json";
const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
const familyC=ledger.rows.find((row)=>row.family==="C");
if(!familyC)throw new Error("Family C ledger row missing");
familyC.currentState="The generic d20 Resolver and portable Common Play interceptor path cover checks, saves, attacks, proficiency/expertise inputs, advantage/disadvantage, flat/additional-die/DC modifiers, reroll/replace/minimum, outcome recalculation, criticals, post-roll decisions, and outcome follow-ups. Cutting Words, Dark One's Own Luck, Peerless Skill, Tactical Mind, and Indomitable execute without named content dispatch. Class feature ownership is derived from canonical progressionContributions, and Indomitable's level-scaled reroll bonus resolves the persisted expression ref actor.class-level:<classId> from the owning Character classLevels as lookup data before entering the generic d20 transaction.";
familyC.disposition="IMPLEMENTED";
const addUnique=(field,value)=>{if(!familyC[field].includes(value))familyC[field].push(value);};
addUnique("implementationEvidence","commonPlayReactionDefinitionRuntime.ts generic numeric expression-ref resolution for deterministic roll.modify values");
addUnique("implementationEvidence","commonPlayInterceptorProductionRuntimeAdapter.ts authoritative actor.class-level:<classId> lookup from owning Character classLevels");
addUnique("implementationEvidence","fighter.indomitable builtin Common Play plus Fighter level-9 progression grant");
addUnique("productionEvidence","fighterIndomitableFollowUpRuntime.test.ts portable Indomitable reroll + owner class-level bonus + Undo");
addUnique("productionEvidence","commonPlayReactionDefinitionRuntime.test.ts authoritative numeric ref lowering");
addUnique("identityInvarianceEvidence","Indomitable classId is expression lookup data; execution selection remains structural Common Play family/outcome/operation dispatch");
addUnique("connectedEvidenceIfRelevant","fighterIndomitableFollowUpRuntime.test.ts remote owner prompt and exactly-once Host event");
addUnique("persistenceEvidenceIfRelevant","fighterIndomitableFollowUpRuntime.test.ts projected remote Character resource ownership plus event-native Undo");
familyC.remainingNamedSeams=[];
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
