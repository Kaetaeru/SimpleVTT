import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignDateTimeToAbsoluteMinute,
  projectCampaignCalendar,
} from "../../src/app/campaignCalendar";
import {
  parseInstalledCampaignProviderProfile,
  providerIdForInstalledCampaignProfile,
  type InstalledCampaignCalendarProfileV1,
  type InstalledCampaignRationProfileV1,
} from "../../src/app/campaignProviderProfiles";

const calendarProfile:InstalledCampaignCalendarProfileV1={
  kind:"calendar",
  defaultEra:"왕국력",
  weekdays:["해","달","불","물","나무"],
  months:[
    {id:"dawn",label:"새벽달",days:30},
    {id:"sun",label:"태양달",days:31},
    {id:"harvest",label:"수확달",days:29},
  ],
  leapYear:{cycle:4,remainders:[0],monthId:"harvest",extraDays:1},
};

const rationProfile:InstalledCampaignRationProfileV1={
  kind:"ration",
  defaultUnitsPerDay:1,
  unitsByRosterKind:{companion:2},
  shortageConsequences:["식량 부족을 DM에게 경고합니다."],
};

test("declarative Campaign provider profiles validate data-only calendar and ration payloads",()=>{
  assert.deepEqual(parseInstalledCampaignProviderProfile(structuredClone(calendarProfile)),calendarProfile);
  assert.deepEqual(parseInstalledCampaignProviderProfile(structuredClone(rationProfile)),rationProfile);
  assert.equal(providerIdForInstalledCampaignProfile("homebrew.world","calendar.kingdom",calendarProfile),"module.calendar-profile:homebrew.world:calendar.kingdom");
  assert.equal(providerIdForInstalledCampaignProfile("homebrew.world","ration.gritty",rationProfile),"module.ration-profile:homebrew.world:ration.gritty");
});

test("calendar profile rejects executable or structurally unsafe payloads",()=>{
  assert.throws(()=>parseInstalledCampaignProviderProfile({...calendarProfile,run:"alert(1)"}),/unsupported field/i);
  assert.throws(()=>parseInstalledCampaignProviderProfile({...calendarProfile,months:[{id:"bad",label:"Bad",days:0}]}),/days/i);
  assert.throws(()=>parseInstalledCampaignProviderProfile({...calendarProfile,leapYear:{cycle:4,remainders:[4],monthId:"harvest",extraDays:1}}),/remainder/i);
  assert.throws(()=>parseInstalledCampaignProviderProfile({...calendarProfile,leapYear:{cycle:4,remainders:[0],monthId:"missing",extraDays:1}}),/month/i);
});

test("ration profile rejects executable fields and invalid unit declarations",()=>{
  assert.throws(()=>parseInstalledCampaignProviderProfile({...rationProfile,script:"while(true){}"}),/unsupported field/i);
  assert.throws(()=>parseInstalledCampaignProviderProfile({...rationProfile,defaultUnitsPerDay:-1}),/defaultUnitsPerDay/i);
  assert.throws(()=>parseInstalledCampaignProviderProfile({...rationProfile,unitsByRosterKind:{companion:1.5}}),/unitsByRosterKind/i);
});

test("custom calendar profile round-trips authoritative absolute minutes",()=>{
  const providerId="module.calendar-profile:homebrew.world:calendar.kingdom";
  const input={era:"왕국력",year:5,monthId:"sun",day:12,hour:7,minute:45};
  const absolute=campaignDateTimeToAbsoluteMinute(providerId,input,calendarProfile);
  const projected=projectCampaignCalendar(providerId,absolute,"왕국력",calendarProfile);
  assert.deepEqual(projected,{...input,monthLabel:"태양달"});
});
