export type MotionPreference = "system" | "full" | "reduced";

export const MOTION_STORAGE_KEY = "simplevtt.v1.motion";
export const DEFAULT_MOTION_PREFERENCE: MotionPreference = "system";

function storageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sanitizeMotionPreference(value: unknown): MotionPreference {
  return value === "full" || value === "reduced" || value === "system" ? value : DEFAULT_MOTION_PREFERENCE;
}

export function readMotionPreference(storage: Pick<Storage,"getItem"> | null = storageOrNull()): MotionPreference {
  if (!storage) return DEFAULT_MOTION_PREFERENCE;
  try {
    return sanitizeMotionPreference(storage.getItem(MOTION_STORAGE_KEY));
  } catch {
    return DEFAULT_MOTION_PREFERENCE;
  }
}

export function applyMotionPreference(preference: MotionPreference, root?: HTMLElement | null): MotionPreference {
  const safe=sanitizeMotionPreference(preference);
  const target=root??(typeof document!=="undefined"?document.documentElement:null);
  if (target) target.dataset.motion=safe;
  return safe;
}

export function persistMotionPreference(preference: MotionPreference, storage: Pick<Storage,"setItem"> | null = storageOrNull()): MotionPreference {
  const safe=sanitizeMotionPreference(preference);
  try {
    storage?.setItem(MOTION_STORAGE_KEY,safe);
  } catch {
    // Motion preference is presentation-only and must not block play.
  }
  return safe;
}

export function initializeMotionPreference(): MotionPreference {
  return applyMotionPreference(readMotionPreference());
}

export function isReducedMotionPreferred(root?: HTMLElement | null, media?: MediaQueryList | null): boolean {
  const target=root??(typeof document!=="undefined"?document.documentElement:null);
  const explicit=sanitizeMotionPreference(target?.dataset.motion);
  if (explicit==="full") return false;
  if (explicit==="reduced") return true;
  const query=media??(typeof window!=="undefined"?window.matchMedia("(prefers-reduced-motion: reduce)"):null);
  return query?.matches??false;
}
