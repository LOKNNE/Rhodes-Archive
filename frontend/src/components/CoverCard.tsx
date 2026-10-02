import { useEffect, useMemo, useState } from "react";
import type { Book } from "../lib/bookshelf";
import { cachedKey } from "../lib/bookshelf";
import { coverFallback } from "../lib/cover";
import { useBookshelfMetadata, type ResolvedArt } from "../lib/BookshelfMetadataContext";
import { useLongPress } from "../lib/useLongPress";

interface Props {
  book: Book;
  cachedStories: Set<string>;
  readStories: Set<string>;
  lastWatched: string | null;
  selected: boolean;
  partial: boolean;
  selectionMode: boolean;
  favorite: boolean;
  languages: string[];
  translated: boolean;
  onOpen: (book: Book) => void;
  onToggleSelect: (book: Book) => void;
  onLongPress: (book: Book) => void;
  onToggleFavorite: (book: Book) => void;
}

export default function CoverCard({
  book,
  cachedStories,
  readStories,
  lastWatched,
  selected,
  partial,
  selectionMode,
  favorite,
  languages,
  translated,
  onOpen,
  onToggleSelect,
  onLongPress,
  onToggleFavorite,
}: Props) {
  const isLastWatched = !!lastWatched && book.pageTitles.includes(lastWatched);
  const fallback = coverFallback();
  const { metadata, resolveArt } = useBookshelfMetadata();
  const [art, setArt] = useState<ResolvedArt | null>(null);

  useEffect(() => {
    let alive = true;
    void resolveArt("covers", book.coverKey).then((next) => {
      if (alive) setArt(next);
    });
    return () => {
      alive = false;
    };
  }, [book.coverKey, metadata?.version, resolveArt]);

  const ratio = art ? art.width / art.height : 0;
  const isBanner = !!art && ratio >= 2;
  const titleBaked = !!art && ratio >= 0.95 && ratio <= 1.05;

  const cachedCount = useMemo(
    () => book.pageTitles.filter((pt) => cachedStories.has(cachedKey(pt))).length,
    [book.pageTitles, cachedStories]
  );
  const readCount = useMemo(
    () => book.pageTitles.filter((pt) => readStories.has(pt)).length,
    [book.pageTitles, readStories]
  );
  const n = book.storyCount;
  const dotClass =
    n > 0 && readCount === n
      ? "read"
      : n > 0 && cachedCount === n
        ? "all"
        : cachedCount > 0
          ? "partial"
          : "";

  const subtitle =
    book.chapters.length > 1
      ? `${book.chapters.length} 章 · ${book.storyCount} 剧情`
      : `${book.storyCount} 剧情`;

  const press = useLongPress(
    () => onLongPress(book),
    () => (selectionMode ? onToggleSelect(book) : onOpen(book))
  );

  return (
    <div
      className={`cover-card ${selected ? "selected" : ""}`}
      data-cover={book.coverKey}
      role="button"
      tabIndex={0}
      {...press}
    >
      <div
        className="cover-art"
        style={{
          background: fallback.background,
          aspectRatio: isBanner && art ? `${art.width} / ${art.height}` : "1 / 1",
          position: "relative",
        }}
      >
        {art ? (
          <img
            className="cover-img"
            src={art.url}
            data-fallback={art.fallbackUrl}
            onError={(event) => {
              const fallbackUrl = event.currentTarget.dataset.fallback;
              if (!fallbackUrl) {
                setArt(null);
                return;
              }
              delete event.currentTarget.dataset.fallback;
              event.currentTarget.src = fallbackUrl;
            }}
            alt=""
            loading="lazy"
            draggable={false}
          />
        ) : (
          <img className="cover-ph" src="/logo.png" alt="" aria-hidden="true" draggable={false} />
        )}
        <div className="cover-scrim" />

        {!selectionMode && (
          <button
            aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            title={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleFavorite(book);
            }}
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 12,
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(0,0,0,.58)",
              color: favorite ? "#ffd54a" : "#fff",
              fontSize: 18,
              lineHeight: "26px",
              cursor: "pointer",
            }}
          >
            {favorite ? "★" : "☆"}
          </button>
        )}

        {!selectionMode && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 11,
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              maxWidth: "70%",
            }}
          >
            {(translated ? languages : ["CN"]).slice(0, 3).map((lang) => (
              <span
                key={lang}
                style={{
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: translated ? "rgba(19,111,63,.9)" : "rgba(38,38,38,.9)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".03em",
                  border: "1px solid rgba(255,255,255,.16)",
                }}
              >
                {lang.toUpperCase()}
              </span>
            ))}
            {n > 0 && readCount === n && (
              <span
                style={{
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: "rgba(29,116,67,.92)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  border: "1px solid rgba(255,255,255,.16)",
                }}
              >
                ✓
              </span>
            )}
            {n > 0 && cachedCount === n && (
              <span
                style={{
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: "rgba(32,91,155,.92)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  border: "1px solid rgba(255,255,255,.16)",
                }}
              >
                ↓
              </span>
            )}
          </div>
        )}

        <div className="cover-meta">
          {!titleBaked && <div className="cover-title">{book.coverKey}</div>}
          <div className="cover-sub">{subtitle}</div>
        </div>

        {selectionMode && (
          <button
            className={`cover-check ${selected ? "on" : ""} ${partial ? "partial" : ""}`}
            title={selected ? "取消选择全部剧情" : "选择全部剧情"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(book);
            }}
          >
            {selected ? "✓" : partial ? "–" : ""}
          </button>
        )}

        {dotClass && <span className={`cover-dot ${dotClass}`} />}
        {isLastWatched && !selectionMode && <span className="cover-last">上次观看</span>}
      </div>
    </div>
  );
}
