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

function isBufferedTextCommand(command: CharacterDraftCommand) {
  return command.type === "set-name" || command.type === "set-notes";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const isComposingRef = useRef(false);
  const queuedTextCommandRef = useRef<CharacterDraftCommand | null>(null);

  const apply = useCallback(async (operation: () => Promise<AppSnapshot>) => {
    setSnapshot(await operation());
  }, []);

  const refresh = useCallback(async () => {
    setSnapshot(await mockAdapter.getSnapshot());
  }, []);

  const commitCharacterDraftCommand = useCallback(async (command: CharacterDraftCommand) => {
    await apply(() => mockAdapter.updateCharacterDraft(command));
  }, [apply]);

  const updateCharacterDraft = useCallback(async (command: CharacterDraftCommand) => {
    if (isBufferedTextCommand(command) && isComposingRef.current) {
      // During IME composition the browser owns the live input value. Do not mutate
      // Adapter state or publish a new controlled value until composition finishes.
      queuedTextCommandRef.current = command;
      return;
    }

    if (isBufferedTextCommand(command)) {
      // A final input event can arrive after compositionend. Prefer that final value
      // and cancel any older queued syllable so it cannot overwrite the result.
      queuedTextCommandRef.current = null;
    }

    await commitCharacterDraftCommand(command);
  }, [commitCharacterDraftCommand]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const handleCompositionStart = () => {
      isComposingRef.current = true;
      queuedTextCommandRef.current = null;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;

      // React/WebView may deliver the final input event immediately after
      // compositionend. Give it one task to win; otherwise flush the latest
      // queued composed value ourselves.
      window.setTimeout(() => {
        if (isComposingRef.current) return;
        const queued = queuedTextCommandRef.current;
        if (!queued) return;
        queuedTextCommandRef.current = null;
        void commitCharacterDraftCommand(queued);
      }, 0);
    };

    document.addEventListener("compositionstart", handleCompositionStart, true);
    document.addEventListener("compositionend", handleCompositionEnd, true);
    return () => {
      document.removeEventListener("compositionstart", handleCompositionStart, true);
      document.removeEventListener("compositionend", handleCompositionEnd, true);
    };
  }, [commitCharacterDraftCommand]);

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
