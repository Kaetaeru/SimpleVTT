import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const root=new URL("../../",import.meta.url);
const ledger=JSON.parse(readFileSync(new URL("docs/rules/common-play-representative-scenarios.json",root),"utf8"));
const required=["post-roll-reaction-resource-roll-modification","multi-target-save-shared-roll-per-target-damage","magic-missile-style-allocation","persistent-effect-trigger-cleanup","zone-enter-leave-once-per-turn","aoe-cover","forced-movement","teleport-without-opportunity-attack","grapple-drag","hidden-blindsight","concentration-damage-break","simultaneous-start-turn-ordering","ready-attack","ready-spell","object-damage-threshold","vehicle-repair","summoned-controlled-actor","wild-shape-like-form-overlay","possession-controller-change","item-attunement","item-charges-recharge","monster-recharge","legendary-off-turn-pool","crafting-multi-day-project","spell-scroll-crafting","dehydration-exposure","underwater-combat","all-eight-weapon-masteries"];

test("representative composition ledger covers every required scenario with executable evidence",()=>{
  assert.equal(ledger.schemaVersion,"1");
  assert.deepEqual(ledger.scenarios.map((entry)=>entry.id),required);
  for(const entry of ledger.scenarios){
    const source=readFileSync(new URL(entry.evidence,root),"utf8");
    assert.ok(source.includes(entry.pattern),`${entry.id} evidence pattern missing from ${entry.evidence}`);
  }
});
