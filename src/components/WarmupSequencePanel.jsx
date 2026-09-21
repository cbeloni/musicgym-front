import { describeDuration, describeWarmup } from "../utils/warmupSequence";

export default function WarmupSequencePanel({
  warmup,
  isPlaying,
  currentIndex,
  results = [],
  loop,
  onToggleLoop,
  onTogglePlay,
  onSave,
  saveLabel = "Salvar aquecimento",
}) {
  const { notes, bpm, timeSignature, invalid } = warmup;
  const hasNotes = notes.length > 0;
  const summary = describeWarmup(warmup);

  return (
    <section className="warmup-panel" aria-label="Sequência de aquecimento">
      <div className="warmup-head">
        <div className="warmup-info">
          <span className="label-section">Sequência de aquecimento</span>
          <strong>{hasNotes ? summary.label : "nenhuma nota no parâmetro"}</strong>
        </div>

        <div className="warmup-tags">
          <span className="badge">{bpm} BPM</span>
          <span className="badge">{timeSignature}</span>
        </div>

        <div className="warmup-actions">
          <button
            type="button"
            className={`piano-toggle${loop ? " is-on" : ""}`}
            aria-pressed={loop}
            onClick={onToggleLoop}
          >
            Repetir
          </button>
          <button
            type="button"
            className="btn-primary warmup-play"
            disabled={!hasNotes}
            onClick={onTogglePlay}
          >
            {isPlaying ? "■ Parar" : "▶ Tocar"}
          </button>
          {onSave && (
            <button type="button" className="btn-outline warmup-save" disabled={!hasNotes} onClick={onSave}>
              {saveLabel}
            </button>
          )}
        </div>
      </div>

      {hasNotes ? (
        <ol className="warmup-notes">
          {notes.map((note, index) => {
            const duration = describeDuration(note.duration);
            const result = results[index];
            return (
              <li
                key={`${note.source}-${index}`}
                className={`warmup-note${index === currentIndex ? " is-current" : ""}${
                  note.rest ? " is-rest" : ""
                }${result === "match" ? " is-match" : result === "miss" ? " is-miss" : ""}`}
                title={result === "match" ? "Voz igual à nota tocada" : result === "miss" ? "Voz diferente da nota tocada" : undefined}
              >
                <span className="warmup-note-pitch">{note.rest ? "—" : note.pitches.join("+")}</span>
                <span className="warmup-note-duration" title={duration.name}>
                  {duration.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="warmup-empty">
          Informe as notas no parâmetro <code>aquecimento</code> da URL, separando cada nota por
          <code>;</code> ou <code>,</code> e usando as figuras padrão da música (1, 1/2, 1/4, 1/8,
          1/16 e 1/32, com <code>.</code> para pontuada). Exemplo:{" "}
          <code>?aquecimento=bpm=96;C4:1/4;D4:1/8;E4:1/2</code> — o <code>-</code> toca uma pausa.
        </p>
      )}

      {invalid.length > 0 && (
        <p className="warmup-invalid">
          Ignorado(s) no parâmetro: {invalid.map((token) => `“${token}”`).join(", ")}
        </p>
      )}
    </section>
  );
}
