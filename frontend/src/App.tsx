import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  useEffect(() => {
    applyPersistedDownloadSettings();
    void loadBundle().catch((error) => console.warn("PRTS engine startup sync failed", error));
    startKeepalive();
  }, []);

  const manifestProbeTitles = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).getAll("manifestProbe")
    : [];
  if (manifestProbeTitles.length > 0) {
    return <ManifestProbePage titles={manifestProbeTitles} />;
  }

  return (
    <BrowserRouter>
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
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/translations" element={<TranslationsPage />} />
        </Routes>
        <DownloadBar />
        <DebugConsole />
        <TranslationsShortcut />
      </DownloadProvider>
      </CompressionProvider>
      </BookshelfMetadataProvider>
    </BrowserRouter>
  );
}
