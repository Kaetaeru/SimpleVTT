import type {
  AbilityKey,
  AbilityScores,
  ActionVm,
  AppSnapshot,
  AppRole,
  CatalogEntry,
  CharacterCreateDraft,
  CharacterDraftCommand,
  CharacterSheet,
  CharacterSummary,
  ConnectionState,
  LevelUpCommand,
  LevelUpDraft,
  ResolutionView,
  SceneEntity,
  SceneVm,
  SessionMode,
  SimpleVttAdapter,
  ValidationMessage,
} from "./contracts";

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const aelar: CharacterSheet = {
  id: "char.aelar",
  name: "Aelar",
  className: "전사",
  subclassName: "챔피언",
  level: 5,
  species: "인간",
  background: "병사",
  hp: 31,
  maxHp: 42,
  tempHp: 5,
  ac: 18,
  speed: 30,
  proficiencyBonus: 3,
  saveState: "saved",
  abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 },
  saves: ["근력 +7", "건강 +6"],
  skills: ["운동 +7", "지각 +4", "위협 +2"],
  features: ["전투 방식: 방어", "세컨드 윈드", "액션 서지", "추가 공격", "경계"],
  equipment: ["체인 메일", "방패", "롱소드", "숏보우", "치유 물약 ×2"],
  resources: [
    { label: "세컨드 윈드", current: 1, max: 1 },
    { label: "액션 서지", current: 1, max: 1 },
  ],
  attacks: [
    { id: "action.longsword", name: "롱소드", bonus: 7, damage: "1d8 + 4 참격" },
    { id: "action.shortbow", name: "숏보우", bonus: 5, damage: "1d6 + 2 관통" },
  ],
};

const mira: CharacterSummary = {
  id: "char.mira",
  name: "Mira",
  className: "음유시인",
  level: 4,
  species: "엘프",
  background: "연예인",
  hp: 24,
  maxHp: 31,
  ac: 15,
  saveState: "saved",
};

const entities: SceneEntity[] = [
  { id: "char.mira", name: "Mira", side: "ally", kind: "character", hp: 24, maxHp: 31, ac: 15, initiative: 19, status: [] },
  { id: "char.aelar", name: "Aelar", side: "ally", kind: "character", hp: 31, maxHp: 42, ac: 18, initiative: 17, status: [] },
  { id: "combatant.goblin-a", name: "고블린 A", side: "enemy", kind: "combatant", hp: 12, maxHp: 21, ac: 15, initiative: 14, status: ["중독됨"], distance: "22피트" },
  { id: "combatant.goblin-b", name: "고블린 B", side: "enemy", kind: "combatant", hp: 21, maxHp: 21, ac: 14, initiative: 11, status: [], distance: "35피트" },
  { id: "combatant.wolf", name: "늑대", side: "enemy", kind: "combatant", hp: 8, maxHp: 11, ac: 13, initiative: 9, status: ["넘어짐"], distance: "18피트" },
];

const actionsByActor: Record<string, ActionVm[]> = {
  "char.aelar": [
    { id: "action.longsword", actorId: "char.aelar", name: "롱소드", category: "weapon", target: "enemy", economy: "행동", summary: "+7 · 1d8+4 참격", available: true },
    { id: "action.shortbow", actorId: "char.aelar", name: "숏보우", category: "weapon", target: "enemy", economy: "행동", summary: "+5 · 1d6+2 관통", available: true },
    { id: "action.second-wind", actorId: "char.aelar", name: "세컨드 윈드", category: "basic", target: "self", economy: "추가 행동", summary: "1d10+5 회복", available: true },
    { id: "action.dash", actorId: "char.aelar", name: "질주", category: "basic", target: "self", economy: "행동", summary: "이동 가능량 증가", available: true },
  ],
  "char.mira": [
    { id: "action.healing-word", actorId: "char.mira", name: "치유의 단어", category: "magic", target: "ally", economy: "추가 행동", summary: "1d4+4 회복", available: true },
    { id: "action.vicious-mockery", actorId: "char.mira", name: "신랄한 조롱", category: "magic", target: "enemy", economy: "행동", summary: "지혜 내성 · 정신 피해", available: true },
  ],
  "combatant.goblin-a": [
    { id: "action.scimitar", actorId: "combatant.goblin-a", name: "시미터", category: "weapon", target: "enemy", economy: "행동", summary: "+4 · 1d6+2 참격", available: true },
    { id: "action.goblin-bow", actorId: "combatant.goblin-a", name: "숏보우", category: "weapon", target: "enemy", economy: "행동", summary: "+4 · 1d6+2 관통", available: true },
  ],
  "combatant.goblin-b": [
    { id: "action.scimitar-b", actorId: "combatant.goblin-b", name: "시미터", category: "weapon", target: "enemy", economy: "행동", summary: "+4 · 1d6+2 참격", available: true },
  ],
  "combatant.wolf": [
    { id: "action.bite", actorId: "combatant.wolf", name: "물기", category: "basic", target: "enemy", economy: "행동", summary: "+4 · 2d4+2 관통", available: true },
  ],
};

const catalog: CatalogEntry[] = [
  { id: "class.fighter", category: "class", nameKo: "전사", nameEn: "Fighter", scope: "builtin", source: "SRD 5.2.1", description: "무기와 방어구에 숙련된 전투 클래스입니다." },
  { id: "subclass.champion", category: "subclass", nameKo: "챔피언", nameEn: "Champion", scope: "builtin", source: "SRD 5.2.1", description: "전사의 전투 능력을 직접적으로 강화하는 서브클래스입니다." },
  { id: "species.human", category: "species", nameKo: "인간", nameEn: "Human", scope: "builtin", source: "SRD 5.2.1", description: "다재다능한 플레이어 캐릭터 종족입니다." },
  { id: "background.soldier", category: "background", nameKo: "병사", nameEn: "Soldier", scope: "builtin", source: "SRD 5.2.1", description: "군사 경험을 가진 캐릭터의 배경입니다." },
  { id: "feat.alert", category: "feat", nameKo: "경계", nameEn: "Alert", scope: "builtin", source: "SRD 5.2.1", description: "우선권과 관련된 능력을 제공합니다." },
  { id: "spell.healing-word", category: "spell", nameKo: "치유의 단어", nameEn: "Healing Word", scope: "builtin", source: "SRD 5.2.1", description: "원거리에서 아군을 회복시키는 주문입니다." },
  { id: "item.longsword", category: "item", nameKo: "롱소드", nameEn: "Longsword", scope: "builtin", source: "SRD 5.2.1", description: "군용 근접 무기입니다." },
  { id: "condition.poisoned", category: "condition", nameKo: "중독됨", nameEn: "Poisoned", scope: "builtin", source: "SRD 5.2.1", description: "독의 영향을 받는 상태입니다." },
  { id: "combatant.goblin", category: "combatant", nameKo: "고블린", nameEn: "Goblin", scope: "local", source: "로컬 JSON", description: "가져온 전투원 정의입니다." },
  { id: "subclass.homebrew-warden", category: "subclass", nameKo: "철벽 수호자", nameEn: "Iron Warden", scope: "local", source: "Homebrew 0.1", description: "기본 전사 클래스를 확장하는 로컬 홈브루 서브클래스 예시입니다." },
];

function createInitialDraft(mode: CharacterCreateDraft["mode"] = "guided"): CharacterCreateDraft {
  return withCreateDerived({
    id: "draft.character.new",
    step: 0,
    mode,
    rulesProfileId: "dnd.srd-5.2.1",
    name: "",
    className: "전사",
    species: "인간",
    background: "병사",
    level: 1,
    abilityMethod: "standard",
    abilities: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    rolledPool: [16, 15, 14, 13, 12, 10],
    selectedSkills: ["운동", "지각"],
    equipmentPreset: "chain-shield",
    notes: "",
    derived: { proficiencyBonus: 2, ac: 18, hp: 11, speed: 30 },
    validation: [],
  });
}

function createValidation(draft: CharacterCreateDraft): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  if (!draft.name.trim()) messages.push({ severity: "blocking", message: "캐릭터 이름을 입력해야 합니다." });
  const scores = ABILITY_KEYS.map((key) => draft.abilities[key]);
  if (draft.abilityMethod === "standard") {
    const actual = [...scores].sort((a, b) => b - a);
    if (actual.some((score, index) => score !== STANDARD_ARRAY[index])) {
      messages.push({ severity: "blocking", message: "표준 배열의 여섯 값을 한 번씩 배치해야 합니다." });
    }
  }
  if (draft.abilityMethod === "point-buy") {
    if (scores.some((score) => score < 8 || score > 15 || POINT_COST[score] === undefined)) {
      messages.push({ severity: "blocking", message: "포인트 구매 점수는 8~15 범위여야 합니다." });
    } else {
      const used = scores.reduce((sum, score) => sum + POINT_COST[score], 0);
      if (used > 27) messages.push({ severity: "blocking", message: `포인트 구매 한도 27점을 ${used - 27}점 초과했습니다.` });
      else messages.push({ severity: "info", message: `포인트 구매 ${used}/27점 사용 중입니다.` });
    }
  }
  if (draft.abilityMethod === "custom") {
    messages.push({ severity: "warning", message: "커스텀 능력치는 공식 기본 생성 방식이 아니며 명시적으로 저장됩니다." });
  }
  if (draft.abilityMethod === "rolled") {
    messages.push({ severity: "info", message: "4d6에서 가장 낮은 주사위를 제외하는 방식의 Mock 결과를 사용 중입니다." });
  }
  if (draft.selectedSkills.length < 2) messages.push({ severity: "warning", message: "기술 숙련 선택이 아직 완료되지 않았습니다." });
  return messages;
}

function withCreateDerived(draft: CharacterCreateDraft): CharacterCreateDraft {
  const ac = draft.equipmentPreset === "chain-shield" ? 18 : 14 + Math.max(0, Math.min(2, Math.floor((draft.abilities.dex - 10) / 2)));
  const conMod = Math.floor((draft.abilities.con - 10) / 2);
  const next = {
    ...draft,
    derived: {
      proficiencyBonus: 2,
      ac,
      hp: 10 + conMod,
      speed: 30,
    },
  };
  next.validation = createValidation(next);
  return next;
}

function buildLevelUpDraft(character: CharacterSheet): LevelUpDraft {
  const before = { ...character.abilities };
  const after = { ...before, str: Math.min(20, before.str + 2) };
  return {
    characterId: character.id,
    fromLevel: character.level,
    toLevel: character.level + 1,
    step: 0,
    hpMethod: "fixed",
    hpGain: 9,
    asiMode: "plus-two",
    asiPrimary: "str",
    asiSecondary: "con",
    preview: {
      maxHpBefore: character.maxHp,
      maxHpAfter: character.maxHp + 9,
      abilityBefore: before,
      abilityAfter: after,
      grantedFeatures: ["Ability Score Improvement"],
    },
    validation: [],
  };
}

function updateLevelPreview(draft: LevelUpDraft, character: CharacterSheet): LevelUpDraft {
  const after: AbilityScores = { ...character.abilities };
  const validation: ValidationMessage[] = [];
  if (draft.asiMode === "plus-two") {
    after[draft.asiPrimary] = Math.min(20, after[draft.asiPrimary] + 2);
  } else if (draft.asiMode === "split") {
    if (draft.asiPrimary === draft.asiSecondary) {
      validation.push({ severity: "blocking", message: "+1 / +1은 서로 다른 두 능력치를 선택해야 합니다." });
    } else {
      after[draft.asiPrimary] = Math.min(20, after[draft.asiPrimary] + 1);
      after[draft.asiSecondary] = Math.min(20, after[draft.asiSecondary] + 1);
    }
  }
  const hpGain = draft.hpMethod === "fixed" ? 9 : 11;
  return {
    ...draft,
    hpGain,
    preview: {
      maxHpBefore: character.maxHp,
      maxHpAfter: character.maxHp + hpGain,
      abilityBefore: { ...character.abilities },
      abilityAfter: after,
      grantedFeatures: draft.asiMode === "feat" ? ["선택한 적격 일반 재주"] : ["Ability Score Improvement"],
    },
    validation,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MockAdapter implements SimpleVttAdapter {
  private role: AppRole = "player";
  private sessionMode: SessionMode = "initiative";
  private connectionState: ConnectionState = "connected";
  private queuedD20: number | null = null;
  private characters: CharacterSummary[] = [aelar, mira];
  private activeCharacter: CharacterSheet = clone(aelar);
  private createDraft: CharacterCreateDraft | null = null;
  private levelUpDraft: LevelUpDraft | null = null;
  private scene: SceneVm = {
    id: "scene.ruined-gate",
    name: "폐허가 된 성문",
    round: 3,
    currentActorId: "char.aelar",
    selectedActorId: "char.aelar",
    entities: clone(entities),
    actionsByActor: clone(actionsByActor),
  };
  private catalog = clone(catalog);
  private activity = [
    { id: "evt.201", time: "17:31", actor: "Aelar", title: "롱소드 → 고블린 A", summary: "18 vs AC 15 — 명중 · 12 참격 피해", detail: ["d20 11 + 공격 보너스 7 = 18", "고블린 A HP 24 → 12"] },
    { id: "evt.200", time: "17:30", actor: "Mira", title: "치유의 단어 → Aelar", summary: "8 HP 회복", detail: ["Aelar HP 23 → 31"] },
  ];
  private resolution: ResolutionView | null = null;

  async getSnapshot(): Promise<AppSnapshot> {
    return clone({
      role: this.role,
      sessionMode: this.sessionMode,
      connectionState: this.connectionState,
      queuedD20: this.queuedD20,
      characters: this.characters,
      activeCharacter: this.activeCharacter,
      createDraft: this.createDraft,
      levelUpDraft: this.levelUpDraft,
      scene: this.scene,
      catalog: this.catalog,
      activity: this.activity,
      resolution: this.resolution,
    });
  }

  async createCharacterDraft(mode: CharacterCreateDraft["mode"] = "guided") {
    this.createDraft = createInitialDraft(mode);
    return this.getSnapshot();
  }

  async updateCharacterDraft(command: CharacterDraftCommand) {
    if (!this.createDraft) this.createDraft = createInitialDraft();
    const draft = clone(this.createDraft);
    switch (command.type) {
      case "set-step": draft.step = Number(command.value ?? 0); break;
      case "set-mode": draft.mode = String(command.value) as CharacterCreateDraft["mode"]; break;
      case "set-name": draft.name = String(command.value ?? ""); break;
      case "set-class": draft.className = String(command.value ?? "전사"); break;
      case "set-species": draft.species = String(command.value ?? "인간"); break;
      case "set-background": draft.background = String(command.value ?? "병사"); break;
      case "set-ability-method": {
        draft.abilityMethod = String(command.value) as CharacterCreateDraft["abilityMethod"];
        if (draft.abilityMethod === "standard") draft.abilities = { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 };
        if (draft.abilityMethod === "point-buy") draft.abilities = { str: 13, dex: 12, con: 13, int: 10, wis: 12, cha: 10 };
        if (draft.abilityMethod === "rolled") draft.abilities = { str: 16, dex: 15, con: 14, int: 12, wis: 13, cha: 10 };
        break;
      }
      case "set-ability": if (command.ability) draft.abilities[command.ability] = Number(command.value); break;
      case "roll-abilities": {
        draft.rolledPool = [17, 15, 14, 13, 11, 9];
        draft.abilities = { str: 17, dex: 15, con: 14, int: 11, wis: 13, cha: 9 };
        break;
      }
      case "toggle-skill": {
        const skill = String(command.value ?? "");
        draft.selectedSkills = draft.selectedSkills.includes(skill) ? draft.selectedSkills.filter((item) => item !== skill) : [...draft.selectedSkills, skill];
        break;
      }
      case "set-equipment": draft.equipmentPreset = String(command.value ?? "chain-shield"); break;
      case "set-notes": draft.notes = String(command.value ?? ""); break;
    }
    this.createDraft = withCreateDerived(draft);
    return this.getSnapshot();
  }

  async finalizeCharacterDraft() {
    if (!this.createDraft) return this.getSnapshot();
    const blocking = this.createDraft.validation.some((message) => message.severity === "blocking");
    if (blocking) return this.getSnapshot();
    const id = `char.${this.createDraft.name.toLowerCase().replace(/\s+/g, "-") || "new"}`;
    const sheet: CharacterSheet = {
      id,
      name: this.createDraft.name,
      className: this.createDraft.className,
      level: this.createDraft.level,
      species: this.createDraft.species,
      background: this.createDraft.background,
      hp: this.createDraft.derived.hp,
      maxHp: this.createDraft.derived.hp,
      tempHp: 0,
      ac: this.createDraft.derived.ac,
      speed: this.createDraft.derived.speed,
      proficiencyBonus: this.createDraft.derived.proficiencyBonus,
      saveState: "saved",
      abilities: clone(this.createDraft.abilities),
      saves: ["근력", "건강"],
      skills: clone(this.createDraft.selectedSkills),
      features: ["세컨드 윈드"],
      equipment: this.createDraft.equipmentPreset === "chain-shield" ? ["체인 메일", "방패", "롱소드"] : ["가죽 갑옷", "롱소드"],
      resources: [{ label: "세컨드 윈드", current: 1, max: 1 }],
      attacks: [{ id: "action.longsword", name: "롱소드", bonus: 5, damage: "1d8 + 3 참격" }],
    };
    this.activeCharacter = sheet;
    this.characters = [...this.characters, sheet];
    this.createDraft = null;
    return this.getSnapshot();
  }

  async startLevelUp(characterId: string) {
    if (characterId === this.activeCharacter.id) this.levelUpDraft = buildLevelUpDraft(this.activeCharacter);
    return this.getSnapshot();
  }

  async updateLevelUp(command: LevelUpCommand) {
    if (!this.levelUpDraft) this.levelUpDraft = buildLevelUpDraft(this.activeCharacter);
    const draft = clone(this.levelUpDraft);
    switch (command.type) {
      case "set-step": draft.step = Number(command.value); break;
      case "set-hp-method": draft.hpMethod = String(command.value) as LevelUpDraft["hpMethod"]; break;
      case "set-asi-mode": draft.asiMode = String(command.value) as LevelUpDraft["asiMode"]; break;
      case "set-asi-primary": draft.asiPrimary = String(command.value) as AbilityKey; break;
      case "set-asi-secondary": draft.asiSecondary = String(command.value) as AbilityKey; break;
      case "set-feat": draft.featId = String(command.value); break;
    }
    this.levelUpDraft = updateLevelPreview(draft, this.activeCharacter);
    return this.getSnapshot();
  }

  async commitLevelUp() {
    if (!this.levelUpDraft || this.levelUpDraft.validation.some((item) => item.severity === "blocking")) return this.getSnapshot();
    this.activeCharacter.level = this.levelUpDraft.toLevel;
    this.activeCharacter.maxHp = this.levelUpDraft.preview.maxHpAfter;
    this.activeCharacter.hp = Math.min(this.activeCharacter.maxHp, this.activeCharacter.hp + this.levelUpDraft.hpGain);
    this.activeCharacter.abilities = clone(this.levelUpDraft.preview.abilityAfter);
    this.activeCharacter.features = [...this.activeCharacter.features, ...this.levelUpDraft.preview.grantedFeatures];
    this.characters = this.characters.map((character) => character.id === this.activeCharacter.id ? { ...this.activeCharacter } : character);
    this.activity.unshift({ id: `evt.${Date.now()}`, time: "지금", actor: this.activeCharacter.name, title: `레벨 업 ${this.levelUpDraft.fromLevel} → ${this.levelUpDraft.toLevel}`, summary: `최대 HP ${this.levelUpDraft.preview.maxHpBefore} → ${this.levelUpDraft.preview.maxHpAfter}`, detail: ["ProgressionDraft 검토 후 Character Revision 커밋"] });
    this.levelUpDraft = null;
    return this.getSnapshot();
  }

  async selectDmActor(actorId: string) {
    this.scene.selectedActorId = actorId;
    return this.getSnapshot();
  }

  async resolveAction(actionId: string, targetId: string) {
    const allActions = Object.values(this.scene.actionsByActor).flat();
    const action = allActions.find((item) => item.id === actionId);
    const target = this.scene.entities.find((item) => item.id === targetId);
    if (!action || !target) return this.getSnapshot();
    const actor = this.scene.entities.find((item) => item.id === action.actorId);
    const d20 = this.queuedD20 ?? (action.id.includes("longsword") ? 11 : action.id.includes("scimitar") ? 13 : 12);
    this.queuedD20 = null;
    let compact = `${action.name} → ${target.name}`;
    let calculatedOutcome = "적용";
    const detail: string[] = [];
    const stateChanges: string[] = [];
    if (action.id === "action.second-wind" || action.id === "action.healing-word") {
      const healing = action.id === "action.second-wind" ? 10 : 8;
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + healing);
      compact = `${healing} HP 회복`;
      calculatedOutcome = "회복";
      detail.push(`회복량 ${healing}`);
      stateChanges.push(`${target.name} HP ${before} → ${target.hp}`);
    } else {
      const bonus = action.actorId.startsWith("combatant") ? 4 : action.id === "action.shortbow" ? 5 : 7;
      const total = d20 + bonus;
      const hit = total >= target.ac;
      calculatedOutcome = hit ? "명중" : "빗나감";
      compact = `${total} vs AC ${target.ac} — ${calculatedOutcome}`;
      detail.push(`d20 ${d20} + 공격 보너스 ${bonus} = ${total}`);
      if (hit) {
        const damage = action.id.includes("longsword") ? 12 : action.id.includes("bite") ? 8 : 7;
        const before = target.hp;
        target.hp = Math.max(0, target.hp - damage);
        compact += ` · ${damage} 피해`;
        stateChanges.push(`${target.name} HP ${before} → ${target.hp}`);
      }
    }
    this.resolution = {
      id: `resolution.${Date.now()}`,
      actorId: action.actorId,
      targetId,
      actionId,
      actionName: action.name,
      stage: "complete",
      compact,
      detail,
      calculatedOutcome,
      finalOutcome: calculatedOutcome,
      stateChanges,
      adjudicated: false,
    };
    this.activity.unshift({ id: this.resolution.id, time: "지금", actor: actor?.name ?? "—", title: `${action.name} → ${target.name}`, summary: compact, detail: [...detail, ...stateChanges] });
    return this.getSnapshot();
  }

  async applyDmAdjudication(outcome: "success" | "failure") {
    if (!this.resolution) return this.getSnapshot();
    this.resolution.adjudicated = true;
    this.resolution.finalOutcome = outcome === "success" ? "DM 강제 성공" : "DM 강제 실패";
    this.resolution.detail.push(`DM 판정 수정: ${this.resolution.finalOutcome}`);
    this.activity.unshift({ id: `evt.${Date.now()}`, time: "지금", actor: "DM", title: "판정 수정", summary: `${this.resolution.calculatedOutcome} → ${this.resolution.finalOutcome}`, detail: ["원래 계산 결과는 보존됨"], correction: true });
    return this.getSnapshot();
  }

  async undoLastResolution() {
    if (!this.resolution) return this.getSnapshot();
    this.activity.unshift({ id: `evt.${Date.now()}`, time: "지금", actor: "시스템", title: "최근 Resolution 되돌림", summary: this.resolution.actionName, detail: ["Reference Mock에서는 로그 반전 상태만 표시합니다."], correction: true });
    this.resolution = null;
    return this.getSnapshot();
  }

  async setReferenceRole(role: AppRole) { this.role = role; return this.getSnapshot(); }
  async setSessionMode(mode: SessionMode) { this.sessionMode = mode; return this.getSnapshot(); }
  async setCurrentActor(actorId: string) { this.scene.currentActorId = actorId; return this.getSnapshot(); }
  async setQueuedD20(value: number | null) { this.queuedD20 = value; return this.getSnapshot(); }
  async setConnectionState(state: ConnectionState) { this.connectionState = state; return this.getSnapshot(); }
}

export const mockAdapter = new MockAdapter();
