export type SheetLayoutPreference = "simplevtt" | "official";

export interface SheetLayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SHEET_LAYOUT_STORAGE_KEY = "simplevtt.v09.sheet-layout";
export const DEFAULT_SHEET_LAYOUT: SheetLayoutPreference = "simplevtt";

function storageOrNull(): SheetLayoutStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSheetLayoutPreference(value: unknown): value is SheetLayoutPreference {
  return value === "simplevtt" || value === "official";
}

export function sanitizeSheetLayoutPreference(value: unknown): SheetLayoutPreference {
  return value === "official" ? "official" : DEFAULT_SHEET_LAYOUT;
}

export function readStoredSheetLayoutPreference(storage: SheetLayoutStorage | null = storageOrNull()): SheetLayoutPreference | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(SHEET_LAYOUT_STORAGE_KEY);
    return isSheetLayoutPreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function readSheetLayoutPreference(storage: SheetLayoutStorage | null = storageOrNull()): SheetLayoutPreference {
  return readStoredSheetLayoutPreference(storage) ?? DEFAULT_SHEET_LAYOUT;
}

export function persistSheetLayoutPreference(
  preference: SheetLayoutPreference,
  storage: SheetLayoutStorage | null = storageOrNull(),
): SheetLayoutPreference {
  const safe = sanitizeSheetLayoutPreference(preference);
  if (!storage) return safe;
  try {
    storage.setItem(SHEET_LAYOUT_STORAGE_KEY, safe);
  } catch {
    // Sheet layout is presentation-only state. Storage failure must never block Character play.
  }
  return safe;
}
