/**
 * The campaign's art library (ROLL20_TABLE_SPEC.md §9, CAMPAIGN_RESOURCES.md §3): image files the GM and players
 * upload, in folders, referenced by journal avatars (later tokens and page backgrounds) as `art:<id>`. The bytes
 * live outside the metadata document, keyed by content hash — in the host's store and in every viewer's cache —
 * and travel as base64 chunks only to viewers who may see something that references them.
 */
import type { JournalEntry, JournalViewer } from "./journal";
import { canView } from "./journal";

export interface ArtAsset {
  id: string;
  kind: "art";
  campaignId: string;
  name: string;
  folder: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Content hash of the data URL (sha-256 hex, or a fallback digest where SubtleCrypto is unavailable). */
  hash: string;
  /** Small preview (data URL, ≤ ~12KB) carried with the metadata so lists render before the file arrives. */
  thumb?: string;
  ownerId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const ART_LIMIT = 20 * 1024 * 1024;
export const ART_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/** Base64 payload per frame; the TCP carrier is newline-framed JSON, so frames stay well under a megabyte. */
export const ART_CHUNK = 48 * 1024;

const randomId = () => `art_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export const artRef = (id: string) => `art:${id}`;
export const artIdOf = (ref: string | undefined) => (ref && ref.startsWith("art:") ? ref.slice(4) : null);

export function newArtAsset(campaignId: string, ownerId: string, file: { name: string; mime: string; bytes: number; hash: string; width?: number; height?: number; thumb?: string }, now = new Date().toISOString()): ArtAsset {
  return { id: randomId(), kind: "art", campaignId, name: file.name, folder: "", mime: file.mime, bytes: file.bytes, width: file.width, height: file.height, hash: file.hash, thumb: file.thumb, ownerId, tags: [], createdAt: now, updatedAt: now };
}

/** A viewer sees an asset in the library when it is theirs, they are the GM, or something they can see uses it. */
export function artVisible(asset: ArtAsset, viewer: JournalViewer, journal: JournalEntry[]) {
  if (viewer.role === "gm" || asset.ownerId === viewer.userId) return true;
  const ref = artRef(asset.id);
  return journal.some((entry) => entry.avatar === ref && canView(entry, viewer));
}

export const canManageArt = (asset: ArtAsset, viewer: JournalViewer) => viewer.role === "gm" || asset.ownerId === viewer.userId;

/**
 * R20: every art id the campaign still points at — a sheet's portrait, a token's picture, a scene's background, a
 * character's default token, and any `art:<id>` written into a handout's text or an entry's notes. What is left over
 * is what "안 쓰는 그림 정리" offers to delete.
 */
export function usedArtIds(journal: JournalEntry[], pages: Array<{ background?: { image?: string }; tokens: Array<{ image?: string }> }>): Set<string> {
  const used = new Set<string>();
  const add = (ref: string | undefined) => { const id = artIdOf(ref); if (id) used.add(id); };
  const scan = (text: string | undefined) => { for (const match of text?.matchAll(/art:([A-Za-z0-9_-]+)/g) ?? []) used.add(match[1]); };
  for (const entry of journal) {
    add(entry.avatar);
    add((entry as { defaultToken?: { image?: string } }).defaultToken?.image);
    scan(entry.gmNotes);
    scan((entry as { notes?: string }).notes);
    scan((entry as { bio?: string }).bio);
  }
  for (const page of pages) {
    add(page.background?.image);
    for (const token of page.tokens) add(token.image);
  }
  return used;
}

/** The assets nothing points at any more, oldest first. */
export function unusedArt(assets: ArtAsset[], journal: JournalEntry[], pages: Array<{ background?: { image?: string }; tokens: Array<{ image?: string }> }>): ArtAsset[] {
  const used = usedArtIds(journal, pages);
  return assets.filter((asset) => !used.has(asset.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Split a data URL into base64-sized text chunks; `join` puts them back. */
export function chunkText(text: string, size = ART_CHUNK): string[] {
  const out: string[] = [];
  for (let at = 0; at < text.length; at += size) out.push(text.slice(at, at + size));
  return out.length ? out : [""];
}

/** sha-256 of the text where SubtleCrypto exists (secure contexts); a 53-bit FNV-style digest otherwise. */
export async function hashText(text: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch { /* fall through */ }
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let index = 0; index < text.length; index += 1) { const code = text.charCodeAt(index); h1 = Math.imul(h1 ^ code, 16777619) >>> 0; h2 = Math.imul(h2 + code, 2246822519) >>> 0; }
  return `f${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}${text.length.toString(16)}`;
}

/** Assembles chunked transfers keyed by asset id. */
export class ChunkAssembler {
  private readonly pending = new Map<string, { total: number; parts: Array<string | undefined>; done: number }>();
  /** Returns the whole text once every chunk arrived, else null. Chunks may come in any order; repeats are ignored. */
  add(id: string, index: number, total: number, data: string): string | null {
    let entry = this.pending.get(id);
    if (!entry || entry.total !== total) { entry = { total, parts: Array.from({ length: total }, () => undefined), done: 0 }; this.pending.set(id, entry); }
    if (index < 0 || index >= total) return null;
    if (entry.parts[index] === undefined) entry.done += 1;
    entry.parts[index] = data;
    if (entry.done < total) return null;
    this.pending.delete(id);
    return entry.parts.join("");
  }
  drop(id: string) { this.pending.delete(id); }
  progress(id: string) { const entry = this.pending.get(id); return entry ? { done: entry.done, total: entry.total } : null; }
}
