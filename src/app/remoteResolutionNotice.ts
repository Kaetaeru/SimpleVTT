import type { AppSnapshot } from "./contracts";

export function isNonBlockingRemoteResolution(snapshot:AppSnapshot) {
  const resolution=snapshot.resolution;
  const presentation=snapshot.resolutionPresentation;
  return Boolean(
    resolution
    && snapshot.session.role==="client"
    && presentation?.resolutionId===resolution.id
    && !resolution.interrupt
    && !(resolution.concentrationSave&&resolution.concentrationSave.natural===undefined)
  );
}
