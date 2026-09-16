/**
 * R22 (ROLL20_TABLE_SPEC.md D118, D119): the two things the owner ran into.
 * A floating menu is placed against the window, never against the clipped board — right-clicking a token low on
 * the scene used to hide the 삭제 button past the board's edge with no way to reach it. And a browser profile is
 * one person that stays that person, with `?seat=<이름>` for a second person on the same machine.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { seatOf, userIdKey } from "../../client/app/campaigns";
import { fitOnScreen } from "../../client/ui/place";

const room = { width: 1280, height: 640 };

test("fitOnScreen: below the point when it fits, flipped above when it does not, and never off an edge", () => {
  // Plenty of room below: the menu starts right at the pointer.
  assert.deepEqual(fitOnScreen({ x: 100, y: 100 }, { width: 300, height: 200 }, room), { x: 100, y: 100 });
  // A low pointer with a tall menu: it opens upward instead of running past the bottom.
  assert.deepEqual(fitOnScreen({ x: 100, y: 560 }, { width: 300, height: 300 }, room), { x: 100, y: 260 });
  // Near the right edge it is pulled left so the whole menu shows.
  assert.deepEqual(fitOnScreen({ x: 1200, y: 100 }, { width: 300, height: 200 }, room), { x: 972, y: 100 });
  // Too tall to fit either way: as low as it can sit and still start on screen, never above the top margin.
  const cramped = fitOnScreen({ x: 10, y: 600 }, { width: 300, height: 900 }, room);
  assert.deepEqual(cramped, { x: 10, y: 8 });
  // Too wide as well: it starts at the left margin rather than off screen.
  assert.equal(fitOnScreen({ x: 1200, y: 10 }, { width: 2000, height: 100 }, room).x, 8);
  // Exactly flush against the bottom margin still counts as fitting.
  assert.equal(fitOnScreen({ x: 0, y: 432 }, { width: 100, height: 200 }, room).y, 432);
  assert.equal(fitOnScreen({ x: 0, y: 433 }, { width: 100, height: 200 }, room).y, 233, "one pixel more and it flips");
});

test("seats: no seat is the browser's own person; a named seat is another, and each keeps its own key", () => {
  assert.equal(seatOf(""), null);
  assert.equal(seatOf("?seat=지연"), "지연");
  assert.equal(seatOf("?other=1&seat=2"), "2");
  assert.equal(seatOf("?seat="), null, "an empty seat is no seat");
  assert.equal(seatOf("?seat=%20%20"), null, "nor is whitespace");
  assert.equal(seatOf(`?seat=${"x".repeat(60)}`)!.length, 24, "a seat name is kept short");
  assert.equal(userIdKey(null), "simplevtt-user-id");
  assert.equal(userIdKey("지연"), "simplevtt-user-id:지연");
  assert.notEqual(userIdKey("지연"), userIdKey("민수"), "two seats never share an id");
});
