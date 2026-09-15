/**
 * What one viewer receives of a document (CAMPAIGN_RESOURCES.md §4). Computed on the host; a client never sees
 * fields above its level. `none` → nothing; `limited` → name and looks (NPC: an HP band, handout: player blocks);
 * `observer` → everything a party member may read; `owner` → everything.
 */
import type { CampaignDocument, HandoutDocData, NpcDocData, OwnershipLevel, SceneDocData } from "./types";
import { atLeast, hpBand, levelFor } from "./types";

export interface ProjectedDocument { id: string; kind: CampaignDocument["kind"]; name: string; level: OwnershipLevel; version: number; data: unknown }

export function projectDocument(doc: CampaignDocument, userId: string, isHost = false): ProjectedDocument | null {
  const level = levelFor(doc, userId, isHost);
  if (level === "none") return null;
  const base = { id: doc.id, kind: doc.kind, name: doc.name, level, version: doc.version };
  if (level === "owner") return { ...base, data: doc.data };
  switch (doc.kind) {
    case "npc": {
      const data = doc.data as NpcDocData;
      if (level === "limited") return { ...base, data: { prototypeToken: data.prototypeToken, band: hpBand(data.runtime.hp.current, data.runtime.hp.max), conditions: data.runtime.conditions } };
      const { gmNotes: _gm, ...rest } = data;
      return { ...base, data: rest };
    }
    case "handout": {
      const data = doc.data as HandoutDocData;
      return { ...base, data: { blocks: data.blocks } };
    }
    case "scene": {
      const data = doc.data as SceneDocData;
      const { gmNotes: _gm, ...rest } = data;
      return { ...base, data: { ...rest, tokens: data.tokens.filter((token) => !token.hidden) } };
    }
    case "character": {
      if (level === "limited") { const data = doc.data; return { ...base, data: { characterId: data.characterId, ownerUserId: data.ownerUserId, name: data.source.name, portrait: data.source.portrait, band: hpBand(data.runtime.hp.current, data.runtime.hp.maxSeen) } }; }
      return { ...base, data: doc.data };
    }
    default:
      return atLeast(level, "limited") ? { ...base, data: level === "limited" ? { name: doc.name } : doc.data } : null;
  }
}

export function projectAll(docs: CampaignDocument[], userId: string, isHost = false): ProjectedDocument[] {
  return docs.map((doc) => projectDocument(doc, userId, isHost)).filter((doc): doc is ProjectedDocument => doc !== null);
}
