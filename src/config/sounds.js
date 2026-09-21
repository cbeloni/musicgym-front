// Origem dos arquivos de áudio das ferramentas musicais.
//
// As amostras do piano vêm do projeto piano-sound-samples
// (https://github.com/Leethring/piano_88_key_sound_sample) e estão publicadas no
// bucket de cifras, mantendo os nomes originais dos arquivos (ex.: A.mp3, cc.mp3,
// c1.mp3, c4.mp3).
//
// Para voltar a servir os arquivos localmente, basta definir
// VITE_PIANO_SOUND_URL=/piano (com os arquivos em `public/piano`) ou apontar para
// outro bucket sem alterar nenhum componente.

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export const PIANO_SOUND_BASE = trimTrailingSlash(
  import.meta.env.VITE_PIANO_SOUND_URL || "https://cifras.br-se1.magaluobjects.com/piano"
);

export function pianoSampleUrl(fileName) {
  return `${PIANO_SOUND_BASE}/${fileName}`;
}
