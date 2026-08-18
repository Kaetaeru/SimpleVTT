export type AppearanceMode = "dark" | "light";

export interface AppearancePreference {
  mode: AppearanceMode;
  accent: string;
}

export interface AppearanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const APPEARANCE_STORAGE_KEY = "simplevtt.v09.appearance";

export const APPEARANCE_SWATCHES = [
  { id: "amber", label: "앰버", value: "#c58a2c" },
  { id: "blue", label: "블루", value: "#3478c9" },
  { id: "green", label: "그린", value: "#2f8a62" },
  { id: "violet", label: "바이올렛", value: "#7658b5" },
  { id: "rose", label: "로즈", value: "#b64e68" },
] as const;

export const DEFAULT_APPEARANCE: AppearancePreference = {
  mode: "dark",
  accent: APPEARANCE_SWATCHES[0].value,
};

function storageOrNull(): AppearanceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isAppearanceAccent(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function sanitizeAppearancePreference(value: unknown): AppearancePreference {
  if (!value || typeof value !== "object") return { ...DEFAULT_APPEARANCE };
  const candidate = value as Partial<AppearancePreference>;
  return {
    mode: candidate.mode === "light" ? "light" : "dark",
    accent: isAppearanceAccent(candidate.accent) ? candidate.accent.toLowerCase() : DEFAULT_APPEARANCE.accent,
  };
}

export function readAppearancePreference(storage: AppearanceStorage | null = storageOrNull()): AppearancePreference {
  if (!storage) return { ...DEFAULT_APPEARANCE };
  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    return raw ? sanitizeAppearancePreference(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function persistAppearancePreference(preference: AppearancePreference, storage: AppearanceStorage | null = storageOrNull()): AppearancePreference {
  const safe = sanitizeAppearancePreference(preference);
  if (!storage) return safe;
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Appearance is optional presentation state; storage failure must never block play.
  }
  return safe;
}

export function applyAppearancePreference(preference: AppearancePreference, root?: HTMLElement | null): AppearancePreference {
  const safe = sanitizeAppearancePreference(preference);
  const target = root ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!target) return safe;
  target.dataset.theme = safe.mode;
  target.style.setProperty("--accent-base", safe.accent);
  return safe;
}

export function initializeAppearancePreference(): AppearancePreference {
  const preference = readAppearancePreference();
  applyAppearancePreference(preference);
  return preference;
}
