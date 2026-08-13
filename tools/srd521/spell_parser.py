from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

SCHOOLS={"방호술":"abjuration","조형술":"conjuration","예지술":"divination","환혹술":"enchantment","방출술":"evocation","환영술":"illusion","사령술":"necromancy","변환술":"transmutation"}
FIELDS={"원문명":"originalName","시전 시간":"castingTime","사거리":"range","구성요소":"components","지속시간":"duration"}
LETTERS="abcdefghijklmnprstuvwz"
REV="d3d574725e0ecdfd05cb69fa32cf66196e3a8ee4"

def slugify(value:str)->str:
    value=unicodedata.normalize("NFKD",value).encode("ascii","ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+","-",value).strip("-").lower()

def level_school(line:str):
    text=line.strip().strip("*"); ritual="(의식)" in text; text=text.replace("(의식)","").strip()
    if text.startswith("소마법 "): return 0,SCHOOLS[text.removeprefix("소마법 ").strip()],ritual
    m=re.fullmatch(r"(\d+)레벨\s+(.+)",text)
    if not m: raise ValueError(f"bad spell header: {line}")
    return int(m.group(1)),SCHOOLS[m.group(2).strip()],ritual

def parse_bundle(path:Path):
    lines=path.read_text(encoding="utf-8").splitlines(); starts=[i for i,x in enumerate(lines) if x.startswith("## ")]; out=[]
    for n,start in enumerate(starts):
        chunk=lines[start:starts[n+1] if n+1<len(starts) else len(lines)]; name=chunk[0][3:].strip(); i=1
        while i<len(chunk) and not chunk[i].strip(): i+=1
        level,school,ritual=level_school(chunk[i]); i+=1; data={}
        while i<len(chunk):
            s=chunk[i].strip()
            if not s:
                i+=1
                if data: break
                continue
            m=re.match(r"^- \*\*(.+?):\*\*\s*(.*)$",s)
            if not m: break
            if m.group(1) in FIELDS: data[FIELDS[m.group(1)]]=m.group(2).strip()
            i+=1
        while i<len(chunk) and not chunk[i].strip(): i+=1
        original=data["originalName"]
        out.append({"nameKo":name,"originalName":original,"slug":slugify(original),"level":level,"school":school,"ritual":ritual,"castingTime":data.get("castingTime",""),"range":data.get("range",""),"components":data.get("components",""),"duration":data.get("duration",""),"description":"\n".join(chunk[i:]).strip()})
    return out

def _id(s): return f"dnd.srd521.spell.{s['slug']}"
def _source(letter): return {"repository":"Kaetaeru/D-D-2024-","path":f"10-RULEBOOKS/srd-5.2.1/spells/{letter}.md","revision":REV,"status":"reviewed","sourceCode":"SRD52"}
def _entry(s,letter):
    return {"id":_id(s),"category":"spell","presentation":{"originalName":s["originalName"],"defaultLocale":"ko-KR","locales":{"ko-KR":{"name":s["nameKo"],"description":s["description"]}},"translationSource":_source(letter)},"mechanics":[{"kind":"spell-definition","config":{"level":s["level"],"school":s["school"],"ritual":s["ritual"],"castingTimeText":s["castingTime"],"rangeText":s["range"],"componentsText":s["components"],"durationText":s["duration"],"supportStatus":"presentation-only"}}]}
def _module(letter,content):
    return {"$schema":"https://simplevtt.local/schemas/rule-module.schema.json","schemaVersion":"0.1-draft","moduleId":f"dnd.srd-5.2.1.spells-{letter}-generated","moduleVersion":"0.1-draft","rulesProfile":{"id":"dnd.srd-5.2.1","version":"0.1-draft"},"defaultLocale":"ko-KR","source":{"document":"System Reference Document","version":"5.2.1","license":"CC-BY-4.0","srdDerived":True},"dependencies":[{"moduleId":"dnd.srd-5.2.1.core","version":"0.1-draft"}],"conflicts":[],"capabilities":[],"extensionPoints":[],"content":content}
def generate_all(source_root:Path,repo_root:Path):
    src=source_root/"10-RULEBOOKS/srd-5.2.1/spells"; out=repo_root/"content/modules"; source={}; by_letter={}
    for letter in LETTERS:
        spells=parse_bundle(src/f"{letter}.md"); by_letter[letter]=spells
        for spell in spells:
            if _id(spell) in source: raise SystemExit(f"duplicate source id {_id(spell)}")
            source[_id(spell)]=(spell,letter)
    if len(source)!=339: raise SystemExit(f"source spell count {len(source)} != 339")
    existing=set()
    for path in sorted(out.glob("*/module.json")):
        data=json.loads(path.read_text(encoding="utf-8")); changed=False
        for e in data.get("content",[]):
            if e.get("category")!="spell": continue
            existing.add(e["id"])
            if e["id"] not in source: raise SystemExit(f"spell id absent from pinned source: {e['id']}")
            s,l=source[e["id"]]; p=e["presentation"]; p["originalName"]=s["originalName"]; p["defaultLocale"]="ko-KR"; p.setdefault("locales",{}).setdefault("ko-KR",{})["name"]=s["nameKo"]; p["locales"]["ko-KR"]["description"]=s["description"]; p["translationSource"]=_source(l); changed=True
        if changed: path.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    for letter,spells in by_letter.items():
        content=[_entry(s,letter) for s in spells if _id(s) not in existing]
        if not content: continue
        target=out/f"dnd-srd-5.2.1.spells-{letter}-generated/module.json"; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(_module(letter,content),ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"source=339 preserved={len(existing)} generated={339-len(existing)}")

if __name__=="__main__" and len(sys.argv)>1:
    generate_all(Path(sys.argv[1]),Path(__file__).resolve().parents[2])
