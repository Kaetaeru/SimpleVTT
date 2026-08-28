const PREFIX="installed-common-play:";

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
