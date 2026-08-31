import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeProfileProperty } from "../../src/app/realResolutionService";
import type { EffectInstance } from "../../src/domain/effects";

test("runtime profile property resolves derived references inside Effect expressions",()=>{
  const effect:EffectInstance={
    id:"effect.external.derived-ref",
    sourceId:"external.unseen.property-owner",
    targetId:"char.aelar",
    kind:"modifier",
    tags:[],
    expiry:{kind:"permanent"},
    propertyModifier:{
      property:"initiative",
      operation:"add",
      value:{ref:"ability.dex.modifier"},
      source:"definition",
      instancePolicy:"stack",
    },
  };

  const resolved=resolveRuntimeProfileProperty(
    [effect],
    "char.aelar",
    "initiative",
    {initiative:1,"ability.dex.score":14},
  );

  assert.equal(resolved.value,3);
  assert.ok(resolved.provenance.some((entry)=>entry.source.startsWith("profile:dnd.srd-5.2.1/")));
  assert.ok(resolved.provenance.some((entry)=>entry.source==="effect:effect.external.derived-ref"));
});
