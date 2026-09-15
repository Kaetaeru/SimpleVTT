/**
 * How a running session lands in its campaign document (CAMPAIGN_RESOURCES.md §1): players are remembered, the
 * party is the last-seen copy of every character, and the session's shared log and round go into a session
 * record. Pure: the provider calls it on host events (debounced) and once more when the session closes.
 */
import type { SessionSnapshot } from "../session/protocol";
import type { CampaignDocData, CampaignSessionRecord, DocumentBase } from "./types";

export type CampaignDoc = DocumentBase<"campaign", CampaignDocData>;

export function newSessionRecord(id: string, startedAt: string): CampaignSessionRecord {
  return { id, startedAt, round: 0, log: [] };
}

/** The campaign with the session's current state folded in (idempotent for the same snapshot). */
export function campaignWithSession(campaign: CampaignDoc, snapshot: SessionSnapshot, record: { id: string; startedAt: string; endedAt?: string }): CampaignDoc {
  const now = new Date().toISOString();
  const players = [...campaign.data.players];
  for (const participant of snapshot.participants) {
    if (participant.role === "host") continue;
    const index = players.findIndex((player) => player.userId === participant.userId);
    const entry = { userId: participant.userId, name: participant.name, lastSeenAt: participant.connected ? now : players[index]?.lastSeenAt };
    if (index >= 0) players[index] = entry; else players.push(entry);
  }
  const party = snapshot.characters.map((character) => ({ characterId: character.characterId, ownerUserId: character.ownerUserId, source: character.source, runtime: character.runtime, savedAt: now }));
  const session: CampaignSessionRecord = { id: record.id, startedAt: record.startedAt, endedAt: record.endedAt, round: snapshot.round, log: snapshot.log.map((entry) => ({ ...entry })) };
  const sessions = campaign.data.sessions.some((item) => item.id === record.id) ? campaign.data.sessions.map((item) => (item.id === record.id ? session : item)) : [...campaign.data.sessions, session];
  return { ...campaign, data: { ...campaign.data, players, party, sessions } };
}

/** What the host seeds a new session with: the campaign's party and known players. */
export function seedFromCampaign(campaign: CampaignDoc) {
  return {
    characters: campaign.data.party.map((member) => ({ characterId: member.characterId, ownerUserId: member.ownerUserId, source: member.source, runtime: member.runtime })),
    players: campaign.data.players.map((player) => ({ userId: player.userId, name: player.name })),
  };
}
