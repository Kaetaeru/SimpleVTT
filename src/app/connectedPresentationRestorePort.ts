export type ConnectedPresentationRestoreHandler=(peer:string,sessionId:string)=>Promise<void>;

let handler:ConnectedPresentationRestoreHandler|undefined;

export function installConnectedPresentationRestoreHandler(next:ConnectedPresentationRestoreHandler|undefined) {
  handler=next;
}

export async function restoreConnectedPresentationForPeer(peer:string,sessionId:string) {
  if(handler) await handler(peer,sessionId);
}
