import type { SpellDiceFormula, SpellMechanicDefinition } from "./spellcasting";
import rawCatalog from "../generated/spellPresentationCatalog.generated.json";
import type { AbilityKey, ConditionId } from "./conditions";
import type { DurationSpec } from "./effects";

type CatalogSpell={id:string;level:number;castingTime:string;range:string;duration:string;summary:string;description:string};
const CATALOG=(rawCatalog as {spells:CatalogSpell[]}).spells;
const CATALOG_BY_ID=new Map(CATALOG.map((spell)=>[spell.id,spell]));
const ABILITY_BY_KO:Record<string,AbilityKey>={"근력":"str","민첩":"dex","건강":"con","지능":"int","지혜":"wis","매력":"cha"};
const DAMAGE_BY_KO:Record<string,string>={"산성":"acid","타격":"bludgeoning","냉기":"cold","화염":"fire","역장":"force","번개":"lightning","괴저":"necrotic","사령":"necrotic","관통":"piercing","독":"poison","정신":"psychic","광휘":"radiant","참격":"slashing","천둥":"thunder"};
const KOREAN_COUNT:Record<string,number>={"한":1,"하나":1,"둘":2,"두":2,"셋":3,"세":3,"넷":4,"네":4,"다섯":5,"여섯":6,"일곱":7,"여덟":8,"아홉":9,"열":10,"스무":20};
const CONDITION_BY_KO:Array<[RegExp,ConditionId]>=[
  [/실명/,"blinded"],[/청각상실|실청/,"deafened"],[/매혹/,"charmed"],[/공포/,"frightened"],
  [/붙잡힘|붙잡힌|그래플/,"grappled"],[/행동불능/,"incapacitated"],[/투명/,"invisible"],[/마비/,"paralyzed"],
  [/석화/,"petrified"],[/중독/,"poisoned"],[/넘어짐|엎드림/,"prone"],[/구속/,"restrained"],[/기절|충격/,"stunned"],[/무의식/,"unconscious"],
];

function parsedDuration(spell:CatalogSpell):DurationSpec {
  if (/^즉시$|^순간$/.test(spell.duration)) return {kind:"instant"};
  if (/집중/.test(spell.duration)) return {kind:"concentration"};
  const match=spell.duration.match(/(\d+)\s*(라운드|분|시간|일)/);
  if (!match) return /영구|해제될 때까지/.test(spell.duration)?{kind:"permanent"}:{kind:"special",key:`spell-duration:${spell.id}`};
  const amount=Number(match[1]);
  if (match[2]==="라운드") return {kind:"rounds",amount,anchorActorId:"$source",boundary:"end"};
  if (match[2]==="분") return {kind:"minutes",amount};
  return {kind:"hours",amount:match[2]==="일"?amount*24:amount};
}

function durationFromText(text:string,spell:CatalogSpell):DurationSpec {
  const nextTurn=text.match(/(당신|자신|대상)의 다음 턴이 (시작|끝)/);
  if (nextTurn) return {kind:"rounds",amount:1,anchorActorId:nextTurn[1]==="당신"?"$source":"$target",boundary:nextTurn[2]==="시작"?"start":"end"};
  const timed=text.match(/(\d+)\s*(라운드|분|시간|일)(?:\s*동안|\s*까지)?/);
  if (timed) {
    const amount=Number(timed[1]);
    if (timed[2]==="라운드") return {kind:"rounds",amount,anchorActorId:"$source",boundary:"end"};
    if (timed[2]==="분") return {kind:"minutes",amount};
    return {kind:"hours",amount:timed[2]==="일"?amount*24:amount};
  }
  return parsedDuration(spell);
}

function targetCount(spell:CatalogSpell) {
  if (/각 크리처|원하는 수만큼/.test(spell.summary)) return 64;
  const match=spell.summary.match(/최대\s*(\d+|한|하나|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉|열|스무)/);
  return match?Number(match[1])||KOREAN_COUNT[match[1]]||1:1;
}

function rangeFeet(range:string) {
  if (/^자신$/.test(range)) return 0;
  const match=range.match(/(\d+)\s*피트/);
  return match?Number(match[1]):undefined;
}

function catalogTargeting(spell:CatalogSpell,primary:SpellMechanicDefinition["primary"]) {
  const self=/^자신(?:\b|\(|$)/.test(spell.range);
  const areaCreature=/각 크리처|크리처를 최대|선택한 각 크리처/.test(spell.summary);
  const explicitCreature=/크리처 하나|인간형 하나|야수 하나|언데드 하나|접촉한[^.]*크리처|크리처를 최대|대상 하나|대상을 선택|아군을? 선택/.test(spell.summary);
  const creature=primary.kind!=="tracked-effect"||explicitCreature||areaCreature;
  if (self&&!areaCreature) return {kind:"creature" as const,rangeFeet:0,minTargets:1,maxTargets:1,allowedRelations:["self" as const],directTarget:true};
  if (!creature) return {kind:"any" as const,minTargets:0,maxTargets:0,directTarget:false};
  return {kind:"creature" as const,rangeFeet:rangeFeet(spell.range),minTargets:1,maxTargets:targetCount(spell),allowedRelations:["self" as const,"ally" as const,"enemy" as const,"neutral" as const],requiresSight:/볼 수 있는/.test(spell.summary),directTarget:!areaCreature};
}

function parsedDamagePrimary(spell:CatalogSpell):SpellMechanicDefinition["primary"]|undefined {
  if (spell.id==="dnd.srd521.spell.eldritch-blast") return {kind:"multi-attack-damage",damageType:"force",dicePerAttack:{count:1,sides:10},baseAttacks:1,cantripAttackScaling:true};
  if (spell.id==="dnd.srd521.spell.scorching-ray") return {kind:"multi-attack-damage",damageType:"fire",dicePerAttack:{count:2,sides:6},baseAttacks:3,attacksPerSlotAboveBase:1};
  if (spell.id==="dnd.srd521.spell.flame-strike") return {kind:"save-compound-damage",saveAbility:"dex",components:[{damageType:"fire",dice:{count:5,sides:6,dicePerSlotAboveBase:1}},{damageType:"radiant",dice:{count:5,sides:6,dicePerSlotAboveBase:1}}],successDamage:"half"};
  if (spell.id==="dnd.srd521.spell.ice-storm") return {kind:"save-compound-damage",saveAbility:"dex",components:[{damageType:"bludgeoning",dice:{count:2,sides:10,dicePerSlotAboveBase:1}},{damageType:"cold",dice:{count:4,sides:6}}],successDamage:"half"};
  if (spell.id==="dnd.srd521.spell.meteor-swarm") return {kind:"save-compound-damage",saveAbility:"dex",components:[{damageType:"fire",dice:{count:20,sides:6}},{damageType:"bludgeoning",dice:{count:20,sides:6}}],successDamage:"half"};
  if (spell.id==="dnd.srd521.spell.power-word-kill") return {kind:"power-word-kill",fallbackDamage:{count:12,sides:12}};
  const matches=[...spell.summary.matchAll(/(\d+)d(\d+)(?:\s*\+\s*(\d+|(?:당신의\s*)?주문\s*시전\s*능력\s*수정치))?\s*(산성|타격|냉기|화염|역장|번개|괴저|사령|관통|독|정신|광휘|참격|천둥) 피해/g)];
  if (matches.length!==1) return undefined;
  if (/턴을 (?:시작|끝)|처음으로 (?:들어|진입)|구역에 들어/.test(spell.summary.slice(0,matches[0].index))) return undefined;
  const [,count,sides,flatToken,typeKo]=matches[0];
  const dice:SpellDiceFormula={count:Number(count),sides:Number(sides),...(flatToken&&/^\d+$/.test(flatToken)?{flat:Number(flatToken)}:{}),...(flatToken&&/주문\s*시전\s*능력\s*수정치/.test(flatToken)?{addSpellcastingModifier:true}:{}),...(spell.level===0?{cantripScaling:true}:{})};
  const upcast=spell.description.match(new RegExp(`높은 주문 슬롯 레벨마다[^.]*?(\\d+)d${sides}[^.]*증가`));
  if (upcast) dice.dicePerSlotAboveBase=Number(upcast[1]);
  if (/주문 (?:명중 굴림|공격)|주문 공격/.test(spell.summary)) return {kind:"attack-damage",damageType:DAMAGE_BY_KO[typeKo],dice};
  const save=spell.summary.match(/(근력|민첩|건강|지능|지혜|매력) 내성 굴림/);
  if (!save) return undefined;
  return {kind:"save-damage",saveAbility:ABILITY_BY_KO[save[1]],damageType:DAMAGE_BY_KO[typeKo],dice,successDamage:/성공하면 (?:각각 )?절반|성공하면 절반의 피해/.test(spell.summary)?"half":"none"};
}

function parsedHealingPrimary(spell:CatalogSpell):SpellMechanicDefinition["primary"]|undefined {
  if (/모든 히트 포인트를 회복/.test(spell.summary)) return {kind:"full-healing"};
  const dice=spell.summary.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+|(?:당신의\s*)?주문\s*시전\s*능력\s*수정치))?[^.]{0,50}히트 포인트[^.]{0,30}회복/)
    ?? spell.summary.match(/히트 포인트\s*(\d+)d(\d+)(?:\s*\+\s*(\d+|(?:당신의\s*)?주문\s*시전\s*능력\s*수정치))?[^.]{0,30}회복/);
  if (dice) {
    const formula:SpellDiceFormula={count:Number(dice[1]),sides:Number(dice[2]),...(dice[3]&&/^\d+$/.test(dice[3])?{flat:Number(dice[3])}:{}),...(dice[3]&&/주문\s*시전\s*능력\s*수정치/.test(dice[3])?{addSpellcastingModifier:true}:{})};
    const upcast=spell.description.match(new RegExp(`높은 주문 슬롯 레벨마다[^.]*?(\\d+)d${dice[2]}[^.]*증가`));
    if (upcast) formula.dicePerSlotAboveBase=Number(upcast[1]);
    return {kind:"healing",dice:formula};
  }
  if (!/먹으면|열매|턴을 시작하면|각 턴/.test(spell.summary)) {
    const fixed=spell.summary.match(/히트 포인트\s*(\d+)(?:점|만큼)?(?:을|를)?\s*회복(?:시킨다|한다)?/);
    if (fixed) return {kind:"healing",dice:{count:0,sides:2,flat:Number(fixed[1])}};
  }
  return undefined;
}

function parsedTemporaryHpPrimary(spell:CatalogSpell):SpellMechanicDefinition["primary"]|undefined {
  const match=spell.summary.match(/^임시 히트 포인트(?:를)?\s*(\d+)d(\d+)(?:\s*\+\s*(\d+))?\s*얻는다/);
  if (!match) return undefined;
  const upcast=spell.description.match(/높은 주문 슬롯 레벨마다 임시 히트 포인트를 추가로 (\d+) 얻는다/);
  return {kind:"temporary-hp",dice:{count:Number(match[1]),sides:Number(match[2]),flat:Number(match[3]??0),...(upcast?{flatPerSlotAboveBase:Number(upcast[1])}:{})}};
}

function saveAbility(spell:CatalogSpell) {
  const save=spell.summary.match(/(근력|민첩|건강|지능|지혜|매력) 내성 굴림/);
  return save?ABILITY_BY_KO[save[1]]:undefined;
}

function endsOnDamage(text:string) {
  return /피해를 (?:주면|받으면|받거나)|피해를 줄 때까지|피해를 받을 때마다.*(?:끝|해제)/.test(text);
}

function parsedConditionEffects(spell:CatalogSpell,primary:SpellMechanicDefinition["primary"]) {
  const effects:NonNullable<SpellMechanicDefinition["effects"]>=[];
  for (const sentence of spell.summary.split(/(?<=다\.|된다\.|받는다\.)\s*/)) {
    if (!/상태(?:가 된다|에 빠|가 되고|이며)/.test(sentence)) continue;
    for (const [pattern,conditionId] of CONDITION_BY_KO) {
      if (!pattern.test(sentence)) continue;
      const trigger=/실패하면|실패한/.test(sentence)?"failed-save":/명중하면|적중한/.test(sentence)?"hit":"always";
      if (trigger==="failed-save"&&primary.kind!=="save-damage"&&primary.kind!=="save-effect") continue;
      if (trigger==="hit"&&primary.kind!=="attack-damage") continue;
      const parsed=durationFromText(sentence,spell);
      const duration=parsed.kind==="instant"?{kind:"special" as const,key:`spell-condition:${spell.id}:${conditionId}`}:parsed;
      effects.push({conditionId,trigger,duration,...(endsOnDamage(spell.summary)?{termination:{targetTakesDamage:true}}:{})});
    }
  }
  return effects.filter((effect,index)=>effects.findIndex((candidate)=>candidate.conditionId===effect.conditionId&&candidate.trigger===effect.trigger)===index);
}

function parsedRemovedConditions(spell:CatalogSpell) {
  if (!/상태(?:도|를|가)? (?:끝낸다|제거)/.test(spell.summary)||/중 하나를 끝낸다/.test(spell.summary)) return undefined;
  const removed=CONDITION_BY_KO.filter(([pattern])=>pattern.test(spell.summary)).map(([,condition])=>condition);
  return removed.length?[...new Set(removed)]:undefined;
}

function parsedTrackedRiders(spell:CatalogSpell,primary:SpellMechanicDefinition["primary"],hasConditions:boolean) {
  if (primary.kind==="tracked-effect"||hasConditions) return undefined;
  if (primary.kind==="save-effect") {
    const duration=parsedDuration(spell);
    return duration.kind==="instant"?undefined:[{summary:spell.summary,trigger:"failed-save",duration,...(endsOnDamage(spell.summary)?{termination:{targetTakesDamage:true}}:{})}] satisfies NonNullable<SpellMechanicDefinition["trackedEffects"]>;
  }
  if (!/다음 턴|지속시간 동안|주문이 끝날 때까지/.test(spell.summary)) return undefined;
  const trigger=/실패하면|실패한 경우/.test(spell.summary)?"failed-save":/명중하면|적중한 대상/.test(spell.summary)?"hit":"always";
  const attackDisadvantage=/다음 명중 굴림[^.]*불리점|명중 굴림에 불리점/.test(spell.summary);
  return [{summary:spell.summary,trigger,duration:durationFromText(spell.summary,spell),...(endsOnDamage(spell.summary)?{termination:{targetTakesDamage:true}}:{}),...(attackDisadvantage?{modifier:{family:"attack-roll",rollState:"disadvantage",scope:"actor",consumeOnUse:/다음 명중 굴림/.test(spell.summary)}}:{})}] satisfies NonNullable<SpellMechanicDefinition["trackedEffects"]>;
}

function parsedD20ModifierEffects(spell:CatalogSpell,primary:SpellMechanicDefinition["primary"]) {
  const text=`${spell.summary}\n${spell.description}`;
  const duration=durationFromText(text,spell);
  if (duration.kind==="instant") return [];
  const trigger=/실패하면|실패한 경우|내성 굴림에 실패/.test(text)&&("saveAbility" in primary)?"failed-save":/명중하면|적중한/.test(text)&&primary.kind==="attack-damage"?"hit":"always";
  const effects:NonNullable<SpellMechanicDefinition["trackedEffects"]>=[];
  const add=(family:"attack-roll"|"saving-throw"|"ability-check",rollState:"advantage"|"disadvantage",scope:"actor"|"target")=>effects.push({summary:spell.summary,trigger,duration,modifier:{family,rollState,scope}});
  if (/대상을 향한 명중 굴림[^.]{0,30}(?:이점|유리)|영향을 받은[^.]{0,40}(?:에 대한|향한) 명중 굴림[^.]{0,20}(?:이점|유리)/.test(text)) add("attack-roll","advantage","target");
  if (/대상을 향한 명중 굴림[^.]{0,30}(?:불리점|불리)|영향을 받은[^.]{0,40}(?:에 대한|향한) 명중 굴림[^.]{0,20}(?:불리점|불리)/.test(text)) add("attack-roll","disadvantage","target");
  if (/(?:대상|각 대상|당신)[^.]*(?:명중 굴림|공격 굴림)에 (?:이점|유리)/.test(text)) add("attack-roll","advantage","actor");
  if (/(?:대상|각 대상|당신)[^.]*(?:명중 굴림|공격 굴림)에 (?:불리점|불리)/.test(text)) add("attack-roll","disadvantage","actor");
  if (/(?:대상|각 대상|당신)[^.]*내성 굴림에 (?:이점|유리)/.test(text)) add("saving-throw","advantage","actor");
  if (/(?:대상|각 대상|당신)[^.]*내성 굴림에 (?:불리점|불리)/.test(text)) add("saving-throw","disadvantage","actor");
  if (/(?:대상|각 대상|당신)[^.]*능력 판정에 (?:이점|유리)/.test(text)) add("ability-check","advantage","actor");
  if (/(?:대상|각 대상|당신)[^.]*능력 판정에 (?:불리점|불리)/.test(text)) add("ability-check","disadvantage","actor");
  return effects;
}

function catalogMechanic(spell:CatalogSpell):SpellMechanicDefinition {
  const damage=parsedDamagePrimary(spell);
  const healing=parsedHealingPrimary(spell);
  const temporaryHp=parsedTemporaryHpPrimary(spell);
  const save=saveAbility(spell);
  const primary=damage??healing??temporaryHp??(save?{kind:"save-effect" as const,saveAbility:save,summary:spell.summary,duration:parsedDuration(spell)}:{kind:"tracked-effect" as const,summary:spell.summary,duration:parsedDuration(spell)});
  const effects=parsedConditionEffects(spell,primary);
  const trackedEffects=[...(parsedTrackedRiders(spell,primary,effects.length>0)??[]),...parsedD20ModifierEffects(spell,primary)];
  const fullyAdjudicated=Boolean(damage||healing||temporaryHp||save||effects.length);
  return {
    spellId:spell.id,
    baseLevel:spell.level,
    runtimeSupport:fullyAdjudicated?"combat-executable":"tracked-executable",
    castingEconomy:/추가 행동/.test(spell.castingTime)?"bonus-action":/반응/.test(spell.castingTime)?"reaction":"action",
    targeting:catalogTargeting(spell,primary),
    primary,
    concentration:/집중/.test(spell.duration),
    effects:effects.length?effects:undefined,
    trackedEffects:trackedEffects.length?trackedEffects:undefined,
    removesConditions:parsedRemovedConditions(spell),
    executionScope:fullyAdjudicated?"Catalog-derived roll, health, save, condition, and authoritative cast lifecycle.":"Authoritative target, action/slot, concentration, duration, and tracked spell effect lifecycle; spell-specific world interactions are retained in the effect summary.",
  };
}

export const SRD_521_SPELL_MECHANICS: Record<string, SpellMechanicDefinition> = {
  "dnd.srd521.spell.fire-bolt": {
    spellId: "dnd.srd521.spell.fire-bolt",
    baseLevel: 0,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 120,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      directTarget: true,
    },
    primary: {
      kind: "attack-damage",
      damageType: "fire",
      dice: { count: 1, sides: 10, cantripScaling: true },
    },
    executionScope: "Creature-target combat resolution. The separate flammable-object rider is outside this execution envelope.",
  },
  "dnd.srd521.spell.poison-spray": {
    spellId: "dnd.srd521.spell.poison-spray",
    baseLevel: 0,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 30,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      directTarget: true,
    },
    primary: {
      kind: "attack-damage",
      damageType: "poison",
      dice: { count: 1, sides: 12, cantripScaling: true },
    },
  },
  "dnd.srd521.spell.sacred-flame": {
    spellId: "dnd.srd521.spell.sacred-flame",
    baseLevel: 0,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 60,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      requiresSight: true,
      directTarget: true,
    },
    primary: {
      kind: "save-damage",
      saveAbility: "dex",
      damageType: "radiant",
      dice: { count: 1, sides: 8, cantripScaling: true },
      successDamage: "none",
      ignoresCoverForSave: true,
    },
  },
  "dnd.srd521.spell.healing-word": {
    spellId: "dnd.srd521.spell.healing-word",
    baseLevel: 1,
    runtimeSupport: "combat-executable",
    castingEconomy: "bonus-action",
    targeting: {
      kind: "creature",
      rangeFeet: 60,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      requiresSight: true,
      directTarget: true,
    },
    primary: {
      kind: "healing",
      dice: {
        count: 2,
        sides: 4,
        addSpellcastingModifier: true,
        dicePerSlotAboveBase: 2,
      },
    },
  },
  "dnd.srd521.spell.cure-wounds": {
    spellId: "dnd.srd521.spell.cure-wounds",
    baseLevel: 1,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 5,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      directTarget: true,
    },
    primary: {
      kind: "healing",
      dice: {
        count: 2,
        sides: 8,
        addSpellcastingModifier: true,
        dicePerSlotAboveBase: 2,
      },
    },
  },
  "dnd.srd521.spell.burning-hands": {
    spellId: "dnd.srd521.spell.burning-hands",
    baseLevel: 1,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 15,
      minTargets: 1,
      maxTargets: 64,
      allowedRelations: ["ally", "enemy", "neutral"],
      directTarget: false,
    },
    primary: {
      kind: "save-damage",
      saveAbility: "dex",
      damageType: "fire",
      dice: { count: 3, sides: 6, dicePerSlotAboveBase: 1 },
      successDamage: "half",
    },
    executionScope: "Creature damage in the authoritative 15-foot Cone. Environmental ignition is outside this execution envelope.",
  },
  "dnd.srd521.spell.magic-missile": {
    spellId: "dnd.srd521.spell.magic-missile",
    baseLevel: 1,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 120,
      minTargets: 1,
      maxTargets: 3,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      requiresSight: true,
      directTarget: true,
    },
    primary: {
      kind: "automatic-projectiles",
      damageType: "force",
      projectileDice: { sides: 4, flat: 1 },
      baseProjectiles: 3,
      projectilesPerSlotAboveBase: 1,
    },
    unsupportedInteractions: ["A target protected by the Shield spell needs the Shield spell's explicit Magic Missile immunity effect in runtime state."],
    executionScope: "Exact projectile allocation/damage when no unmaterialized spell-specific immunity overrides the generic damage pipeline.",
  },
  "dnd.srd521.spell.vicious-mockery": {
    spellId: "dnd.srd521.spell.vicious-mockery",
    baseLevel: 0,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 60,
      minTargets: 1,
      maxTargets: 1,
      allowedRelations: ["self", "ally", "enemy", "neutral"],
      requiresSight: true,
      directTarget: true,
    },
    primary: {
      kind: "save-damage",
      saveAbility: "wis",
      damageType: "psychic",
      dice: { count: 1, sides: 6, cantripScaling: true },
      successDamage: "none",
    },
    trackedEffects: [{
      summary: "대상의 다음 명중 굴림에 불리점",
      trigger: "failed-save",
      duration: { kind:"rounds", amount:1, anchorActorId:"$target", boundary:"end" },
      modifier: { family:"attack-roll", rollState:"disadvantage", scope:"actor", consumeOnUse:true },
    }],
    executionScope: "Wisdom save, psychic damage, and the one-use attack-disadvantage rider are authoritative.",
  },
  "dnd.srd521.spell.thunderwave": {
    spellId: "dnd.srd521.spell.thunderwave",
    baseLevel: 1,
    runtimeSupport: "combat-executable",
    castingEconomy: "action",
    targeting: {
      kind: "creature",
      rangeFeet: 15,
      minTargets: 1,
      maxTargets: 64,
      allowedRelations: ["ally", "enemy", "neutral"],
      directTarget: false,
    },
    primary: {
      kind: "save-damage",
      saveAbility: "con",
      damageType: "thunder",
      dice: { count: 2, sides: 8, dicePerSlotAboveBase: 1 },
      successDamage: "half",
    },
    executionScope: "Damage resolves without a spatial module. The failed-save 10-foot push remains presentation-only until authoritative forced-movement geometry is available.",
  },
};

export function spellMechanicById(spellId: string) {
  return SRD_521_SPELL_MECHANICS[spellId]??(CATALOG_BY_ID.has(spellId)?catalogMechanic(CATALOG_BY_ID.get(spellId)!):undefined);
}

export const SPELL_EXECUTION_COVERAGE={
  total:CATALOG.length,
  reviewed:Object.keys(SRD_521_SPELL_MECHANICS).length,
  derivedCombat:CATALOG.filter((spell)=>!SRD_521_SPELL_MECHANICS[spell.id]&&catalogMechanic(spell).runtimeSupport==="combat-executable").length,
  tracked:CATALOG.filter((spell)=>!SRD_521_SPELL_MECHANICS[spell.id]&&catalogMechanic(spell).runtimeSupport==="tracked-executable").length,
};
