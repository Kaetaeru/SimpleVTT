export type AppRole = "player" | "dm";
export type SessionMode = "freeform" | "initiative";
export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type AbilityMethod = "standard" | "rolled" | "point-buy" | "custom";
export type AppRoute =
  | "characters"
  | "character"
  | "create"
  | "levelup"
  | "scene"
  | "combatants"
  | "catalog"
  | "activity"
  | "session"
  | "settings";

export type AbilityScores = Record<AbilityKey, number>;

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

export interface CharacterSheet extends CharacterSummary {
  proficiencyBonus: number;
  speed: number;
  tempHp: number;
  abilities: AbilityScores;
  saves: string[];
  skills: string[];
  features: string[];
  equipment: string[];
  resources: Array<{ label: string; current: number; max: number }>;
  attacks: Array<{ id: string; name: string; bonus: number; damage: string }>;
}

export interface ValidationMessage {
  severity: "blocking" | "warning" | "info";
  message: string;
}

export interface CharacterCreateDraft {
  id: string;
  step: number;
  mode: "guided" | "quick" | "import" | "duplicate";
  rulesProfileId: string;
  name: string;
  className: string;
  species: string;
  background: string;
  level: number;
  abilityMethod: AbilityMethod;
  abilities: AbilityScores;
  rolledPool: number[];
  selectedSkills: string[];
  equipmentPreset: string;
  notes: string;
  derived: {
    proficiencyBonus: number;
    ac: number;
    hp: number;
    speed: number;
  };
  validation: ValidationMessage[];
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
    grantedFeatures: string[];
  };
  validation: ValidationMessage[];
}

export interface SceneEntity {
  id: string;
  name: string;
  side: "ally" | "enemy";
  kind: "character" | "combatant";
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
  status: string[];
  distance?: string;
}

export interface ActionVm {
  id: string;
  actorId: string;
  name: string;
  category: "basic" | "weapon" | "magic";
  target: "self" | "ally" | "enemy" | "any";
  economy: string;
  summary: string;
  available: boolean;
  disabledReason?: string;
}

export interface SceneVm {
  id: string;
  name: string;
  round: number;
  currentActorId: string;
  selectedActorId: string;
  entities: SceneEntity[];
  actionsByActor: Record<string, ActionVm[]>;
}

export interface ResolutionView {
  id: string;
  actorId: string;
  targetId: string;
  actionId: string;
  actionName: string;
  stage: "attack" | "damage" | "healing" | "effect" | "complete";
  compact: string;
  detail: string[];
  calculatedOutcome: string;
  finalOutcome: string;
  stateChanges: string[];
  adjudicated: boolean;
}

export interface CatalogEntry {
  id: string;
  category: "class" | "subclass" | "species" | "background" | "feat" | "spell" | "item" | "condition" | "combatant";
  nameKo: string;
  nameEn: string;
  scope: "builtin" | "local" | "session";
  source: string;
  description: string;
}

export interface ActivityEntry {
  id: string;
  time: string;
  actor: string;
  title: string;
  summary: string;
  detail: string[];
  correction?: boolean;
}

export interface AppSnapshot {
  role: AppRole;
  sessionMode: SessionMode;
  connectionState: ConnectionState;
  queuedD20: number | null;
  characters: CharacterSummary[];
  activeCharacter: CharacterSheet;
  createDraft: CharacterCreateDraft | null;
  levelUpDraft: LevelUpDraft | null;
  scene: SceneVm;
  catalog: CatalogEntry[];
  activity: ActivityEntry[];
  resolution: ResolutionView | null;
}

export interface CharacterDraftCommand {
  type:
    | "set-step"
    | "set-mode"
    | "set-name"
    | "set-class"
    | "set-species"
    | "set-background"
    | "set-ability-method"
    | "set-ability"
    | "roll-abilities"
    | "toggle-skill"
    | "set-equipment"
    | "set-notes";
  value?: string | number;
  ability?: AbilityKey;
}

export interface LevelUpCommand {
  type: "set-step" | "set-hp-method" | "set-asi-mode" | "set-asi-primary" | "set-asi-secondary" | "set-feat";
  value: string | number;
}

export interface SimpleVttAdapter {
  getSnapshot(): Promise<AppSnapshot>;
  createCharacterDraft(mode?: CharacterCreateDraft["mode"]): Promise<AppSnapshot>;
  updateCharacterDraft(command: CharacterDraftCommand): Promise<AppSnapshot>;
  finalizeCharacterDraft(): Promise<AppSnapshot>;
  startLevelUp(characterId: string): Promise<AppSnapshot>;
  updateLevelUp(command: LevelUpCommand): Promise<AppSnapshot>;
  commitLevelUp(): Promise<AppSnapshot>;
  selectDmActor(actorId: string): Promise<AppSnapshot>;
  resolveAction(actionId: string, targetId: string): Promise<AppSnapshot>;
  applyDmAdjudication(outcome: "success" | "failure"): Promise<AppSnapshot>;
  undoLastResolution(): Promise<AppSnapshot>;
  setReferenceRole(role: AppRole): Promise<AppSnapshot>;
  setSessionMode(mode: SessionMode): Promise<AppSnapshot>;
  setCurrentActor(actorId: string): Promise<AppSnapshot>;
  setQueuedD20(value: number | null): Promise<AppSnapshot>;
  setConnectionState(state: ConnectionState): Promise<AppSnapshot>;
}
