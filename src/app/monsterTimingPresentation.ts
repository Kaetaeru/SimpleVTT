import type { SceneEntity } from "./contracts";
import "./combatantRuntimeContracts";

export interface MonsterTimingBadge { key:string; text:string; title:string }

/** Short chips for an actor card / encounter row: legendary pool, legendary resistance, spent recharge actions, exhausted uses. */
export function monsterTimingBadges(entity:Pick<SceneEntity,"runtimeMonsterTiming">):MonsterTimingBadge[] {
  const timing=entity.runtimeMonsterTiming;
  if (!timing) return [];
  const badges:MonsterTimingBadge[]=[];
  if (timing.legendary) badges.push({ key:"legendary", text:`전설 ${timing.legendary.remaining}/${timing.legendary.max}`, title:"이번 라운드에 남은 전설 행동" });
  if (timing.legendaryResistance) badges.push({ key:"legendary-resistance", text:`저항 ${timing.legendaryResistance.remaining}/${timing.legendaryResistance.max}`, title:"남은 전설 저항" });
  for (const [id,recharge] of Object.entries(timing.recharge)) {
    if (!recharge.ready) badges.push({ key:`recharge:${id}`, text:`${recharge.label} 재충전 중`, title:`턴 시작 시 d${recharge.sides}에서 ${recharge.min} 이상이면 다시 사용할 수 있습니다.` });
  }
  for (const [id,uses] of Object.entries(timing.uses)) {
    if (uses.remaining<=0) badges.push({ key:`uses:${id}`, text:`${uses.label} 소진`, title:uses.per==="round" ? "다음 턴 시작 시 다시 사용할 수 있습니다." : "오늘의 사용 횟수를 모두 썼습니다." });
  }
  return badges;
}
