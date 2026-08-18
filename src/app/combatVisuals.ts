import type { ActionVm, ResolutionView } from "./contracts";

export type CombatVfxDelivery = "slashing"|"piercing"|"bludgeoning"|"projectile"|"beam"|"wave"|"impact";
export type CombatVfxElement = "fire"|"lightning"|"poison"|"cold"|"force"|"acid"|"radiant"|"necrotic"|"thunder"|"psychic"|null;

export interface CombatVfxProfile {
  delivery:CombatVfxDelivery;
  physical:"slashing"|"piercing"|"bludgeoning"|null;
  element:CombatVfxElement;
  phase:"delivery"|"impact";
  label:string;
}

const PHYSICAL:Record<string,NonNullable<CombatVfxProfile["physical"]>>={
  "slashing":"slashing","참격":"slashing",
  "piercing":"piercing","관통":"piercing",
  "bludgeoning":"bludgeoning","타격":"bludgeoning","둔기":"bludgeoning",
};

const ELEMENT:Record<string,Exclude<CombatVfxElement,null>>={
  "fire":"fire","화염":"fire","불":"fire",
  "lightning":"lightning","번개":"lightning","전격":"lightning",
  "poison":"poison","독":"poison",
  "cold":"cold","냉기":"cold","얼음":"cold",
  "force":"force","역장":"force",
  "acid":"acid","산성":"acid",
  "radiant":"radiant","광휘":"radiant",
  "necrotic":"necrotic","사령":"necrotic",
  "thunder":"thunder","천둥":"thunder",
  "psychic":"psychic","정신":"psychic",
};

function normalized(value:string) { return value.trim().toLowerCase(); }

function damageProfile(action:ActionVm) {
  let physical:CombatVfxProfile["physical"]=null;
  let element:CombatVfxElement=null;
  for (const component of action.damage??[]) {
    const key=normalized(component.type);
    physical??=PHYSICAL[key]??null;
    element??=ELEMENT[key]??null;
  }
  return {physical,element};
}

function baseDelivery(action:ActionVm,physical:CombatVfxProfile["physical"],element:CombatVfxElement):CombatVfxDelivery {
  if (physical) return physical;
  if (action.target==="multi-enemy") return "wave";
  if (element==="lightning") return "beam";
  if (action.category==="magic"||action.resolutionKind==="no-roll-damage") return "projectile";
  return "impact";
}

export function buildCombatVfxProfile(resolution:ResolutionView,action:ActionVm|undefined):CombatVfxProfile|null {
  if (!action || !(action.damage?.length)) return null;
  const {physical,element}=damageProfile(action);
  // damage-animation is the post-roll impact phase. effect-preview is the only
  // pre-apply stage for no-roll damage such as a magic projectile, so it must
  // retain delivery motion instead of jumping straight to impact.
  const impactStage=resolution.stage==="damage-animation";
  const delivery=impactStage?"impact":baseDelivery(action,physical,element);
  const semantic=element??physical;
  return {
    delivery,
    physical,
    element,
    phase:impactStage?"impact":"delivery",
    label:semantic??"impact",
  };
}
