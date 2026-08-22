import type {
  ActivityEntry,
  AppSnapshot,
  CatalogEntry,
  CharacterSheet,
  DmInventoryAdjustmentCommand,
  ItemInstanceVm,
  SessionCharacterInventoryVm,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { entryName, itemEntryById, itemMechanic } from "./characterCreationV10Data";
import { mutateActiveCharacterDurably } from "./characterLibraryRuntimeAdapter";

declare module "./mockAdapter" {
  interface MockAdapter {
    adjustDmInventory(command:DmInventoryAdjustmentCommand):Promise<AppSnapshot>;
    undoLastDmInventoryAdjustment():Promise<AppSnapshot>;
  }
}

type AdapterState = {
  activeCharacter:CharacterSheet;
  activity:ActivityEntry[];
  catalog:CatalogEntry[];
};

type InventoryContext = {
  inventories:Map<string,SessionCharacterInventoryVm>;
  requestIds:Set<string>;
  lastUndo:null|{
    requestId:string;
    activityId:string;
    actorId:string;
    before:SessionCharacterInventoryVm;
  };
};

const contexts=new WeakMap<MockAdapter,InventoryContext>();
const cp=<T,>(value:T):T=>structuredClone(value);
const oldGetSnapshot=MockAdapter.prototype.getSnapshot;

function contextFor(adapter:MockAdapter,snapshot?:AppSnapshot) {
  const existing=contexts.get(adapter);
  if (existing) return existing;
  const inventories=new Map<string,SessionCharacterInventoryVm>();
  if (snapshot) {
    for (const entity of snapshot.scene.entities.filter((entry)=>entry.kind==="character")) {
      const active=entity.id===snapshot.activeCharacter.id;
      inventories.set(entity.id,{
        characterId:entity.id,
        characterName:entity.name,
        revision:0,
        goldGp:active ? snapshot.activeCharacter.goldGp??0 : entity.name==="Mira" ? 75 : 0,
        items:active ? cp(snapshot.activeCharacter.items) : entity.name==="Mira" ? [{
          id:"item.dagger.mira",
          definitionId:"dnd.srd521.item.weapon.dagger",
          name:"단검",
          nameEn:"Dagger",
          kind:"equipment",
          quantity:1,
          equipped:true,
          wielded:true,
          wieldSlot:"main-hand",
          passiveEffects:["1d4 관통"],
          grantedActionIds:[],
          provenance:["SRD 5.2.1 · 세션 캐릭터"],
        }] : [],
      });
    }
  }
  const created={inventories,requestIds:new Set<string>(),lastUndo:null};
  contexts.set(adapter,created);
  return created;
}

function inventoryFor(context:InventoryContext,snapshot:AppSnapshot,actorId:string) {
  const existing=context.inventories.get(actorId);
  if (existing) return existing;
  const actor=snapshot.scene.entities.find((entry)=>entry.id===actorId&&entry.kind==="character");
  if (!actor) throw new Error("아이템을 변경할 플레이어 캐릭터를 선택해 주세요.");
  const created:SessionCharacterInventoryVm={characterId:actor.id,characterName:actor.name,revision:0,goldGp:0,items:[]};
  context.inventories.set(actorId,created);
  return created;
}

function catalogDefinitionId(entry:CatalogEntry) {
  return entry.contentId?.trim() || entry.id;
}

const LEGACY_ITEM_DEFINITION_ALIASES:Record<string,string>={
  "item.chain-mail":"dnd.srd521.item.armor.chain-mail",
  "item.shield":"dnd.srd521.item.shield",
  "item.potion-of-healing":"dnd.srd521.item.gear.potion-of-healing",
};

function compatibleDefinitionId(definitionId:string) {
  return LEGACY_ITEM_DEFINITION_ALIASES[definitionId]??definitionId;
}

function materializeItem(entry:CatalogEntry,actorId:string):ItemInstanceVm {
  const definitionId=catalogDefinitionId(entry);
  const canonical=itemEntryById(definitionId);
  const weapon=canonical ? itemMechanic(canonical,"weapon-definition") as {damage?:string;damageType?:string}|undefined : undefined;
  const armor=canonical ? itemMechanic(canonical,"armor-definition") as {ac?:{base?:number}}|undefined : undefined;
  const shield=canonical ? itemMechanic(canonical,"shield-definition") as {acBonus?:number}|undefined : undefined;
  const consumable=canonical ? itemMechanic(canonical,"consumable-definition") : undefined;
  const passiveEffects=[
    weapon?.damage ? `${weapon.damage} ${weapon.damageType??""}`.trim() : "",
    armor?.ac?.base!==undefined ? `기본 AC ${armor.ac.base}` : "",
    shield?.acBonus!==undefined ? `AC +${shield.acBonus}` : "",
  ].filter(Boolean);
  return {
    id:`item.session.${actorId}.${Date.now()}.${Math.floor(Math.random()*10000)}`,
    definitionId,
    name:canonical ? entryName(canonical) : entry.nameKo,
    nameEn:canonical?.presentation.originalName || entry.nameEn,
    kind:consumable ? "consumable" : /magic|마법|완드|wand|potion|물약/i.test(`${entry.nameKo} ${entry.nameEn} ${entry.capabilities.join(" ")}`) ? "magic" : "equipment",
    quantity:1,
    equipped:false,
    passiveEffects,
    grantedActionIds:[],
    provenance:[`${entry.source} · v${entry.version}`,`catalog:${entry.sourceId??entry.scope}/${definitionId}`],
  };
}

function applyCommand(inventory:SessionCharacterInventoryVm,command:DmInventoryAdjustmentCommand,catalog:CatalogEntry[]) {
  const changes:string[]=[];
  if (command.operation==="grant-item") {
    if (!Number.isInteger(command.quantity)||command.quantity<1) throw new Error("지급 수량은 1 이상이어야 합니다.");
    const entry=catalog.find((candidate)=>candidate.id===command.catalogEntryId&&candidate.category==="item");
    if (!entry) throw new Error("현재 활성 카탈로그에서 아이템을 찾지 못했습니다.");
    const template=materializeItem(entry,inventory.characterId);
    const existing=inventory.items.find((item)=>compatibleDefinitionId(item.definitionId)===compatibleDefinitionId(template.definitionId)&&!item.charges&&!item.attunementRequired);
    if (existing) {
      const before=existing.quantity;
      existing.quantity+=command.quantity;
      changes.push(`${existing.name} ${before} → ${existing.quantity}`);
    } else {
      template.quantity=command.quantity;
      inventory.items.push(template);
      changes.push(`${template.name} 0 → ${command.quantity}`);
    }
  } else if(command.operation==="grant-item-template"){
    if(!Number.isInteger(command.quantity)||command.quantity<1)throw new Error("지급 수량은 1 이상이어야 합니다.");
    const source=command.itemTemplate;
    const existing=inventory.items.find((item)=>compatibleDefinitionId(item.definitionId)===compatibleDefinitionId(source.definitionId)&&!item.charges&&!item.attunementRequired);
    if(existing){const before=existing.quantity;existing.quantity+=command.quantity;changes.push(`${existing.name} ${before} → ${existing.quantity}`);}
    else{
      inventory.items.push({id:`item.session.${inventory.characterId}.${Date.now()}.${Math.floor(Math.random()*10000)}`,...cp(source),quantity:command.quantity,equipped:false,wielded:false,attuned:false});
      changes.push(`${source.name} 0 → ${command.quantity}`);
    }
  } else if (command.operation==="revoke-item") {
    if (!Number.isInteger(command.quantity)||command.quantity<1) throw new Error("회수 수량은 1 이상이어야 합니다.");
    const item=inventory.items.find((candidate)=>candidate.id===command.itemId);
    if (!item) throw new Error("플레이어 인벤토리에서 아이템을 찾지 못했습니다.");
    if (item.quantity<command.quantity) throw new Error("보유 수량보다 많이 회수할 수 없습니다.");
    if ((item.equipped||item.wielded||item.attuned)&&!command.forceUnequip) throw new Error("장착 또는 조율된 아이템은 해제 후 회수해 주세요.");
    const before=item.quantity;
    if (command.forceUnequip) { item.equipped=false;item.wielded=false;item.attuned=false;delete item.wieldSlot; }
    item.quantity-=command.quantity;
    if (item.quantity===0) inventory.items=inventory.items.filter((candidate)=>candidate.id!==item.id);
    changes.push(`${item.name} ${before} → ${item.quantity}`);
  } else {
    if (!Number.isInteger(command.amount)||command.amount<1) throw new Error("재화 수량은 1 GP 이상이어야 합니다.");
    if (command.operation==="revoke-currency"&&inventory.goldGp<command.amount) throw new Error("보유 GP보다 많이 회수할 수 없습니다.");
    const before=inventory.goldGp;
    inventory.goldGp+=command.operation==="grant-currency" ? command.amount : -command.amount;
    changes.push(`GP ${before} → ${inventory.goldGp}`);
  }
  inventory.revision+=1;
  return changes;
}

function activityFor(inventory:SessionCharacterInventoryVm,command:DmInventoryAdjustmentCommand,changes:string[]):ActivityEntry {
  const grant=command.operation==="grant-item"||command.operation==="grant-currency";
  return {
    id:`evt.dm-inventory.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",
    actor:"DM",
    title:`${inventory.characterName} 소지품 ${grant?"지급":"회수"}`,
    summary:changes.join(" · "),
    detail:[`requestId: ${command.requestId}`,"Host 권위 · 원자적 Character inventory 변경"],
    stateChanges:cp(changes),
  };
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithSessionInventories() {
  const snapshot=await oldGetSnapshot.call(this);
  const context=contextFor(this,snapshot);
  const active=context.inventories.get(snapshot.activeCharacter.id);
  context.inventories.set(snapshot.activeCharacter.id,{
    characterId:snapshot.activeCharacter.id,
    characterName:snapshot.activeCharacter.name,
    revision:active?.revision??0,
    goldGp:snapshot.activeCharacter.goldGp??0,
    items:cp(snapshot.activeCharacter.items),
  });
  snapshot.sessionCharacterInventories=Object.fromEntries([...context.inventories].map(([id,inventory])=>[id,cp(inventory)]));
  return snapshot;
};

MockAdapter.prototype.adjustDmInventory=async function adjustDmInventory(command:DmInventoryAdjustmentCommand) {
  const snapshot=await this.getSnapshot();
  const context=contextFor(this,snapshot);
  if (context.requestIds.has(command.requestId)) return snapshot;
  const inventory=inventoryFor(context,snapshot,command.actorId);
  const before=cp(inventory);
  const draft=cp(inventory);
  const state=this as unknown as AdapterState;
  const changes=applyCommand(draft,command,state.catalog);
  const activity=activityFor(draft,command,changes);

  if (command.actorId===state.activeCharacter.id) {
    await mutateActiveCharacterDurably(this,(character)=>{
      character.items=cp(draft.items);
      character.goldGp=draft.goldGp;
      state.activity.unshift(activity);
    });
  } else {
    state.activity.unshift(activity);
  }
  context.inventories.set(command.actorId,draft);
  context.requestIds.add(command.requestId);
  context.lastUndo={requestId:command.requestId,activityId:activity.id,actorId:command.actorId,before};
  return this.getSnapshot();
};

MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastDmInventoryAdjustment() {
  const snapshot=await this.getSnapshot();
  const context=contextFor(this,snapshot);
  const undo=context.lastUndo;
  if (!undo) return snapshot;
  const state=this as unknown as AdapterState;
  const restore=cp(undo.before);
  const undoActivity:ActivityEntry={
    id:`evt.dm-inventory-undo.${Date.now()}`,
    time:"지금",
    actor:"DM",
    title:`${restore.characterName} 소지품 변경 실행 취소`,
    summary:"직전 지급·회수 상태를 복원했습니다.",
    detail:[`undoOf: ${undo.activityId}`],
    stateChanges:["아이템·GP 이전 상태 복원"],
    correction:true,
    undoOf:undo.activityId,
  };
  if (undo.actorId===state.activeCharacter.id) {
    await mutateActiveCharacterDurably(this,(character)=>{
      character.items=cp(restore.items);
      character.goldGp=restore.goldGp;
      state.activity=state.activity.map((entry)=>entry.id===undo.activityId?{...entry,reversed:true}:entry);
      state.activity.unshift(undoActivity);
    });
  } else {
    state.activity=state.activity.map((entry)=>entry.id===undo.activityId?{...entry,reversed:true}:entry);
    state.activity.unshift(undoActivity);
  }
  context.inventories.set(undo.actorId,restore);
  context.requestIds.delete(undo.requestId);
  context.lastUndo=null;
  return this.getSnapshot();
};

export {};
