import { useEffect, useRef, useState } from "react";
import { decodeDrumData } from "./DrumMachineEditor";

const SOUND_BASE = "https://cifras.br-se1.magaluobjects.com/drum/";
const SOUNDS = [
  ["foot", "hihat-foot.mp3", 500],
  ["tom", "tom1.mp3", 360],
  ["floor", "floor-tom.mp3", 280],
  ["ride", "ride.mp3", 620],
  ["hat", "hihat.mp3", 500],
  ["snare", "snare-drum.mp3", 180],
  ["kick", "bass.mp3", 90],
];

function playClick(context, frequency) {
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

function playSample(context, buffer) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.8;
  source.connect(gain).connect(context.destination);
  source.start();
}

export default function DrumMachinePlayer({ drumMachineUrl, playRequest = 0, stopRequest = 0, onPlayingChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const { bpm, pattern } = decodeDrumData(new URL(drumMachineUrl).searchParams.get("data"));
  const context = useRef(null);
  const buffers = useRef({});
  const timer = useRef(null);
  const stepRef = useRef(0);
  const patternRef = useRef(pattern);

  useEffect(() => { patternRef.current = pattern; }, [pattern]);

  useEffect(() => {
    context.current ||= new (window.AudioContext || window.webkitAudioContext)();
    SOUNDS.forEach(([id, file]) => {
      fetch(`${SOUND_BASE}${file}`)
        .then((response) => response.arrayBuffer())
        .then((data) => context.current.decodeAudioData(data))
        .then((buffer) => { buffers.current[id] = buffer; })
        .catch(() => {});
    });
    return () => clearInterval(timer.current);
  }, []);

  useEffect(() => () => clearInterval(timer.current), []);

  const stop = () => {
    clearInterval(timer.current);
    setIsPlaying(false);
    onPlayingChange?.(false);
    setCurrentStep(-1);
  };

  const startPlayback = () => {
    if (isPlaying) return;
    if (context.current.state === "suspended") context.current.resume();
    stepRef.current = 0;
    const tick = () => {
      const step = stepRef.current;
      setCurrentStep(step);
      SOUNDS.forEach(([id, , frequency]) => {
        if (patternRef.current[id].includes(step)) buffers.current[id] ? playSample(context.current, buffers.current[id]) : playClick(context.current, frequency);
      });
      stepRef.current = (step + 1) % 16;
    };
    clearInterval(timer.current);
    tick();
    timer.current = setInterval(tick, (60 / bpm / 4) * 1000);
    setIsPlaying(true);
    onPlayingChange?.(true);
  };

  useEffect(() => {
    if (playRequest > 0) startPlayback();
  }, [playRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stopRequest > 0) stop();
  }, [stopRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    if (isPlaying) { stop(); return; }
    startPlayback();
  };

  return <div className="drum-player panel">
    <div className="drum-player-info">
      <span className="label-section">Batida da cifra</span>
      <strong>{bpm} BPM</strong>
    </div>
    <div className="drum-player-steps" aria-label="Progresso da batida">
      {Array.from({ length: 16 }, (_, index) => <span key={index} className={currentStep === index ? "is-current" : ""} />)}
    </div>
    <button type="button" className="btn-primary drum-player-button" onClick={togglePlay}>{isPlaying ? "■ Parar" : "▶ Tocar batida"}</button>
  </div>;
}
