import type { EconomyVm, SceneVm } from "./contracts";
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

export function createTurnRuntimeSession(scene:SceneVm):TurnRuntimeSession {
  const groups = orderInitiative(scene.entities.map((entity) => ({
    id:entity.id,
    controller:entity.kind === "character" ? "player" as const : "gm" as const,
    total:entity.initiative,
  })));
  const initiativeOrder = groups.flatMap((group) => group.participantIds);
  const activeActorId = initiativeOrder[0] ?? scene.currentActorId;
  const state:RulesRuntimeState = {
    revision:0,
    clock:{ round:1, elapsedSeconds:0, activeActorId },
    combatants:Object.fromEntries(scene.entities.map((entity) => {
      const speed = scene.economyByActor[entity.id]?.movementMax ?? 30;
      return [entity.id,{
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
      }];
    })),
    effects:[],
    concentration:{},
    history:[],
  };
  return { state, initiativeOrder, activeIndex:Math.max(0,initiativeOrder.indexOf(activeActorId)) };
}

export function projectTurnRuntimeToScene(session:TurnRuntimeSession,scene:SceneVm) {
  scene.round=session.state.clock.round;
  if (session.state.clock.activeActorId) scene.currentActorId=session.state.clock.activeActorId;
  for (const id of session.initiativeOrder) {
    const runtime=session.state.combatants[id];
    if (runtime) scene.economyByActor[id]=sceneEconomy(runtime.economy);
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
    if (!runtime||!projected) continue;
    if (!sameEconomy(sceneEconomy(runtime.economy),projected)) {
      runtime.economy={ ...runtimeEconomy(projected), extraActions:runtime.economy.extraActions ?? [] };
      changed=true;
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
