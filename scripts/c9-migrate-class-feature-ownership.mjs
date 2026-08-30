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
  if(!text.includes('"follow-up.d20-modification"')) throw new Error(`${path}: legacy Tactical Mind interrupt assertion missing`);
  fs.writeFileSync(path,text.replace('"follow-up.d20-modification"','"use-tactical-mind"'));
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
