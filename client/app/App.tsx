import type { ReactElement } from "react";
import { useClient } from "./context";
import { ContentsScreen } from "../screens/ContentsScreen";
import { CreateScreen } from "../screens/CreateScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { LevelUpScreen } from "../screens/LevelUpScreen";
import { CampaignScreen, CampaignsScreen } from "../screens/CampaignScreen";
import { SessionScreen } from "../screens/SessionScreen";
import { SheetScreen } from "../screens/SheetScreen";
import { DiceProvider } from "../ui/dice/DiceProvider";
import { SessionProvider, useSession } from "./session";

export function App() {
  return <SessionProvider><AppBody /></SessionProvider>;
}

function AppBody() {
  const { route, navigate, theme, setTheme, ready, characters } = useClient();
  const session = useSession();
  const group = route.screen === "contents" ? "contents" : route.screen === "session" ? "session" : route.screen === "campaigns" || route.screen === "campaign" ? "campaigns" : "library";
  const link = (screen: "library" | "contents" | "session" | "campaigns", label: string) => (
    <a href={screen === "library" ? "#/" : `#/${screen}`} className={group === screen ? "active" : ""} onClick={(event) => { event.preventDefault(); navigate({ screen }); }}>{label}{screen === "session" && session.role ? <span className="cl-nav-dot" title={session.status} /> : null}</a>
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
    case "levelup": body = ready ? <LevelUpScreen key={route.id} id={route.id} /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    case "contents": body = <ContentsScreen />; break;
    case "session": body = ready ? <SessionScreen /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    case "campaigns": body = ready ? <CampaignsScreen /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    case "campaign": body = ready ? <CampaignScreen key={route.id} id={route.id} /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    default: body = <LibraryScreen />;
  }
  return (
    <DiceProvider>
    <div className="cl-root">
      <header className="cl-topbar">
        <div className="cl-brand">SimpleVTT <small>캐릭터</small></div>
        <nav className="cl-nav" aria-label="화면">{link("library", "캐릭터")}{link("campaigns", "캠페인")}{link("session", "세션")}{link("contents", "콘텐츠")}</nav>
        <span className="cl-spacer" />
        <button type="button" className="cl-btn quiet small" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="테마 전환">{theme === "dark" ? "밝게" : "어둡게"}</button>
      </header>
      <main className="cl-main">{body}</main>
    </div>
    </DiceProvider>
  );
}
