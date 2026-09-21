import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PIANO_KEYS,
  PIANO_KEY_BY_MIDI,
  PIANO_MIDI_BY_SHORTCUT,
  PIANO_ROWS,
  noteNameFromMidi,
} from "../config/pianoKeyboard";
import { pianoSampleUrl } from "../config/sounds";
import { VIRTUAL_PIANO_AI_INSTRUCTION } from "../config/aiInstructions";
import { centsFromNote, detectPitch, frequencyToMidi, median } from "../utils/pitchDetection";
import { durationMs, encodeWarmupParam, parseWarmupParam } from "../utils/warmupSequence";
import AiInstructionButton from "./AiInstructionButton";
import WarmupSequencePanel from "./WarmupSequencePanel";

const WHITE_KEYS = PIANO_KEYS.filter((key) => key.isWhite);
const BLACK_KEYS = PIANO_KEYS.filter((key) => !key.isWhite);
const PRELOAD_BATCH = 6;
const PRELOAD_INTERVAL = 140;
const ANALYSIS_INTERVAL = 70; // ~14 análises por segundo
const VOICE_TIMEOUT = 400; // tempo sem voz para limpar a nota detectada
const ESTIMATES_WINDOW = 6; // amostras usadas na mediana do pitch

function formatShortcut(shortcut) {
  return shortcut === " " ? "␣" : shortcut;
}

export default function VirtualPiano({ onSave, saveLabel, toolbarExtra }) {
  const [searchParams] = useSearchParams();
  const [activeNotes, setActiveNotes] = useState(() => new Set());
  const [volume, setVolume] = useState(0.85);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [samplesSettled, setSamplesSettled] = useState(false);
  const [lastNote, setLastNote] = useState("");
  const [lastPlayedMidi, setLastPlayedMidi] = useState(null);
  const [listening, setListening] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState("");
  const [voice, setVoice] = useState(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sequenceIndex, setSequenceIndex] = useState(-1);
  const [sequenceResults, setSequenceResults] = useState([]);
  const [loopSequence, setLoopSequence] = useState(false);
  const audiosRef = useRef(new Map());
  const loadedSamplesRef = useRef(new Set());
  const volumeRef = useRef(0.85);
  const pointerNotesRef = useRef(new Map());
  const keyboardNotesRef = useRef(new Map());
  const activeNotesRef = useRef(activeNotes);
  const micRef = useRef(null);
  const levelRef = useRef(null);
  const fadeTimersRef = useRef(new Map());
  const sequenceTimerRef = useRef(null);
  const sequenceActiveRef = useRef([]);
  const sequenceResultsRef = useRef([]);
  const voiceRef = useRef(null);
  const loopRef = useRef(false);

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

  useEffect(
    () => () => {
      fadeTimersRef.current.forEach((timer) => window.clearInterval(timer));
      fadeTimersRef.current.clear();
      audiosRef.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audiosRef.current.clear();
    },
    []
  );

  useEffect(() => {
    volumeRef.current = volume;
    audiosRef.current.forEach((audio) => {
      audio.volume = volume;
    });
  }, [volume]);

  // A nota soa enquanto a tecla estiver pressionada. Ao soltar, o som é
  // interrompido com um fade curto para não estalar (como o abafador do piano).
  const stopAudio = useCallback((midi, fade = 90) => {
    const audio = audiosRef.current.get(midi);
    if (!audio || audio.paused) return;

    const pending = fadeTimersRef.current.get(midi);
    if (pending) window.clearInterval(pending);

    const startVolume = audio.volume || volumeRef.current;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= fade) {
        window.clearInterval(timer);
        fadeTimersRef.current.delete(midi);
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          /* amostra ainda carregando */
        }
        audio.volume = volumeRef.current;
        return;
      }
      audio.volume = startVolume * (1 - elapsed / fade);
    }, 16);
    fadeTimersRef.current.set(midi, timer);
  }, []);

  const playNote = useCallback(
    (midi) => {
      const key = PIANO_KEY_BY_MIDI.get(midi);
      if (!key) return;

      const audio = getAudio(midi);
      if (audio) {
        // Cancela um fade em andamento caso a nota seja repetida.
        const pending = fadeTimersRef.current.get(midi);
        if (pending) {
          window.clearInterval(pending);
          fadeTimersRef.current.delete(midi);
        }
        audio.volume = volumeRef.current;
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
      setLastPlayedMidi(midi);
      setActiveNotes((current) => {
        if (current.has(midi)) return current;
        const next = new Set(current);
        next.add(midi);
        return next;
      });
    },
    [getAudio]
  );

  const releaseNote = useCallback(
    (midi) => {
      stopAudio(midi);
      setActiveNotes((current) => {
        if (!current.has(midi)) return current;
        const next = new Set(current);
        next.delete(midi);
        return next;
      });
    },
    [stopAudio]
  );

  const releaseAll = useCallback(() => {
    pointerNotesRef.current.clear();
    keyboardNotesRef.current.clear();
    audiosRef.current.forEach((audio, midi) => stopAudio(midi, 60));
    setActiveNotes((current) => (current.size === 0 ? current : new Set()));
  }, [stopAudio]);

  const teardownMic = useCallback(() => {
    const state = micRef.current;
    micRef.current = null;
    if (!state) return;
    if (state.timer) window.clearInterval(state.timer);
    state.stream?.getTracks().forEach((track) => track.stop());
    state.context?.close().catch(() => {});
  }, []);

  const stopWarmup = useCallback(() => {
    teardownMic();
    if (levelRef.current) levelRef.current.style.transform = "scaleX(0)";
    setListening(false);
    setVoice(null);
  }, [teardownMic]);

  // Aquecimento: liga o microfone, identifica a nota cantada e destaca a tecla.
  const startWarmup = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("O microfone exige uma conexão segura (HTTPS) ou localhost.");
      return;
    }

    setMicBusy(true);
    setMicError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      await context.resume();

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);

      const state = {
        stream,
        context,
        analyser,
        buffer: new Float32Array(analyser.fftSize),
        estimates: [],
        timer: null,
        lastVoice: 0,
        lastPush: 0,
        current: null,
      };
      micRef.current = state;
      setListening(true);

      const runAnalysis = () => {
        const active = micRef.current;
        if (!active) return;

        const now = performance.now();

        active.analyser.getFloatTimeDomainData(active.buffer);
        const result = detectPitch(active.buffer, active.context.sampleRate);

        if (levelRef.current) {
          levelRef.current.style.transform = `scaleX(${Math.min(1, result.level * 12).toFixed(3)})`;
        }

        if (!result.frequency) {
          if (active.current && now - active.lastVoice > VOICE_TIMEOUT) {
            active.current = null;
            active.estimates.length = 0;
            setVoice(null);
          }
          return;
        }

        active.lastVoice = now;
        active.estimates.push(result.frequency);
        if (active.estimates.length > ESTIMATES_WINDOW) active.estimates.shift();

        // Leituras muito distantes indicam troca de nota: encolhe a janela para
        // acompanhar a nova nota sem esperar o filtro estabilizar.
        const spread =
          Math.max(...active.estimates) / Math.min(...active.estimates);
        if (spread > 1.12) active.estimates = active.estimates.slice(-2);

        const frequency = median(active.estimates);
        const midi = frequencyToMidi(frequency);
        const key = PIANO_KEY_BY_MIDI.get(midi);
        const changed = active.current?.midi !== midi;

        if (changed || now - active.lastPush > 150) {
          active.lastPush = now;
          active.current = {
            midi,
            note: key?.note || noteNameFromMidi(midi),
            inRange: Boolean(key),
            frequency,
            cents: centsFromNote(frequency, midi),
            clarity: result.clarity,
          };
          setVoice(active.current);
        }
      };

      state.timer = window.setInterval(runAnalysis, ANALYSIS_INTERVAL);
      runAnalysis();
    } catch (error) {
      setMicError(
        error?.name === "NotAllowedError"
          ? "Permissão de microfone negada. Autorize o acesso para usar o aquecimento."
          : "Não foi possível acessar o microfone."
      );
      stopWarmup();
    } finally {
      setMicBusy(false);
    }
  }, [stopWarmup]);

  const toggleWarmup = () => {
    if (listening) stopWarmup();
    else startWarmup();
  };

  useEffect(() => () => teardownMic(), [teardownMic]);

  // Sequência de aquecimento recebida pelo parâmetro ?aquecimento= da URL.
  const warmupParam =
    searchParams.get("aquecimento") ?? searchParams.get("warmup") ?? searchParams.get("data") ?? "";
  const warmup = useMemo(() => parseWarmupParam(warmupParam), [warmupParam]);

  useEffect(() => {
    loopRef.current = loopSequence;
  }, [loopSequence]);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Limpa as marcações de acerto/erro (chamado ao (re)iniciar a sequência).
  const clearSequenceResults = useCallback(() => {
    sequenceResultsRef.current = [];
    setSequenceResults([]);
  }, []);

  // Marca o passo atual em verde assim que a voz confere com a nota tocada.
  useEffect(() => {
    if (!isPlayingSequence || sequenceIndex < 0 || !voice?.inRange) return;
    const note = warmup.notes[sequenceIndex];
    if (!note || note.rest || !note.midis.includes(voice.midi)) return;
    setSequenceResults((current) => {
      if (current[sequenceIndex] === "match") return current;
      const next = [...current];
      next[sequenceIndex] = "match";
      sequenceResultsRef.current = next;
      return next;
    });
  }, [voice, isPlayingSequence, sequenceIndex, warmup]);

  const stopSequence = useCallback(() => {
    window.clearTimeout(sequenceTimerRef.current);
    sequenceTimerRef.current = null;
    sequenceActiveRef.current.forEach((midi) => releaseNote(midi));
    sequenceActiveRef.current = [];
    setIsPlayingSequence(false);
    setSequenceIndex(-1);
  }, [releaseNote]);

  const startSequence = useCallback(() => {
    const notes = warmup.notes;
    if (!notes.length) return;

    window.clearTimeout(sequenceTimerRef.current);
    setIsPlayingSequence(true);
    clearSequenceResults();
    let index = 0;

    const writeResult = (stepIndex, value) => {
      const next = [...sequenceResultsRef.current];
      next[stepIndex] = value;
      sequenceResultsRef.current = next;
      setSequenceResults(next);
    };

    // Ao fim de cada passo compara a última nota ouvida com a nota tocada.
    const finishStep = (stepIndex) => {
      const note = notes[stepIndex];
      if (!note || note.rest) return;
      if (sequenceResultsRef.current[stepIndex] === "match") return; // já acertou
      const heard = voiceRef.current;
      if (!heard?.inRange) return; // ninguém cantou: fica sem marcação
      writeResult(stepIndex, note.midis.includes(heard.midi) ? "match" : "miss");
    };

    const step = () => {
      if (index >= notes.length) {
        if (!loopRef.current) {
          stopSequence();
          return;
        }
        index = 0;
        clearSequenceResults(); // repetição: limpa as cores
      }

      const note = notes[index];
      const current = index;
      setSequenceIndex(current);

      // Solta as notas anteriores para as teclas não ficarem marcadas depois de soar.
      sequenceActiveRef.current.forEach((midi) => releaseNote(midi));
      sequenceActiveRef.current = [];
      if (!note.rest) {
        note.midis.forEach((midi) => playNote(midi));
        sequenceActiveRef.current = [...note.midis];
      }

      index += 1;
      sequenceTimerRef.current = window.setTimeout(() => {
        finishStep(current);
        step();
      }, durationMs(note.duration, warmup.bpm));
    };

    step();
  }, [warmup, playNote, releaseNote, stopSequence, clearSequenceResults]);

  const toggleSequence = () => {
    if (isPlayingSequence) stopSequence();
    else startSequence();
  };

  useEffect(() => () => window.clearTimeout(sequenceTimerRef.current), []);

  // O aviso de carregamento aparece só nos primeiros segundos: se alguma amostra
  // demorar, o piano continua utilizável sem ficar exibindo o contador.
  useEffect(() => {
    const timer = window.setTimeout(() => setSamplesSettled(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  // Reinicia a reprodução quando a sequência do parâmetro muda.
  useEffect(() => {
    stopSequence();
  }, [warmupParam, stopSequence]);

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

  const detectedMidi = voice?.inRange ? voice.midi : null;
  // Com o aquecimento ligado a última tecla tocada fica sempre marcada.
  const lastPlayedKey = listening ? lastPlayedMidi : null;
  // Notas da sequência de aquecimento em reprodução (um acorde pode ter várias).
  const currentSequenceNote = isPlayingSequence ? warmup.notes[sequenceIndex] : null;
  const sequenceMidis = useMemo(
    () => new Set(currentSequenceNote && !currentSequenceNote.rest ? currentSequenceNote.midis : []),
    [currentSequenceNote]
  );

  const keyProps = (key) => ({
    type: "button",
    className: `piano-key ${key.isWhite ? "piano-key-white" : "piano-key-black"}${
      activeNotes.has(key.midi) || sequenceMidis.has(key.midi) ? " is-active" : ""
    }${detectedMidi === key.midi ? " is-detected" : ""}${
      lastPlayedKey === key.midi ? " is-last-played" : ""
    }`,
    style: { left: `${key.left}%`, width: `${key.width}%` },
    onPointerDown: (event) => handlePointerDown(event, key.midi),
    onPointerEnter: (event) => handlePointerEnter(event, key.midi),
    onContextMenu: (event) => event.preventDefault(),
    "aria-label": `Nota ${key.note}${key.shortcut ? `, atalho ${key.shortcut}` : ""}${
      detectedMidi === key.midi ? ", nota detectada no microfone" : ""
    }${lastPlayedKey === key.midi ? ", última tecla tocada" : ""}`,
  });

  const loadProgress = useMemo(() => `${loadedCount}/${PIANO_KEYS.length}`, [loadedCount]);

  return (
    <div className="piano-card panel">
      <div className="piano-toolbar">
        <div className="piano-readout">
          <span className="label-section">Nota tocada</span>
          <strong className={lastNote ? "" : "is-muted"}>{lastNote || "—"}</strong>
        </div>

        <div className="piano-readout piano-readout-voice">
          <span className="label-section">Voz</span>
          <span className="piano-voice-line">
            <strong className={voice ? "is-voice" : "is-muted"}>{voice?.note || "—"}</strong>
            <span className="piano-voice-detail">
              {voice
                ? `${voice.frequency.toFixed(1)} Hz · ${voice.cents > 0 ? "+" : ""}${voice.cents} ¢${
                    voice.inRange ? "" : " · fora"
                  }`
                : listening
                  ? "ouvindo…"
                  : "desligado"}
            </span>
          </span>
          <span className="piano-level" aria-hidden="true">
            <i ref={levelRef} />
          </span>
        </div>

        <div className="piano-toolbar-row">
          <div className="piano-controls">
            <label className="piano-volume">
              <svg className="piano-volume-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
                <path
                  d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                title="Volume"
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
            <button
              type="button"
              className={`piano-warmup${listening ? " is-on" : ""}`}
              aria-pressed={listening}
              disabled={micBusy}
              onClick={toggleWarmup}
              aria-label={listening ? "Desligar o aquecimento com microfone" : "Ativar o aquecimento com microfone"}
            >
              <span className="piano-warmup-dot" aria-hidden="true" />
              Aquecimento
            </button>
            <AiInstructionButton className="piano-toggle" instruction={VIRTUAL_PIANO_AI_INSTRUCTION} />
          </div>

          {toolbarExtra}
        </div>

        {micError && <p className="piano-mic-error">{micError}</p>}
      </div>

      <WarmupSequencePanel
        warmup={warmup}
        isPlaying={isPlayingSequence}
        currentIndex={sequenceIndex}
        results={sequenceResults}
        loop={loopSequence}
        onToggleLoop={() => setLoopSequence((value) => !value)}
        onTogglePlay={toggleSequence}
        onSave={onSave ? () => onSave(encodeWarmupParam(warmup)) : undefined}
        saveLabel={saveLabel}
      />

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

      <p className="piano-hint">
        Toque com o mouse ou use o teclado do computador: <kbd>Shift</kbd> + tecla branca aciona o
        sustenido.
        {!samplesSettled && loadedCount < PIANO_KEYS.length && <> Amostras carregadas: {loadProgress}.</>}
      </p>

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
