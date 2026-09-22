import { useState } from "react";
import YouTubePlayer from "./YouTubePlayer";
import { resolveChordSheetAudio } from "../services/api";

const MEDIA_TABS = [
  { id: "youtube", label: "Vídeo", icon: "▶" },
  { id: "audio", label: "Áudio", icon: "🎵" }
];

/**
 * Player da mídia da cifra, exibido no mesmo local do vídeo do YouTube.
 *
 * - Apenas vídeo ou apenas áudio: mostra a mídia direto.
 * - Vídeo e áudio: mostra abas para alternar entre um e outro.
 */
export default function ChordSheetMediaPlayer({ chordSheet }) {
  const [selectedTab, setSelectedTab] = useState(null);

  const youtubeUrl = chordSheet?.youtube_url || "";
  const audioUrl = resolveChordSheetAudio(chordSheet);
  const hasYoutube = Boolean(youtubeUrl);
  const hasAudio = Boolean(audioUrl);
  const hasBoth = hasYoutube && hasAudio;
  // Sem escolha do usuário o vídeo tem prioridade (comportamento anterior).
  const activeTab = hasYoutube ? (hasBoth ? selectedTab ?? "youtube" : "youtube") : "audio";

  if (!hasYoutube && !hasAudio) {
    return (
      <p className="panel p-4 text-sm text-black/65">
        Nenhum vídeo ou áudio vinculado para esta cifra.
      </p>
    );
  }

  return (
    <div className="panel mb-5 overflow-hidden p-2">
      {hasBoth && (
        <div className="media-tabs" role="tablist" aria-label="Mídia da cifra">
          {MEDIA_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`media-tab ${activeTab === tab.id ? "is-active" : ""}`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "youtube" ? (
        <YouTubePlayer url={youtubeUrl} bare />
      ) : (
        <div className="media-audio">
          <audio src={audioUrl} controls preload="metadata" className="w-full">
            Seu navegador não suporta a reprodução deste áudio.
          </audio>
          <span className="media-audio-label">Áudio da cifra</span>
        </div>
      )}
    </div>
  );
}
