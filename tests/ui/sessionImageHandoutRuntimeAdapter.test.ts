import assert from "node:assert/strict";
import test from "node:test";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";

function fakeTransport() {
  const original={available:tauriSessionTransport.available,startHost:tauriSessionTransport.startHost,connectClient:tauriSessionTransport.connectClient,send:tauriSessionTransport.send,sendTo:tauriSessionTransport.sendTo,stop:tauriSessionTransport.stop,onMessage:tauriSessionTransport.onMessage,onState:tauriSessionTransport.onState,onPeerLifecycle:tauriSessionTransport.onPeerLifecycle};
  const handlers:Array<(message:SessionTransportMessage)=>void>=[];
  const sent:string[]=[];
  const sentTo:Array<{peer:string;raw:string}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.connectClient=async(address)=>({role:"client",state:"connected",address,peerCount:1});
  tauriSessionTransport.send=async(raw)=>{sent.push(raw);return 1;};
  tauriSessionTransport.sendTo=async(peer,raw)=>{sentTo.push({peer,raw});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{handlers.push(handler);return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    sent:()=>sent.map((raw)=>({raw,value:JSON.parse(raw) as Record<string,unknown>})),
    sentTo:()=>sentTo.map((entry)=>({...entry,value:JSON.parse(entry.raw) as Record<string,unknown>})),
    emit(index:number,peer:string,raw:string){handlers[index]?.({peer,message:raw});},
    count:()=>handlers.length,
    restore(){Object.assign(tauriSessionTransport,original);},
  };
}

async function flush() { await new Promise<void>((resolve)=>setImmediate(resolve)); await new Promise<void>((resolve)=>setImmediate(resolve)); await new Promise<void>((resolve)=>setImmediate(resolve)); }

test("connected Session keeps handouts/private notes safe and rules lookup pinned to Session content",async()=>{
  const transport=fakeTransport();
  try {
    await import("../../src/app/offlineRuntimeAdapters");
    const { MockAdapter }=await import("../../src/app/mockAdapter");
    const { MemoryCampaignLibraryStore }=await import("../../src/app/memoryCampaignLibraryStore");
    const { setCampaignLibraryStoreForTests }=await import("../../src/app/campaignRuntimeAdapter");
    await import("../../src/app/campaignDmLibraryOrganizationRuntimeAdapter");
    const { connectedInternal }=await import("../../src/app/connectedSessionRuntimeAdapter");
    const { connectedStateFor }=await import("../../src/app/connectedSessionState");
    await import("../../src/app/connectedParticipantIdempotencyAdapter");
    await import("../../src/app/productionSessionLifecycleAdapter");
    const handout=await import("../../src/app/sessionImageHandoutRuntimeAdapter");
    await import("../../src/app/sessionContentParityRuntimeAdapter");
    const { parseLocalImageDataUrl,HANDOUT_IMAGE_MAX_BYTES }=await import("../../src/app/localImageAsset");

    const host=new MockAdapter();
    const client=new MockAdapter();
    const client2=new MockAdapter();
    setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
    setCampaignLibraryStoreForTests(client,new MemoryCampaignLibraryStore());
    setCampaignLibraryStoreForTests(client2,new MemoryCampaignLibraryStore());

    const privateFolderId="folder.g06-private";
    const privateFolderLabel="G06 Hidden Vault";
    const privateEntryId="dm-note.g06-secret";
    const privateEntryLabel="G06 Hidden Note";
    const privateNoteText="G06-NOTE-TEXT-SENTINEL";
    const privateTag="G06-PRIVATE-TAG";
    await host.createCampaign({campaignId:"campaign.handout.g06",name:"Handout Campaign"});
    await host.upsertCampaignDmLibraryFolder("campaign.handout.g06",{folderId:privateFolderId,label:privateFolderLabel});
    await host.upsertCampaignDmLibraryEntry("campaign.handout.g06",{
      entryId:privateEntryId,
      kind:"note",
      label:privateEntryLabel,
      folderId:privateFolderId,
      favorite:true,
      tags:[privateTag],
      noteText:privateNoteText,
    });

    const hostTemplate=await host.getSnapshot();
    const privateCampaign=hostTemplate.campaigns?.find((campaign)=>campaign.campaignId==="campaign.handout.g06");
    assert.equal(privateCampaign?.dmLibrary.entries.find((entry)=>entry.entryId===privateEntryId)?.noteText,privateNoteText,"privacy fixture must exist in the Host-only Campaign store");
    const clientTemplate=await client.getSnapshot();
    const client2Template=await client2.getSnapshot();
    const hostCharacter={...structuredClone(hostTemplate.activeCharacter),id:"char.handout.host",name:"Handout Host",saveState:"saved" as const};
    const clientCharacter={
      ...structuredClone(clientTemplate.activeCharacter),
      id:"char.handout.client",
      name:"Handout Client",
      saveState:"saved" as const,
      equipment:[],
      items:[],
      attacks:[],
    };
    const client2Character={
      ...structuredClone(client2Template.activeCharacter),
      id:"char.handout.client2",
      name:"Handout Observer",
      saveState:"saved" as const,
      equipment:[],
      items:[],
      attacks:[],
    };
    const hostApp=connectedInternal(host);
    hostApp.activeCharacter=structuredClone(hostCharacter);
    hostApp.characters=[...hostApp.characters.filter((entry)=>![hostCharacter.id,clientCharacter.id,client2Character.id].includes(entry.id)),structuredClone(hostCharacter),structuredClone(clientCharacter),structuredClone(client2Character)];
    const clientApp=connectedInternal(client);
    clientApp.activeCharacter=structuredClone(clientCharacter);
    clientApp.characters=[...clientApp.characters.filter((entry)=>entry.id!==clientCharacter.id),structuredClone(clientCharacter)];
    const client2App=connectedInternal(client2);
    client2App.activeCharacter=structuredClone(client2Character);
    client2App.characters=[...client2App.characters.filter((entry)=>entry.id!==client2Character.id),structuredClone(client2Character)];

    await host.hostSession();
    await client.joinSession("127.0.0.1:3210");
    assert.equal(transport.count(),2,"handout layer must reuse the existing connected listener registration");
    const firstHello=transport.sent().find((entry)=>entry.value.type==="hello");
    assert.ok(firstHello);
    transport.emit(0,"peer.client",firstHello.raw);
    await flush();
    const firstAck=transport.sentTo().find((entry)=>entry.peer==="peer.client"&&entry.value.type==="hello-ack");
    assert.ok(firstAck);
    assert.equal((firstAck.value.compatibility as {status?:string}).status,"compatible");
    transport.emit(1,"host",firstAck.raw);
    await flush();
    const reconnectHello=transport.sent().filter((entry)=>entry.value.type==="hello").at(-1);
    assert.ok(reconnectHello,"content parity must leave a current hello that can be used for reconnect");

    await client2.joinSession("127.0.0.1:3210");
    assert.equal(transport.count(),3,"H+P1+P2 must each retain the existing connected listener path");
    const secondHello=transport.sent().filter((entry)=>entry.value.type==="hello").at(-1);
    assert.ok(secondHello);
    transport.emit(0,"peer.client2",secondHello.raw);
    await flush();
    const secondAck=transport.sentTo().find((entry)=>entry.peer==="peer.client2"&&entry.value.type==="hello-ack");
    assert.ok(secondAck);
    assert.equal((secondAck.value.compatibility as {status?:string}).status,"compatible");
    transport.emit(2,"host",secondAck.raw);
    await flush();

    const liveCatalog=(await host.getSnapshot()).catalog;
    const pinnedSourceEntry=liveCatalog.find((entry)=>entry.category==="feat")??liveCatalog[0];
    assert.ok(pinnedSourceEntry,"production Session must expose at least one rules/content entry to pin");
    const pinnedEntryId=pinnedSourceEntry.id;
    const pinnedBefore=await host.lookupSessionContent(pinnedEntryId);
    assert.deepEqual(pinnedBefore,pinnedSourceEntry,"Host lookup must start from the composed Session content snapshot");
    for(const app of [hostApp,clientApp,client2App]){
      const ambient=app.catalog.find((entry)=>entry.id===pinnedEntryId);
      assert.ok(ambient,"all connected peers must have the selected ambient content entry");
      ambient.nameKo="G07 변경 콘텐츠";
      ambient.nameEn="G07 Changed Content";
      ambient.description="G07 ambient catalog changed after Session start";
    }
    for(const adapter of [host,client,client2]){
      assert.equal((await adapter.getSnapshot()).catalog.find((entry)=>entry.id===pinnedEntryId)?.nameEn,"G07 Changed Content","ambient catalog fixture must drift after Session start");
    }
    const sentBeforeLookup=transport.sent().length;
    const sentToBeforeLookup=transport.sentTo().length;
    const cursorBeforeLookup=connectedStateFor(host).ledger?.cursor;
    for(const adapter of [host,client,client2]){
      const lookup=await adapter.lookupSessionContent(pinnedEntryId);
      assert.equal(lookup?.nameEn,pinnedSourceEntry.nameEn,"live rules lookup must read the pinned Session content snapshot");
      assert.notEqual(lookup?.description,"G07 ambient catalog changed after Session start");
    }
    assert.equal(transport.sent().length,sentBeforeLookup,"Session content lookup must not send a network message");
    assert.equal(transport.sentTo().length,sentToBeforeLookup,"Session content lookup must not fan out a network message");
    assert.equal(connectedStateFor(host).ledger?.cursor,cursorBeforeLookup,"Session content lookup must not create a mechanics/participant event");

    const ledgerCursorBefore=connectedStateFor(host).ledger?.cursor;
    const asset=parseLocalImageDataUrl("data:image/webp;base64,UklGRg==","clue.webp",HANDOUT_IMAGE_MAX_BYTES);
    assert.equal(transport.sent().filter((entry)=>entry.value.type==="presentation-handout").length,0,"local DM preview must not broadcast before explicit reveal");
    await handout.revealSessionImageHandout(host,asset);
    assert.equal(connectedStateFor(host).ledger?.cursor,ledgerCursorBefore,"presentation reveal must not create a ResolutionEvent/participant ledger event");
    const reveal=transport.sent().filter((entry)=>entry.value.type==="presentation-handout").at(-1);
    assert.ok(reveal);
    assert.deepEqual(Object.keys(reveal.value).sort(),["asset","revision","sessionId","type"],"handout fan-out must stay on the presentation envelope without Library metadata");
    transport.emit(1,"host",reveal.raw);
    transport.emit(2,"host",reveal.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset?.fileName,"clue.webp");
    assert.equal(handout.getSessionImageHandoutState(client2).asset?.fileName,"clue.webp");
    handout.dismissSessionImageHandout(client);
    assert.equal(handout.getSessionImageHandoutState(client).dismissed,true);

    const reconnectPeer="peer.client.reconnect";
    transport.emit(0,reconnectPeer,reconnectHello.raw);
    await flush();
    const restored=transport.sentTo().filter((entry)=>entry.peer===reconnectPeer&&entry.value.type==="presentation-handout").at(-1);
    assert.ok(restored,"compatible reconnect hello-ack must be followed by the active Host presentation");
    transport.emit(1,"host",restored.raw);
    await flush();
    const clientState=handout.getSessionImageHandoutState(client);
    assert.equal(clientState.asset?.fileName,"clue.webp");
    assert.equal(clientState.dismissed,false,"reconnect restoration should reopen the current Host reveal");

    await handout.withdrawSessionImageHandout(host);
    const withdrawn=transport.sent().filter((entry)=>entry.value.type==="presentation-handout").at(-1);
    assert.ok(withdrawn);
    transport.emit(1,"host",withdrawn.raw);
    transport.emit(2,"host",withdrawn.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset,null);
    assert.equal(handout.getSessionImageHandoutState(client2).asset,null);

    const withdrawnReconnectPeer="peer.client.reconnect-withdrawn";
    transport.emit(0,withdrawnReconnectPeer,reconnectHello.raw);
    await flush();
    const restoredWithdrawal=transport.sentTo().filter((entry)=>entry.peer===withdrawnReconnectPeer&&entry.value.type==="presentation-handout").at(-1);
    assert.ok(restoredWithdrawal,"reconnecting Clients must receive the current withdrawn handout state");
    assert.equal(restoredWithdrawal.value.asset,null,"withdrawn handout restoration must not leak the previously revealed asset");
    transport.emit(1,"host",restoredWithdrawal.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset,null);

    await handout.dismissSessionLastRoll(host,"resolution.last-roll.1");
    const dismissed=transport.sent().filter((entry)=>entry.value.type==="presentation-last-roll-dismiss").at(-1);
    assert.ok(dismissed);
    transport.emit(1,"host",dismissed.raw);
    await flush();
    assert.equal(handout.getSessionLastRollPresentationState(client).dismissedResolutionId,"resolution.last-roll.1");

    const lastRollReconnectPeer="peer.client.reconnect-last-roll";
    transport.emit(0,lastRollReconnectPeer,reconnectHello.raw);
    await flush();
    const restoredDismissal=transport.sentTo().filter((entry)=>entry.peer===lastRollReconnectPeer&&entry.value.type==="presentation-last-roll-dismiss").at(-1);
    assert.ok(restoredDismissal,"reconnecting Clients must keep the current Last Roll hidden until a new resolution arrives");

    const wire=[...transport.sent().map((entry)=>entry.raw),...transport.sentTo().map((entry)=>entry.raw)].join("\n");
    const playerProjection=JSON.stringify([await client.getSnapshot(),await client2.getSnapshot()]);
    for(const privateValue of [privateFolderId,privateFolderLabel,privateEntryId,privateEntryLabel,privateNoteText,privateTag]){
      assert.equal(wire.includes(privateValue),false,`connected wire must not expose private DM Library value: ${privateValue}`);
      assert.equal(playerProjection.includes(privateValue),false,`Player projection must not expose private DM Library value: ${privateValue}`);
    }
    for(const privateShape of ["\"dmLibrary", "\"noteText\"", "\"recentEntryIds\""]){
      assert.equal(wire.includes(privateShape),false,`connected wire must not expose private DM Library metadata shape: ${privateShape}`);
      assert.equal(playerProjection.includes(privateShape),false,`Player projection must not expose private DM Library metadata shape: ${privateShape}`);
    }
  } finally { transport.restore(); }
});
