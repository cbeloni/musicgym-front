import ReactPlayer from "react-player";

/**
 * Player do YouTube da cifra.
 *
 * - `bare`: renderiza apenas o player, sem o painel externo. Usado quando o
 *   player é embutido no `ChordSheetMediaPlayer` (que já tem painel/abas).
 */
export default function YouTubePlayer({ url, bare = false }) {
  if (!url) {
    if (bare) return null;
    return <p className="panel p-4 text-sm text-black/65">Nenhum video vinculado para esta cifra.</p>;
  }

  const player = (
    <div className="aspect-video w-full rounded-xl">
      <ReactPlayer url={url} controls width="100%" height="100%" />
    </div>
  );

  if (bare) {
    return player;
  }

  return <div className="panel mb-5 overflow-hidden p-2">{player}</div>;
}
