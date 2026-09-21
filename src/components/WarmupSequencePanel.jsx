import { describeDuration, describeWarmup } from "../utils/warmupSequence";

// Quanto maior o erro, mais escura fica a faixa: 1 semitom errado = verde claro
// (quase certo), 2–3 semitons = tons de ciano e 4+ semitons = azul escuro.
function errorColor(deviation) {
  const t = Math.min(1, Math.max(0, (deviation - 1) / 3)); // 1 semitom -> verde claro, 4+ -> azul escuro
  const start = { h: 142, s: 69, l: 73 }; // hsl do verde claro
  const end = { h: 225, s: 64, l: 33 }; // hsl do azul escuro
  const mix = (from, to) => Math.round(from + (to - from) * t);
  return `hsl(${mix(start.h, end.h)}, ${mix(start.s, end.s)}%, ${mix(start.l, end.l)}%)`;
}

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
            const matched = result?.kind === "match";
            const missed = result?.kind === "miss";
            const semitones = missed ? `${result.deviation.toFixed(1).replace(".", ",")} semitons` : "";
            const resultTitle = matched
              ? "Voz igual à nota tocada"
              : missed
                ? `Voz ${result.direction === "above" ? "acima" : "abaixo"} da nota tocada (${semitones})`
                : undefined;
            return (
              <li
                key={`${note.source}-${index}`}
                className={`warmup-note${index === currentIndex ? " is-current" : ""}${
                  note.rest ? " is-rest" : ""
                }${matched ? " is-match" : missed ? " is-miss" : ""}${
                  missed && result.direction === "above" ? " is-miss-above" : ""
                }${missed && result.direction === "below" ? " is-miss-below" : ""}`}
                style={
                  missed
                    ? {
                        [result.direction === "above" ? "borderTopColor" : "borderBottomColor"]: errorColor(
                          result.deviation
                        ),
                      }
                    : undefined
                }
                title={resultTitle}
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
