import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import AutoScrollControls from "../components/AutoScrollControls";
import PdfViewer from "../components/PdfViewer";
import ShareModal from "../components/ShareModal";
import YouTubePlayer from "../components/YouTubePlayer";
import {
  fetchChordSheet,
  fetchChordSheetSharedUsers,
  fetchTabVisibility,
  isPdfAsset,
  recordChordSheetView,
  resolveChordSheetAsset,
  setTabVisibility,
  shareChordSheet,
  unshareChordSheet,
  updateChordSheetScrollSpeed,
} from "../services/api";
import { useAuth } from "../components/AuthContext";

// Regex para identificar linhas de tablatura: começa com letra maiúscula seguida de pipe
const TAB_LINE_REGEX = /^[A-Z]\|/;

function hasTabLines(content) {
  if (!content) return false;
  return content.split("\n").some((line) => TAB_LINE_REGEX.test(line));
}

export default function ChordSheetPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [chordSheet, setChordSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScrollSpeed, setCurrentScrollSpeed] = useState(1);
  const [savedScrollSpeed, setSavedScrollSpeed] = useState(1);
  const [tabHidden, setTabHidden] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const saveTimeoutRef = useRef(null);
  const lastScheduledSpeedRef = useRef(1);

  const isOwner = isAuthenticated && user && chordSheet && chordSheet.created_by_id === user.id;
  const sheetHasTab = chordSheet ? hasTabLines(chordSheet.content) : false;
  const images = Array.isArray(chordSheet?.image_data) ? chordSheet.image_data : [];
  const hasImages = images.length > 0;

  // Carrega a cifra e a preferência de tablatura
  useEffect(() => {
    if (!id) return;
    fetchChordSheet(id)
      .then((data) => {
        setChordSheet(data);
        const normalized = Number(
          Math.min(1.8, Math.max(0.2, Number(data?.scroll_speed ?? 1))).toFixed(1)
        );
        setCurrentScrollSpeed(normalized);
        setSavedScrollSpeed(normalized);

        recordChordSheetView(id)
          .then(() => {
            setChordSheet((prev) => ({ ...prev, view_count: Number(prev?.view_count || 0) + 1 }));
          })
          .catch(() => {});

        // Carrega preferência de tablatura do Redis
        if (isAuthenticated) {
          fetchTabVisibility(id)
            .then((res) => {
              // res.tab_hidden = true significa oculta (default)
              setTabHidden(res.tab_hidden);
            })
            .catch(() => {});
        } else {
          // Usuário não logado: sempre começa oculta
          setTabHidden(true);
        }
      })
      .catch(() => {
        setChordSheet(null);
      })
      .finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  // Persiste a preferência de tablatura no Redis quando o usuário alterna
  const toggleTab = useCallback(() => {
    setTabHidden((prev) => {
      const newVal = !prev;
      if (isAuthenticated && id) {
        setTabVisibility(id, newVal).catch(() => {});
      }
      return newVal;
    });
  }, [isAuthenticated, id]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chordSheet?.id]);

  useEffect(() => {
    if (!id || !isOwner) return;
    if (currentScrollSpeed === savedScrollSpeed) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    lastScheduledSpeedRef.current = currentScrollSpeed;
    saveTimeoutRef.current = setTimeout(async () => {
      if (lastScheduledSpeedRef.current === savedScrollSpeed) return;
      try {
        await updateChordSheetScrollSpeed(id, lastScheduledSpeedRef.current);
        setSavedScrollSpeed(lastScheduledSpeedRef.current);
        setChordSheet((prev) => ({ ...prev, scroll_speed: lastScheduledSpeedRef.current }));
      } catch {
        // Silent fail
      }
    }, 60000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentScrollSpeed, id, isOwner, savedScrollSpeed]);

  const setlistId = searchParams.get("setlistId");
  const currentIndex = Number(searchParams.get("currentIndex") || 0);
  const songIds = (searchParams.get("songIds") || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const hasNextSong = songIds.length > 0 && currentIndex < songIds.length - 1;
  const hasPreviousSong = songIds.length > 0 && currentIndex > 0;
  const previousSongId = hasPreviousSong ? songIds[currentIndex - 1] : null;
  const nextSongId = hasNextSong ? songIds[currentIndex + 1] : null;
  const previousSongHref = hasPreviousSong
    ? `/cifras/${previousSongId}?setlistId=${setlistId || ""}&songIds=${songIds.join(",")}&currentIndex=${
        currentIndex - 1
      }`
    : null;
  const nextSongHref = hasNextSong
    ? `/cifras/${nextSongId}?setlistId=${setlistId || ""}&songIds=${songIds.join(",")}&currentIndex=${
        currentIndex + 1
      }`
    : null;

  // Renderiza o conteúdo filtrando linhas de tablatura se tabHidden for true
  const renderContent = (content) => {
    if (!tabHidden) {
      return content;
    }
    return content
      .split("\n")
      .filter((line) => !TAB_LINE_REGEX.test(line))
      .join("\n");
  };

  if (loading) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="panel p-12 text-center animate-pulse">Carregando cifra...</div>
      </section>
    );
  }

  if (!chordSheet) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="panel p-12 text-center text-slate-500">Cifra não encontrada</div>
      </section>
    );
  }

  return (
    <article className="space-y-6 animate-fade-in pb-32">
      {/* ── Header ── */}
      <header className="relative overflow-hidden panel p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <span className="label-section">Cifra Pública</span>
            <h2 className="mt-3 text-4xl font-black text-slate-900">{chordSheet.title}</h2>
            <p className="mt-1 text-base font-medium text-slate-600">{chordSheet.artist}</p>
            {/* Botões abaixo do nome da música/cantor */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isAuthenticated && (
                <Link
                  to={`/cifras/${chordSheet.id}/editar`}
                  className="btn-outline text-xs px-4 py-2"
                >
                  ✏️ Editar Cifra
                </Link>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="btn-outline text-xs px-3 py-1.5"
                >
                  🔗 Compartilhar
                </button>
              )}
              {sheetHasTab && (
                <button
                  type="button"
                  onClick={toggleTab}
                  className={`btn-outline text-xs px-4 py-2 ${tabHidden ? "" : "bg-blue-50 border-blue-300 text-blue-700"}`}
                >
                  {tabHidden ? "📄 Mostrar Tablatura" : "🎸 Ocultar Tablatura"}
                </button>
              )}
            </div>
          </div>
          {/* YouTube Player no lugar do antigo botão "Editar Cifra" */}
          <div className="w-full sm:w-80 lg:w-96 shrink-0">
            <YouTubePlayer url={chordSheet.youtube_url} />
          </div>
        </div>

        {/* Navegação entre músicas do setlist */}
        {(hasPreviousSong || hasNextSong) && (
          <div className="mt-6 flex flex-wrap gap-2">
            {hasPreviousSong && previousSongHref && (
              <Link to={previousSongHref} className="btn-outline text-xs px-3 py-1.5">
                ← Música anterior
              </Link>
            )}
            {hasNextSong && nextSongHref && (
              <Link to={nextSongHref} className="btn-outline text-xs px-3 py-1.5">
                Próxima música →
              </Link>
            )}
          </div>
        )}
      </header>

      {/* ── Share Modal ── */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onShare={shareChordSheet}
        onUnshare={unshareChordSheet}
        fetchSharedUsers={fetchChordSheetSharedUsers}
        resourceId={Number(id)}
      />

      {/* ── Controls ── */}
      <div>
        <AutoScrollControls initialSpeed={currentScrollSpeed} onSpeedChange={setCurrentScrollSpeed} />
      </div>

      {/* ── Chord content ── */}
      <div className="panel p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
          {hasImages ? "Arquivos da Cifra" : "Cifra"}
        </h3>
        {hasImages ? (
          <div className="-mx-6 border-y border-slate-200 bg-slate-50">
            {images.map((image, index) => {
              const src = resolveChordSheetAsset(chordSheet, image);
              return isPdfAsset(image) ? (
                <PdfViewer
                  key={`${index}-${src.slice(0, 24)}`}
                  src={src}
                  title={`PDF da cifra ${index + 1} - ${chordSheet.title}`}
                />
              ) : (
                <img
                  key={`${index}-${src.slice(0, 24)}`}
                  src={src}
                  alt={`Imagem da cifra ${index + 1} - ${chordSheet.title}`}
                  className="block w-full h-auto select-none"
                />
              );
            })}
          </div>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-8 text-slate-800">
            {renderContent(chordSheet.content)}
          </pre>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Criado por:</span>{" "}
          {chordSheet.created_by_name || "Usuário"} · {Number(chordSheet.view_count || 0)} visualizações
        </div>
        {(hasPreviousSong || hasNextSong) && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {hasPreviousSong && previousSongHref && (
              <Link to={previousSongHref} className="btn-outline text-xs px-3 py-1.5">
                ← Música anterior
              </Link>
            )}
            {hasNextSong && nextSongHref && (
              <Link to={nextSongHref} className="btn-outline text-xs px-3 py-1.5">
                Próxima música →
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
