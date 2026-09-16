/**
 * R22 (ROLL20_TABLE_SPEC.md D119): where a floating menu goes.
 *
 * The board is a clipped box, so a menu drawn inside it loses whatever falls past its edge. Menus are placed
 * against the window instead: below the point when they fit, flipped above it when they do not, and pulled back
 * from the right edge. They never leave the top or the left, because a menu you cannot reach is no menu at all.
 */
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export function fitOnScreen(at: Point, size: Size, room: Size, margin = 8): Point {
  const top = at.y + size.height + margin <= room.height
    ? at.y
    : at.y - size.height >= margin
      ? at.y - size.height
      : Math.max(margin, room.height - size.height - margin);
  const left = at.x + size.width + margin <= room.width ? at.x : Math.max(margin, room.width - size.width - margin);
  return { x: Math.round(left), y: Math.round(top) };
}
