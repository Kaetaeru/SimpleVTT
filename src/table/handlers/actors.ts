import type { TableCommand } from "../commands";
import { actorInitiativeBonus, materializeActors } from "../actors";
import { refused } from "../refusal";
import type { CombatantRuntimeState } from "../../domain/combatState";
import type { ActorPatch } from "../events";
import type { Actor, TableState } from "../state";
import { actorName, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

/** Roll initiative for one actor with the table's dice; the face is recorded for the log. */
export function rollInitiative(ctx:HandlerContext,actor:Actor):{face:number;total:number} {
  const face=ctx.dice.faces(20,1,`${actor.name} 이니셔티브`)[0];
  return {face,total:face+actorInitiativeBonus(actor)};
}

/** Insert new actors into an existing order by initiative (higher first, ties after existing entries). */
export function insertIntoOrder(state:TableState,order:string[],actors:Actor[]):string[] {
  const next=[...order];
  for(const actor of [...actors].sort((a,b)=>b.initiative-a.initiative)) {
    const index=next.findIndex((id)=>(state.actors[id]?.initiative??-Infinity)<actor.initiative);
    if(index<0) next.push(actor.id); else next.splice(index,0,actor.id);
  }
  return next;
}

export function addActors(ctx:HandlerContext,command:Extract<TableCommand,{type:"add-actors"}>):HandlerResult {
  if(!command.specs.length) return refused("actor-spec-empty","추가할 액터가 없습니다.");
  const staged:TableState={...ctx.state,actors:{...ctx.state.actors}};
  const actors:Actor[]=[];
  const combatants:Record<string,CombatantRuntimeState>={};
  const rolls:string[]=[];
  for(const spec of command.specs) {
    let materialized;
    try { materialized=materializeActors(staged,spec); }
    catch(error) { return refused("actor-source",error instanceof Error?error.message:String(error)); }
    for(const actor of materialized.actors) {
      if(ctx.state.mode==="initiative") {
        const roll=rollInitiative(ctx,actor);
        actor.initiative=roll.total;
        rolls.push(`${actor.name} 이니셔티브 ${roll.total} (d20 ${roll.face})`);
      }
      staged.actors[actor.id]=actor;
      actors.push(actor);
    }
    Object.assign(combatants,materialized.combatants);
  }
  const order=ctx.state.mode==="initiative"?insertIntoOrder({...ctx.state,actors:{...ctx.state.actors,...Object.fromEntries(actors.map((actor)=>[actor.id,actor]))}},ctx.state.order,actors):undefined;
  const summary=actors.length===1?actors[0].name:`${actors[0].name} 외 ${actors.length-1}`;
  return {status:"committed",events:[{
    payload:{type:"actors-added",actors,combatants,...(order?{order}:{})},
    log:[logEntry(ctx,{actor:"DM",title:"액터 추가",summary,detail:[...actors.map((actor)=>`${actor.name} · ${actor.side==="enemy"?"상대":"아군"}`),...rolls],stateChanges:["Scene participant 추가"]})],
  }]};
}

export function removeActor(ctx:HandlerContext,command:Extract<TableCommand,{type:"remove-actor"}>):HandlerResult {
  const actor=ctx.state.actors[command.actorId];
  if(!actor) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(ctx.state.mode==="initiative"&&ctx.state.currentActorId===command.actorId&&ctx.state.order.length>1) return refused("actor-current","현재 턴인 액터는 제거할 수 없습니다. 턴을 넘긴 뒤 제거하세요.",{actorId:command.actorId});
  return {status:"committed",events:[{
    payload:{type:"actor-removed",actorId:command.actorId},
    log:[logEntry(ctx,{actor:"DM",title:"액터 제거",summary:actor.name,detail:[],stateChanges:["Scene participant 제거"]})],
  }]};
}

export function setActor(ctx:HandlerContext,command:Extract<TableCommand,{type:"set-actor"}>):HandlerResult {
  const actor=ctx.state.actors[command.actorId];
  if(!actor) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const patch:ActorPatch={};
  if(command.patch.name!==undefined) { if(!command.patch.name.trim()) return refused("actor-name","이름이 비어 있습니다."); patch.name=command.patch.name.trim(); }
  if(command.patch.side!==undefined) patch.side=command.patch.side;
  if(command.patch.hidden!==undefined) patch.hidden=command.patch.hidden;
  if(command.patch.controllerPeer!==undefined) patch.controllerPeer=command.patch.controllerPeer??undefined;
  if(command.patch.initiative!==undefined) { if(!Number.isInteger(command.patch.initiative)) return refused("actor-initiative","이니셔티브는 정수여야 합니다."); patch.initiative=command.patch.initiative; }
  if(!Object.keys(patch).length) return refused("actor-patch-empty","바꿀 내용이 없습니다.");
  const changes=Object.entries(patch).map(([key,value])=>`${key} = ${String(value)}`);
  const drafts:EventDraft[]=[{payload:{type:"actor-updated",actorId:command.actorId,patch},log:[logEntry(ctx,{actor:"DM",title:"액터 변경",summary:actorName(ctx.state,command.actorId),detail:changes,stateChanges:changes})]}];
  if(patch.initiative!==undefined&&ctx.state.mode==="initiative") {
    const initiativeOf=(id:string)=>id===command.actorId?Number(patch.initiative):ctx.state.actors[id]?.initiative??0;
    const reordered=[...ctx.state.order].sort((a,b)=>initiativeOf(b)-initiativeOf(a));
    drafts.push({payload:{type:"turn-changed",currentActorId:ctx.state.currentActorId,round:ctx.state.round,order:reordered,rules:ctx.state.rules},log:[]});
  }
  return {status:"committed",events:drafts};
}
