import { useSimpleVtt } from "./app/AppProvider";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import "./session-main-focus.css";
import "./session-integrated-reference-chrome.css";

export function SessionMainFocus({ role: _role, lastRollActorId, onOpenActivity: _onOpenActivity }: { role: "player" | "dm"; lastRollActorId:string|null; onOpenActivity(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;

  if (snapshot.sessionMode === "initiative") {
    const actor=snapshot.scene.entities.find((entity)=>entity.id===snapshot.scene.currentActorId)??null;
    const portrait=actor?.id===snapshot.activeCharacter.id?sanitizeCharacterPortrait(snapshot.activeCharacter.portrait):null;
    const initials=actor?.name.trim().slice(0,2)||"?";
    return <section className="session-main-focus-state session-initiative-focus" aria-label="이니셔티브 플레이 공간">
      {actor?<div className="session-last-roll-actor session-current-turn-actor" aria-label={`현재 턴 액터 ${actor.name}`}>
        <div className="session-last-roll-art">{portrait?<img src={portrait.asset.dataUrl} alt={`${actor.name} 일러스트`} style={{objectPosition:`${portrait.focalX*100}% ${portrait.focalY*100}%`}}/>:<span aria-hidden="true"><i/><b>{initials}</b></span>}</div>
        <div className="session-last-roll-caption"><small>CURRENT TURN · ROUND {snapshot.scene.round}</small><strong>{actor.name}</strong></div>
      </div>:<div className="session-freeform-empty"><span className="eyebrow accent">이니셔티브</span><strong>현재 턴 액터 없음</strong></div>}
    </section>;
  }

  const actor=snapshot.scene.entities.find((entity)=>entity.id===lastRollActorId)??null;
  const portrait=actor?.id===snapshot.activeCharacter.id?sanitizeCharacterPortrait(snapshot.activeCharacter.portrait):null;
  const initials=actor?.name.trim().slice(0,2)||"";
  return <section className="session-main-focus-state session-freeform-focus" aria-label="자유 진행 플레이 공간">
    {actor?<div className="session-last-roll-actor" aria-label={`마지막 굴림 액터 ${actor.name}`}>
      <div className="session-last-roll-art">{portrait?<img src={portrait.asset.dataUrl} alt={`${actor.name} 일러스트`} style={{objectPosition:`${portrait.focalX*100}% ${portrait.focalY*100}%`}}/>:<span aria-hidden="true"><i/><b>{initials}</b></span>}</div>
      <div className="session-last-roll-caption"><small>LAST ROLL</small><strong>{actor.name}</strong></div>
    </div>:<div className="session-freeform-empty"><span className="eyebrow accent">자유 진행</span><strong>첫 굴림을 기다리는 중</strong></div>}
  </section>;
}
