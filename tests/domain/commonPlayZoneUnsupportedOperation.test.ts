import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveCommonPlayZoneActivation, type CommonPlayZoneDefinition } from "../../src/domain/commonPlayZoneRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const BASE=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/persistent-zone-trigger.json",import.meta.url),
  "utf8",
)) as CommonPlayZoneDefinition;

test("unsupported Zone rule operation kind rejects explicitly instead of falling through to effect.apply",()=>{
  const definition=structuredClone(BASE) as unknown as {
    artifactTemplates:Array<{artifactKind:string;rules:Array<{operations:unknown[]}>}>;
  };
  const zone=definition.artifactTemplates.find((template)=>template.artifactKind==="zone");
  assert.ok(zone);
  zone.rules[0].operations=[{kind:"future.zone.operation",template:"missing-template",target:"event.subject"}];

  const result=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),definition as unknown as CommonPlayZoneDefinition,{
    resolutionId:"unsupported-zone-operation",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"manual",
  });

  assert.equal(result.status,"rejected");
  if(result.status!=="rejected") return;
  assert.match(result.error,/kind is not supported by the zone runtime slice/);
});
