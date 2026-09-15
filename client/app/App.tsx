import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { useClient } from "./context";
import { ContentsScreen } from "../screens/ContentsScreen";
import { CreateScreen } from "../screens/CreateScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { LevelUpScreen } from "../screens/LevelUpScreen";
import { CampaignDetailScreen, CampaignsScreen } from "../screens/CampaignScreens";
import { SheetScreen } from "../screens/SheetScreen";
import { TableScreen } from "../screens/TableScreen";
import { DiceProvider } from "../ui/dice/DiceProvider";
import { CampaignsProvider, useCampaigns } from "./campaigns";

export function App() {
  return <ScreenErrorBoundary><CampaignsProvider><AppBody /></CampaignsProvider></ScreenErrorBoundary>;
}

/** A crash in a screen shows what broke and a way out instead of a white page. */
class ScreenErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("screen crashed", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="cl-page" role="alert">
        <h1>화면을 그리다가 오류가 났습니다</h1>
        <pre>{this.state.error.message}</pre>
        <div className="cl-row" style={{ gap: 8 }}>
          <button type="button" className="cl-btn primary" onClick={() => { location.hash = "#/"; this.setState({ error: null }); }}>캐릭터 화면으로</button>
          <button type="button" className="cl-btn" onClick={() => location.reload()}>새로고침</button>
        </div>
        <p className="cl-quiet cl-small">이 메시지가 계속 나오면 브라우저의 사이트 데이터(IndexedDB `simplevtt-client`)를 지우고 다시 여세요. 캐릭터는 먼저 JSON으로 내보내 두세요.</p>
      </div>
    );
  }
}

function AppBody() {
  const { route, navigate, theme, setTheme, ready, characters } = useClient();
  const { table } = useCampaigns();
  const group = route.screen === "contents" ? "contents" : route.screen === "table" ? "table" : route.screen === "campaigns" || route.screen === "campaign" ? "campaigns" : "library";
  const link = (screen: "library" | "contents" | "campaigns" | "table", label: string) => (
    <a href={screen === "library" ? "#/" : `#/${screen}`} className={group === screen ? "active" : ""} onClick={(event) => { event.preventDefault(); navigate({ screen }); }}>{label}{screen === "table" && table.role ? <span className="cl-nav-dot" title={table.status} /> : null}</a>
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
    case "campaigns": body = ready ? <CampaignsScreen /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    case "campaign": body = ready ? <CampaignDetailScreen key={route.id} id={route.id} /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    case "table": body = ready ? <TableScreen /> : <div className="cl-page"><p className="cl-quiet">불러오는 중…</p></div>; break;
    default: body = <LibraryScreen />;
  }
  return (
    <DiceProvider>
    <div className="cl-root">
      <header className="cl-topbar">
        <div className="cl-brand">SimpleVTT <small>캐릭터</small></div>
        <nav className="cl-nav" aria-label="화면">{link("library", "캐릭터")}{link("campaigns", "캠페인")}{link("table", "테이블")}{link("contents", "콘텐츠")}</nav>
        <span className="cl-spacer" />
        <button type="button" className="cl-btn quiet small" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="테마 전환">{theme === "dark" ? "밝게" : "어둡게"}</button>
      </header>
      <main className="cl-main">{body}</main>
    </div>
    </DiceProvider>
  );
}
