import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * SRD 5.2.1 monster catalog generator (V1.2 T1-01). Reads the Korean stat-block presentation bundle
 * (`content/presentation/dnd-srd-5.2.1.monsters`) and parses every stat block into a structured, language-independent
 * definition: abilities and saves, AC/HP/speed, skills, damage resistances/immunities/vulnerabilities, condition
 * immunities, senses, CR/XP/proficiency bonus, traits, actions (attack rolls, saving-throw effects, multiattack),
 * bonus actions, reactions, legendary actions, and the spellcasting lists. Prose that the parser cannot
 * structure is kept verbatim on the entry so the DM still sees it. Unparsed attack/save lines are reported.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const presentationDir = join(root, "content", "presentation", "dnd-srd-5.2.1.monsters");
const outputPath = join(root, "src", "generated", "monsterCatalog.generated.json");

const manifest = JSON.parse(readFileSync(join(presentationDir, "manifest.json"), "utf8"));
const payloadDir = join(presentationDir, "payload");
const encoded = readdirSync(payloadDir).filter((name) => /^\d+\.b64$/.test(name)).sort((a, b) => a.localeCompare(b, "en")).map((name) => readFileSync(join(payloadDir, name), "ascii").trim()).join("");
const compressed = Buffer.from(encoded, "base64");
if (compressed.length !== manifest.compressedBytes) throw new Error(`monster presentation compressed byte mismatch: expected ${manifest.compressedBytes}, got ${compressed.length}`);
if (createHash("sha256").update(compressed).digest("hex") !== manifest.sha256) throw new Error("monster presentation sha256 mismatch");
const bundle = JSON.parse(gunzipSync(compressed).toString("utf8"));
if (bundle.count !== manifest.count || bundle.monsters.length !== manifest.count) throw new Error("monster presentation count mismatch");

const ABILITY_BY_KO = { "근력":"str", "민첩":"dex", "건강":"con", "지능":"int", "지혜":"wis", "매력":"cha" };
const SIZE_BY_KO = { "초소형":"tiny", "소형":"small", "중형":"medium", "대형":"large", "거대형":"huge", "초거대형":"gargantuan" };
const TYPE_BY_KO = { "변이체":"aberration", "야수":"beast", "천상체":"celestial", "구조물":"construct", "용":"dragon", "원소":"elemental", "요정":"fey", "악마":"fiend", "거인":"giant", "인간형":"humanoid", "괴수":"monstrosity", "점액체":"ooze", "점액괴물":"ooze", "식물":"plant", "언데드":"undead", "떼":"swarm", "정령":"elemental", "구조체":"construct", "괴물":"monstrosity" };
const DAMAGE_BY_KO = { "산성":"acid", "타격":"bludgeoning", "냉기":"cold", "화염":"fire", "역장":"force", "번개":"lightning", "괴저":"necrotic", "사령":"necrotic", "관통":"piercing", "독":"poison", "정신":"psychic", "광휘":"radiant", "참격":"slashing", "천둥":"thunder" };
const CONDITION_BY_KO = { "실명":"blinded", "매혹":"charmed", "실청":"deafened", "탈진":"exhaustion", "공포":"frightened", "붙잡힘":"grappled", "행동불능":"incapacitated", "투명":"invisible", "마비":"paralyzed", "석화":"petrified", "중독":"poisoned", "넘어짐":"prone", "엎드림":"prone", "포박":"restrained", "기절":"stunned", "무의식":"unconscious", "의식 불명":"unconscious" };
const SKILL_BY_KO = { "곡예":"acrobatics", "동물 조련":"animal-handling", "비전":"arcana", "운동":"athletics", "기만":"deception", "역사":"history", "통찰":"insight", "위협":"intimidation", "조사":"investigation", "의학":"medicine", "자연":"nature", "지각":"perception", "공연":"performance", "설득":"persuasion", "종교":"religion", "손재주":"sleight-of-hand", "은신":"stealth", "생존":"survival" };

const warnings = [];
function warn(slug, message) { warnings.push(`${slug}: ${message}`); }
function num(text) { return Number(String(text).replace(/,/g, "")); }
function damageType(ko) { const key = Object.keys(DAMAGE_BY_KO).find((entry) => ko.includes(entry)); return key ? DAMAGE_BY_KO[key] : undefined; }
function conditionIds(text) { return [...new Set(Object.entries(CONDITION_BY_KO).filter(([ko]) => text.includes(ko)).map(([, id]) => id))]; }

/** "13(1d10 +8) 참격 피해 및 5(2d4) 화염 피해" → components. Also accepts flat-only "5 타격 피해". */
function damageComponents(text) {
  const out = [];
  const dice = /(\d+)\s*\(\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*\)\s*([가-힣]+)\s*피해/g;
  let m;
  while ((m = dice.exec(text))) {
    out.push({ average:num(m[1]), dice:`${m[2]}d${m[3]}`, count:num(m[2]), sides:num(m[3]), flat:m[4] ? (m[4] === "-" ? -num(m[5]) : num(m[5])) : 0, type:damageType(m[6]) ?? m[6] });
  }
  if (!out.length) {
    const flat = /(\d+)\s*([가-힣]+)\s*피해/g;
    while ((m = flat.exec(text))) out.push({ average:num(m[1]), dice:undefined, count:0, sides:0, flat:num(m[1]), type:damageType(m[2]) ?? m[2] });
  }
  if (!out.length && /^\s*피해\.?\s*$/.test(text.trim())) {
    // The translation dropped the number of "1 <type> damage" lines on tiny animals: record 1 untyped.
    out.push({ average:1, dice:undefined, count:0, sides:0, flat:1, type:"bludgeoning" });
  }
  return out;
}

function sections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = []; let current = null; let sub = null;
  const head = [];
  for (const line of lines) {
    const h2 = /^## (.+)$/.exec(line); const h3 = /^### (.+)$/.exec(line);
    if (h2) { current = { title:h2[1].trim(), entries:[] }; out.push(current); sub = null; continue; }
    if (h3 && current) { sub = { title:h3[1].trim(), lines:[] }; current.entries.push(sub); continue; }
    if (sub) sub.lines.push(line); else if (!current) head.push(line);
  }
  return { head, sections:out };
}

function parseHead(head, slug) {
  const text = head.join("\n");
  const stat = {};
  const title = /^\*(.+?)\*$/m.exec(text)?.[1] ?? "";
  const [sizeType, alignment] = title.split(",").map((part) => part.trim());
  const sizeKo = Object.keys(SIZE_BY_KO).sort((a, b) => b.length - a.length).find((ko) => sizeType.startsWith(ko));
  stat.size = sizeKo ? SIZE_BY_KO[sizeKo] : "medium";
  const typeRest = sizeKo ? sizeType.slice(sizeKo.length).trim() : sizeType;
  const typeKo = Object.keys(TYPE_BY_KO).sort((a, b) => b.length - a.length).find((ko) => typeRest.includes(ko));
  stat.creatureType = typeKo ? TYPE_BY_KO[typeKo] : "monstrosity";
  stat.typeText = typeRest; stat.alignment = alignment ?? "";
  if (!sizeKo || !typeKo) warn(slug, `size/type not recognised: ${title}`);
  const bullet = (label) => new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "m").exec(text)?.[1]?.trim() ?? "";
  stat.ac = num(/(\d+)/.exec(bullet("방어도"))?.[1] ?? 10);
  stat.acText = bullet("방어도");
  stat.initiativeBonus = num(/([+-]?\d+)/.exec(bullet("우선권"))?.[1] ?? 0);
  const hp = /(\d+)\s*\(([^)]*)\)/.exec(bullet("히트 포인트"));
  stat.hp = num(hp?.[1] ?? /(\d+)/.exec(bullet("히트 포인트"))?.[1] ?? 1);
  stat.hitDice = hp?.[2]?.replace(/\s+/g, "") ?? undefined;
  stat.speedText = bullet("이동 속도");
  stat.speed = num(/보행\s*(\d+)/.exec(stat.speedText)?.[1] ?? /(\d+)/.exec(stat.speedText)?.[1] ?? 30);
  stat.speeds = Object.fromEntries([...stat.speedText.matchAll(/(보행|등반|비행|수영|굴착)\s*(\d+)/g)].map((m) => [{ "보행":"walk", "등반":"climb", "비행":"fly", "수영":"swim", "굴착":"burrow" }[m[1]], num(m[2])]));
  stat.abilities = {}; stat.saves = {};
  for (const row of text.matchAll(/^\|\s*(근력|민첩|건강|지능|지혜|매력)\s*\|\s*(\d+)\s*\|\s*([+-]?\d+)\s*\|\s*([+-]?\d+)\s*\|/gm)) {
    stat.abilities[ABILITY_BY_KO[row[1]]] = num(row[2]);
    stat.saves[ABILITY_BY_KO[row[1]]] = num(row[4]);
  }
  if (Object.keys(stat.abilities).length !== 6) warn(slug, "ability table incomplete");
  stat.skills = Object.fromEntries([...bullet("기술").matchAll(/([가-힣 ]+?)\s*([+-]\d+)/g)].map((m) => [SKILL_BY_KO[m[1].trim()] ?? m[1].trim(), num(m[2])]));
  const list = (label) => bullet(label) ? bullet(label).split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [];
  stat.damageImmunities = list("피해 면역").map((item) => damageType(item) ?? item);
  stat.damageResistances = list("피해 저항").map((item) => damageType(item) ?? item);
  stat.damageVulnerabilities = list("피해 취약성").map((item) => damageType(item) ?? item);
  stat.conditionImmunities = conditionIds(bullet("상태 면역"));
  stat.sensesText = bullet("감각");
  stat.senses = Object.fromEntries([...stat.sensesText.matchAll(/(암시야|맹시|진시야|진동감지)\s*(\d+)/g)].map((m) => [{ "암시야":"darkvision", "맹시":"blindsight", "진시야":"truesight", "진동감지":"tremorsense" }[m[1]], num(m[2])]));
  stat.passivePerception = num(/수동 지각\s*(\d+)/.exec(stat.sensesText)?.[1] ?? 10);
  stat.languagesText = bullet("언어");
  const cr = bullet("도전 등급");
  const crMatch = /^([\d/]+)\s*\(XP\s*([\d,]+)(?:;\s*숙련 보너스\s*([+-]\d+))?\)/.exec(cr);
  stat.cr = crMatch ? (crMatch[1].includes("/") ? Number(crMatch[1].split("/")[0]) / Number(crMatch[1].split("/")[1]) : num(crMatch[1])) : 0;
  stat.crText = crMatch?.[1] ?? cr;
  stat.xp = crMatch ? num(crMatch[2]) : 0;
  stat.proficiencyBonus = crMatch?.[3] ? num(crMatch[3]) : 2;
  if (!crMatch) warn(slug, `challenge rating not recognised: ${cr}`);
  return stat;
}

// T1-02 timing semantics. The translation dropped the "(Recharge 5–6)", "(N/Day)", "Legendary Action Uses: 3"
// and "Legendary Resistance (3/Day)" annotations, so the values below follow the SRD 5.2.1 English text:
// breath weapons, webs and sprays recharge on 5–6 except the ones listed as 6; every legendary creature has 3
// legendary action uses and 3 legendary resistances per day, ancient dragons and the kraken 4, the tarrasque 5.
const RECHARGE_NAME = /브레스|숨결|분사|거미줄/;
const RECHARGE_ON_SIX = new Set(["ankheg", "dust-mephit", "ice-mephit", "magma-mephit", "steam-mephit", "iron-golem"]);
const LEGENDARY_RESISTANCE_OVERRIDES = { tarrasque:5, kraken:4 };
const USES_PER_DAY = /(\d+)\s*\/\s*(일|Day)/i;
const USES_PER_ROUND = /다음 턴이 시작될 때까지 이 행동을 다시 사용할 수 없다/;

function timingFor(entry, slug, section, flat, originalName) {
  const timing = {};
  if ((section === "행동" || section === "추가 행동") && (RECHARGE_NAME.test(entry.title) || /Breath|Web|Spray/i.test(originalName))) {
    timing.recharge = { min: RECHARGE_ON_SIX.has(slug) ? 6 : 5, sides: 6 };
  }
  const perDay = USES_PER_DAY.exec(entry.title);
  if (perDay) timing.usesPerDay = num(perDay[1]);
  if (USES_PER_ROUND.test(flat)) timing.usesPerRound = 1;
  return Object.keys(timing).length ? timing : undefined;
}

function parseEntry(entry, slug, section) {
  const originalName = entry.lines.map((line) => /^- \*\*원문명:\*\*\s*(.+)$/.exec(line)?.[1]?.trim()).find(Boolean) ?? entry.title;
  const text = entry.lines.filter((line) => !/^- \*\*원문명:\*\*/.test(line)).join("\n").trim();
  const flat = text.replace(/\s+/g, " ");
  const out = { name:entry.title, nameEn:originalName, text, kind:"text" };
  const cost = /\(([^)]*?)\)\s*$/.exec(entry.title);
  const attack = /(근접 또는 원거리|근접|원거리)?\s*명중 굴림:\s*([+-]\d+)(?:,\s*([^.]*?))?\.\s*적중:\s*(.*)$/s.exec(flat);
  if (attack) {
    const reachRange = attack[3] ?? "";
    const reach = /도달 거리\s*(\d+)/.exec(reachRange)?.[1];
    const range = /사거리\s*(\d+)(?:\/(\d+))?/.exec(reachRange);
    const hitText = attack[4].split(/(?:\.\s|$)/)[0];
    const kindWord = attack[1] ?? "";
    // The translation writes "원거리 명중 굴림 … 사거리 5피트" for melee attacks; classify by reach/range shape.
    const melee = Boolean(reach) || (range && !range[2] && num(range[1]) <= 10) || (!reach && !range);
    const ranged = kindWord.includes("원거리") && Boolean(range?.[2] || (range && num(range[1]) > 10));
    out.kind = "attack";
    out.attack = {
      mode: reach && range ? "melee-or-ranged" : ranged && !reach ? "ranged" : melee ? "melee" : "ranged",
      bonus: num(attack[2]),
      reachFeet: reach ? num(reach) : undefined,
      rangeFeet: range ? num(range[1]) : undefined,
      longRangeFeet: range?.[2] ? num(range[2]) : undefined,
      damage: damageComponents(attack[4]),
      hitText: attack[4].trim(),
      riderConditions: conditionIds(attack[4]),
    };
    if (!out.attack.damage.length && !/피해/.test(attack[4])) warn(slug, `${entry.title}: hit effect without damage`);
    else if (!out.attack.damage.length) warn(slug, `${entry.title}: damage not parsed from "${attack[4].slice(0, 60)}"`);
  } else {
    const save = /(근력|민첩|건강|지능|지혜|매력)\s*내성 굴림:\s*DC\s*(\d+)(?:,\s*([^.]*?))?\.\s*(.*)$/s.exec(flat);
    if (save) {
      const rest = save[4];
      const fail = /실패:\s*(.*?)(?=\s*성공:|$)/s.exec(rest)?.[1] ?? rest;
      const success = /성공:\s*(.*)$/s.exec(rest)?.[1] ?? "";
      const area = save[3] ?? "";
      const areaFeet = /(\d+)\s*피트/.exec(area)?.[1];
      out.kind = "save";
      out.save = {
        ability: ABILITY_BY_KO[save[1]],
        dc: num(save[2]),
        areaText: area,
        areaKind: /원뿔/.test(area) ? "cone" : /라인|길이/.test(area) ? "line" : /반경|반지름/.test(area) ? "sphere" : /각 크리처/.test(area) ? "area" : "single",
        areaFeet: areaFeet ? num(areaFeet) : undefined,
        failDamage: damageComponents(fail),
        failText: fail.trim(),
        successDamage: /절반/.test(success) ? "half" : /피해/.test(success) ? "other" : "none",
        successText: success.trim(),
        failConditions: conditionIds(fail),
      };
    } else if (/^다중공격$/.test(entry.title) || /^Multiattack$/i.test(originalName)) {
      out.kind = "multiattack";
      // "찢기 공격을 세 번 한다" → 3; "물기 공격 한 번과 발톱 공격 한 번" → 1 + 1; "여러 번" keeps a default of 2 with a warning.
      const first = (flat.split(/(?<=다\.)\s*/)[0] ?? flat);
      const explicit = [...first.matchAll(/(두|세|네|다섯|여섯|\d+)\s*번/g)].map((m) => ({ "두":2, "세":3, "네":4, "다섯":5, "여섯":6 }[m[1]] ?? num(m[1])));
      const singles = (first.match(/한 번/g) ?? []).length;
      const count = explicit.reduce((sum, value) => sum + value, 0) + singles;
      out.multiattack = { count: count > 0 ? count : 2, text: flat, parsed: count > 0 };
      if (count <= 0) warn(slug, `multiattack count not parsed: "${flat.slice(0, 80)}"`);
    } else if (/^주문 시전$/.test(entry.title) || /Spellcasting/i.test(originalName)) {
      out.kind = "spellcasting";
      const ability = Object.keys(ABILITY_BY_KO).find((ko) => new RegExp(`주문 시전 능력치는 ${ko}`).test(flat));
      out.spellcasting = {
        ability: ability ? ABILITY_BY_KO[ability] : undefined,
        dc: num(/주문 내성 DC는?\s*(\d+)/.exec(flat)?.[1] ?? 0),
        attackBonus: /주문 명중[^0-9+-]*([+-]\d+)/.exec(flat)?.[1] ? num(/주문 명중[^0-9+-]*([+-]\d+)/.exec(flat)[1]) : undefined,
        lists: [...text.matchAll(/^(의지대로|각 (\d+)\/일|각 (\d+)일|(\d+)\/일|각 (\d+)\/휴식|(\d+)\/휴식)\s*:\s*(.+)$/gm)].map((m) => ({
          frequency: m[1] === "의지대로" ? "at-will" : /휴식/.test(m[1]) ? "per-rest" : "per-day",
          uses: m[1] === "의지대로" ? undefined : num(m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6]),
          spells: m[7].split(/,\s*/).map((item) => item.trim()).filter(Boolean),
        })),
      };
    }
  }
  if (cost) out.costText = cost[1];
  const legendary = section === "전설 행동" ? /\(([1-3])\s*행동\)/.exec(entry.title) : null;
  if (legendary) out.legendaryCost = num(legendary[1]);
  else if (section === "전설 행동") out.legendaryCost = 1;
  const timing = timingFor(entry, slug, section, flat, originalName);
  if (timing) out.timing = timing;
  return out;
}

const monsters = bundle.monsters.map((monster) => {
  const { head, sections:parsed } = sections(monster.markdown);
  const stat = parseHead(head, monster.slug);
  const pick = (title) => parsed.find((section) => section.title === title)?.entries ?? [];
  const entriesOf = (title) => pick(title).map((entry) => parseEntry(entry, monster.slug, title));
  const legendaryIntro = parsed.find((section) => section.title === "전설 행동");
  // SRD 5.2.1: every legendary creature has 3 legendary action uses (4 in its lair); the translation dropped the line.
  const legendaryUses = legendaryIntro ? 3 : 0;
  const legendaryResistance = pick("특성").some((entry) => /전설 저항/.test(entry.title))
    ? (LEGENDARY_RESISTANCE_OVERRIDES[monster.slug] ?? (monster.slug.startsWith("ancient-") ? 4 : 3))
    : 0;
  return {
    id: monster.id, slug: monster.slug, name: monster.name, nameEn: monster.nameEn,
    ...stat,
    traits: entriesOf("특성"),
    actions: entriesOf("행동"),
    bonusActions: entriesOf("추가 행동"),
    reactions: entriesOf("반응 행동"),
    legendaryActions: entriesOf("전설 행동"),
    legendaryActionsPerRound: legendaryUses,
    legendaryResistance,
    presentation: { markdown: monster.markdown },
  };
});

const stats = {
  attacks: monsters.reduce((sum, m) => sum + m.actions.filter((a) => a.kind === "attack").length, 0),
  saves: monsters.reduce((sum, m) => sum + m.actions.filter((a) => a.kind === "save").length, 0),
  multiattack: monsters.filter((m) => m.actions.some((a) => a.kind === "multiattack")).length,
  spellcasters: monsters.filter((m) => m.actions.some((a) => a.kind === "spellcasting")).length,
  legendary: monsters.filter((m) => m.legendaryActions.length).length,
  textOnlyActions: monsters.reduce((sum, m) => sum + m.actions.filter((a) => a.kind === "text").length, 0),
};
mkdirSync(dirname(outputPath), { recursive:true });
writeFileSync(outputPath, JSON.stringify({ formatVersion:1, rulesProfileId:bundle.rulesProfileId, source:bundle.source, count:monsters.length, stats, warnings, monsters }), "utf8");
console.log(`Generated SRD monster catalog: ${monsters.length} monsters (${stats.attacks} attacks, ${stats.saves} save actions, ${stats.multiattack} multiattack, ${stats.spellcasters} spellcasters, ${stats.legendary} legendary, ${stats.textOnlyActions} text-only actions, ${warnings.length} warnings)`);
