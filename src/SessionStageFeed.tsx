import { useSimpleVtt } from "./app/AppProvider";

/** V1.4 U1-03: the last few activity entries sit on the stage under the current-turn focus, so play reads without opening 기록. */
export function SessionStageFeed({ limit = 3 }: { limit?: number }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  const entries = snapshot.activity.filter((entry) => !entry.reversed).slice(0, limit);
  if (!entries.length) return null;
  return <ol className="session-stage-feed" aria-label="최근 결과">
    {entries.map((entry) => <li key={entry.id} className={entry.correction ? "correction" : ""}>
      <span className="session-stage-feed-actor">{entry.actor}</span>
      <strong>{entry.title}</strong>
      {entry.summary && <small>{entry.summary}</small>}
    </li>)}
  </ol>;
}
