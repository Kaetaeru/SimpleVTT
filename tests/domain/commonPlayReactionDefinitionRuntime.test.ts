import test from "node:test";
import assert from "node:assert/strict";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";

function portableReaction(ids={definition:"portable-reaction",interceptor:"reduce-roll",interaction:"choose-reaction"}) {
  return parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id:ids.definition,
    payments:[
      {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"},
      {kind:"resource",resource:"portable-die",amount:{value:1},consumeAt:"commit"},
    ],
    interceptors:[{
      id:ids.interceptor,
      timing:"d20.outcome-determined",
      interaction:{
        id:ids.interaction,
        kind:"choice",
        responder:"actor-owner",
        mode:"blocking",
        input:{type:"boolean"},
        revalidate:"if-revision-changed",
        stalePolicy:"reject",
      },
      operation:"recalculate",
      slot:"d20.roll",
      operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d8+1"}],
    }],
  });
}

test("portable d20 interceptor lowers into the existing Gate A reaction definition",()=>{
  assert.deepEqual(lowerCommonPlayReactionDefinition(portableReaction()),{
    id:"portable-reaction",
    payments:[
      {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"},
      {kind:"resource",resource:"portable-die",amount:{value:1},consumeAt:"commit"},
    ],
    interceptors:[{
      id:"reduce-roll",
      timing:"d20.outcome-determined",
      interaction:{
        id:"choose-reaction",
        kind:"choice",
        responder:"actor-owner",
        mode:"blocking",
        input:{type:"boolean"},
        revalidate:"if-revision-changed",
        stalePolicy:"reject",
      },
      operation:"recalculate",
      slot:"d20.roll",
      operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d8+1"}],
    }],
  });
});

test("portable interceptor fact eligibility lowers without content identity dispatch",()=>{
  const definition=portableReaction();
  Object.assign(definition.interceptors![0],{
    factQueries:[
      {id:"trigger-distance",fact:"spatial.distance-feet",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"block"},
      {id:"source-sees-trigger",fact:"sense.can-see",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"treat-false"},
    ],
    when:{op:"all",args:[
      {op:"lte",left:{ref:"trigger-distance"},right:{value:60}},
      {op:"eq",left:{ref:"source-sees-trigger"},right:{value:true}},
    ]},
  });
  const lowered=lowerCommonPlayReactionDefinition(definition)!;
  assert.deepEqual(lowered.interceptors[0].eligibility,{
    factQueries:[
      {id:"trigger-distance",fact:"spatial.distance-feet",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"block"},
      {id:"source-sees-trigger",fact:"sense.can-see",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"treat-false"},
    ],
    when:{op:"all",args:[
      {op:"lte",left:{ref:"trigger-distance"},right:{value:60}},
      {op:"eq",left:{ref:"source-sees-trigger"},right:{value:true}},
    ]},
  });
});

test("portable reaction lowering is invariant to definition, interceptor, and interaction identities",()=>{
  const first=lowerCommonPlayReactionDefinition(portableReaction())!;
  const renamed=lowerCommonPlayReactionDefinition(portableReaction({
    definition:"renamed-reaction",
    interceptor:"renamed-interceptor",
    interaction:"renamed-choice",
  }))!;
  assert.deepEqual(first.payments,renamed.payments);
  const mechanics=(definition:typeof first)=>definition.interceptors.map(({id,interaction,...rest})=>({
    ...rest,
    interaction:{...interaction,id:"ignored"},
  }));
  assert.deepEqual(mechanics(first),mechanics(renamed));
});

test("portable d20 interceptor lowers deterministic post-roll roll.modify modes structurally",()=>{
  const definition=portableReaction();
  definition.interceptors![0].operations=[
    {kind:"roll.modify",mode:"replace",value:{value:10}},
    {kind:"roll.modify",mode:"minimum",value:{value:12}},
    {kind:"roll.modify",mode:"target-add",value:{value:3}},
    {kind:"roll.modify",mode:"add-flat",value:{value:-1}},
  ];
  const lowered=lowerCommonPlayReactionDefinition(definition)!;
  assert.deepEqual(lowered.interceptors[0].operations,definition.interceptors![0].operations);

  const damage=portableReaction();
  Object.assign(damage.interceptors![0],{timing:"damage.rolled",slot:"primary.damage",operations:[{kind:"roll.modify",mode:"replace",value:{value:10}}]});
  assert.throws(()=>lowerCommonPlayReactionDefinition(damage),/primary.damage supports subtract-die only/);
});

test("existing attack outcome recalculation remains lowerable",()=>{
  const definition=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id:"portable-defense",
    payments:[{kind:"resource",resource:"defense-die",amount:{value:1},consumeAt:"commit"}],
    interceptors:[{
      id:"raise-defense",
      timing:"attack.outcome-determined",
      interaction:{id:"choose-defense",kind:"choice",responder:"target-owner",mode:"blocking",input:{type:"boolean"},revalidate:"always"},
      operation:"recalculate",
      slot:"attack.outcome",
      operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:3}}],
    }],
  });
  const lowered=lowerCommonPlayReactionDefinition(definition)!;
  assert.equal(lowered.interceptors[0]?.slot,"attack.outcome");
  assert.deepEqual(lowered.interceptors[0]?.operations,[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:3}}]);
});

test("portable damage-roll reduction lowers through the generic reaction kernel",()=>{
  const definition=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id:"damage-only",
    interceptors:[{
      id:"damage-reducer",
      timing:"damage.rolled",
      interaction:{id:"choose-damage-reduction",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"always"},
      operation:"recalculate",
      slot:"primary.damage",
      operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d6"}],
    }],
  });
  const lowered=lowerCommonPlayReactionDefinition(definition)!;
  assert.equal(lowered.interceptors[0].slot,"primary.damage");
  assert.deepEqual(lowered.interceptors[0].operations,[{kind:"roll.modify",mode:"subtract-die",dice:"1d6"}]);
});

test("unconnected interceptor families fail explicitly instead of falling through to a named engine",()=>{
  const definition=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",id:"secondary-damage-only",
    interceptors:[{id:"secondary-reducer",timing:"damage.rolled",operation:"recalculate",slot:"secondary.damage",operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d6"}]}],
  });
  assert.throws(()=>lowerCommonPlayReactionDefinition(definition),/not connected to the generic reaction runtime/);
});

test("reaction lowering rejects payment timing the Gate A kernel cannot commit atomically",()=>{
  const definition=portableReaction();
  definition.payments![0].consumeAt="stage";
  assert.throws(()=>lowerCommonPlayReactionDefinition(definition),/consumeAt must be commit/);
});
