import type { CampaignDmLibraryEntry, CampaignPartyStashItemTemplate, CampaignRecordV1, CampaignSessionSnapshot, CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";

export type AppRole = "player" | "dm";
export type SessionMode = "freeform" | "initiative";
export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export type EdgeState = "normal" | "save-error" | "unsupported";
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type AbilityMethod = "standard" | "rolled" | "point-buy" | "custom";
export type AppRoute =
  | "home"
  | "campaigns"
  | "characters"
  | "character"
  | "create"
  | "levelup"
  | "scene"
  | "combatants"
  | "catalog"
  | "activity"
  | "session"
  | "content"
  | "settings";

export type AbilityScores = Record<AbilityKey, number>;

export interface ValidationMessage {
  severity: "blocking" | "warning" | "info";
  message: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  className: string;
  subclassName?: string;
  level: number;
  species: string;
  background: string;
  hp: number;
  maxHp: number;
  ac: number;
  saveState: "saved" | "draft";
}

export interface CharacterResourceVm {
  id: string;
  label: string;
  current: number;
  max: number;
  source: string;
}

export interface ItemInstanceVm {
  id: string;
  definitionId: string;
  name: string;
  nameEn?: string;
  kind: "equipment" | "consumable" | "magic";
  quantity: number;
  equipped: boolean;
  wielded?: boolean;
  wieldSlot?: "main-hand" | "off-hand" | "two-hand";
  attunementRequired?: boolean;
  attuned?: boolean;
  charges?: { current: number; max: number };
  passiveEffects: string[];
  grantedActionIds: string[];
  provenance: string[];
}

export interface SessionCharacterInventoryVm {
  characterId: string;
  characterName: string;
  revision: number;
  goldGp: number;
  items: ItemInstanceVm[];
}

export type DmInventoryAdjustmentCommand =
  | { requestId: string; actorId: string; operation: "grant-item"; catalogEntryId: string; quantity: number }
  | { requestId: string; actorId: string; operation: "grant-item-template"; itemTemplate: CampaignPartyStashItemTemplate; quantity: number }
  | { requestId: string; actorId: string; operation: "revoke-item"; itemId: string; quantity: number; forceUnequip?: boolean }
  | { requestId: string; actorId: string; operation: "grant-currency" | "revoke-currency"; amount: number };

export type PartyStashTransferCommand =
  | {requestId:string;campaignId:string;actorId:string;direction:"character-to-stash";asset:"item";itemId:string;definitionId:string;quantity:number;itemTemplate?:CampaignPartyStashItemTemplate;forceUnequip?:boolean}
  | {requestId:string;campaignId:string;actorId:string;direction:"stash-to-character";asset:"item";definitionId:string;catalogEntryId?:string;itemTemplate?:CampaignPartyStashItemTemplate;quantity:number}
  | {requestId:string;campaignId:string;actorId:string;direction:"character-to-stash";asset:"currency";amount:number}
  | {requestId:string;campaignId:string;actorId:string;direction:"stash-to-character";asset:"currency";amount:number};

export interface CharacterSheet extends CharacterSummary {
  proficiencyBonus: number;
  speed: number;
  tempHp: number;
  abilities: AbilityScores;
  saves: string[];
  skills: string[];
  features: string[];
  equipment: string[];
  items: ItemInstanceVm[];
  resources: CharacterResourceVm[];
  attacks: Array<{ id: string; name: string; bonus: number; damage: string }>;
}

export interface AbilityRollSlot {
  id: string;
  total: number;
  dice: number[];
  dropped: number;
}

export type CharacterCreationSectionKind =
  | "rules-profile"
  | "identity"
  | "species"
  | "background"
  | "class"
  | "abilities"
  | "proficiencies"
  | "class-choices"
  | "equipment"
  | "spells"
  | "dynamic-choice"
  | "review";

export type CharacterCreationSectionStatus = "complete" | "incomplete" | "blocked" | "warning" | "not-applicable";

export interface CharacterCreationOptionVm {
  id: string;
  name: string;
  nameEn: string;
  summary: string;
  source: string;
  selected: boolean;
  recommended: boolean;
  grants: string[];
  choices: string[];
}

export interface CharacterCreationSection {
  id: string;
  kind: CharacterCreationSectionKind;
  label: string;
  description: string;
  status: CharacterCreationSectionStatus;
  required: boolean;
  dependsOn: string[];
  options: CharacterCreationOptionVm[];
  automaticGrants: string[];
  validation: ValidationMessage[];
}

export interface CharacterCreationSummary {
  name: string;
  species: string;
  background: string;
  className: string;
  subclassName?: string;
  level: number;
  abilities: AbilityScores;
  unresolvedCount: number;
  blockingCount: number;
  warningCount: number;
}

export interface CharacterCreationPlan {
  draftId: string;
  rulesProfileId: string;
  activeSectionId: string;
  recommendedSectionId: string;
  sections: CharacterCreationSection[];
  summary: CharacterCreationSummary;
  validation: ValidationMessage[];
}

export interface CharacterCreateDraft {
  id: string;
  editingCharacterId?: string;
  step: number;
  activeSectionId?: string;
  mode: "guided" | "quick" | "import" | "duplicate";
  rulesProfileId: string;
  name: string;
  className: string;
  subclassName: string;
  species: string;
  background: string;
  level: number;
  abilityMethod: AbilityMethod;
  abilities: AbilityScores;
  rolledPool: AbilityRollSlot[];
  rolledAssignments: Partial<Record<AbilityKey, string>>;
  selectedSkills: string[];
  selectedSpells: string[];
  selectedClassChoices?: string[];
  equipmentPreset: string;
  notes: string;
  overrides: { hp?: number; ac?: number; speed?: number };
  importStatus?: "idle" | "valid" | "invalid";
  importMessage?: string;
  derived: {
    proficiencyBonus: number;
    ac: number;
    hp: number;
    speed: number;
  };
  validation: ValidationMessage[];
}

export interface LevelUpDiffVm {
  label: string;
  before: string;
  after: string;
  source: string;
}

export interface LevelUpDraft {
  characterId: string;
  fromLevel: number;
  toLevel: number;
  step: number;
  hpMethod: "fixed" | "roll";
  hpGain: number;
  asiMode: "plus-two" | "split" | "feat";
  asiPrimary: AbilityKey;
  asiSecondary: AbilityKey;
  featId?: string;
  preview: {
    maxHpBefore: number;
    maxHpAfter: number;
    abilityBefore: AbilityScores;
    abilityAfter: AbilityScores;
    proficiencyBefore: number;
    proficiencyAfter: number;
    hitDiceBefore: string;
    hitDiceAfter: string;
    grantedFeatures: string[];
    resourceChanges: string[];
    actionChanges: string[];
    spellChanges: string[];
    diffs: LevelUpDiffVm[];
  };
  validation: ValidationMessage[];
}

export interface ReactionOptionVm {
  id: string;
  name: string;
  trigger: string;
  cost: string;
  effect: string;
  source: string;
  acBonus?: number;
}

export interface SceneEntity {
  id: string;
  name: string;
  side: "ally" | "enemy";
  kind: "character" | "combatant";
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  initiative: number;
  status: string[];
  distance?: string;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  reactions: ReactionOptionVm[];
}

export interface ActionDetailVm {
  label: string;
  value: string;
  source?: string;
}

export interface DamageSpecVm {
  type: string;
  dice: string;
  flat: number;
  average: number;
}

export interface ActionVm {
  id: string;
  actorId: string;
  name: string;
  category: "basic" | "weapon" | "magic";
  target: "self" | "ally" | "enemy" | "any" | "none" | "multi-enemy";
  economy: "행동" | "추가 행동" | "반응" | "없음";
  resolutionKind: "attack" | "ability-check" | "saving-throw" | "healing" | "no-roll" | "no-roll-damage";
  summary: string;
  available: boolean;
  disabledReason?: string;
  eligibleTargetIds: string[];
  eligibleTargetReasons?: Record<string,string>;
  maxTargets?: number;
  attackBonus?: number;
  checkBonus?: number;
  saveDc?: number;
  saveAbility?: string;
  damage?: DamageSpecVm[];
  healing?: { dice: string; flat: number; average: number };
  resourceCost?: { resourceId: string; amount: number };
  itemCost?: { itemId: string; quantity?: number; charges?: number };
  saveHalf?: boolean;
  details: ActionDetailVm[];
}

export interface EconomyVm {
  action: boolean;
  bonusAction: boolean;
  reaction: boolean;
  movement: number;
  movementMax: number;
}

export interface SceneVm {
  id: string;
  name: string;
  round: number;
  currentActorId: string;
  selectedActorId: string;
  entities: SceneEntity[];
  actionsByActor: Record<string, ActionVm[]>;
  economyByActor: Record<string, EconomyVm>;
}

export interface DamageComponentView {
  type: string;
  roll: string;
  raw: number;
  adjusted: number;
  adjustment?: string;
  source?: string;
}

export interface SaveResultVm {
  targetId: string;
  targetName: string;
  d20: number;
  total: number;
  dc: number;
  outcome: "성공" | "실패";
  finalDamage?: number;
}

export interface InterruptView {
  id: string;
  responderId: string;
  responderName: string;
  trigger: string;
  optionName: string;
  cost: string;
  effect: string;
  source: string;
}

export type ResolutionStage =
  | "roll-animation"
  | "attack-result"
  | "interrupt"
  | "save-animation"
  | "save-result"
  | "damage-animation"
  | "effect-preview"
  | "complete";

export interface ResolutionView {
  id: string;
  actorId: string;
  targetIds: string[];
  actionId: string;
  actionName: string;
  rollKind: "attack" | "check" | "save" | "damage" | "healing" | "effect";
  stage: ResolutionStage;
  authoritativeDice: number[];
  rollTotal?: number;
  attackTotal?: number;
  targetAc?: number;
  attackOutcome?: "명중" | "빗나감";
  critical?: boolean;
  saveResults: SaveResultVm[];
  damageComponents: DamageComponentView[];
  compact: string;
  detail: string[];
  provenance: string[];
  calculatedOutcome: string;
  finalOutcome: string;
  stateChanges: string[];
  adjudicated: boolean;
  interrupt?: InterruptView;
  canAdvance: boolean;
  nextLabel?: string;
}

export type AdjudicationScope = "resolution" | "target" | "turn" | "scene" | "until-cleared";

export interface DmAdjudicationCommand {
  type:
    | "modifier"
    | "advantage"
    | "disadvantage"
    | "force-success"
    | "force-failure"
    | "ac-dc-adjustment"
    | "damage-correction"
    | "healing-correction"
    | "condition-add"
    | "condition-remove"
    | "resource-correction"
    | "target-correction";
  value?: number | string;
  targetId?: string;
  scope: AdjudicationScope;
  reason?: string;
}

export interface CatalogRelationshipVm {
  label: string;
  targetId: string;
  targetName: string;
}

export interface CatalogEntry {
  id: string;
  category: "class" | "subclass" | "species" | "background" | "feat" | "spell" | "item" | "condition" | "combatant" | "option";
  nameKo: string;
  nameEn: string;
  scope: "builtin" | "local" | "session";
  source: string;
  version: string;
  description: string;
  relationships: CatalogRelationshipVm[];
  capabilities: string[];
}

export interface ContentImportPreview {
  payload: string;
  validation: ValidationMessage[];
  entry?: CatalogEntry;
  unsupportedCapabilities: string[];
}

export interface CombatantDefinitionVm {
  id: string;
  name: string;
  nameEn?: string;
  ac: number;
  maxHp: number;
  source: string;
  version: string;
  actions: string[];
  statusImmunities: string[];
}

export interface CombatantImportPreview {
  payload: string;
  validation: ValidationMessage[];
  definition?: CombatantDefinitionVm;
}

export interface ActivityEntry {
  id: string;
  time: string;
  actor: string;
  title: string;
  summary: string;
  detail: string[];
  stateChanges: string[];
  correction?: boolean;
  ruling?: string;
  undoOf?: string;
  reversed?: boolean;
}

export interface SessionParticipantVm {
  id: string;
  name: string;
  characterName?: string;
  state: "connected" | "reconnecting" | "disconnected";
}

export interface SessionVm {
  name: string;
  address: string;
  role: "offline" | "host" | "client";
  compatibility: "compatible" | "warning" | "incompatible";
  compatibilityMessage: string;
  participants: SessionParticipantVm[];
  sessionContent: string[];
}

export interface AppSnapshot {
  role: AppRole;
  sessionMode: SessionMode;
  connectionState: ConnectionState;
  edgeState: EdgeState;
  queuedD20: number | null;
  characters: CharacterSummary[];
  activeCharacter: CharacterSheet;
  createDraft: CharacterCreateDraft | null;
  creationPlan?: CharacterCreationPlan | null;
  levelUpDraft: LevelUpDraft | null;
  scene: SceneVm;
  catalog: CatalogEntry[];
  contentImport: ContentImportPreview | null;
  combatantDefinitions: CombatantDefinitionVm[];
  combatantImport: CombatantImportPreview | null;
  activity: ActivityEntry[];
  resolution: ResolutionView | null;
  session: SessionVm;
  sessionCharacterInventories?: Record<string, SessionCharacterInventoryVm>;
  campaigns?: CampaignRecordV1[];
  activeCampaignId?: string | null;
  campaignSessionSnapshot?: CampaignSessionSnapshot | null;
  campaignSessionSystems?: CampaignSessionSystemsProjection | null;
}

export interface CharacterDraftCommand {
  type:
    | "set-step"
    | "set-section"
    | "set-mode"
    | "set-name"
    | "set-class"
    | "set-subclass"
    | "set-species"
    | "set-background"
    | "set-ability-method"
    | "set-ability"
    | "assign-roll"
    | "apply-recommended-array"
    | "roll-abilities"
    | "toggle-skill"
    | "toggle-class-choice"
    | "toggle-spell"
    | "set-equipment"
    | "set-notes"
    | "set-override"
    | "clear-overrides"
    | "import-json";
  value?: string | number;
  ability?: AbilityKey;
  field?: "hp" | "ac" | "speed";
}

export interface LevelUpCommand {
  type: "set-step" | "set-hp-method" | "set-asi-mode" | "set-asi-primary" | "set-asi-secondary" | "set-feat";
  value: string | number;
}

export interface SimpleVttAdapter {
  getSnapshot(): Promise<AppSnapshot>;
  createCharacterDraft(mode?: CharacterCreateDraft["mode"]): Promise<AppSnapshot>;
  editCharacterDraft(characterId: string): Promise<AppSnapshot>;
  updateCharacterDraft(command: CharacterDraftCommand): Promise<AppSnapshot>;
  finalizeCharacterDraft(): Promise<AppSnapshot>;
  toggleItemEquipped(itemId: string): Promise<AppSnapshot>;
  toggleItemAttunement(itemId: string): Promise<AppSnapshot>;
  useItem(itemId: string): Promise<AppSnapshot>;
  startLevelUp(characterId: string): Promise<AppSnapshot>;
  updateLevelUp(command: LevelUpCommand): Promise<AppSnapshot>;
  commitLevelUp(): Promise<AppSnapshot>;
  selectDmActor(actorId: string): Promise<AppSnapshot>;
  startInitiative(): Promise<AppSnapshot>;
  endInitiative(): Promise<AppSnapshot>;
  endTurn(): Promise<AppSnapshot>;
  resolveAction(actionId: string, targetIds: string[]): Promise<AppSnapshot>;
  advanceResolution(): Promise<AppSnapshot>;
  respondToInterrupt(accept: boolean): Promise<AppSnapshot>;
  dismissResolution(): Promise<AppSnapshot>;
  applyDmAdjudication(command: DmAdjudicationCommand): Promise<AppSnapshot>;
  undoLastResolution(): Promise<AppSnapshot>;
  previewContentImport(payload: string): Promise<AppSnapshot>;
  activateContentImport(): Promise<AppSnapshot>;
  clearContentImport(): Promise<AppSnapshot>;
  previewCombatantImport(payload: string): Promise<AppSnapshot>;
  activateCombatantImport(): Promise<AppSnapshot>;
  clearCombatantImport(): Promise<AppSnapshot>;
  instantiateCombatant(definitionId: string): Promise<AppSnapshot>;
  adjustDmInventory(command: DmInventoryAdjustmentCommand): Promise<AppSnapshot>;
  undoLastDmInventoryAdjustment(): Promise<AppSnapshot>;
  transferPartyStash(command:PartyStashTransferCommand):Promise<AppSnapshot>;
  upsertCampaignDmLibraryEntry(campaignId:string,entry:CampaignDmLibraryEntry):Promise<AppSnapshot>;
  removeCampaignDmLibraryEntry(campaignId:string,entryId:string):Promise<AppSnapshot>;
  grantCampaignDmLibraryItem(campaignId:string,entryId:string,target:{kind:"character";actorId:string}|{kind:"stash"},quantity:number):Promise<AppSnapshot>;
  hostSession(): Promise<AppSnapshot>;
  joinSession(address: string): Promise<AppSnapshot>;
  setReferenceRole(role: AppRole): Promise<AppSnapshot>;
  setSessionMode(mode: SessionMode): Promise<AppSnapshot>;
  setCurrentActor(actorId: string): Promise<AppSnapshot>;
  setQueuedD20(value: number | null): Promise<AppSnapshot>;
  setConnectionState(state: ConnectionState): Promise<AppSnapshot>;
  setEdgeState(state: EdgeState): Promise<AppSnapshot>;
  loadReferenceScenario(id: "attack" | "critical" | "reaction" | "multi-save" | "typed-damage"): Promise<AppSnapshot>;
}
