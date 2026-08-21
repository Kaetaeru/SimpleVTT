export interface FirstRunStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const FIRST_RUN_COMPLETION_STORAGE_KEY = "simplevtt.product.first-run.v1";
export const FIRST_RUN_COMPLETION_VALUE = "complete";

function storageOrNull(): FirstRunStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFirstRunCompletion(storage: FirstRunStorage | null = storageOrNull()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(FIRST_RUN_COMPLETION_STORAGE_KEY) === FIRST_RUN_COMPLETION_VALUE;
  } catch {
    return false;
  }
}

export function persistFirstRunCompletion(storage: FirstRunStorage | null = storageOrNull()): boolean {
  if (!storage) return true;
  try {
    storage.setItem(FIRST_RUN_COMPLETION_STORAGE_KEY, FIRST_RUN_COMPLETION_VALUE);
  } catch {
    // First-run state is local product preference. Storage failure must not block product use.
  }
  return true;
}
