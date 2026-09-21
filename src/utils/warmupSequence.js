// Parâmetro de aquecimento do Virtual Piano (deep link `?aquecimento=`).
//
// Formato:
//   [bpm=96;][compasso=4/4;]C4:1/4;D4:1/8;E4:1/2
//
// - bpm: 40 a 220. Também aceito como primeiro token numérico ("96;C4:1/4").
// - compasso: fórmula de compasso (padrão 4/4), usada para contar os compassos.
// - nota: altura[:duração]. Alturas: C4, C#4, Db4, c4 e "-" (pausa).
//   Para tocar notas ao mesmo tempo (acorde), junte as alturas com "+" ou "~":
//   C4+E4+G4:1/4. Na URL o "+" pode chegar como espaço — as três formas valem.
// - duração: figuras padrão da música — 1, 1/2, 1/4, 1/8, 1/16, 1/32 — com
//   "." para pontuada e "t" para tercina. Aceita também os atalhos 2, 4, 8, 16,
//   32 e os nomes em português (semínima, colcheia...). Padrão: 1/4.
//
// Os separadores de notas podem ser ";" ou ",".

export const DEFAULT_BPM = 90;
export const MIN_BPM = 40;
export const MAX_BPM = 220;
export const DEFAULT_TIME_SIGNATURE = "4/4";
export const DEFAULT_DURATION = 1 / 4;

const REST_TOKENS = new Set(["-", "_", "pausa", "rest", "silence"]);

// Separadores entre as notas de um acorde. O espaço entra na lista porque um "+"
// escrito direto na URL é decodificado como espaço pelo navegador.
const CHORD_SEPARATORS = /[+~\s]+/;

const LETTER_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Figuras de duração em unidades de semibreve.
const DURATION_FIGURES = [
  { value: 1, label: "1", name: "Semibreve" },
  { value: 1 / 2, label: "1/2", name: "Mínima" },
  { value: 1 / 4, label: "1/4", name: "Semínima" },
  { value: 1 / 8, label: "1/8", name: "Colcheia" },
  { value: 1 / 16, label: "1/16", name: "Semicolcheia" },
  { value: 1 / 32, label: "1/32", name: "Fusa" },
  { value: 1 / 64, label: "1/64", name: "Semifusa" },
];

// Atalhos numéricos aceitos no parâmetro (4 = 1/4, 8 = 1/8 ...).
const DURATION_TOKENS = {
  1: 1,
  2: 1 / 2,
  4: 1 / 4,
  8: 1 / 8,
  16: 1 / 16,
  32: 1 / 32,
  64: 1 / 64,
};

const DURATION_NAMES = {
  semibreve: 1,
  minima: 1 / 2,
  seminima: 1 / 4,
  colcheia: 1 / 8,
  semicolcheia: 1 / 16,
  fusa: 1 / 32,
  semifusa: 1 / 64,
};

// Combinações reconhecidas na exibição (figura + pontuação).
const DURATION_SHAPES = [
  { factor: 1, suffix: "", name: "" },
  { factor: 1.5, suffix: ".", name: " pontuada" },
  { factor: 2 / 3, suffix: "t", name: " (tercina)" },
];

export function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function clampBpm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(number)));
}

export function formatPitch(midi) {
  const pitchClass = ((midi % 12) + 12) % 12;
  return `${SHARP_NAMES[pitchClass]}${Math.floor(midi / 12) - 1}`;
}

export function parsePitch(raw) {
  const token = String(raw ?? "").trim();
  if (!token) return null;
  const normalized = token.charAt(0).toUpperCase() + token.slice(1);
  // "#" e "s" são sustenido; "b" é bemol (aceito como a nota equivalente em sustenido).
  const match = normalized.match(/^([A-G])([#bs]?)(-?\d)$/);
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  const semitone =
    LETTER_SEMITONES[letter.toLowerCase()] +
    (accidental === "#" || accidental === "s" ? 1 : accidental === "b" ? -1 : 0);
  return (Number(octave) + 1) * 12 + semitone;
}

export function parseDuration(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_DURATION;
  let token = normalize(raw);
  let factor = 1;

  if (token.endsWith(".")) {
    factor = 1.5;
    token = token.slice(0, -1);
  } else if (token.endsWith("t")) {
    factor = 2 / 3;
    token = token.slice(0, -1);
  }

  if (DURATION_NAMES[token]) return DURATION_NAMES[token] * factor;

  const fraction = token.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const value = Number(fraction[1]) / Number(fraction[2]);
    return value > 0 && Number.isFinite(value) ? value * factor : null;
  }

  if (/^\d+$/.test(token)) {
    const value = DURATION_TOKENS[token];
    if (value) return value * factor;
  }

  return null;
}

// Valor em semibreves -> etiqueta legível (ex.: "1/4." e "Semínima pontuada").
export function describeDuration(value) {
  for (const figure of DURATION_FIGURES) {
    for (const shape of DURATION_SHAPES) {
      const target = figure.value * shape.factor;
      if (Math.abs(target - value) < 1e-6) {
        return { label: `${figure.label}${shape.suffix}`, name: `${figure.name}${shape.name}` };
      }
    }
  }

  return { label: value.toFixed(3), name: "Figura personalizada" };
}

function parseTimeSignature(raw) {
  const match = String(raw ?? "").trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!numerator || !denominator) return null;
  return `${numerator}/${denominator}`;
}

export function measuresPerWhole(timeSignature) {
  const [numerator, denominator] = String(timeSignature || DEFAULT_TIME_SIGNATURE)
    .split("/")
    .map(Number);
  if (!numerator || !denominator) return 1;
  return numerator / denominator;
}

export function parseWarmupParam(raw) {
  const result = {
    bpm: DEFAULT_BPM,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    notes: [],
    invalid: [],
  };

  const text = String(raw ?? "").trim();
  if (!text) return result;

  let bpmDefined = false;

  text
    .split(/[;,|]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      const lower = normalize(token);

      const bpmToken = lower.match(/^(bpm|tempo)[=:](\d+)$/);
      if (bpmToken) {
        result.bpm = clampBpm(bpmToken[2]);
        bpmDefined = true;
        return;
      }

      const meterToken = lower.match(/^(compasso|metrica|time)[=:](\d+\/\d+)$/);
      if (meterToken) {
        result.timeSignature = parseTimeSignature(meterToken[2]) || result.timeSignature;
        return;
      }

      if (/^\d{2,3}$/.test(token) && !bpmDefined) {
        result.bpm = clampBpm(token);
        bpmDefined = true;
        return;
      }

      const separatorIndex = token.indexOf(":");
      const pitchRaw = separatorIndex === -1 ? token : token.slice(0, separatorIndex);
      const durationRaw = separatorIndex === -1 ? "" : token.slice(separatorIndex + 1);
      const isRest = REST_TOKENS.has(normalize(pitchRaw));
      const duration = parseDuration(durationRaw);

      // Um token pode ser um acorde: C4+E4+G4 (duas ou mais notas ao mesmo tempo).
      const parts = isRest ? [] : String(pitchRaw).split(CHORD_SEPARATORS).filter(Boolean);
      const midis = isRest ? [] : parts.map(parsePitch);
      const invalidChord = !isRest && (parts.length === 0 || midis.some((midi) => midi === null));

      if (invalidChord || duration === null) {
        result.invalid.push(token);
        return;
      }

      result.notes.push({
        rest: isRest,
        midis,
        pitches: isRest ? ["-"] : midis.map(formatPitch),
        duration,
        source: token,
      });
    });

  return result;
}

export function encodeWarmupParam({ bpm, timeSignature, notes }) {
  const parts = [`bpm=${clampBpm(bpm)}`];
  if (timeSignature && timeSignature !== DEFAULT_TIME_SIGNATURE) {
    parts.push(`compasso=${timeSignature}`);
  }
  notes.forEach((note) => {
    parts.push(`${note.rest ? "-" : note.pitches.join("+")}:${describeDuration(note.duration).label}`);
  });
  return parts.join(";");
}

// Duração de uma figura em milissegundos considerando o BPM (semínima = 1/4).
export function durationMs(duration, bpm) {
  const beat = 60000 / clampBpm(bpm);
  return duration * 4 * beat;
}

export function describeWarmup({ bpm, timeSignature, notes }) {
  const total = notes.reduce((sum, note) => sum + note.duration, 0);
  const measures = measuresPerWhole(timeSignature);
  const seconds = durationMs(total, bpm) / 1000;
  const measureCount = measures > 0 ? total / measures : 0;
  return {
    total,
    measures: measureCount,
    seconds,
    label: `${notes.length} ${notes.length === 1 ? "nota" : "notas"} · ${measureCount
      .toFixed(2)
      .replace(".", ",")} compassos · ${seconds.toFixed(1).replace(".", ",")} s`,
  };
}
