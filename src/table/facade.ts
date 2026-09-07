import type { AppSnapshot, CharacterSheet, ResolutionVisibilityVm, SessionMode } from "../app/contracts";
import type { MockAdapter } from "../app/mockAdapter";
import { publishExternalAdapterSnapshot } from "../app/adapterSnapshotEvents";
import { isSrdMonsterId } from "../app/srdMonsterCatalog";
import { sessionDebugPreviewRoleFor } from "../app/sessionDebugPreviewRole";
import { CONDITION_IDS } from "./actors";
import { conditionLabelKo } from "../app/srdMonsterCatalog";
import { HOST_ORIGIN, type CommandOrigin, type TableCommand } from "./commands";
import { queuedDice, randomDice } from "./dice";
import { projectTable, type TableViewer } from "./project";
import { TableRuntime, type Outcome } from "./runtime";

export const LOCAL_PLAYER_PEER="peer.local";

/**
 * The session facade (TABLE_RUNTIME.md §6): the old screens keep calling the adapter surface they know; the session
 * subset is answered by the table runtime and merged into the base snapshot. Everything outside the session (character
 * library, creation, campaign) still goes to the base adapter. At switch-over (T2-07) this becomes the app's adapter.
 */
export interface TableSessionFacade {
  readonly runtime:TableRuntime;
  readonly adapter:MockAdapter;
  /** Dispatch from outside the screens (scripts, tests) and push the merged snapshot to the provider. */
  dispatch(command:TableCommand,origin?:CommandOrigin):Promise<Outcome>;
  /** Seed the local character as a controlled ally when the table has no actors yet. */
  ensureLocalCharacter():Promise<void>;
}

const CONDITION_BY_LABEL=new Map(CONDITION_IDS.map((id)=>[conditionLabelKo(id),id]));
const NARRATIVE_ALIASES:Record<string,string>={"매혹됨":"charmed","실명":"blinded","기절":"stunned","무의식":"unconscious","포박":"restrained","마비":"paralyzed","중독됨":"poisoned","공포":"frightened","붙잡힘":"grappled","넘어짐":"prone"};

export function createTableSessionFacade(base:MockAdapter,options:{runtime?:TableRuntime;origin?:CommandOrigin}={}):TableSessionFacade {
  const dice=queuedDice([],randomDice());
  const runtime=options.runtime??new TableRuntime({sessionId:"table.preview",dice});
  const origin=options.origin??HOST_ORIGIN;
  let selectedActorId:string|null=null;
  let dismissedResolutionId:string|null=null;

  // The DM is whoever hosts (or previews as the DM); the base adapter's own role field lags behind the preview toggle.
  const isDm=(snapshot:AppSnapshot)=>sessionDebugPreviewRoleFor(base)==="dm"||snapshot.role==="dm"||snapshot.session.role==="host";
  const viewerFor=(snapshot:AppSnapshot):TableViewer=>isDm(snapshot)?{role:"dm",peerId:HOST_ORIGIN.peerId}:{role:"player",peerId:LOCAL_PLAYER_PEER};
  const originFor=(snapshot:AppSnapshot):CommandOrigin=>isDm(snapshot)?origin:{peerId:LOCAL_PLAYER_PEER,role:"player"};

  const merged=async():Promise<AppSnapshot>=>{
    const snapshot=await base.getSnapshot();
    const view=projectTable(runtime.state,viewerFor(snapshot),runtime.lastRefusal);
    const ids=view.scene.entities.map((entity)=>entity.id);
    if(!selectedActorId||!ids.includes(selectedActorId)) selectedActorId=runtime.state.currentActorId&&ids.includes(runtime.state.currentActorId)?runtime.state.currentActorId:ids[0]??null;
    const resolution=view.resolution&&view.resolution.id!==dismissedResolutionId?view.resolution:null;
    return {
      ...snapshot,
      sessionMode:view.sessionMode,
      scene:{...view.scene,name:snapshot.scene.name||"테이블",selectedActorId:selectedActorId??""},
      activity:view.activity,
      resolution,
      resolutionPresentation:null,
      refusal:view.refusal,
    };
  };

  const run=async(command:TableCommand,commandOrigin?:CommandOrigin)=>{
    const snapshot=await base.getSnapshot();
    const outcome=runtime.dispatch(command,commandOrigin??originFor(snapshot));
    if(outcome.status==="committed"&&outcome.events.some((event)=>event.payload.type==="rules-committed"&&event.payload.resolution)) dismissedResolutionId=null;
    return outcome;
  };

  const actorForAction=(snapshot:AppSnapshot,actionId:string)=>{
    const preferred=isDm(snapshot)?selectedActorId:snapshot.activeCharacter.id;
    if(preferred&&runtime.state.actors[preferred]&&projectTable(runtime.state,viewerFor(snapshot)).scene.actionsByActor[preferred]?.some((action)=>action.id===actionId)) return preferred;
    const view=projectTable(runtime.state,viewerFor(snapshot));
    return Object.keys(view.scene.actionsByActor).find((id)=>view.scene.actionsByActor[id].some((action)=>action.id===actionId))??preferred??null;
  };

  const ensureLocalCharacter=async()=>{
    const snapshot=await base.getSnapshot();
    const sheet=snapshot.activeCharacter as CharacterSheet;
    if(!sheet?.id||runtime.state.actors[sheet.id]) return;
    runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet,controllerPeer:LOCAL_PLAYER_PEER,side:"ally"}]},HOST_ORIGIN);
  };

  const overrides:Partial<Record<keyof MockAdapter,unknown>>={
    getSnapshot:async()=>{await ensureLocalCharacter();return merged();},
    resolveAction:async(actionId:string,targetIds:string[])=>{
      const snapshot=await base.getSnapshot();
      const actorId=actorForAction(snapshot,actionId);
      if(actorId) await run({type:"act",actorId,actionId,targetIds});
      return merged();
    },
    advanceResolution:async()=>merged(),
    dismissResolution:async()=>{dismissedResolutionId=runtime.state.activeResolution?.id??null;return merged();},
    undoLastResolution:async()=>{await run({type:"undo"});return merged();},
    respondToInterrupt:async()=>merged(),
    applyDmAdjudication:async()=>merged(),
    setNextResolutionVisibility:async(visibility:ResolutionVisibilityVm|null)=>{
      const wanted=visibility&&(visibility as unknown as {mode?:string;visibility?:string}).mode==="dm-only"?"dm":visibility&&(visibility as unknown as {visibility?:string}).visibility==="dm-only"?"dm":"public";
      if(runtime.state.rollVisibility!==wanted) await run({type:"set-roll-visibility",visibility:wanted});
      return merged();
    },
    selectDmActor:async(id:string)=>{if(runtime.state.actors[id]) selectedActorId=id;return merged();},
    startInitiative:async()=>{await run({type:"start-initiative"});return merged();},
    endInitiative:async()=>{await run({type:"end-initiative"});return merged();},
    endTurn:async()=>{await run({type:"end-turn"});return merged();},
    setSessionMode:async(mode:SessionMode)=>{
      if(mode==="initiative"&&runtime.state.mode!=="initiative") await run({type:"start-initiative"});
      if(mode==="freeform"&&runtime.state.mode!=="freeform") await run({type:"end-initiative"});
      return merged();
    },
    setCurrentActor:async(id:string)=>{if(runtime.state.mode==="initiative") await run({type:"set-current-actor",actorId:id}); selectedActorId=id; return merged();},
    setQueuedD20:async(value:number|null)=>{if(value!==null) dice.push(value,value);await base.setQueuedD20(value);return merged();},
    instantiateCombatant:async(definitionId:string)=>{
      if(isSrdMonsterId(definitionId)) await run({type:"add-actors",specs:[{kind:"monster",monsterId:definitionId}]});
      return merged();
    },
    instantiateCombatantGroup:async(definitionId:string,count:number,label?:string)=>{
      if(isSrdMonsterId(definitionId)) await run({type:"add-actors",specs:[{kind:"monster",monsterId:definitionId,count,...(label?{name:label}:{})}]});
      return merged();
    },
    removeCombatant:async(id:string)=>{await run({type:"remove-actor",actorId:id});return merged();},
    applyNarrativeDamage:async(entityId:string,amount:number|"half")=>{
      const combatant=runtime.state.rules.combatants[entityId];
      if(combatant) {
        const value=amount==="half"?Math.floor(combatant.life.hp.current/2):amount;
        if(value>0) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"damage",amount:value}});
        else if(value<0) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"heal",amount:-value}});
      }
      return merged();
    },
    setCreatureStatus:async(entityId:string,status:string,on:boolean)=>{
      const conditionId=CONDITION_BY_LABEL.get(status)??(NARRATIVE_ALIASES[status] as import("../domain/conditions").ConditionId|undefined);
      if(conditionId) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"condition",conditionId,on}});
      return merged();
    },
    setEngagement:async(leftId:string,rightId:string,engaged:boolean)=>{await run({type:"ruling",targetIds:[leftId],ruling:{kind:"engage",otherId:rightId,on:engaged}});return merged();},
  };

  const adapter=new Proxy(base,{
    get(target,property,receiver) {
      if(typeof property==="string"&&property in overrides) return overrides[property as keyof MockAdapter];
      const value=Reflect.get(target,property,receiver);
      return typeof value==="function"?value.bind(target):value;
    },
  }) as MockAdapter;

  return {
    runtime,
    adapter,
    async dispatch(command,commandOrigin=HOST_ORIGIN) {
      const outcome=await run(command,commandOrigin);
      publishExternalAdapterSnapshot(await merged());
      return outcome;
    },
    ensureLocalCharacter,
  };
}
