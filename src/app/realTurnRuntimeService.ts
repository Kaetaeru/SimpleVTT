import type { EconomyVm, SceneEntity, SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";
import { orderInitiative } from "../domain/initiative";
import { beginTurn } from "../domain/turnEconomy";

export interface TurnRuntimeSession {
  state:RulesRuntimeState;
  initiativeOrder:string[];
  activeIndex:number;
}

function runtimeEconomy(economy:EconomyVm) {
  return {
    action:economy.action,
    bonusAction:economy.bonusAction,
    reaction:economy.reaction,
    movement:economy.movement,
    movementMaximum:economy.movementMax,
    extraActions:[],
  };
}

function sceneEconomy(economy:RulesRuntimeState["combatants"][string]["economy"]):EconomyVm {
  return {
    action:economy.action,
    bonusAction:economy.bonusAction,
    reaction:economy.reaction,
    movement:economy.movement,
    movementMax:economy.movementMaximum,
  };
}

function initiativeOrder(scene:SceneVm) {
  const groups=orderInitiative(scene.entities.map((entity)=>({
    id:entity.id,
    controller:entity.kind === "character" ? "player" as const : "gm" as const,
    total:entity.initiative,
  })));
  return groups.flatMap((group)=>group.participantIds);
}

function runtimeCombatant(scene:SceneVm,entity:SceneEntity):RulesRuntimeState["combatants"][string] {
  const speed=scene.economyByActor[entity.id]?.movementMax ?? 30;
  return {
    id:entity.id,
    baseSpeed:speed,
    life:{
      hp:{ current:entity.hp, maximum:entity.maxHp, temporary:entity.tempHp },
      deathSaves:{ successes:0, failures:0 },
      stable:false,
      unconscious:false,
      dead:false,
    },
    economy:beginTurn(speed),
    resources:[],
    hitDice:[],
    damageDefenses:[
      ...entity.resistances.map((damageType)=>({ source:`scene:${entity.id}:resistance:${damageType}`, kind:"resistance" as const, damageType })),
      ...entity.vulnerabilities.map((damageType)=>({ source:`scene:${entity.id}:vulnerability:${damageType}`, kind:"vulnerability" as const, damageType })),
      ...entity.immunities.map((damageType)=>({ source:`scene:${entity.id}:immunity:${damageType}`, kind:"immunity" as const, damageType })),
    ],
  };
}

export function createTurnRuntimeSession(scene:SceneVm):TurnRuntimeSession {
  const ordered=initiativeOrder(scene);
  const activeActorId=ordered[0] ?? scene.currentActorId;
  const state:RulesRuntimeState = {
    revision:0,
    clock:{ round:1, elapsedSeconds:0, activeActorId },
    combatants:Object.fromEntries(scene.entities.map((entity)=>[entity.id,runtimeCombatant(scene,entity)])),
    effects:[],
    concentration:{},
    history:[],
  };
  return { state, initiativeOrder:ordered, activeIndex:Math.max(0,ordered.indexOf(activeActorId)) };
}

export function addTurnRuntimeCombatant(session:TurnRuntimeSession,scene:SceneVm,entityId:string) {
  const entity=scene.entities.find((entry)=>entry.id===entityId);
  if (!entity || session.state.combatants[entityId]) return false;
  const activeActorId=session.state.clock.activeActorId;
  const state=cloneRuntimeState(session.state);
  state.combatants[entityId]=runtimeCombatant(scene,entity);
  state.revision+=1;
  const ordered=initiativeOrder(scene);
  const nextActive=activeActorId && ordered.includes(activeActorId) ? activeActorId : ordered[0];
  state.clock.activeActorId=nextActive;
  session.state=state;
  session.initiativeOrder=ordered;
  session.activeIndex=Math.max(0,nextActive ? ordered.indexOf(nextActive) : 0);
  return true;
}

export function projectTurnRuntimeToScene(session:TurnRuntimeSession,scene:SceneVm) {
  scene.round=session.state.clock.round;
  if (session.state.clock.activeActorId) scene.currentActorId=session.state.clock.activeActorId;
  for (const id of session.initiativeOrder) {
    const runtime=session.state.combatants[id];
    const entity=scene.entities.find((entry)=>entry.id===id);
    if (!runtime) continue;
    scene.economyByActor[id]=sceneEconomy(runtime.economy);
    if (entity) {
      entity.hp=runtime.life.hp.current;
      entity.maxHp=runtime.life.hp.maximum;
      entity.tempHp=runtime.life.hp.temporary;
    }
  }
}

function sameEconomy(left:EconomyVm,right:EconomyVm) {
  return left.action===right.action
    && left.bonusAction===right.bonusAction
    && left.reaction===right.reaction
    && left.movement===right.movement
    && left.movementMax===right.movementMax;
}

export function synchronizeTurnRuntimeFromScene(session:TurnRuntimeSession,scene:SceneVm) {
  const state=cloneRuntimeState(session.state);
  let changed=false;
  for (const id of session.initiativeOrder) {
    const runtime=state.combatants[id];
    const projected=scene.economyByActor[id];
    const entity=scene.entities.find((entry)=>entry.id===id);
    if (!runtime) continue;
    if (projected && !sameEconomy(sceneEconomy(runtime.economy),projected)) {
      runtime.economy={ ...runtimeEconomy(projected), extraActions:runtime.economy.extraActions ?? [] };
      changed=true;
    }
    if (entity) {
      const hp=runtime.life.hp;
      if (hp.current!==entity.hp || hp.maximum!==entity.maxHp || hp.temporary!==entity.tempHp) {
        runtime.life.hp={ current:entity.hp, maximum:entity.maxHp, temporary:entity.tempHp };
        changed=true;
      }
    }
  }
  if (changed) state.revision+=1;
  session.state=state;
  return changed;
}

export function advanceTurnRuntimeSession(session:TurnRuntimeSession) {
  if (session.initiativeOrder.length===0) return session;
  const state=cloneRuntimeState(session.state);
  const nextIndex=(session.activeIndex+1)%session.initiativeOrder.length;
  const wrapped=nextIndex===0;
  const nextId=session.initiativeOrder[nextIndex];
  const combatant=state.combatants[nextId];
  if (combatant) combatant.economy=beginTurn(combatant.baseSpeed);
  state.clock.activeActorId=nextId;
  if (wrapped) state.clock.round+=1;
  state.revision+=1;
  session.state=state;
  session.activeIndex=nextIndex;
  return session;
}

export function setTurnRuntimeActiveActor(session:TurnRuntimeSession,actorId:string) {
  const index=session.initiativeOrder.indexOf(actorId);
  if (index<0) return false;
  const state=cloneRuntimeState(session.state);
  state.clock.activeActorId=actorId;
  state.revision+=1;
  session.state=state;
  session.activeIndex=index;
  return true;
}
