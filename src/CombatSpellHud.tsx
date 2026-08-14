import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import "./app/spellcastingRuntimeContracts";
import { selectedCombatSpellSlot, setSelectedCombatSpellSlot } from "./app/spellcastingRuntimeSelection";
import { SpellTile } from "./SpellUi";

function useConsoleHost() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [magicActive, setMagicActive] = useState(false);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;
    let activeHost: HTMLElement | null = null;
    const connect = () => {
      if (cancelled) return;
      const next = document.querySelector<HTMLElement>(".action-console .console-actions");
      if (!next) {
        requestAnimationFrame(connect);
        return;
      }
      activeHost = next;
      setHost(next);
      const update = () => {
        const active = [...next.querySelectorAll<HTMLButtonElement>(".action-tabs button")]
          .find((button) => button.classList.contains("active"));
        const isMagic = active?.textContent?.trim() === "마법";
        setMagicActive(isMagic);
        next.classList.toggle("phase06-magic-active", isMagic);
      };
      update();
      observer = new MutationObserver(update);
      observer.observe(next, { subtree: true, attributes: true, attributeFilter: ["class"] });
    };
    connect();
    return () => {
      cancelled = true;
      observer?.disconnect();
      activeHost?.classList.remove("phase06-magic-active");
    };
  }, []);

  return { host, magicActive };
}

export function CombatSpellHudBridge() {
  const { snapshot, uiDebug } = useSimpleVtt();
  const { host, magicActive } = useConsoleHost();
  const actorId = useMemo(() => {
    if (!snapshot) return undefined;
    if (snapshot.role === "dm") return snapshot.scene.selectedActorId;
    return snapshot.sessionMode === "initiative" ? snapshot.scene.currentActorId : snapshot.activeCharacter.id;
  }, [snapshot]);
  const [slotLevel, setSlotLevel] = useState(1);

  const spellActions = useMemo(() => {
    if (!snapshot || !actorId) return [];
    return (snapshot.scene.actionsByActor[actorId] ?? []).filter((action) => action.category === "magic" && action.spellCast);
  }, [snapshot, actorId]);
  const spellcasting = actorId ? snapshot?.scene.spellcastingByActor?.[actorId] : undefined;
  const slotSignature = useMemo(
    () => (spellcasting?.slots ?? []).map((slot) => `${slot.level}:${slot.current}`).join("|"),
    [spellcasting?.slots],
  );

  useEffect(() => {
    if (!actorId) return;
    const firstAvailable = spellcasting?.slots.find((slot) => slot.current > 0)?.level ?? 1;
    const stored = selectedCombatSpellSlot(actorId, firstAvailable);
    const storedStillAvailable = spellcasting?.slots.some((slot) => slot.level === stored && slot.current > 0) ?? false;
    const selected = storedStillAvailable ? stored : firstAvailable;
    setSlotLevel(selected);
    setSelectedCombatSpellSlot(actorId, selected);
  }, [actorId, slotSignature, spellcasting?.slots]);

  if (!snapshot || !actorId || !host || spellActions.length === 0) return null;

  const chooseSlot = (level: number) => {
    setSlotLevel(level);
    setSelectedCombatSpellSlot(actorId, level);
  };

  const triggerLegacyAction = (actionId: string) => {
    const button = host.querySelector<HTMLButtonElement>(`button[data-action-id="${CSS.escape(actionId)}"]`);
    button?.click();
  };

  return createPortal(
    <section className={`combat-spell-hud ${magicActive ? "active" : ""}`} aria-label="전투 주문 HUD">
      <header className="combat-spell-hud-head">
        <div>
          <strong>주문</strong>
          <span>{spellcasting ? `주문 공격 +${spellcasting.spellAttackModifier} · 내성 DC ${spellcasting.spellSaveDc}` : "아이템 / 기능 주문"}</span>
        </div>
        {spellcasting?.slottedSpellCastThisTurn && <em>이번 턴 주문 슬롯 사용 완료</em>}
      </header>

      {spellcasting && spellcasting.slots.length > 0 && <div className="combat-spell-slot-rail">
        <span>주문 슬롯</span>
        {spellcasting.slots.map((slot) => <button
          type="button"
          key={slot.level}
          className={slotLevel === slot.level ? "active" : ""}
          disabled={slot.current <= 0}
          onClick={() => chooseSlot(slot.level)}
        >
          <b>{slot.level}</b>
          <small>{slot.current}/{slot.max}</small>
        </button>)}
      </div>}

      <div className="combat-spell-grid">
        {spellActions.map((action) => {
          const meta = action.spellCast!;
          const needsSlot = meta.baseLevel > 0 && meta.castSource !== "item" && meta.castSource !== "feature";
          const selectedSlot = needsSlot ? Math.max(meta.baseLevel, slotLevel) : undefined;
          const slot = selectedSlot ? spellcasting?.slots.find((entry) => entry.level === selectedSlot) : undefined;
          const unsupported = meta.runtimeSupport === "partial";
          const slotUnavailable = Boolean(needsSlot && (!slot || slot.current <= 0));
          const disabled = !action.available || unsupported || slotUnavailable;
          const status = meta.runtimeSupport === "combat-executable"
            ? selectedSlot ? `${selectedSlot}레벨 슬롯 · 실행 가능` : "실행 가능"
            : meta.runtimeSupport === "legacy-item"
              ? "아이템 경로"
              : "추가 규칙 미지원";
          return <div className="combat-spell-entry" key={action.id}>
            <SpellTile
              spellId={meta.spellId}
              selected={uiDebug.selectedActionId === action.id}
              disabled={disabled}
              compact
              status={status}
              onClick={() => triggerLegacyAction(action.id)}
            />
            {(meta.disabledMechanicReason || action.disabledReason) && <small className="combat-spell-disabled-reason">
              {meta.disabledMechanicReason ?? action.disabledReason}
            </small>}
          </div>;
        })}
      </div>
      <footer>Phase 06 · mechanics manifest → targeting / slot / d20 / damage / effect atomic resolution</footer>
    </section>,
    host,
  );
}
