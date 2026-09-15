/** A saved library character as an offline session: the play panel plus export, level up, edit, delete. */
import { useClient } from "../app/context";
import { Notice } from "../ui/components";
import { SheetPlay } from "./SheetPlay";

export function SheetScreen({ id }: { id: string }) {
  const { catalog, characters, navigate, saveCharacter, deleteCharacter } = useClient();
  const record = characters.find((item) => item.id === id);
  if (!record) return <div className="cl-page"><Notice tone="bad">캐릭터를 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "library" })}>라이브러리로</button></div>;
  const remove = async () => {
    if (!confirm(`"${record.source.name}"을(를) 삭제할까요?`)) return;
    await deleteCharacter(record.id);
    navigate({ screen: "library" });
  };
  return (
    <SheetPlay
      source={record.source}
      runtime={record.runtime}
      catalog={catalog}
      savedAt={record.savedAt}
      save={(runtime) => saveCharacter(record.source, runtime)}
      actions={<>
        <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "levelup", id: record.id })}>레벨 업</button>
        <button type="button" className="cl-btn" onClick={() => navigate({ screen: "edit", id: record.id })}>편집</button>
        <button type="button" className="cl-btn danger" onClick={remove}>삭제</button>
        <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "library" })}>라이브러리</button>
      </>}
    />
  );
}
