/**
 * R20 (ROLL20_TABLE_SPEC.md D116): the housekeeping. `unusedArt` is what "안 쓰는 그림 정리" offers to delete —
 * everything the campaign no longer points at, from portraits and token pictures to scene backgrounds and the
 * `art:` references written into text.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { artRef, newArtAsset, unusedArt, usedArtIds } from "../../client/campaign/art";
import { newHandout, newJournalCharacter } from "../../client/campaign/journal";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { build } from "./support";

/** Real ids are `art_` plus a base36/uuid slice, so the ids here are ASCII like the product's. */
let nextId = 0;
const asset = (name: string, at: string) => ({ ...newArtAsset("c", "dm", { name, mime: "image/png", bytes: 1000, hash: `h_${name}` }, at), id: `art_${(nextId += 1).toString(36)}k` });

test("unusedArt: a picture stays while anything points at it, and is offered once nothing does", () => {
  const portrait = asset("초상화", "2026-01-01T00:00:00.000Z");
  const tokenPic = asset("토큰", "2026-01-02T00:00:00.000Z");
  const background = asset("배경", "2026-01-03T00:00:00.000Z");
  const inText = asset("글속", "2026-01-04T00:00:00.000Z");
  const orphan = asset("고아", "2026-01-05T00:00:00.000Z");
  const fighter = build({ name: "파이터", classes: "fighter", level: 1 });
  const pc = { ...newJournalCharacter("c", "dm", fighter.source, initialRuntime(fighter.derived)), avatar: artRef(portrait.id) };
  const handout = { ...newHandout("c", "dm"), notes: `이 그림을 보세요: ${artRef(inText.id)}` };
  const token = { ...tokenForCharacter(pc), image: artRef(tokenPic.id) };
  const scene = { ...newScene("c", "동굴", 0), background: { color: "#000", image: artRef(background.id) }, tokens: [token] };
  const assets = [portrait, tokenPic, background, inText, orphan];

  const used = usedArtIds([pc, handout], [scene]);
  assert.deepEqual([...used].sort(), [background.id, inText.id, portrait.id, tokenPic.id].sort());
  assert.deepEqual(unusedArt(assets, [pc, handout], [scene]).map((item) => item.name), ["고아"]);

  // Take the portrait off the sheet and it joins the orphans, oldest first.
  assert.deepEqual(unusedArt(assets, [{ ...pc, avatar: undefined }, handout], [scene]).map((item) => item.name), ["초상화", "고아"]);
  // With nothing in the campaign at all, everything is unused.
  assert.equal(unusedArt(assets, [], []).length, assets.length);
  // A character's saved default token counts as a use.
  const withDefault = { ...pc, avatar: undefined, defaultToken: { image: artRef(portrait.id) } };
  assert.deepEqual(unusedArt(assets, [withDefault, handout], [scene]).map((item) => item.name), ["고아"]);
});
