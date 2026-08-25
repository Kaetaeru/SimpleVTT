import "./productionPlayRuntimeAdapter";
import type { ActionVm, AppSnapshot, CharacterSheet, CharacterSummary, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";

const REFERENCE_SCENE_ID="scene.ruined-gate";
const REFERENCE_MIRA_ID="char.mira";

interface InternalState {
  characters:CharacterSummary[];
  activeCharacter:CharacterSheet;
  scene:SceneVm;
  session:AppSnapshot["session"];
}

function isSheet(value:CharacterSummary):value is CharacterSheet {
  const candidate=value as Partial<CharacterSheet>;
  return Boolean(
    candidate.abilities
    &&Array.isArray(candidate.items)
    &&Array.isArray(candidate.resources)
    &&Array.isArray(candidate.attacks)
    &&typeof candidate.proficiencyBonus==="number",
  );
}

function materializeReferenceMira(summary:CharacterSummary,template:CharacterSheet):CharacterSheet {
  return {
    ...structuredClone(template),
    id:summary.id,
    name:summary.name,
    className:summary.className,
    subclassName:"전승 학파",
    level:summary.level,
    species:summary.species,
    background:summary.background,
    hp:summary.hp,
    maxHp:summary.maxHp,
    tempHp:0,
    ac:summary.ac,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:8,dex:16,con:14,int:12,wis:13,cha:18},
    saves:["민첩 +5","매력 +6"],
    skills:["곡예 +5","공연 +6","설득 +6","지각 +3"],
    features:["바드의 격려","만물박사","노래로 얻는 휴식"],
    equipment:["레이피어","숏보우","가죽 갑옷","악기"],
    items:[],
    resources:[{id:"resource.bardic-inspiration",label:"바드의 격려",current:4,max:4,source:"음유시인"}],
    attacks:[
      {id:"action.rapier",name:"레이피어",bonus:5,damage:"1d8 + 3 관통"},
      {id:"action.shortbow",name:"숏보우",bonus:5,damage:"1d6 + 3 관통"},
    ],
    cantrips:["dnd.srd521.spell.vicious-mockery"],
    preparedSpells:["dnd.srd521.spell.healing-word","dnd.srd521.spell.thunderwave"],
    spellSlotMaximums:{1:4,2:3},
  };
}

function ensureSelectableReferenceCharacter(adapter:MockAdapter,characterId:string) {
  const internal=adapter as unknown as InternalState;
  const index=internal.characters.findIndex((character)=>character.id===characterId);
  if (index<0) return;
  const selected=internal.characters[index];
  if (isSheet(selected)||selected.id!==REFERENCE_MIRA_ID) return;
  internal.characters[index]=materializeReferenceMira(selected,internal.activeCharacter);
}

function projectReferenceAttackEligibility(snapshot:AppSnapshot) {
  if (snapshot.scene.id!==REFERENCE_SCENE_ID) return snapshot;
  for (const actions of Object.values(snapshot.scene.actionsByActor)) {
    for (const action of actions) {
      if (action.resolutionKind!=="attack"||!action.runtimeAttack) continue;
      const reasons:Record<string,string>={};
      const legal=action.eligibleTargetIds.filter((targetId)=>{
        const targeting=resolveRuntimeTargetingFact(snapshot.scene,action.actorId,targetId);
        if (!targeting.visible) { reasons[targetId]="공간 모듈에서 보이지 않는 대상입니다."; return false; }
        if (targeting.distanceFeet>action.runtimeAttack!.rangeFeet) {
          reasons[targetId]=`거리 ${targeting.distanceFeet}피트 · 무기 사거리 ${action.runtimeAttack!.rangeFeet}피트 밖`;
          return false;
        }
        return true;
      });
      action.eligibleTargetIds=legal;
      action.eligibleTargetReasons=reasons;
      if (action.available&&legal.length===0) {
        action.available=false;
        action.disabledReason=`사거리 ${action.runtimeAttack.rangeFeet}피트 안에 공격 가능한 대상이 없습니다.`;
      }
    }
  }
  return snapshot;
}

const previousSelectProductionCharacter=MockAdapter.prototype.selectProductionCharacter;
MockAdapter.prototype.selectProductionCharacter=async function selectProductionCharacterWithReferenceMaterialization(characterId:string) {
  ensureSelectableReferenceCharacter(this,characterId);
  return previousSelectProductionCharacter.call(this,characterId);
};

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithAcceptanceProjection() {
  const snapshot=await previousGetSnapshot.call(this);
  return projectReferenceAttackEligibility(snapshot);
};

export function referenceAttackTargetsForTests(snapshot:AppSnapshot,actorId:string,actionId:string) {
  return snapshot.scene.actionsByActor[actorId]?.find((action:ActionVm)=>action.id===actionId)?.eligibleTargetIds ?? [];
}
