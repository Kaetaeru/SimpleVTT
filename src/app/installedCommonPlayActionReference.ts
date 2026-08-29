const PREFIX="installed-common-play:";
const ARTIFACT_PREFIX="runtime-artifact-common-play:";
const STORED_INVOCATION_PREFIX="stored-invocation-common-play:";
const STORED_INVOCATION_CANCEL_PREFIX="stored-invocation-cancel:";
const ZONE_MEMBERSHIP_PREFIX="zone-membership-common-play:";

export interface InstalledCommonPlayActionReference {
  catalogId:string;
  mechanicId:string;
  entryPointId:string;
}

export function installedCommonPlayActionId(reference:InstalledCommonPlayActionReference) {
  return `${PREFIX}${encodeURIComponent(reference.catalogId)}#${encodeURIComponent(reference.mechanicId)}#${encodeURIComponent(reference.entryPointId)}`;
}

export function parseInstalledCommonPlayActionId(actionId:string):InstalledCommonPlayActionReference|null {
  if (!actionId.startsWith(PREFIX)) return null;
  const parts=actionId.slice(PREFIX.length).split("#");
  if (parts.length!==3 || parts.some((part)=>!part)) return null;
  try {
    return {
      catalogId:decodeURIComponent(parts[0]),
      mechanicId:decodeURIComponent(parts[1]),
      entryPointId:decodeURIComponent(parts[2]),
    };
  } catch {
    return null;
  }
}

export function runtimeArtifactCommonPlayActionId(actorId:string,definitionActionId:string) {
  return `${ARTIFACT_PREFIX}${encodeURIComponent(actorId)}#${encodeURIComponent(definitionActionId)}`;
}

export function parseRuntimeArtifactCommonPlayActionId(actionId:string) {
  if(!actionId.startsWith(ARTIFACT_PREFIX)) return null;
  const parts=actionId.slice(ARTIFACT_PREFIX.length).split("#");
  if(parts.length!==2||parts.some((part)=>!part)) return null;
  try { return {actorId:decodeURIComponent(parts[0]),definitionActionId:decodeURIComponent(parts[1])}; }
  catch { return null; }
}

export function storedInvocationCommonPlayActionId(artifactId:string,definitionActionId:string) {
  return `${STORED_INVOCATION_PREFIX}${encodeURIComponent(artifactId)}#${encodeURIComponent(definitionActionId)}`;
}

export function parseStoredInvocationCommonPlayActionId(actionId:string) {
  if(!actionId.startsWith(STORED_INVOCATION_PREFIX)) return null;
  const parts=actionId.slice(STORED_INVOCATION_PREFIX.length).split("#");
  if(parts.length!==2||parts.some((part)=>!part)) return null;
  try { return {artifactId:decodeURIComponent(parts[0]),definitionActionId:decodeURIComponent(parts[1])}; }
  catch { return null; }
}

export function storedInvocationCancelActionId(artifactId:string) {
  return `${STORED_INVOCATION_CANCEL_PREFIX}${encodeURIComponent(artifactId)}`;
}

export function parseStoredInvocationCancelActionId(actionId:string) {
  if(!actionId.startsWith(STORED_INVOCATION_CANCEL_PREFIX)) return null;
  try { return {artifactId:decodeURIComponent(actionId.slice(STORED_INVOCATION_CANCEL_PREFIX.length))}; }
  catch { return null; }
}

export function zoneMembershipCommonPlayActionId(artifactId:string,definitionActionId:string,present:boolean) {
  return `${ZONE_MEMBERSHIP_PREFIX}${present?"enter":"leave"}#${encodeURIComponent(artifactId)}#${encodeURIComponent(definitionActionId)}`;
}

export function parseZoneMembershipCommonPlayActionId(actionId:string) {
  if(!actionId.startsWith(ZONE_MEMBERSHIP_PREFIX)) return null;
  const parts=actionId.slice(ZONE_MEMBERSHIP_PREFIX.length).split("#");
  if(parts.length!==3||(parts[0]!=="enter"&&parts[0]!=="leave")||!parts[1]||!parts[2]) return null;
  try { return {present:parts[0]==="enter",artifactId:decodeURIComponent(parts[1]),definitionActionId:decodeURIComponent(parts[2])}; }
  catch { return null; }
}
