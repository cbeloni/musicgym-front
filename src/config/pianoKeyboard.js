// Definição do teclado do Virtual Piano.
//
// Extensão: C2 -> C7 (61 teclas / 36 teclas brancas e 25 pretas), igual ao
// teclado exibido na referência de layout.
//
// Atalhos: as linhas do teclado do computador cobrem as teclas brancas de baixo
// para cima em blocos de 10/10/9/7 teclas. A linha de números (topo) toca o
// registro mais grave e a linha Z X C V (base) o mais agudo. A tecla branca
// somada a Shift toca a tecla preta (sustenido) imediatamente à sua direita.

export const START_MIDI = 36; // C2
export const END_MIDI = 96; // C7

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

// Nomes originais das amostras (mesma nomenclatura usada no bucket).
const SAMPLE_NAMES = {
  2: ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"],
  3: ["cc", "ccs", "dd", "dds", "ee", "ff", "ffs", "gg", "ggs", "aa", "aas", "bb"],
  4: ["c1", "c1s", "d1", "d1s", "e1", "f1", "f1s", "g1", "g1s", "a1", "a1s", "b1"],
  5: ["c2", "c2s", "d2", "d2s", "e2", "f2", "f2s", "g2", "g2s", "a2", "a2s", "b2"],
  6: ["c3", "c3s", "d3", "d3s", "e3", "f3", "f3s", "g3", "g3s", "a3", "a3s", "b3"],
  7: ["c4", "c4s", "d4", "d4s", "e4", "f4", "f4s", "g4", "g4s", "a4", "a4s", "b4"],
};

// Linhas de teclas brancas, da mais grave (topo do teclado) para a mais aguda.
export const SHORTCUT_ROWS = [
  { id: "numbers", keys: "1234567890", label: "1 2 3 4 5 6 7 8 9 0" },
  { id: "qwerty", keys: "qwertyuiop", label: "Q W E R T Y U I O P" },
  { id: "asdf", keys: "asdfghjkl", label: "A S D F G H J K L" },
  { id: "zxcv", keys: "zxcvbnm", label: "Z X C V B N M" },
];

const SHIFT_SYMBOLS = {
  1: "!",
  2: "@",
  3: "#",
  4: "$",
  5: "%",
  6: "^",
  7: "&",
  8: "*",
  9: "(",
  0: ")",
};

function shiftLabel(char) {
  return SHIFT_SYMBOLS[char] || char.toUpperCase();
}

function noteName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function sampleFile(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const samples = SAMPLE_NAMES[octave];
  return samples ? `${samples[midi % 12]}.mp3` : null;
}

// Posição de cada tecla branca (0..35) usada para distribuir os atalhos.
const WHITE_SLOTS = SHORTCUT_ROWS.flatMap((row) =>
  [...row.keys].map((char) => ({ char, rowId: row.id, rowLabel: row.label }))
);

export const PIANO_WHITE_COUNT = WHITE_SLOTS.length;

function buildKeys() {
  const whiteWidth = 100 / PIANO_WHITE_COUNT;
  const keys = [];
  let whiteCount = 0;

  for (let midi = START_MIDI; midi <= END_MIDI; midi += 1) {
    const isWhite = WHITE_PITCH_CLASSES.has(midi % 12);

    if (isWhite) {
      const slot = WHITE_SLOTS[whiteCount] || {};
      keys.push({
        midi,
        note: noteName(midi),
        isWhite: true,
        shortcut: slot.char || "",
        rowId: slot.rowId || "",
        left: whiteCount * whiteWidth,
        width: whiteWidth,
        file: sampleFile(midi),
      });
      whiteCount += 1;
      continue;
    }

    // Teclas pretas usam a tecla branca imediatamente à esquerda somada a Shift.
    const reference = WHITE_SLOTS[whiteCount - 1] || {};
    keys.push({
      midi,
      note: noteName(midi),
      isWhite: false,
      shortcut: shiftLabel(reference.char || ""),
      rowId: reference.rowId || "",
      left: (whiteCount - 1 + 0.68) * whiteWidth,
      width: whiteWidth * 0.62,
      file: sampleFile(midi),
    });
  }

  return keys;
}

export const PIANO_KEYS = buildKeys();

export const PIANO_KEY_BY_MIDI = new Map(PIANO_KEYS.map((key) => [key.midi, key]));
export const PIANO_MIDI_BY_SHORTCUT = new Map(PIANO_KEYS.map((key) => [key.shortcut, key.midi]));

// Faixa de notas coberta por cada linha de atalhos (usada na legenda).
export const PIANO_ROWS = SHORTCUT_ROWS.map((row) => {
  const rowKeys = PIANO_KEYS.filter((key) => key.rowId === row.id && key.isWhite);
  return {
    ...row,
    firstNote: rowKeys[0]?.note || "",
    lastNote: rowKeys[rowKeys.length - 1]?.note || "",
    sharps: PIANO_KEYS.filter((key) => key.rowId === row.id && !key.isWhite).map((key) => key.shortcut),
  };
});
