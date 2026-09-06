import assert from "node:assert/strict";
import test from "node:test";
import type { ResolutionView, SceneEntity } from "../../src/app/contracts";
import { combatBannerText, diffCombatFeedback, resolutionFeedback } from "../../src/app/combatFeedback";

function entity(id:string,name:string,hp:number,maxHp:number,extra:Partial<SceneEntity>={}):SceneEntity {
  return {id,name,side:"enemy",kind:"combatant",hp,maxHp,tempHp:0,ac:12,initiative:10,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],...extra} as SceneEntity;
}
function resolution(overrides:Partial<ResolutionView>):ResolutionView {
  return {id:"res.1",actorId:"pc",targetIds:["gob"],actionId:"action.longsword",actionName:"롱소드",rollKind:"attack",stage:"complete",authoritativeDice:[15],saveResults:[],damageComponents:[],compact:"",detail:[],provenance:[],calculatedOutcome:"",finalOutcome:"",stateChanges:[],adjudicated:false,canAdvance:false,...overrides};
}

test("F1-01: a hit shows the damage with its type, and a drop to 0 shows 쓰러짐", () => {
  const before=[entity("pc","카엘",11,11,{side:"ally",kind:"character"}),entity("gob","고블린 1",7,7)];
  const after=[entity("pc","카엘",11,11,{side:"ally",kind:"character"}),entity("gob","고블린 1",0,7)];
  const view=resolution({attackOutcome:"명중",damageComponents:[{type:"참격",roll:"1d8+3",raw:7,adjusted:7}]});
  const events=diffCombatFeedback(before,after,view,1);
  assert.deepEqual(events.map((event)=>[event.kind,event.entityId,event.label,event.semantic]),[["damage","gob","−7 참격","slashing"],["down","gob","쓰러짐",null]]);
  assert.equal(events[0].tone,"bad");
});

test("F1-01: healing, temporary HP and a new condition read as their own events; engagement chips are not conditions", () => {
  const before=[entity("pc","카엘",4,11,{side:"ally",kind:"character",status:["교전 · 늑대 1"]})];
  const after=[entity("pc","카엘",10,11,{side:"ally",kind:"character",tempHp:5,status:["교전 · 늑대 1","넘어짐"]})];
  const events=diffCombatFeedback(before,after,null,2);
  assert.deepEqual(events.map((event)=>[event.kind,event.label,event.tone]),[["heal","+6","good"],["temp-hp","+5 임시","info"],["condition","넘어짐","info"]]);
});

test("F1-01: temporary HP that soaks a hit reads as 임시 damage beside the HP loss", () => {
  const before=[entity("pc","Aelar",31,42,{tempHp:5})];const after=[entity("pc","Aelar",30,42,{tempHp:0})];
  assert.deepEqual(diffCombatFeedback(before,after,null,9).map((event)=>event.label),["−1","−5 임시"]);
});

test("F1-01: a revive from 0 reads as 일어남; the first snapshot produces nothing", () => {
  const down=[entity("pc","세라",0,10)];const up=[entity("pc","세라",1,10)];
  assert.deepEqual(diffCombatFeedback(down,up,null,3).map((event)=>event.label),["+1 일어남"]);
  assert.deepEqual(diffCombatFeedback(null,up,null,4),[]);
});

test("F1-02: miss, critical, saves and checks land once, when the resolution completes", () => {
  const entities=[entity("pc","카엘",11,11,{side:"ally",kind:"character"}),entity("gob","고블린 1",7,7)];
  const seen=new Set<string>();
  assert.deepEqual(resolutionFeedback(resolution({stage:"attack-result",attackOutcome:"빗나감"}),entities,seen),[],"nothing lands before the resolution completes");
  const miss=resolution({stage:"complete",attackOutcome:"빗나감"});
  assert.deepEqual(resolutionFeedback(miss,entities,seen).map((event)=>[event.kind,event.entityId,event.label]),[["miss","gob","빗나감"]]);
  assert.deepEqual(resolutionFeedback(miss,entities,seen),[],"the same stage does not fire twice");
  const critRolling=resolution({id:"res.2",stage:"damage-animation",attackOutcome:"명중",critical:true});
  assert.deepEqual(resolutionFeedback(critRolling,entities,seen),[],"치명타! waits for the damage to land");
  const crit=resolution({id:"res.2",stage:"complete",attackOutcome:"명중",critical:true});
  assert.deepEqual(resolutionFeedback(crit,entities,seen).map((event)=>[event.kind,event.tone,event.label]),[["critical","crit","치명타!"]]);
  const save=resolution({id:"res.3",rollKind:"save",stage:"complete",targetIds:["gob"],saveResults:[{targetId:"gob",targetName:"고블린 1",d20:14,total:16,dc:13,outcome:"성공"}]});
  assert.deepEqual(resolutionFeedback(save,entities,seen).map((event)=>[event.kind,event.label]),[["save-success","내성 성공 · 16 vs DC 13"]]);
  const rolling=resolution({id:"res.4",stage:"roll-animation",attackOutcome:"빗나감"});
  assert.deepEqual(resolutionFeedback(rolling,entities,seen),[],"nothing fires while the dice are still rolling");
  const check=resolution({id:"res.5",rollKind:"check",stage:"complete",targetIds:[],actionName:"영향 주기 · 설득",checkOutcome:"성공",checkTarget:12,rollTotal:14});
  assert.deepEqual(resolutionFeedback(check,entities,seen).map((event)=>[event.kind,event.entityId,event.label]),[["check-success","pc","판정 성공 · 14 vs DC 12"]]);
});

test("F1-02: the stage banner summarises attacks, saves, healing and checks", () => {
  const entities=[entity("pc","카엘",11,11,{side:"ally",kind:"character"}),entity("gob","고블린 1",7,7),entity("wolf","늑대 3",11,11)];
  assert.deepEqual(combatBannerText(resolution({attackOutcome:"명중",damageComponents:[{type:"참격",roll:"1d8+3",raw:6,adjusted:6}]}),entities),{title:"카엘 · 롱소드 → 고블린 1",detail:"명중 · 6 참격 피해",tone:"bad",semantic:"slashing"});
  assert.deepEqual(combatBannerText(resolution({attackOutcome:"명중",critical:true,damageComponents:[{type:"화염",roll:"2d6",raw:9,adjusted:9}]}),entities),{title:"카엘 · 롱소드 → 고블린 1",detail:"치명타 · 명중 · 9 화염 피해",tone:"crit",semantic:"fire"});
  assert.deepEqual(combatBannerText(resolution({attackOutcome:"빗나감"}),entities),{title:"카엘 · 롱소드 → 고블린 1",detail:"빗나감",tone:"neutral",semantic:null});
  assert.deepEqual(combatBannerText(resolution({rollKind:"save",actionName:"신성한 불길",targetIds:["wolf"],saveResults:[{targetId:"wolf",targetName:"늑대 3",d20:17,total:19,dc:12,outcome:"성공"}]}),entities),{title:"카엘 · 신성한 불길 → 늑대 3",detail:"내성 1 성공 · 0 실패",tone:"good",semantic:null});
  assert.deepEqual(combatBannerText(resolution({rollKind:"healing",actionName:"치유의 단어",targetIds:["pc"],finalOutcome:"카엘 HP 6 회복"}),entities),{title:"카엘 · 치유의 단어",detail:"카엘 HP 6 회복",tone:"good",semantic:null});
  assert.equal(combatBannerText(resolution({stage:"roll-animation",attackOutcome:"명중"}),entities),null,"no banner while rolling");
});
