import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PIANO_KEYS, PIANO_KEY_BY_MIDI, PIANO_MIDI_BY_SHORTCUT, PIANO_ROWS } from "../config/pianoKeyboard";
import { pianoSampleUrl } from "../config/sounds";

const WHITE_KEYS = PIANO_KEYS.filter((key) => key.isWhite);
const BLACK_KEYS = PIANO_KEYS.filter((key) => !key.isWhite);
const PRELOAD_BATCH = 6;
const PRELOAD_INTERVAL = 140;

function formatShortcut(shortcut) {
  return shortcut === " " ? "␣" : shortcut;
}

export default function VirtualPiano() {
  const [activeNotes, setActiveNotes] = useState(() => new Set());
  const [volume, setVolume] = useState(0.85);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [lastNote, setLastNote] = useState("");
  const audiosRef = useRef(new Map());
  const loadedSamplesRef = useRef(new Set());
  const volumeRef = useRef(0.85);
  const pointerNotesRef = useRef(new Map());
  const keyboardNotesRef = useRef(new Map());
  const activeNotesRef = useRef(activeNotes);

  useEffect(() => {
    activeNotesRef.current = activeNotes;
  }, [activeNotes]);

  const getAudio = useCallback((midi) => {
    const cached = audiosRef.current.get(midi);
    if (cached) return cached;

    const key = PIANO_KEY_BY_MIDI.get(midi);
    if (!key?.file) return null;

    const audio = new Audio();
    audio.src = pianoSampleUrl(key.file);
    audio.preload = "auto";
    audio.volume = volumeRef.current;

    const markLoaded = () => {
      loadedSamplesRef.current.add(midi);
      setLoadedCount(loadedSamplesRef.current.size);
    };

    audio.addEventListener("canplaythrough", markLoaded, { once: true });
    audio.addEventListener("error", markLoaded, { once: true });
    audio.load();
    audiosRef.current.set(midi, audio);
    return audio;
  }, []);

  // Carrega as amostras em pequenos lotes para não travar a primeira interação.
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let index = 0;

    const step = () => {
      if (cancelled) return;
      PIANO_KEYS.slice(index, index + PRELOAD_BATCH).forEach((key) => getAudio(key.midi));
      index += PRELOAD_BATCH;
      if (index < PIANO_KEYS.length) timer = window.setTimeout(step, PRELOAD_INTERVAL);
    };

    step();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [getAudio]);

  useEffect(() => () => {
    audiosRef.current.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });
    audiosRef.current.clear();
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    audiosRef.current.forEach((audio) => {
      audio.volume = volume;
    });
  }, [volume]);

  const playNote = useCallback(
    (midi) => {
      const key = PIANO_KEY_BY_MIDI.get(midi);
      if (!key) return;

      const audio = getAudio(midi);
      if (audio) {
        if (audio.readyState > 0) {
          try {
            audio.currentTime = 0;
          } catch {
            /* amostra ainda carregando: toca a partir do início natural */
          }
        }
        const playback = audio.play();
        if (playback && typeof playback.catch === "function") playback.catch(() => {});
      }

      setLastNote(key.note);
      setActiveNotes((current) => {
        if (current.has(midi)) return current;
        const next = new Set(current);
        next.add(midi);
        return next;
      });
    },
    [getAudio]
  );

  const releaseNote = useCallback((midi) => {
    setActiveNotes((current) => {
      if (!current.has(midi)) return current;
      const next = new Set(current);
      next.delete(midi);
      return next;
    });
  }, []);

  const releaseAll = useCallback(() => {
    pointerNotesRef.current.clear();
    keyboardNotesRef.current.clear();
    setActiveNotes((current) => (current.size === 0 ? current : new Set()));
  }, []);

  // Atalhos de teclado. O controle é feito por `event.code` para que soltar o
  // Shift antes da tecla não deixe a nota presa.
  useEffect(() => {
    const isTypingTarget = (target) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    const handleKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const midi = PIANO_MIDI_BY_SHORTCUT.get(event.key);
      if (midi === undefined) return;
      event.preventDefault();
      keyboardNotesRef.current.set(event.code, midi);
      playNote(midi);
    };

    const handleKeyUp = (event) => {
      const midi = keyboardNotesRef.current.get(event.code);
      if (midi === undefined) return;
      keyboardNotesRef.current.delete(event.code);
      releaseNote(midi);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [playNote, releaseNote, releaseAll]);

  // Libera as notas ao soltar o clique/toque em qualquer lugar da página.
  useEffect(() => {
    const handlePointerRelease = (event) => {
      const midi = pointerNotesRef.current.get(event.pointerId);
      if (midi === undefined) return;
      pointerNotesRef.current.delete(event.pointerId);
      releaseNote(midi);
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);
    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [releaseNote]);

  const handlePointerDown = (event, midi) => {
    event.preventDefault();
    pointerNotesRef.current.set(event.pointerId, midi);
    playNote(midi);
  };

  const handlePointerEnter = (event, midi) => {
    if (event.buttons === 0) return; // arrastando o mouse sobre as teclas
    const current = pointerNotesRef.current.get(event.pointerId);
    if (current === midi) return;
    if (current !== undefined) releaseNote(current);
    pointerNotesRef.current.set(event.pointerId, midi);
    playNote(midi);
  };

  const keyProps = (key) => ({
    type: "button",
    className: `piano-key ${key.isWhite ? "piano-key-white" : "piano-key-black"}${
      activeNotes.has(key.midi) ? " is-active" : ""
    }`,
    style: { left: `${key.left}%`, width: `${key.width}%` },
    onPointerDown: (event) => handlePointerDown(event, key.midi),
    onPointerEnter: (event) => handlePointerEnter(event, key.midi),
    onContextMenu: (event) => event.preventDefault(),
    "aria-label": `Nota ${key.note}${key.shortcut ? `, atalho ${key.shortcut}` : ""}`,
  });

  const loadProgress = useMemo(
    () => `${loadedCount}/${PIANO_KEYS.length}`,
    [loadedCount]
  );

  return (
    <div className="piano-card panel">
      <div className="piano-toolbar">
        <div className="piano-readout">
          <span className="label-section">Nota tocada</span>
          <strong className={lastNote ? "" : "is-muted"}>{lastNote || "—"}</strong>
        </div>

        <div className="piano-controls">
          <label className="piano-volume">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              aria-label="Volume do piano"
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className={`piano-toggle${showShortcuts ? " is-on" : ""}`}
            aria-pressed={showShortcuts}
            onClick={() => setShowShortcuts((value) => !value)}
          >
            Atalhos
          </button>
          <button
            type="button"
            className={`piano-toggle${showNotes ? " is-on" : ""}`}
            aria-pressed={showNotes}
            onClick={() => setShowNotes((value) => !value)}
          >
            Notas
          </button>
        </div>

        <p className="piano-hint">
          Toque com o mouse ou use o teclado do computador: <kbd>Shift</kbd> + tecla branca aciona o
          sustenido. Amostras carregadas: {loadProgress}.
        </p>
      </div>

      <div className="piano-stage">
        <div className="piano-keyboard" role="group" aria-label="Teclado do piano virtual de C2 a C7">
          {WHITE_KEYS.map((key) => (
            <button key={key.midi} {...keyProps(key)}>
              {showShortcuts && <span className="piano-key-shortcut">{formatShortcut(key.shortcut)}</span>}
              {showNotes && <span className="piano-key-note">{key.note}</span>}
            </button>
          ))}
          {BLACK_KEYS.map((key) => (
            <button key={key.midi} {...keyProps(key)}>
              {showShortcuts && <span className="piano-key-shortcut">{formatShortcut(key.shortcut)}</span>}
              {showNotes && <span className="piano-key-note">{key.note}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="piano-legend" aria-label="Mapa de atalhos do teclado">
        <p className="label-section">Mapa de atalhos</p>
        {PIANO_ROWS.map((row) => (
          <div className="piano-legend-row" key={row.id}>
            <span className="piano-legend-keys">{row.label}</span>
            <span className="piano-legend-range">
              {row.firstNote} → {row.lastNote}
            </span>
            <span className="piano-legend-sharps">
              sustenidos: <strong>{row.sharps.map(formatShortcut).join(" ")}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
