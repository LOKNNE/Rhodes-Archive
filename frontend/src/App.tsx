import { useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import StoryBrowserPage from "./pages/StoryBrowserPage";
import StoryPlayerPage from "./pages/StoryPlayerPage";
import SettingsPage from "./pages/SettingsPage";
import AboutPage from "./pages/AboutPage";
import HelpPage from "./pages/HelpPage";
import DebugConsole from "./components/DebugConsole";
import DownloadBar from "./components/DownloadBar";
import { DownloadProvider } from "./lib/DownloadContext";
import { CompressionProvider } from "./lib/CompressionContext";
import { applyPersistedDownloadSettings, loadBundle } from "./lib/predownload";
import { startKeepalive } from "./lib/keepalive";
import { BookshelfMetadataProvider } from "./lib/BookshelfMetadataContext";
import ManifestProbePage from "./pages/ManifestProbePage";
import TranslationsPage from "./pages/TranslationsPage";
import TranslationsShortcut from "./components/TranslationsShortcut";
import CompanionHubPage from "./pages/CompanionHubPage";
import OperatorsPage from "./pages/OperatorsPage";
import BannersPage from "./pages/BannersPage";
import PlannerPage from "./pages/PlannerPage";
import MyRhodesPage from "./pages/MyRhodesPage";
import CloudSyncPage from "./pages/CloudSyncPage";
import { hydrateFromCloud } from "./lib/cloudSync";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const Router = isTauri ? BrowserRouter : HashRouter;

export default function App() {
  useEffect(() => {
    if (isTauri) {
      applyPersistedDownloadSettings();
      void loadBundle().catch((error) => console.warn("PRTS engine startup sync failed", error));
      startKeepalive();
    }
    void hydrateFromCloud().catch((error) => console.warn("Rhodes Cloud Sync startup:", error));
  }, []);

  const manifestProbeTitles = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).getAll("manifestProbe")
    : [];
  if (manifestProbeTitles.length > 0) {
    return <ManifestProbePage titles={manifestProbeTitles} />;
  }

  return (
    <Router>
      <BookshelfMetadataProvider>
      <CompressionProvider>
      <DownloadProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hub" element={<CompanionHubPage />} />
          <Route path="/browse" element={<StoryBrowserPage />} />
          <Route path="/play/:pageTitle" element={<StoryPlayerPage />} />
          <Route path="/operators" element={<OperatorsPage />} />
          <Route path="/banners" element={<BannersPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/my-rhodes" element={<MyRhodesPage />} />
          <Route path="/cloud-sync" element={<CloudSyncPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/translations" element={<TranslationsPage />} />
        </Routes>
        {isTauri && <DownloadBar />}
        {isTauri && <DebugConsole />}
        {isTauri && <TranslationsShortcut />}
      </DownloadProvider>
      </CompressionProvider>
      </BookshelfMetadataProvider>
    </Router>
  );
}
