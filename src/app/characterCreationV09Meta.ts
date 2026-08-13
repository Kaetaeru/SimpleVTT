import type { AbilityKey, CharacterCreateDraft } from "./contracts";
import { CLASSES } from "./characterCreationV09Catalog";
export type Meta={hit:number;saves:string[];rec:AbilityKey[];skills:string[];gear:{id:string;label:string}[];features:string[]};
export const META:Record<string,Meta>={
"class.fighter":{hit:10,saves:["근력","건강"],rec:["str","con"],skills:["운동","곡예","지각","통찰","생존","위협"],gear:[{id:"chain-shield",label:"체인 메일 + 방패 + 롱소드"},{id:"leather-kit",label:"가죽 갑옷 + 롱소드 + 숏보우"}],features:["세컨드 윈드"]},
"class.bard":{hit:8,saves:["민첩","매력"],rec:["cha","dex"],skills:["곡예","비전","기만","통찰","지각","공연","설득","손재주","은신"],gear:[{id:"leather-kit",label:"가죽 갑옷 + 레이피어 + 악기"},{id:"bard-pack",label:"가죽 갑옷 + 단검 + 악기"}],features:["바드 주문 시전"]},
"class.wizard":{hit:6,saves:["지능","지혜"],rec:["int","con"],skills:["비전","역사","통찰","조사","의학","종교"],gear:[{id:"wizard-focus",label:"주문서 + 비전 매개체 + 단검"},{id:"wizard-component",label:"주문서 + 구성요소 주머니 + 단검"}],features:["주문서","마법사 주문 시전"]},
"class.cleric":{hit:8,saves:["지혜","매력"],rec:["wis","con"],skills:["역사","통찰","의학","설득","종교"],gear:[{id:"chain-shield",label:"체인 메일 + 방패 + 메이스"},{id:"scale-shield",label:"스케일 메일 + 방패 + 메이스"}],features:["성직자 주문 시전"]}};
export const classId=(d:CharacterCreateDraft)=>CLASSES.find((x)=>x.name===d.className)?.id??"class.fighter";
export const meta=(d:CharacterCreateDraft)=>META[classId(d)]??META["class.fighter"];
