import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CatalogEntry } from "../../src/app/contracts";
import {
  latestCampaignProviderDescriptorsFromCatalog,
  pinnedCampaignProviderDescriptorFromCatalog,
  type InstalledCampaignCalendarProfileV1,
} from "../../src/app/campaignProviderProfiles";

const systems=readFileSync(new URL("../../src/CampaignSystemsPanel.tsx",import.meta.url),"utf8");

const calendarProfile:InstalledCampaignCalendarProfileV1={kind:"calendar",defaultEra:"왕국력",weekdays:["해","달"],months:[{id:"first",label:"첫달",days:30}]};
function catalogEntry(version:string):CatalogEntry {
  return {
    id:`content:homebrew@${version}#calendar.kingdom`,contentId:"calendar.kingdom",category:"option",nameKo:"왕국 달력",nameEn:"Kingdom Calendar",
    scope:"local",sourceId:"homebrew",source:"Campaign Providers",version,description:"",relationships:[],capabilities:[],campaignProvider:calendarProfile,
  };
}

test("provider picker exposes only the newest installed version while preserving exact pinned lookup",()=>{
  const catalog=[catalogEntry("1.2.0"),catalogEntry("1.10.0")];
  const latest=latestCampaignProviderDescriptorsFromCatalog(catalog,"calendar");
  assert.equal(latest.length,1);
  assert.equal(latest[0].providerVersion,"1.10.0");
  assert.equal(pinnedCampaignProviderDescriptorFromCatalog(catalog,"calendar",latest[0].providerId,"1.2.0")?.providerVersion,"1.2.0");
});

test("Campaign provider UI derives installed profiles from snapshot catalog and pins selected version",()=>{
  assert.match(systems,/snapshot\?\.catalog/);
  assert.match(systems,/latestCampaignProviderDescriptorsFromCatalog/);
  assert.match(systems,/pinnedCampaignProviderDescriptorFromCatalog/);
  assert.match(systems,/providerVersion:provider\.providerVersion/);
  assert.match(systems,/providerOptionValue/);
});

test("custom calendar keeps the existing editor but uses profile months and explicit unavailable state",()=>{
  assert.match(systems,/selectedCalendarProfile\?\.months/);
  assert.match(systems,/현재 고정 달력 공급자를 찾을 수 없습니다/);
  assert.match(systems,/공급자 없음은 세션·휴식·행동을 막지 않습니다/);
  assert.match(systems,/날짜와 시간 직접 설정/);
  assert.match(systems,/calendarStructuredDate/);
});

test("custom ration preview uses provider defaults and consequences stay advisory only",()=>{
  assert.match(systems,/previewCampaignDailyRations\(campaign,undefined,selectedRationProfile/);
  assert.match(systems,/shortageConsequences/);
  assert.match(systems,/DM 판정 제안/);
  assert.match(systems,/피해나 소진을 자동 적용하지 않습니다/);
  assert.doesNotMatch(systems,/applyDamage|exhaustionLevel|automaticExhaustion/);
});
