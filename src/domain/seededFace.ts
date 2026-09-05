/**
 * Deterministic die face for rolls the runtime must make on its own (V1.3 C1-03: Bless/Bane d4s on a d20,
 * Hunter's Mark/Hex/Divine Favor dice on a weapon hit). The seed is the resolution, operation and effect id,
 * so a replayed or undone resolution reproduces the same faces on every peer.
 */
export function deterministicFace(seed:string,sides:number):number {
  let hash=0x811c9dc5;
  for (let index=0;index<seed.length;index+=1) {
    hash^=seed.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  hash^=hash>>>13;
  hash=Math.imul(hash,0x5bd1e995)>>>0;
  hash^=hash>>>15;
  return 1+((hash>>>0)%sides);
}
