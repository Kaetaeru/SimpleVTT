import type { MockAdapter } from "./mockAdapter";

const roles=new WeakMap<MockAdapter,"dm"|"player">();

export function setSessionDebugPreviewRole(adapter:MockAdapter,role:"dm"|"player"|null) {
  if (role) roles.set(adapter,role);
  else roles.delete(adapter);
}

export function sessionDebugPreviewRoleFor(adapter:MockAdapter) {
  return roles.get(adapter);
}
