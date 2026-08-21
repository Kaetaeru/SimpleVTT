import type { AppSnapshot, SimpleVttAdapter } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { setSpatialRelation, type RuntimeCover } from "./spatialRuntimeContracts";

export interface TheaterOfMindSpatialCommand {
  sourceId:string;
  targetId:string;
  distanceFeet:number;
  visible:boolean;
  cover:RuntimeCover;
  targetCanSeeAttacker:boolean;
}

declare module "./contracts" {
  interface SimpleVttAdapter {
    setTheaterOfMindSpatialRelation(command:TheaterOfMindSpatialCommand):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    setTheaterOfMindSpatialRelation(command:TheaterOfMindSpatialCommand):Promise<AppSnapshot>;
  }
}

interface TheaterOfMindInternal {
  role:AppSnapshot["role"];
  session:AppSnapshot["session"] & { lifecycle?:string };
  scene:AppSnapshot["scene"];
  activity:AppSnapshot["activity"];
  getSnapshot():Promise<AppSnapshot>;
}

function warning(internal:TheaterOfMindInternal,message:string) {
  internal.session.compatibility="warning";
  internal.session.compatibilityMessage=message;
  return internal.getSnapshot();
}

MockAdapter.prototype.setTheaterOfMindSpatialRelation=async function setTheaterOfMindSpatialRelation(command:TheaterOfMindSpatialCommand) {
  const internal=this as unknown as TheaterOfMindInternal;
  const hasDmAuthority=internal.role==="dm"||internal.session.role==="host";
  if (!hasDmAuthority) return warning(internal,"Only the DM/Host can author theater-of-mind spatial relations.");
  if (internal.session.role==="host"&&internal.session.lifecycle!=="live") {
    return warning(internal,"Start live play before authoring theater-of-mind spatial relations.");
  }
  if (command.sourceId===command.targetId) return warning(internal,"Spatial relation source and target must differ.");
  const source=internal.scene.entities.find((entity)=>entity.id===command.sourceId);
  const target=internal.scene.entities.find((entity)=>entity.id===command.targetId);
  if (!source||!target) return warning(internal,"Both spatial relation actors must exist in the live Scene.");
  if (!Number.isFinite(command.distanceFeet)||command.distanceFeet<0) {
    return warning(internal,"Theater-of-mind distance must be a non-negative number of feet.");
  }

  setSpatialRelation(internal.scene,{
    sourceId:command.sourceId,
    targetId:command.targetId,
    distanceFeet:command.distanceFeet,
    visible:command.visible,
    cover:command.cover,
    targetCanSeeAttacker:command.targetCanSeeAttacker,
    provenance:`production:theater-of-mind:${internal.scene.id}:dm`,
  });
  internal.session.compatibility="compatible";
  internal.session.compatibilityMessage=`거리 관계 설정: ${source.name} → ${target.name} · ${command.distanceFeet}ft`;
  internal.activity.unshift({
    id:`phase14.spatial.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",
    actor:"DM",
    title:"거리 관계 설정",
    summary:`${source.name} → ${target.name} · ${command.distanceFeet}ft`,
    detail:[
      `가시성 ${command.visible?"보임":"보이지 않음"}`,
      `엄폐 ${command.cover}`,
      `대상 시야 ${command.targetCanSeeAttacker?"공격자 확인":"공격자 미확인"}`,
    ],
    stateChanges:[`Spatial relation ${command.sourceId} -> ${command.targetId} authored`],
  });
  return internal.getSnapshot();
};

export type TheaterOfMindSpatialAdapter=SimpleVttAdapter;
