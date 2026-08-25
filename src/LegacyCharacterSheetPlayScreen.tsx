import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { AbilityKey } from "./app/contracts";
import { projectOfficialSheet, SHEET_ABILITY_LABELS, signed } from "./app/characterSheetV10Projection";
import { sheetAbilityModifier, sheetSaveBonus } from "./app/sheetRollValues";
import { StandaloneDicePresentation } from "./VisualDiceBridge";
import type { CharacterSheetHostMode } from "./CharacterSheetPlayScreen";
import { visibleCharacterResources } from "./app/characterResourcePresentation";

type RollMode="normal"|"advantage"|"disadvantage";
type DieSides=4|6|8|10|12|20;
type LocalRoll={id:string;label:string;dice:Array<{value:number;sides:DieSides}>;modifier:number;total:number;note?:string};
type Props={hostMode?:CharacterSheetHostMode;onLevelUp?:()=>void;onEdit?:()=>void};
const ABILITIES:AbilityKey[]=["str","dex","con","int","wis","cha"];

function randomDie(sides:number){
  const values=new Uint32Array(1); crypto.getRandomValues(values);
  return (values[0]%sides)+1;
}
function parseDice(expression:string) {
  const match=expression.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i);
  if (!match) return null;
  const count=Number(match[1]); const sides=Number(match[2]) as DieSides;
  if (![4,6,8,10,12,20].includes(sides)||count<1||count>20) return null;
  const flat=match[3]?Number(match[4])*(match[3]==="-"?-1:1):0;
  return {count,sides,flat};
}

export function CharacterSheetPlayScreen({hostMode="standalone",onLevelUp,onEdit}:Props) {
  const {snapshot}=useSimpleVtt();
  const [mode,setMode]=useState<RollMode>("normal");
  const [roll,setRoll]=useState<LocalRoll|null>(null);
  const [history,setHistory]=useState<LocalRoll[]>([]);
  const [sessionNotice,setSessionNotice]=useState("");
  if (!snapshot) return null;
  const c=snapshot.activeCharacter;
  const view=projectOfficialSheet(c);
  const skillAbility=new Map<string,AbilityKey>();
  for (const ability of ABILITIES) for (const skill of view.skillsByAbility[ability]) skillAbility.set(skill,ability);

  const sessionReference=(label:string)=>{
    setSessionNotice(`${label} · 연결된 세션의 공유 판정은 Session Action 경로에서 실행합니다.`);
  };
  const publish=(next:LocalRoll)=>{ setRoll(next); setHistory((current)=>[next,...current].slice(0,8)); };
  const d20=(label:string,modifier:number)=>{
    if(hostMode==="session"){ sessionReference(label); return; }
    const first=randomDie(20); const second=mode==="normal"?null:randomDie(20);
    const face=second===null?first:mode==="advantage"?Math.max(first,second):Math.min(first,second);
    publish({id:`${Date.now()}:${label}`,label,dice:second===null?[{value:first,sides:20}]:[{value:first,sides:20},{value:second,sides:20}],modifier,total:face+modifier,note:second===null?undefined:`${mode==="advantage"?"유리":"불리"}: ${face} 채택`});
  };
  const rawDie=(sides:DieSides)=>{
    if(hostMode==="session"){ sessionReference(`d${sides}`); return; }
    const value=randomDie(sides); publish({id:`${Date.now()}:d${sides}`,label:`d${sides}`,dice:[{value,sides}],modifier:0,total:value});
  };
  const damage=(label:string,expression:string)=>{
    if(hostMode==="session"){ sessionReference(`${label} 피해`); return; }
    const parsed=parseDice(expression);
    if (!parsed) return;
    const dice=Array.from({length:parsed.count},()=>({value:randomDie(parsed.sides),sides:parsed.sides}));
    publish({id:`${Date.now()}:${label}:damage`,label:`${label} 피해`,dice,modifier:parsed.flat,total:dice.reduce((sum,die)=>sum+die.value,0)+parsed.flat,note:expression});
  };

  return <div className="screen sheet-play-screen" data-sheet-host={hostMode}>
    {hostMode==="standalone"&&<header className="sheet-play-toolbar">
      <div><span className="eyebrow accent">TABLE CHARACTER SHEET</span><h1>{c.name}</h1><p>{c.className} {c.level} · {c.subclassName||"서브클래스 없음"} · {c.species} · {c.background}</p></div>
      <div className="sheet-play-toolbar-actions"><button onClick={onEdit}>편집</button><button onClick={onLevelUp}>레벨 업</button></div>
    </header>}

    <div className="sheet-play-statusbar">
      <div><span>AC</span><strong>{c.ac}</strong></div><div><span>HP</span><strong>{c.hp}/{c.maxHp}</strong>{c.tempHp>0&&<small>+{c.tempHp} 임시</small>}</div><div><span>이동</span><strong>{c.speed} ft</strong></div><div><span>우선권</span><strong>{signed(sheetAbilityModifier(c,"dex"))}</strong></div><div><span>숙련</span><strong>+{c.proficiencyBonus}</strong></div><div><span>수동 지각</span><strong>{view.passivePerception}</strong></div>
      {hostMode==="standalone"&&<div className="sheet-roll-mode" role="group" aria-label="d20 굴림 방식"><button className={mode==="advantage"?"active":""} onClick={()=>setMode("advantage")}>유리</button><button className={mode==="normal"?"active":""} onClick={()=>setMode("normal")}>보통</button><button className={mode==="disadvantage"?"active":""} onClick={()=>setMode("disadvantage")}>불리</button></div>}
    </div>

    {hostMode==="session"&&<div className="session-sheet-roll-policy" role="status"><strong>세션 시트</strong><span>{sessionNotice||"수치와 장비는 같은 canonical Character를 표시합니다. 공유 판정은 Session Action 경로를 사용합니다."}</span></div>}
    {hostMode==="standalone"&&roll&&<StandaloneDicePresentation roll={roll} onFinished={()=>setRoll(null)}/>}

    <main className="sheet-play-layout">
      <section className="sheet-play-abilities" aria-label="능력치 내성 기술">
        {ABILITIES.map((ability)=>{
          const abilityMod=sheetAbilityModifier(c,ability); const saveProf=view.saveProficiencies.has(ability); const save=sheetSaveBonus(c,view,ability);
          return <article className="sheet-play-ability" key={ability}><header><button onClick={()=>d20(`${SHEET_ABILITY_LABELS[ability]} 판정`,abilityMod)}><span>{SHEET_ABILITY_LABELS[ability]}</span><strong>{signed(abilityMod)}</strong><b>{c.abilities[ability]}</b><small>{hostMode==="session"?"세션 판정 참조":"능력 판정"}</small></button></header><button className="sheet-play-line save" onClick={()=>d20(`${SHEET_ABILITY_LABELS[ability]} 내성 굴림`,save)}><span>{saveProf?"●":"○"} 내성 굴림</span><strong>{signed(save)}</strong></button>{view.skillsByAbility[ability].map((skill)=><button className="sheet-play-line" key={skill} onClick={()=>d20(skill,view.skillBonus(skill,skillAbility.get(skill)??ability))}><span>{view.skillExpertise(skill)?"◆":view.skillProficient(skill)?"●":"○"} {skill}</span><strong>{signed(view.skillBonus(skill,skillAbility.get(skill)??ability))}</strong></button>)}</article>;
        })}
      </section>

      <section className="sheet-play-core">
        <article className="sheet-play-card"><header><div><span className="eyebrow accent">ATTACKS</span><h2>공격 & 피해</h2></div></header><div className="sheet-play-attack-list">{c.attacks.map((attack)=><div key={attack.id}><div><strong>{attack.name}</strong><span>명중 +{attack.bonus}</span><small>{attack.damage}</small></div><button onClick={()=>d20(`${attack.name} 명중`,attack.bonus)}>{hostMode==="session"?"세션 판정":"명중 굴림"}</button><button onClick={()=>damage(attack.name,attack.damage)}>{hostMode==="session"?"피해 참조":"피해 굴림"}</button></div>)}{!c.attacks.length&&<p>등록된 공격이 없습니다.</p>}</div></article>

        <article className="sheet-play-card"><header><div><span className="eyebrow accent">RESOURCES</span><h2>자원</h2></div></header><div className="sheet-resource-grid">{visibleCharacterResources(c.resources).map((resource)=><div key={resource.id}><strong>{resource.label}</strong><span>{resource.current}/{resource.max}</span><small>{resource.source}</small></div>)}{!visibleCharacterResources(c.resources).length&&<p>추적할 자원이 없습니다.</p>}</div></article>

        <article className="sheet-play-card"><header><div><span className="eyebrow accent">FEATURES</span><h2>기능</h2></div></header><div className="sheet-simple-list">{c.features.map((feature)=><span key={feature}>{feature}</span>)}</div></article>
      </section>

      <aside className="sheet-play-side">
        {hostMode==="standalone"&&<article className="sheet-play-card"><header><div><span className="eyebrow accent">DICE</span><h2>주사위</h2></div></header><div className="sheet-common-dice">{([4,6,8,10,12,20] as DieSides[]).map((sides)=><button key={sides} onClick={()=>rawDie(sides)}>d{sides}</button>)}</div></article>}
        <article className="sheet-play-card"><header><div><span className="eyebrow accent">EQUIPMENT</span><h2>장비</h2></div></header><div className="sheet-simple-list">{c.equipment.map((item)=><span key={item}>{item}</span>)}</div></article>
        <article className="sheet-play-card"><header><div><span className="eyebrow accent">SPELLS</span><h2>주문</h2></div></header><div className="sheet-simple-list">{view.spells.map((spell)=><span key={spell.id}>{spell.name}<small>{spell.level===0?"소마법":`${spell.level}레벨`}{spell.prepared?" · 준비됨":""}</small></span>)}{!view.spells.length&&<p>주문 없음</p>}</div></article>
        {hostMode==="standalone"&&history.length>0&&<article className="sheet-play-card"><header><div><span className="eyebrow accent">HISTORY</span><h2>최근 굴림</h2></div></header><div className="sheet-roll-history">{history.map((entry)=><button key={entry.id} onClick={()=>setRoll(entry)}><span>{entry.label}</span><strong>{entry.total}</strong></button>)}</div></article>}
      </aside>
    </main>
  </div>;
}
