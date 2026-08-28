import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STEPS = 16;
const DEFAULT_BPM = 90;
const SOUND_BASE = "https://cifras.br-se1.magaluobjects.com/drum/";
const INSTRUMENTS = [
  ["foot", "Hi-hat (pedal)", "hihat-foot.mp3", "emerald"],
  ["tom", "Tom-tom", "tom1.mp3", "emerald"],
  ["floor", "Tom de chão", "floor-tom.mp3", "emerald"],
  ["ride", "Prato de condução", "ride.mp3", "emerald"],
  ["hat", "Hi-hat", "hihat.mp3", "amber"],
  ["snare", "Caixa", "snare-drum.mp3", "emerald"],
  ["kick", "Bumbo", "bass.mp3", "emerald"],
];
const DEFAULT_PATTERN = { foot: [], tom: [], floor: [], ride: [], hat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 8] };

const emptyPattern = () => Object.fromEntries(INSTRUMENTS.map(([id]) => [id, []]));

export function decodeDrumData(data) {
  if (!data) return { bpm: DEFAULT_BPM, pattern: DEFAULT_PATTERN };
  const [bpmPart, ...parts] = data.split("-");
  const bpm = Math.min(220, Math.max(40, Number(bpmPart) || DEFAULT_BPM));
  const encoded = parts.join("-").split("--").pop()?.split("-")[0] || "";
  const pattern = emptyPattern();
  const masks = encoded.includes(".") ? encoded.split(".") : [];
  if (masks.length === 7) INSTRUMENTS.forEach(([id], row) => {
    const mask = Number.parseInt(masks[row], 16) || 0;
    pattern[id] = Array.from({ length: STEPS }, (_, step) => step).filter((step) => mask & (1 << step));
  });
  return { bpm, pattern };
}

export function encodeDrumData(bpm, pattern) {
  return `${bpm}-n-44-a--${INSTRUMENTS.map(([id]) => pattern[id].reduce((value, step) => value | (1 << step), 0).toString(16).padStart(4, "0")).join(".")}-5q`;
}

export function drumMachineUrl(bpm, pattern) {
  return `${window.location.origin}/drum-machine?data=${encodeDrumData(bpm, pattern)}`;
}

function dataFromUrl(url) {
  try { return new URL(url, window.location.origin).searchParams.get("data"); } catch { return null; }
}

function clickSound(context, frequency) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.06);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.06);
}

function sampleSound(context, buffer) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.8;
  source.connect(gain).connect(context.destination);
  source.start();
}

export default function DrumMachineEditor({ initialUrl = "", syncUrl = false, onSave, readOnly = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceData = syncUrl ? searchParams.get("data") : dataFromUrl(initialUrl);
  const initial = useMemo(() => decodeDrumData(sourceData), [sourceData]);
  const [bpm, setBpm] = useState(initial.bpm);
  const [bpmInput, setBpmInput] = useState(String(initial.bpm));
  const [pattern, setPattern] = useState(initial.pattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempoPaused, setTempoPaused] = useState(false);
  const [step, setStep] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const context = useRef(null);
  const buffers = useRef({});
  const promises = useRef({});
  const timer = useRef(null);
  const resumeTimer = useRef(null);
  const playbackStep = useRef(0);
  const patternRef = useRef(pattern);

  useEffect(() => { setBpm(initial.bpm); setBpmInput(String(initial.bpm)); setPattern(initial.pattern); }, [initial]);
  useEffect(() => { patternRef.current = pattern; }, [pattern]);

  const loadSound = (id, file) => {
    if (buffers.current[id] || promises.current[id]) return;
    promises.current[id] = fetch(`${SOUND_BASE}${file}`).then((response) => response.arrayBuffer())
      .then((data) => context.current.decodeAudioData(data)).then((buffer) => { buffers.current[id] = buffer; })
      .catch(() => {});
  };

  useEffect(() => {
    context.current ||= new (window.AudioContext || window.webkitAudioContext)();
    INSTRUMENTS.forEach(([id, , file]) => loadSound(id, file));
  }, []);

  useEffect(() => {
    if (!syncUrl) return;
    const next = new URLSearchParams(searchParams);
    next.set("data", encodeDrumData(bpm, pattern));
    if (next.get("data") !== searchParams.get("data")) setSearchParams(next, { replace: true });
  }, [bpm, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPlaying || tempoPaused) { clearInterval(timer.current); return undefined; }
    const tick = () => {
      const current = playbackStep.current;
      setStep(current);
      INSTRUMENTS.forEach(([id], index) => {
        if (patternRef.current[id].includes(current)) buffers.current[id] ? sampleSound(context.current, buffers.current[id]) : clickSound(context.current, index === 6 ? 90 : 420 + index * 70);
      });
      playbackStep.current = (current + 1) % STEPS;
    };
    clearInterval(timer.current); tick();
    timer.current = setInterval(tick, (60 / bpm / 4) * 1000);
    return () => clearInterval(timer.current);
  }, [bpm, isPlaying, tempoPaused]);

  useEffect(() => () => { clearInterval(timer.current); clearTimeout(resumeTimer.current); }, []);

  const updateBpm = (value) => {
    setBpm(value);
    setBpmInput(String(value));
    if (isPlaying) { clearTimeout(resumeTimer.current); setTempoPaused(true); resumeTimer.current = setTimeout(() => setTempoPaused(false), 1000); }
  };
  const commitBpmInput = () => {
    const value = Number(bpmInput);
    updateBpm(Math.min(220, Math.max(40, Number.isFinite(value) && value > 0 ? value : DEFAULT_BPM)));
  };
  const togglePlay = () => {
    if (isPlaying) { clearTimeout(resumeTimer.current); setTempoPaused(false); setIsPlaying(false); setStep(-1); return; }
    if (context.current.state === "suspended") context.current.resume();
    playbackStep.current = 0; setTempoPaused(false); setIsPlaying(true);
  };
  const toggleCell = (id, cell) => {
    if (readOnly) return;
    setPattern((current) => ({ ...current, [id]: current[id].includes(cell) ? current[id].filter((value) => value !== cell) : [...current[id], cell].sort((a, b) => a - b) }));
    setSaved(false);
  };
  const copyLink = async () => { await navigator.clipboard.writeText(drumMachineUrl(bpm, pattern)); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const save = () => { onSave?.(drumMachineUrl(bpm, pattern)); setSaved(true); };

  return <div className="drum-machine-editor">
    <div className="drum-toolbar panel">
      <button type="button" className="drum-play-button" onClick={togglePlay}>{isPlaying ? "■" : "▶"}</button>
      <label className="tempo-control"><span>BPM</span><input type="number" min="40" max="220" value={bpmInput} disabled={readOnly} onChange={(event) => setBpmInput(event.target.value)} onBlur={commitBpmInput} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitBpmInput(); event.currentTarget.blur(); } }} /></label>
      <button type="button" className="drum-tool-button" disabled={readOnly} onClick={() => updateBpm(DEFAULT_BPM)}>Tempo padrão</button>
      <button type="button" className="drum-tool-button" disabled={readOnly} onClick={() => { setPattern(emptyPattern()); setSaved(false); }}>Limpar</button>
      <button type="button" className="drum-tool-button" onClick={copyLink}>{copied ? "Link copiado" : "Compartilhar link"}</button>
      {onSave && !readOnly && <button type="button" className="btn-primary drum-save-button" onClick={save}>{saved ? "Batida salva" : "Salvar batida"}</button>}
    </div>
    <div className="drum-grid panel" role="grid" aria-label="Grade da bateria">
      <div className="drum-grid-corner">Instrumentos</div>
      {Array.from({ length: STEPS }, (_, index) => <div className={`drum-step-number ${index % 4 === 0 ? "beat-mark" : ""}`} key={`n-${index}`}>{index % 4 === 0 ? index / 4 + 1 : ""}</div>)}
      {INSTRUMENTS.map(([id, label, , color]) => <div className="drum-row" key={id}><div className="drum-instrument-label">{label}</div>{Array.from({ length: STEPS }, (_, index) => <button type="button" role="gridcell" aria-label={`${label}, passo ${index + 1}`} aria-pressed={pattern[id].includes(index)} disabled={readOnly} key={`${id}-${index}`} onClick={() => toggleCell(id, index)} className={`drum-cell ${pattern[id].includes(index) ? `is-active ${color}` : ""} ${step === index ? "is-current" : ""}`} />)}</div>)}
    </div>
  </div>;
}
