import fs from 'node:fs';

function replaceOnce(path,needle,replacement){
  const text=fs.readFileSync(path,'utf8');
  if(!text.includes(needle)) throw new Error(`${path}: expected patch anchor missing`);
  fs.writeFileSync(path,text.replace(needle,replacement));
}

replaceOnce('scripts/generate-builtin-catalog.mjs',
`    capabilities:[...new Set(module.capabilities ?? [])].sort((a,b) => a.localeCompare(b,"en")),
    mechanics:(entry.mechanics ?? [])`,
`    capabilities:[...new Set(module.capabilities ?? [])].sort((a,b) => a.localeCompare(b,"en")),
    progressionContributions:(entry.progressionContributions ?? []).map((contribution) => ({
      track:String(contribution.track),
      threshold:Number(contribution.threshold),
      grants:[...(contribution.grants ?? [])].map(String),
    })),
    mechanics:(entry.mechanics ?? [])`);

replaceOnce('src/app/characterSessionProjection.ts',
`type ResolvedCatalogEntry = CatalogEntry & { contentId?:string; sourceId?:string };`,
`type ResolvedCatalogEntry = CatalogEntry & {
  contentId?:string;
  sourceId?:string;
  progressionContributions?:Array<{track:string;threshold:number;grants:string[]}>;
};`);

replaceOnce('src/app/characterSessionProjection.ts',
`    { label:"primary class",token:source.build.className,categories:["class"] },`,
`    { label:"primary class",token:source.build.classLevels?.[0]?.classId ?? source.build.className,categories:["class"] },`);

replaceOnce('src/app/characterSessionProjection.ts',
`  if (source.build.subclassName?.trim()) refs.push({ label:"subclass",token:source.build.subclassName,categories:["subclass"] });`,
`  for (const subclassId of Object.values(source.progression.subclassIds ?? {})) {
    if (subclassId.trim()) refs.push({ label:"subclass",token:subclassId,categories:["subclass"] });
  }`);

replaceOnce('src/app/characterSessionProjection.ts',
`function resolveKnownFeatureIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {`,
`function resolveKnownClassFeatureIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const resolvedCatalog=catalog as ResolvedCatalogEntry[];
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  const tracks=source.build.classLevels?.length
    ? source.build.classLevels
    : [{classId:source.build.className,level:source.build.level}];
  for (const track of tracks) {
    const classMatches=resolvedCatalog.filter((entry)=>entry.category==="class"&&matchesToken(entry,track.classId));
    if (classMatches.length===0) throw new Error("missing canonical class progression source: "+track.classId);
    if (classMatches.length>1) throw new Error("ambiguous canonical class progression source: "+track.classId);
    const grants=(classMatches[0].progressionContributions ?? [])
      .filter((contribution)=>Number.isInteger(contribution.threshold)&&contribution.threshold>0&&contribution.threshold<=track.level)
      .flatMap((contribution)=>contribution.grants);
    for (const featureId of grants) {
      const matches=resolvedCatalog.filter((entry)=>(entry.category==="option"||entry.category==="feat")&&matchesToken(entry,featureId));
      if (matches.length>1) throw new Error("ambiguous canonical content for class feature: "+featureId);
      if (matches.length===0) continue;
      const identity=entryIdentity(matches[0]);
      identities.set(identity.qualifiedId,identity);
    }
  }
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

function resolveKnownFeatureIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {`);

replaceOnce('src/app/characterSessionProjection.ts',
`    ...resolveKnownItemIdentities(source,catalog),
    ...resolveKnownFeatureIdentities(source,catalog),`,
`    ...resolveKnownItemIdentities(source,catalog),
    ...resolveKnownClassFeatureIdentities(source,catalog),
    ...resolveKnownFeatureIdentities(source,catalog),`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`import type { PendingResolution, ResolutionEvent } from "../domain/resolutionTypes";`,
`import type { PendingResolution, ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`type PendingPassiveReaction={
  resolutionId:string;
  operationId:string;
  kind:"d20"|"damage";
  originalTotal?:number;`,
`type PendingPassiveReaction={
  resolutionId:string;
  operationId:string;
  kind:"d20"|"damage";
  originalTotal?:number;
  resumeCheckAfterResponse:boolean;`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`function pendingD20s(resolution:ResolutionView,state:RulesRuntimeState):Array<{pending:PendingResolution;operationId:string}> {
  const projections:Array<{pending:PendingResolution;operationId:string}>=[];
  const natural=resolution.naturalD20??resolution.authoritativeDice[0];
  if(resolution.rollKind==="check"&&resolution.checkOutcome&&Number.isFinite(resolution.checkTarget)&&validD20(natural)){
    const operationId=\`op.\${resolution.actionId}.ability-check\`;
    projections.push({operationId,pending:{
      id:\`\${resolution.id}:common-play-interceptor\`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[{id:operationId,kind:"d20",actorId:resolution.actorId,request:{
        family:"ability-check",target:resolution.checkTarget!,modifierContributions:d20Contributions(resolution),
        dice:{id:\`\${resolution.id}:common-play:d20\`,purpose:resolution.actionName,sides:20,faces:[natural]},
      }}],
    }});
  }`,
`function checkSuccessOperations(scene:SceneVm,resolution:ResolutionView,operationId:string):ResolutionOperation[] {
  if(resolution.rollKind!=="check"||resolution.checkOutcome!=="실패")return [];
  const origin=Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
  const targetId=resolution.targetIds[0];
  if(!origin||!targetId)return [];
  return (origin.checkSuccessOperations??[]).flatMap((operation,index):ResolutionOperation[]=>{
    if(operation.kind==="stabilize"&&operation.target==="first-target")return [{
      id:\`\${operationId}.success.\${index}\`,
      kind:"stabilize",
      targetId,
      when:{operationId,field:"outcome",equals:"success"},
    }];
    return [];
  });
}

function pendingD20s(resolution:ResolutionView,state:RulesRuntimeState,scene:SceneVm):Array<{pending:PendingResolution;operationId:string}> {
  const projections:Array<{pending:PendingResolution;operationId:string}>=[];
  const natural=resolution.naturalD20??resolution.authoritativeDice[0];
  if(resolution.rollKind==="check"&&resolution.checkOutcome&&Number.isFinite(resolution.checkTarget)&&validD20(natural)){
    const operationId=\`op.\${resolution.actionId}.ability-check\`;
    const d20Operation:ResolutionOperation={id:operationId,kind:"d20",actorId:resolution.actorId,request:{
      family:"ability-check",target:resolution.checkTarget!,modifierContributions:d20Contributions(resolution),
      dice:{id:\`\${resolution.id}:common-play:d20\`,purpose:resolution.actionName,sides:20,faces:[natural]},
    }};
    projections.push({operationId,pending:{
      id:\`\${resolution.id}:common-play-interceptor\`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[d20Operation,...checkSuccessOperations(scene,resolution,operationId)],
    }});
  }`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`    const projections=damageProjection?[damageProjection]:pendingD20s(resolution,runtime);`,
`    const projections=damageProjection?[damageProjection]:pendingD20s(resolution,runtime,internal.scene);`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`      pendingByAdapter.set(adapter,{resolutionId:resolution.id,operationId:projected.operationId,kind:damage?"damage":"d20",originalTotal:"originalTotal" in projected?projected.originalTotal:undefined,candidate,awaiting:started});`,
`      pendingByAdapter.set(adapter,{resolutionId:resolution.id,operationId:projected.operationId,kind:damage?"damage":"d20",originalTotal:"originalTotal" in projected?projected.originalTotal:undefined,resumeCheckAfterResponse:resolution.rollKind==="check"&&resolution.stage!=="complete",candidate,awaiting:started});`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`function restoreInterruptedStage(resolution:ResolutionView) {
  resolution.interrupt=undefined;
  if(resolution.rollKind==="check"){
    resolution.stage="roll-animation";
    resolution.canAdvance=true;
    resolution.nextLabel="판정 적용";`,
`function restoreInterruptedStage(resolution:ResolutionView,pending:PendingPassiveReaction) {
  resolution.interrupt=undefined;
  if(resolution.rollKind==="check"){
    if(!pending.resumeCheckAfterResponse){
      resolution.stage="complete";
      resolution.canAdvance=false;
      resolution.nextLabel=undefined;
      return;
    }
    resolution.stage="roll-animation";
    resolution.canAdvance=true;
    resolution.nextLabel="판정 적용";`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;`,
`const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;`);

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {`,
`MockAdapter.prototype.resolveAction=async function resolveWithPortableCommonPlayInterceptors(actionId:string,targetIds:string[]) {
  const resolved=await previousResolveAction.call(this,actionId,targetIds);
  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();
  return resolved;
};

MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {`);

{
  const path='src/app/commonPlayInterceptorProductionRuntimeAdapter.ts';
  const text=fs.readFileSync(path,'utf8');
  const next=text.replaceAll('restoreInterruptedStage(resolution);','restoreInterruptedStage(resolution,pending);');
  if(next===text)throw new Error(`${path}: interrupt restore call anchors missing`);
  fs.writeFileSync(path,next);
}

replaceOnce('src/app/commonPlayInterceptorProductionRuntimeAdapter.ts',
`  if(await offerPassiveReaction(this))return internal.getSnapshot();
  if(resolution.rollKind==="check")return previousAdvanceResolution.call(this);`,
`  if(await offerPassiveReaction(this))return internal.getSnapshot();
  if(resolution.rollKind==="check"&&pending.resumeCheckAfterResponse)return previousAdvanceResolution.call(this);`);

for(const path of ['src/app/productionPlayRuntimeAdapter.ts','src/app/characterSessionProjectionReconstruction.ts']){
  const text=fs.readFileSync(path,'utf8');
  const next=text.replace(/^\s*runtimeD20FollowUps:fighterLevel>=2\?\[.*\]:undefined,\r?\n/m,'');
  if(next===text) throw new Error(`${path}: Tactical Mind named follow-up anchor missing`);
  fs.writeFileSync(path,next);
}

replaceOnce('src/app/mockAdapter.ts',
`  id:"char.aelar", name:"Aelar", className:"전사", subclassName:"챔피언", level:5, species:"인간", background:"병사",`,
`  id:"char.aelar", name:"Aelar", className:"전사", subclassName:"챔피언", level:5, classLevels:[{classId:"dnd.srd521.class.fighter",level:5}], species:"인간", background:"군인",`);

for(const path of ['tests/ui/fighterTacticalMindFollowUpRuntime.test.ts','tests/ui/openAbilityCheckDcRuntime.test.ts']){
  const text=fs.readFileSync(path,'utf8');
  const needle='snapshot.resolution?.interrupt?.id,"follow-up.d20-modification"';
  if(!text.includes(needle)) throw new Error(`${path}: legacy Tactical Mind interrupt assertion missing`);
  fs.writeFileSync(path,text.replace(needle,'snapshot.resolution?.interrupt?.optionName,"전술적 정신"'));
}

const modulePath='content/modules/dnd-srd-5.2.1.classes/module.json';
const module=JSON.parse(fs.readFileSync(modulePath,'utf8'));
if(module.content.some((entry)=>entry.id==='fighter.tactical-mind')) throw new Error('Tactical Mind portable entry already exists');
const fighterIndex=module.content.findIndex((entry)=>entry.id==='dnd.srd521.class.fighter');
if(fighterIndex<0) throw new Error('canonical Fighter entry missing');
const tactical={
  id:'fighter.tactical-mind',category:'option',
  presentation:{originalName:'Tactical Mind',defaultLocale:'ko-KR',locales:{'ko-KR':{name:'전술적 정신',summary:'실패한 능력 판정에 d10을 더하고 성공으로 바뀔 때만 재기의 바람 사용 횟수를 소비한다.'}}},
  relationships:[{kind:'parent',target:'dnd.srd521.class.fighter'}],
  mechanics:[{kind:'common-play',config:{
    $schema:'https://simplevtt.local/schemas/common-play-contract.schema.json',schemaVersion:'0.2-draft',id:'fighter.tactical-mind',
    payments:[{kind:'resource',resource:'resource:fighter.second-wind',amount:{value:1},consumeAt:'commit',condition:{kind:'d20-result',outcome:'success'}}],
    interceptors:[{id:'tactical-mind-d20',timing:'d20.outcome-determined',interaction:{id:'use-tactical-mind',kind:'choice',responder:'actor-owner',mode:'blocking',input:{type:'boolean'},revalidate:'if-revision-changed',stalePolicy:'reject'},operation:'recalculate',slot:'d20.roll',families:['ability-check'],outcomes:['failure'],operations:[{kind:'roll.modify',mode:'add-die',dice:'1d10'}]}]
  }}]
};
module.content.splice(fighterIndex+1,0,tactical);
fs.writeFileSync(modulePath,JSON.stringify(module)+'\n');

const subclassPath='content/modules/dnd-srd-5.2.1.subclasses/module.json';
const subclasses=JSON.parse(fs.readFileSync(subclassPath,'utf8'));
if(!subclasses.content.some((entry)=>entry.id==='dnd.srd521.subclass.fighter.champion')){
  const firstFighterChild=subclasses.content.findIndex((entry)=>entry.relationships?.some((relationship)=>relationship.kind==='parent'&&relationship.target==='dnd.srd521.class.fighter'));
  const champion={id:'dnd.srd521.subclass.fighter.champion',category:'subclass',presentation:{originalName:'Champion',defaultLocale:'ko-KR',locales:{'ko-KR':{name:'챔피언',summary:'무기 전투와 육체적 기량을 극대화하는 파이터 서브클래스다.'}}},relationships:[{kind:'parent',target:'dnd.srd521.class.fighter'}]};
  if(firstFighterChild<0)subclasses.content.push(champion);else subclasses.content.splice(firstFighterChild,0,champion);
  fs.writeFileSync(subclassPath,JSON.stringify(subclasses)+'\n');
}
