import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { HostLibrary, MemoryLibraryStorage, blankNpc, bundleEntry, bundleFromActors, bundleSpecs, itemEntry, npcFromSrd, npcsFromJson, presetFromSheet } from "../../src/table/library";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/** DM_WORKSPACE.md §3 — the host library: one registration form in and out of a session; bundles summon at once; items land in bags. */
const lib=()=>new HostLibrary(new MemoryLibraryStorage(),()=>"T");

test("library: SRD clone with edits, blank NPC, JSON import, PC preset, favourites and recency survive a reload", () => {
  const storage=new MemoryLibraryStorage();
  const library=new HostLibrary(storage,()=>"T");
  const boss=npcFromSrd(library,GOBLIN,{name:"고블린 두목",maxHp:21,ac:16});
  assert.equal(boss.kind,"npc"); assert.equal(boss.npc?.maxHp,21); assert.equal(boss.npc?.ac,16); assert.equal(boss.npc?.name,"고블린 두목");
  assert.ok((boss.npc as {runtimeActions?:unknown[]}).runtimeActions?.length,"keeps the SRD attacks");
  const guard=blankNpc(library,{name:"성문 경비",ac:16,maxHp:11,attacks:[{name:"창",bonus:3,dice:"1d6",flat:1,type:"관통"}]});
  assert.equal(guard.npc?.actions[0],"창");
  const [cultist]=npcsFromJson(library,'[{"name":"광신도","ac":12,"hp":9}]');
  assert.equal(cultist.npc?.maxHp,9);
  assert.throws(()=>npcsFromJson(library,'{"name":"x"}'),/name, ac, maxHp/);
  const preset=presetFromSheet(library,fighter());
  assert.equal(preset.kind,"preset");
  library.toggleFavorite(cultist.id); library.touch(guard.id);
  const reloaded=new HostLibrary(storage,()=>"T");
  assert.deepEqual(reloaded.entries("npc").map((entry)=>entry.name),["광신도","성문 경비","고블린 두목"],"favourite first, then recent");
  assert.equal(reloaded.entries().length,4);
  reloaded.remove(guard.id);
  assert.equal(reloaded.entries("npc").length,2);
});

test("library: a scene bundle summons NPCs, SRD monsters and a preset in one command; the table folds back into a bundle", () => {
  const library=lib();
  const boss=npcFromSrd(library,GOBLIN,{name:"고블린 두목",maxHp:21});
  const preset=presetFromSheet(library,fighter());
  const bundle=bundleEntry(library,"무너진 종탑",{actors:[{entryId:boss.id,count:1},{monsterId:GOBLIN,count:2,hidden:true},{entryId:preset.id,count:1}],noteIds:[]});
  const specs=bundleSpecs(library,bundle.bundle!);
  assert.deepEqual(specs.map((spec)=>spec.kind),["npc","monster","character"]);
  const {runtime}=table([]);
  const summoned=runtime.dispatch({type:"add-actors",specs});
  assert.equal(summoned.status,"committed",JSON.stringify(summoned));
  const actors=Object.values(runtime.state.actors);
  assert.equal(actors.length,4);
  assert.equal(actors.filter((actor)=>actor.hidden).length,2,"hidden summons arrive hidden");
  assert.ok(actors.some((actor)=>actor.name==="고블린 두목 1"&&actor.source.kind==="monster"&&actor.source.definition.maxHp===21));
  assert.ok(actors.some((actor)=>actor.kind==="character"&&actor.side==="ally"));
  const folded=bundleFromActors(actors,{[boss.npc!.id]:boss.id});
  assert.deepEqual(folded,[{entryId:boss.id,count:1,side:"enemy"},{monsterId:GOBLIN,count:2,side:"enemy",hidden:true}]);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
});

test("grant-item: a potion stacks in the bag, a weapon becomes an attack tile, only characters receive", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  const library=lib();
  const potion=itemEntry(library,{definitionId:"dnd.srd521.item.potion-of-healing",name:"치유 물약",kind:"consumable",quantity:2});
  const granted=runtime.dispatch({type:"grant-item",actorId:kael,item:potion.item!});
  assert.equal(granted.status,"committed",JSON.stringify(granted));
  const sheet=()=>runtime.state.actors[kael].source.kind==="character"?runtime.state.actors[kael].source.sheet:fighter();
  assert.equal(sheet().items.find((item)=>item.id==="item.potion")?.quantity,4,"stacked onto the existing potions");
  const axe=runtime.dispatch({type:"grant-item",actorId:kael,item:{definitionId:"dnd.srd521.item.weapon.greataxe",name:"그레이트액스",kind:"equipment"}});
  assert.equal(axe.status,"committed",JSON.stringify(axe));
  const attack=sheet().attacks.find((entry)=>entry.name==="그레이트액스");
  assert.ok(attack,"a weapon adds an attack");
  assert.equal(attack?.bonus,7,"STR +4 and proficiency +3");
  assert.match(attack?.damage??"",/1d12 \+ 4/);
  assert.equal(runtime.dispatch({type:"grant-item",actorId:gob,item:potion.item!}).status,"refused");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
