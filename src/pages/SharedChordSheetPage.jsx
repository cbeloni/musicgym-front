import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AutoScrollControls from "../components/AutoScrollControls";
import YouTubePlayer from "../components/YouTubePlayer";
import { fetchChordSheetByToken, recordChordSheetView } from "../services/api";

// Regex para identificar linhas de tablatura
const TAB_LINE_REGEX = /^[A-Z]\|/;

export default function SharedChordSheetPage() {
  const { shareToken } = useParams();
  const [chordSheet, setChordSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tabHidden, setTabHidden] = useState(true);
  const [currentScrollSpeed, setCurrentScrollSpeed] = useState(1);

  useEffect(() => {
    if (!shareToken) return;
    fetchChordSheetByToken(shareToken)
      .then((data) => {
        setChordSheet(data);
        const normalized = Number(
          Math.min(1.8, Math.max(0.2, Number(data?.scroll_speed ?? 1))).toFixed(1)
        );
        setCurrentScrollSpeed(normalized);
        recordChordSheetView(data.id)
          .then(() => {
            setChordSheet((prev) => ({ ...prev, view_count: Number(prev?.view_count || 0) + 1 }));
          })
          .catch(() => {});
        setLoading(false);
      })
      .catch(() => {
        setError("Cifra não encontrada");
        setLoading(false);
      });
  }, [shareToken]);

  const sheetHasTab = chordSheet && TAB_LINE_REGEX.test(chordSheet.content);
  const images = Array.isArray(chordSheet?.image_data) ? chordSheet.image_data : [];
  const hasImages = images.length > 0;

  const renderContent = (content) => {
    if (!tabHidden) return content;
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

  if (error || !chordSheet) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="panel p-12 text-center text-slate-500">{error || "Cifra não encontrada"}</div>
      </section>
    );
  }

  return (
    <article className="space-y-6 animate-fade-in pb-32">
      <header className="relative overflow-hidden panel p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <span className="label-section">Cifra Compartilhada</span>
            <h2 className="mt-3 text-4xl font-black text-slate-900">{chordSheet.title}</h2>
            <p className="mt-1 text-base font-medium text-slate-600">{chordSheet.artist}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sheetHasTab && (
                <button
                  type="button"
                  onClick={() => setTabHidden((prev) => !prev)}
                  className={`btn-outline text-xs px-4 py-2 ${tabHidden ? "" : "bg-blue-50 border-blue-300 text-blue-700"}`}
                >
                  {tabHidden ? "📄 Mostrar Tablatura" : "🎸 Ocultar Tablatura"}
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-80 lg:w-96 shrink-0">
            <YouTubePlayer url={chordSheet.youtube_url} />
          </div>
        </div>
      </header>

      <div>
        <AutoScrollControls initialSpeed={currentScrollSpeed} onSpeedChange={setCurrentScrollSpeed} />
      </div>

      <div className="panel p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
          {hasImages ? "Imagens da Cifra" : "Cifra"}
        </h3>
        {hasImages ? (
          <div className="-mx-6 border-y border-slate-200 bg-slate-50">
            {images.map((image, index) => (
              <img
                key={`${index}-${image.slice(0, 24)}`}
                src={image}
                alt={`Imagem da cifra ${index + 1} - ${chordSheet.title}`}
                className="block w-full h-auto select-none"
              />
            ))}
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
      </div>
    </article>
  );
}
