from __future__ import annotations

import re
import unicodedata
from pathlib import Path

SCHOOLS={"방호술":"abjuration","조형술":"conjuration","예지술":"divination","환혹술":"enchantment","방출술":"evocation","환영술":"illusion","사령술":"necromancy","변환술":"transmutation"}
FIELDS={"원문명":"originalName","시전 시간":"castingTime","사거리":"range","구성요소":"components","지속시간":"duration"}

def slugify(value:str)->str:
    value=unicodedata.normalize("NFKD",value).encode("ascii","ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+","-",value).strip("-").lower()

def level_school(line:str):
    text=line.strip().strip("*")
    ritual="(의식)" in text
    text=text.replace("(의식)","").strip()
    if text.startswith("소마법 "):
        return 0,SCHOOLS[text.removeprefix("소마법 ").strip()],ritual
    m=re.fullmatch(r"(\d+)레벨\s+(.+)",text)
    if not m: raise ValueError(f"bad spell header: {line}")
    return int(m.group(1)),SCHOOLS[m.group(2).strip()],ritual

def parse_bundle(path:Path):
    lines=path.read_text(encoding="utf-8").splitlines()
    starts=[i for i,x in enumerate(lines) if x.startswith("## ")]
    out=[]
    for n,start in enumerate(starts):
        chunk=lines[start:starts[n+1] if n+1<len(starts) else len(lines)]
        name=chunk[0][3:].strip(); i=1
        while i<len(chunk) and not chunk[i].strip(): i+=1
        level,school,ritual=level_school(chunk[i]); i+=1
        data={}
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
