export type SessionHotbarRows = 2 | 3 | 4;
export type SessionHotbarCategory = "action" | "class" | "item" | "special" | "custom";

export const SESSION_HOTBAR_ROWS_KEY = "simplevtt.session-hotbar-rows.v1";
export const SESSION_HOTBAR_CATEGORY_ORDER_KEY = "simplevtt.session-hotbar-category-order.v1";
export const DEFAULT_SESSION_HOTBAR_ROWS:SessionHotbarRows = 2;
export const DEFAULT_SESSION_HOTBAR_CATEGORY_ORDER:SessionHotbarCategory[]=["action","class","item","special","custom"];

export function normalizeSessionHotbarRows(value:unknown):SessionHotbarRows {
  const rows=Number(value);
  if (rows===3||rows===4) return rows;
  return DEFAULT_SESSION_HOTBAR_ROWS;
}

export function readSessionHotbarRows(storage:Pick<Storage,"getItem">=window.localStorage):SessionHotbarRows {
  try { return normalizeSessionHotbarRows(storage.getItem(SESSION_HOTBAR_ROWS_KEY)); }
  catch { return DEFAULT_SESSION_HOTBAR_ROWS; }
}

export function writeSessionHotbarRows(rows:SessionHotbarRows,storage:Pick<Storage,"setItem">=window.localStorage) {
  try { storage.setItem(SESSION_HOTBAR_ROWS_KEY,String(rows)); }
  catch { /* A blocked storage backend must not block play. */ }
}

export function normalizeSessionHotbarCategoryOrder(value:unknown):SessionHotbarCategory[] {
  const parsed=Array.isArray(value)?value:typeof value==="string"?(()=>{try{return JSON.parse(value) as unknown;}catch{return [];}})():[];
  const known=new Set<SessionHotbarCategory>(DEFAULT_SESSION_HOTBAR_CATEGORY_ORDER);
  const ordered=Array.isArray(parsed)?parsed.filter((entry):entry is SessionHotbarCategory=>known.has(entry as SessionHotbarCategory)):[];
  return [...new Set(ordered),...DEFAULT_SESSION_HOTBAR_CATEGORY_ORDER.filter((entry)=>!ordered.includes(entry))];
}

export function readSessionHotbarCategoryOrder(storage:Pick<Storage,"getItem">=window.localStorage) {
  try { return normalizeSessionHotbarCategoryOrder(storage.getItem(SESSION_HOTBAR_CATEGORY_ORDER_KEY)); }
  catch { return [...DEFAULT_SESSION_HOTBAR_CATEGORY_ORDER]; }
}

export function writeSessionHotbarCategoryOrder(order:SessionHotbarCategory[],storage:Pick<Storage,"setItem">=window.localStorage) {
  try { storage.setItem(SESSION_HOTBAR_CATEGORY_ORDER_KEY,JSON.stringify(normalizeSessionHotbarCategoryOrder(order))); }
  catch { /* Presentation preference failure must not block play. */ }
}
