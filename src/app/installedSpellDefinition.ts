/**
 * Declarative spell facts an external RuleModule carries on a `spell` entry (`spell-definition` mechanic), the
 * presentation-level counterpart of the builtin SRD spell catalog: level, school, casting time, range, components,
 * duration, and the class lists the spell belongs to. Executable mechanics live in the sibling `spell-mechanic`.
 */
export interface InstalledSpellDefinitionV1 {
  level:number;
  school:string;
  ritual:boolean;
  castingTimeText:string;
  rangeText:string;
  componentsText:string;
  durationText:string;
  /** Class ids (full `dnd.srd521.class.wizard` or short `wizard`) whose spell lists include this spell. */
  classes?:string[];
  summary?:string;
}

const ALLOWED_FIELDS=new Set(["level","school","ritual","castingTimeText","rangeText","componentsText","durationText","classes","summary","supportStatus"]);
const SCHOOLS=new Set(["abjuration","conjuration","divination","enchantment","evocation","illusion","necromancy","transmutation"]);

function isObject(value:unknown):value is Record<string,unknown> {
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}
function text(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim())throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

export function parseInstalledSpellDefinition(value:unknown,label:string):InstalledSpellDefinitionV1 {
  if(!isObject(value))throw new Error(`${label} must be an object`);
  const unsupported=Object.keys(value).filter((key)=>!ALLOWED_FIELDS.has(key));
  if(unsupported.length)throw new Error(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const level=value.level;
  if(typeof level!=="number"||!Number.isInteger(level)||level<0||level>9)throw new Error(`${label}.level must be an integer between 0 and 9`);
  const school=text(value.school,`${label}.school`);
  if(!SCHOOLS.has(school))throw new Error(`${label}.school must be one of ${[...SCHOOLS].join("|")}`);
  if(typeof value.ritual!=="boolean")throw new Error(`${label}.ritual must be a boolean`);
  const classes=value.classes===undefined?undefined:(()=>{
    if(!Array.isArray(value.classes)||value.classes.some((item)=>typeof item!=="string"||!item.trim()))throw new Error(`${label}.classes must be an array of non-empty strings`);
    const items=(value.classes as string[]).map((item)=>item.trim());
    if(new Set(items).size!==items.length)throw new Error(`${label}.classes must not repeat entries`);
    return items;
  })();
  return {
    level,school,ritual:value.ritual,
    castingTimeText:text(value.castingTimeText,`${label}.castingTimeText`),
    rangeText:text(value.rangeText,`${label}.rangeText`),
    componentsText:text(value.componentsText,`${label}.componentsText`),
    durationText:text(value.durationText,`${label}.durationText`),
    ...(classes?{classes}:{}),
    ...(value.summary!==undefined?{summary:text(value.summary,`${label}.summary`)}:{}),
  };
}

/** Normalizes a class reference to the short class key used by creation spell lists (`dnd.srd521.class.wizard` → `wizard`). */
export function installedSpellClassKey(classId:string) {
  return classId.replace(/^dnd\.srd521\.class\./,"");
}
