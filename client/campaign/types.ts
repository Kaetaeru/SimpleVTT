/**
 * Campaign documents (CAMPAIGN_RESOURCES.md §2): one envelope for everything a DM keeps — characters, NPCs, items,
 * assets, handouts, scenes, folders, the party stash and the campaign itself. Ownership (§4) decides what each
 * viewer receives; the projection in ./projection.ts applies it per kind.
 */
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";

export type OwnershipLevel = "none" | "limited" | "observer" | "owner";
export const OWNERSHIP_ORDER: OwnershipLevel[] = ["none", "limited", "observer", "owner"];

export interface Ownership {
  default: OwnershipLevel;
  users: Record<string, OwnershipLevel>;
}

export type DocumentKind = "campaign" | "character" | "npc" | "item" | "asset" | "handout" | "scene" | "rolltable" | "folder" | "party-stash";

export interface DocumentBase<K extends DocumentKind, T> {
  schema: 1;
  id: string;
  kind: K;
  name: string;
  folder?: string;
  version: number;
  updatedAt: string;
  ownership: Ownership;
  tags?: string[];
  data: T;
}

export interface PrototypeToken { image?: string; size: number; vision?: number }

export interface EmbeddedItem { instanceId: string; itemId?: string; docId?: string; name: string; quantity: number; equipped?: boolean; attuned?: boolean; charges?: number }

export interface CharacterDocData { characterId: string; ownerUserId: string; source: CharacterSource; runtime: CharacterRuntime; prototypeToken?: PrototypeToken }

export type HpBand = "healthy" | "hurt" | "critical";

export interface NpcRuntime { hp: { current: number; max: number; temp: number }; conditions: string[]; notes?: string }
export interface NpcDocData { statBlock: { catalogId?: string; name: string; ac?: number; hp?: number; speed?: string; text?: string }; runtime: NpcRuntime; prototypeToken?: PrototypeToken; gmNotes?: string; loot: EmbeddedItem[] }

export interface ItemDocData { base?: string; kind: string; description?: string; charges?: number; attunement?: boolean; priceGp?: number; image?: string }

export interface AssetDocData { hash: string; mime: string; bytes: number; width?: number; height?: number; thumbHash?: string; sourceName?: string }

export type HandoutBlock = { type: "text"; text: string } | { type: "image"; assetId: string };
export interface HandoutDocData { blocks: HandoutBlock[]; gmText?: string }

export interface SceneToken { id: string; actorRef: { kind: "character" | "npc"; id: string }; x: number; y: number; size: number; image?: string; hidden: boolean; elevation?: number; overrides?: { hp?: { current: number; max: number } } }
export interface SceneDocData { background?: string; grid: { size: number; offsetX: number; offsetY: number; type: "square" | "none" }; width: number; height: number; tokens: SceneToken[]; gmNotes?: string }

export interface RollTableDocData { formula: string; rows: Array<{ from: number; to: number; text: string }> }
export interface FolderDocData { kindFilter?: DocumentKind }
export interface PartyStashDocData { gold: number; items: EmbeddedItem[] }
export interface CampaignDocData { title: string; ruleset: string; moduleIds: string[]; players: Array<{ userId: string; name: string }>; settings: { partySheetsVisible: boolean; dmApprovesRejoin: boolean } }

export type CampaignDocument =
  | DocumentBase<"campaign", CampaignDocData>
  | DocumentBase<"character", CharacterDocData>
  | DocumentBase<"npc", NpcDocData>
  | DocumentBase<"item", ItemDocData>
  | DocumentBase<"asset", AssetDocData>
  | DocumentBase<"handout", HandoutDocData>
  | DocumentBase<"scene", SceneDocData>
  | DocumentBase<"rolltable", RollTableDocData>
  | DocumentBase<"folder", FolderDocData>
  | DocumentBase<"party-stash", PartyStashDocData>;

export const DM_USER = "__dm__";

export function newDocumentId() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `doc_${random}`;
}

export function makeDocument<K extends DocumentKind, T>(kind: K, name: string, data: T, ownership: Partial<Ownership> = {}): DocumentBase<K, T> {
  return { schema: 1, id: newDocumentId(), kind, name, version: 1, updatedAt: new Date().toISOString(), ownership: { default: ownership.default ?? "none", users: ownership.users ?? {} }, data };
}

export function levelFor(doc: { ownership: Ownership }, userId: string, isHost = false): OwnershipLevel {
  if (isHost) return "owner";
  return doc.ownership.users[userId] ?? doc.ownership.default;
}

export const atLeast = (level: OwnershipLevel, needed: OwnershipLevel) => OWNERSHIP_ORDER.indexOf(level) >= OWNERSHIP_ORDER.indexOf(needed);

export function hpBand(current: number, max: number): HpBand {
  if (max <= 0) return "healthy";
  const ratio = current / max;
  return ratio > 0.5 ? "healthy" : ratio > 0.2 ? "hurt" : "critical";
}
