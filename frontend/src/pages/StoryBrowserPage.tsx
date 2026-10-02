import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useStoryIndex } from "../hooks/useStoryIndex";
import { useDownload } from "../lib/DownloadContext";
import { useCompression } from "../lib/CompressionContext";
import { buildShelves } from "../lib/bookshelf";
import { getReadStories, getLastWatched } from "../lib/readState";
import { getFavorites, saveFavorites } from "../lib/favorites";
import { listTranslations, type TranslationFileInfo } from "../lib/translationsFolder";
import type { Book, Shelf } from "../lib/bookshelf";
import CoverCard from "../components/CoverCard";
import ChapterDetail from "../components/ChapterDetail";
import SelectionBar from "../components/SelectionBar";
import { storylineIcon } from "../assets/storylines";
import { confirmAction, showNotice } from "../lib/dialogs";

export default function StoryBrowserPage() {
  const { index, loading, error, refresh } = useStoryIndex();
  const [search, setSearch] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");
  const [translationFilter, setTranslationFilter] = useState<"all" | "translated" | "untranslated">("all");
  const [languageFilter, setLanguageFilter] = useState("");
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());
  const [translations, setTranslations] = useState<TranslationFileInfo[]>([]);
  const [cachedStories, setCachedStories] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openCategory = searchParams.get("cat");
  const openCover = searchParams.get("book");

  const openBook: Book | null = useMemo(
    () =>
      openCover
        ? ({ category: openCategory ?? "", coverKey: openCover, chapters: [], pageTitles: [], storyCount: 0 } as Book)
        : null,
    [openCategory, openCover]
  );

  const openBookCard = useCallback(
    (book: Book) => setSearchParams({ cat: book.category, book: book.coverKey }),
    [setSearchParams]
  );

  const prevOpen = useRef<string | null>(openCover);
  useEffect(() => {
    const left = prevOpen.current;
    prevOpen.current = openCover;
    setSelected(new Set());
    if (!openCover && left) {
      requestAnimationFrame(() => {
        const sel = `[data-cover="${left.replace(/["\\]/g, "\\$&")}"]`;
        document.querySelector(sel)?.scrollIntoView({ block: "center" });
      });
    }
  }, [openCover]);

  const [readStories, setReadStories] = useState<Set<string>>(() => getReadStories());
  const [lastWatched, setLastWatchedState] = useState<string | null>(() => getLastWatched());
  const { start: startPredownload, busy, status, onFinished } = useDownload();
  const { busy: compressionBusy } = useCompression();

  const refreshTranslations = useCallback(() => {
    void listTranslations().then(setTranslations).catch(() => setTranslations([]));
  }, []);

  useEffect(() => {
    refreshTranslations();
    const refreshState = () => {
      setReadStories(getReadStories());
      setLastWatchedState(getLastWatched());
      setFavorites(getFavorites());
      refreshTranslations();
    };
    window.addEventListener("focus", refreshState);
    return () => window.removeEventListener("focus", refreshState);
  }, [refreshTranslations]);

  const refreshCached = useCallback(
    () =>
      invoke<string[]>("list_cached_stories")
        .then((list) => setCachedStories(new Set(list)))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    refreshCached();
    return onFinished(refreshCached);
  }, [onFinished, refreshCached]);

  const shelves: Shelf[] = useMemo(() => (index ? buildShelves(index) : []), [index]);

  const translationsByTitle = useMemo(() => {
    const map = new Map<string, TranslationFileInfo[]>();
    for (const item of translations) {
      const current = map.get(item.page_title) ?? [];
      current.push(item);
      map.set(item.page_title, current);
    }
    return map;
  }, [translations]);

  const languages = useMemo(
    () => [...new Set(translations.map((t) => t.language).filter(Boolean))].sort(),
    [translations]
  );

  const translationInfoForBook = useCallback(
    (book: Book) => {
      const items = book.pageTitles.flatMap((pt) => translationsByTitle.get(pt) ?? []);
      return {
        translated: items.length > 0,
        languages: [...new Set(items.map((t) => t.language).filter(Boolean))].sort(),
      };
    },
    [translationsByTitle]
  );

  const toggleFavoriteBook = useCallback((book: Book) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const key = `${book.category}::${book.coverKey}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (book: Book) => favorites.has(`${book.category}::${book.coverKey}`),
    [favorites]
  );

  const filtered: Shelf[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cq = characterSearch.trim().toLowerCase();

    return shelves
      .map((shelf) => ({
        category: shelf.category,
        books: shelf.books.filter((b) => {
          const matchesText = !q ||
            b.coverKey.toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q) ||
            b.chapters.some(
              (ch) =>
                ch.name.toLowerCase().includes(q) ||
                (ch.activity_name?.toLowerCase().includes(q) ?? false) ||
                ch.stories.some(
                  (s) => s.title.toLowerCase().includes(q) || s.page_title.toLowerCase().includes(q)
                )
            );
          if (!matchesText) return false;

          if (favoriteFilter && !favorites.has(`${b.category}::${b.coverKey}`)) return false;

          const pageTranslations = b.pageTitles.flatMap((pt) => translationsByTitle.get(pt) ?? []);
          const isTranslated = pageTranslations.length > 0;

          if (translationFilter === "translated" && !isTranslated) return false;
          if (translationFilter === "untranslated" && isTranslated) return false;

          if (languageFilter && !pageTranslations.some((t) => t.language === languageFilter)) {
            return false;
          }

          if (cq && !pageTranslations.some((t) =>
            t.characters.some((name) => name.toLowerCase().includes(cq))
          )) {
            return false;
          }

          return true;
        }),
      }))
      .filter((shelf) => shelf.books.length > 0);
  }, [shelves, search, characterSearch, translationFilter, languageFilter, favoriteFilter, favorites, translationsByTitle]);

  const liveBook: Book | null = useMemo(() => {
    if (!openBook) return null;
    for (const shelf of shelves) {
      const found = shelf.books.find(
        (b) => b.category === openBook.category && b.coverKey === openBook.coverKey
      );
      if (found) return found;
    }
    return openBook;
  }, [openBook, shelves]);

  const toggleStory = (pt: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });

  const setMany = (pts: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const pt of pts) {
        if (on) next.add(pt);
        else next.delete(pt);
      }
      return next;
    });

  const toggleBook = (book: Book) => {
    const allSel = book.pageTitles.every((pt) => selected.has(pt));
    setMany(book.pageTitles, !allSel);
  };

  const bookSelState = (book: Book): { selected: boolean; partial: boolean } => {
    const sel = book.pageTitles.filter((pt) => selected.has(pt)).length;
    return { selected: sel === book.pageTitles.length && sel > 0, partial: sel > 0 };
  };

  const clearSelection = () => setSelected(new Set());
  const selectionMode = selected.size > 0;
  const enterSelect = (book: Book) => setMany(book.pageTitles, true);

  const shelfTitles = (shelf: Shelf) => shelf.books.flatMap((b) => b.pageTitles);
  const shelfSelState = (shelf: Shelf): { selected: boolean; partial: boolean } => {
    const pts = shelfTitles(shelf);
    const sel = pts.filter((pt) => selected.has(pt)).length;
    return { selected: sel === pts.length && sel > 0, partial: sel > 0 };
  };
  const toggleShelf = (shelf: Shelf) => {
    const pts = shelfTitles(shelf);
    setMany(pts, !pts.every((pt) => selected.has(pt)));
  };

  const playStory = (pageTitle: string) => {
    if (compressionBusy) {
      void showNotice("Se están comprimiendo recursos. Espera a que termine antes de abrir una historia.");
      return;
    }
    navigate(`/play/${encodeURIComponent(pageTitle)}`);
  };

  const fmtSize = (b: number): string =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  const deleteTitles = async (titles: string[], label: string, after?: () => void) => {
    if (titles.length === 0) return;
    if (!await confirmAction(`¿Eliminar la caché local de «${label}»?\n(Solo se borrarán sus recursos exclusivos; los compartidos con otros capítulos se conservarán.)`)) return;
    try {
      const r = await invoke<{ freedBytes: number; deletedFiles: number; storiesCleared: number }>(
        "delete_chapter_cache",
        { titles }
      );
      await showNotice(`Caché de «${label}» limpiada: ${r.storiesCleared} historias, ${fmtSize(r.freedBytes)} liberados`);
      refreshCached();
      after?.();
    } catch (e) {
      await showNotice(`Error al eliminar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const batchDownload = () => startPredownload([...selected]);
  const batchDelete = () => deleteTitles([...selected], `${selected.size} historias`, clearSelection);

  if (loading && !index) return <div className="loading">Cargando historias...</div>;

  if (error && !index) {
    return (
      <div className="error-msg">
        <p>No se pudo cargar el catálogo: {error}</p>
        <button className="btn-primary" onClick={refresh} style={{ marginTop: "12px" }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="browser-page story-browser">
      {!liveBook && (
        <>
          <div className="browser-header" style={{ flexWrap: "wrap", gap: "8px" }}>
            <button className="back-icon" onClick={() => navigate(-1)} aria-label="Volver">◀</button>
            <h1>Historias</h1>
            <input
              className="search-input"
              type="text"
              placeholder="Buscar colección / historia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              className="search-input"
              type="text"
              placeholder="Personaje..."
              value={characterSearch}
              onChange={(e) => setCharacterSearch(e.target.value)}
              style={{ maxWidth: "180px" }}
            />
            <select
              className="search-input"
              value={translationFilter}
              onChange={(e) => setTranslationFilter(e.target.value as "all" | "translated" | "untranslated")}
              style={{ maxWidth: "170px" }}
            >
              <option value="all">Todos</option>
              <option value="translated">Traducidos</option>
              <option value="untranslated">Sin traducir</option>
            </select>
            <select
              className="search-input"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              style={{ maxWidth: "150px" }}
            >
              <option value="">Todos los idiomas</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
            <button
              className="nav-btn"
              onClick={() => setFavoriteFilter((v) => !v)}
              style={favoriteFilter ? { color: "#ffd54a", borderColor: "#8a7420" } : undefined}
              title="Mostrar solo favoritos"
            >
              {favoriteFilter ? "★ Favoritos" : "☆ Favoritos"}
            </button>
            {(search || characterSearch || translationFilter !== "all" || languageFilter || favoriteFilter) && (
              <button
                className="nav-btn"
                onClick={() => {
                  setSearch("");
                  setCharacterSearch("");
                  setTranslationFilter("all");
                  setLanguageFilter("");
                  setFavoriteFilter(false);
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="browser-content shelf-content">
            {filtered.map((shelf) => (
              <section key={shelf.category} className="shelf">
                <div className="shelf-header">
                  {selectionMode && (() => {
                    const ss = shelfSelState(shelf);
                    return (
                      <button
                        className={`shelf-check ${ss.selected ? "on" : ""} ${ss.partial && !ss.selected ? "partial" : ""}`}
                        title={ss.selected ? "Deseleccionar esta categoría" : "Seleccionar toda la categoría"}
                        onClick={() => toggleShelf(shelf)}
                      >
                        {ss.selected ? "✓" : ss.partial ? "–" : ""}
                      </button>
                    );
                  })()}
                  {storylineIcon(shelf.category) && (
                    <img className="shelf-icon" src={storylineIcon(shelf.category)} alt="" aria-hidden="true" />
                  )}
                  <span className="shelf-title">{shelf.category}</span>
                  <span className="shelf-count">{shelf.books.length} capítulos</span>
                </div>
                <div className="cover-grid">
                  {shelf.books.map((book) => {
                    const st = bookSelState(book);
                    const ti = translationInfoForBook(book);
                    return (
                      <CoverCard
                        key={book.coverKey}
                        book={book}
                        cachedStories={cachedStories}
                        readStories={readStories}
                        lastWatched={lastWatched}
                        selected={st.selected}
                        partial={st.partial && !st.selected}
                        selectionMode={selectionMode}
                        favorite={isFavorite(book)}
                        translated={ti.translated}
                        languages={ti.languages}
                        onOpen={openBookCard}
                        onToggleSelect={toggleBook}
                        onLongPress={enterSelect}
                        onToggleFavorite={toggleFavoriteBook}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            {filtered.length === 0 && <div className="loading">No se encontraron historias con estos filtros</div>}
          </div>
        </>
      )}

      {liveBook && (
        <ChapterDetail
          book={liveBook}
          cachedStories={cachedStories}
          readStories={readStories}
          lastWatched={lastWatched}
          selected={selected}
          selectionMode={selectionMode}
          onBack={() => navigate(-1)}
          onPlay={playStory}
          onToggleStory={toggleStory}
          onSetMany={setMany}
        />
      )}

      <SelectionBar
        count={selected.size}
        busy={busy}
        downloadActive={status !== null}
        onClear={clearSelection}
        onDownload={batchDownload}
        onDelete={batchDelete}
      />
    </div>
  );
}
