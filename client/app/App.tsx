import type { ReactElement } from "react";
import { useClient } from "./context";
import { ContentsScreen } from "../screens/ContentsScreen";
import { CreateScreen } from "../screens/CreateScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { SheetScreen } from "../screens/SheetScreen";

export function App() {
  const { route, navigate, theme, setTheme, ready, characters } = useClient();
  const link = (screen: "library" | "contents", label: string) => (
    <a href={screen === "library" ? "#/" : "#/contents"} className={route.screen === screen || (screen === "library" && route.screen !== "contents") ? "active" : ""} onClick={(event) => { event.preventDefault(); navigate({ screen }); }}>{label}</a>
  );
  let body: ReactElement;
  switch (route.screen) {
    case "new": body = <CreateScreen key="new" />; break;
    case "edit": {
      const record = characters.find((item) => item.id === route.id);
      body = ready ? (record ? <CreateScreen key={route.id} existing={record.source} initialStep="classes" /> : <div className="cl-page"><p className="cl-quiet">캐릭터를 찾을 수 없습니다.</p></div>) : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>;
      break;
    }
    case "sheet": body = <SheetScreen key={route.id} id={route.id} />; break;
    case "contents": body = <ContentsScreen />; break;
    default: body = <LibraryScreen />;
  }
  return (
    <div className="cl-root">
      <header className="cl-topbar">
        <div className="cl-brand">SimpleVTT <small>캐릭터</small></div>
        <nav className="cl-nav" aria-label="화면">{link("library", "캐릭터")}{link("contents", "콘텐츠")}</nav>
        <span className="cl-spacer" />
        <button type="button" className="cl-btn quiet small" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="테마 전환">{theme === "dark" ? "밝게" : "어둡게"}</button>
      </header>
      <main className="cl-main">{body}</main>
    </div>
  );
}
