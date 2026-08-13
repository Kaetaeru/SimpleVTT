import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AppRole,
  AppSnapshot,
  CharacterCreateDraft,
  CharacterDraftCommand,
  ConnectionState,
  LevelUpCommand,
  SessionMode,
} from "./contracts";
import { mockAdapter } from "./mockAdapter";

interface AppContextValue {
  snapshot: AppSnapshot | null;
  loading: boolean;
  refresh(): Promise<void>;
  createCharacterDraft(mode?: CharacterCreateDraft["mode"]): Promise<void>;
  updateCharacterDraft(command: CharacterDraftCommand): Promise<void>;
  finalizeCharacterDraft(): Promise<void>;
  startLevelUp(characterId: string): Promise<void>;
  updateLevelUp(command: LevelUpCommand): Promise<void>;
  commitLevelUp(): Promise<void>;
  selectDmActor(actorId: string): Promise<void>;
  resolveAction(actionId: string, targetId: string): Promise<void>;
  applyDmAdjudication(outcome: "success" | "failure"): Promise<void>;
  undoLastResolution(): Promise<void>;
  debug: {
    setRole(role: AppRole): Promise<void>;
    setMode(mode: SessionMode): Promise<void>;
    setCurrentActor(actorId: string): Promise<void>;
    setQueuedD20(value: number | null): Promise<void>;
    setConnectionState(state: ConnectionState): Promise<void>;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

function isOptimisticTextCommand(command: CharacterDraftCommand) {
  return command.type === "set-name" || command.type === "set-notes";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const operationSequenceRef = useRef(0);

  const publishIfLatest = useCallback((sequence: number, next: AppSnapshot) => {
    if (sequence !== operationSequenceRef.current) return;
    setSnapshot(next);
  }, []);

  const apply = useCallback(async (operation: () => Promise<AppSnapshot>) => {
    const sequence = ++operationSequenceRef.current;
    const next = await operation();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);

  const refresh = useCallback(async () => {
    const sequence = ++operationSequenceRef.current;
    const next = await mockAdapter.getSnapshot();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);

  const updateCharacterDraft = useCallback(async (command: CharacterDraftCommand) => {
    if (!isOptimisticTextCommand(command)) {
      await apply(() => mockAdapter.updateCharacterDraft(command));
      return;
    }

    const sequence = ++operationSequenceRef.current;
    const value = String(command.value ?? "");

    // React controlled inputs must receive their new value synchronously from the
    // onChange call. Publishing the text optimistically here lets the browser keep
    // ownership of an active Korean/IME composition instead of restoring the old
    // controlled value after each input event.
    setSnapshot((current) => {
      if (!current?.createDraft) return current;
      return {
        ...current,
        createDraft: {
          ...current.createDraft,
          ...(command.type === "set-name" ? { name: value } : { notes: value }),
        },
      };
    });

    const next = await mockAdapter.updateCharacterDraft(command);
    publishIfLatest(sequence, next);
  }, [apply, publishIfLatest]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AppContextValue>(() => ({
    snapshot,
    loading,
    refresh,
    createCharacterDraft: async (mode) => apply(() => mockAdapter.createCharacterDraft(mode)),
    updateCharacterDraft,
    finalizeCharacterDraft: async () => apply(() => mockAdapter.finalizeCharacterDraft()),
    startLevelUp: async (characterId) => apply(() => mockAdapter.startLevelUp(characterId)),
    updateLevelUp: async (command) => apply(() => mockAdapter.updateLevelUp(command)),
    commitLevelUp: async () => apply(() => mockAdapter.commitLevelUp()),
    selectDmActor: async (actorId) => apply(() => mockAdapter.selectDmActor(actorId)),
    resolveAction: async (actionId, targetId) => apply(() => mockAdapter.resolveAction(actionId, targetId)),
    applyDmAdjudication: async (outcome) => apply(() => mockAdapter.applyDmAdjudication(outcome)),
    undoLastResolution: async () => apply(() => mockAdapter.undoLastResolution()),
    debug: {
      setRole: async (role) => apply(() => mockAdapter.setReferenceRole(role)),
      setMode: async (mode) => apply(() => mockAdapter.setSessionMode(mode)),
      setCurrentActor: async (actorId) => apply(() => mockAdapter.setCurrentActor(actorId)),
      setQueuedD20: async (value) => apply(() => mockAdapter.setQueuedD20(value)),
      setConnectionState: async (state) => apply(() => mockAdapter.setConnectionState(state)),
    },
  }), [snapshot, loading, refresh, apply, updateCharacterDraft]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useSimpleVtt() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useSimpleVtt must be used inside AppProvider");
  return value;
}
