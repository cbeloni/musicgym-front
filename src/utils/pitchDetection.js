// Detecção de frequência fundamental para o modo "Aquecimento" do Virtual Piano.
//
// Usa o método YIN (diferença normalizada acumulada) sobre a janela de amostras
// capturada pelo microfone, com interpolação parabólica no vale encontrado.
// O resultado sempre traz o nível (RMS) captado, e traz a frequência apenas
// quando existe uma nota com confiança suficiente.

const RMS_FLOOR = 0.01; // abaixo disso consideramos silêncio/ruído de fundo
const DIFFERENCE_THRESHOLD = 0.15; // limiar de diferença normalizada do YIN
const FALLBACK_THRESHOLD = 0.5; // confiança mínima quando nenhum vale cruza o limiar
const MIN_FREQUENCY = 70; // ~C#2, abaixo disso é improvável para voz
const MAX_FREQUENCY = 1200; // ~D6, acima disso costuma ser harmônico

export function detectPitch(buffer, sampleRate) {
  const size = buffer.length;

  let energy = 0;
  for (let i = 0; i < size; i += 1) energy += buffer[i] * buffer[i];
  const level = Math.sqrt(energy / size);

  if (level < RMS_FLOOR) return { level, frequency: null, clarity: 0 };

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQUENCY), size - 2);
  if (maxLag <= minLag) return { level, frequency: null, clarity: 0 };

  const difference = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < size; i += 1) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  // Diferença média normalizada acumulada (YIN).
  const normalized = new Float32Array(maxLag + 1);
  let runningSum = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    runningSum += difference[lag];
    normalized[lag] =
      runningSum === 0 ? 1 : (difference[lag] * (lag - minLag + 1)) / runningSum;
  }

  let bestLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (normalized[lag] < DIFFERENCE_THRESHOLD) {
      while (lag + 1 < maxLag && normalized[lag + 1] < normalized[lag]) lag += 1;
      bestLag = lag;
      break;
    }
  }

  if (bestLag === -1) {
    let smallest = Number.POSITIVE_INFINITY;
    for (let lag = minLag + 1; lag < maxLag; lag += 1) {
      if (normalized[lag] < smallest) {
        smallest = normalized[lag];
        bestLag = lag;
      }
    }
    if (bestLag === -1 || smallest > FALLBACK_THRESHOLD) {
      return { level, frequency: null, clarity: 0 };
    }
  }

  const previous = normalized[bestLag - 1] ?? 1;
  const current = normalized[bestLag];
  const next = normalized[bestLag + 1] ?? current;
  const a = (previous + next - 2 * current) / 2;
  const b = (next - previous) / 2;
  const refinedLag = a !== 0 ? bestLag - b / (2 * a) : bestLag;

  const frequency = sampleRate / refinedLag;
  if (!Number.isFinite(frequency) || frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    return { level, frequency: null, clarity: 0 };
  }

  return { level, frequency, clarity: Math.max(0, 1 - current) };
}

export function frequencyToMidi(frequency) {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

// Desvio em cents da frequência cantada em relação à nota temperada mais próxima.
export function centsFromNote(frequency, midi) {
  const reference = 440 * 2 ** ((midi - 69) / 12);
  return Math.round(1200 * Math.log2(frequency / reference));
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
