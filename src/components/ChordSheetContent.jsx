const TAB_LINE_REGEX = /^[A-Ga-g]\|/;
const SECTION_LINE_REGEX = /^\s*\[[^\]]+\]\s*$/;
const CHORD_TOKEN_REGEX = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?$/;

function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("[")) return false;

  return trimmed.split(/\s+/).every((token) => CHORD_TOKEN_REGEX.test(token));
}

function getLineClass(line) {
  if (!line.trim()) return "chord-sheet-line chord-sheet-line--empty";
  if (TAB_LINE_REGEX.test(line)) return "chord-sheet-line chord-sheet-line--tab";
  if (SECTION_LINE_REGEX.test(line)) return "chord-sheet-line chord-sheet-line--section";
  if (isChordLine(line)) return "chord-sheet-line chord-sheet-line--chords";
  return "chord-sheet-line chord-sheet-line--lyrics";
}

export default function ChordSheetContent({ content, tabHidden = false }) {
  const lines = (content || "")
    .split("\n")
    .filter((line) => !tabHidden || !TAB_LINE_REGEX.test(line));

  return (
    <pre className="chord-sheet-content overflow-x-auto font-mono text-sm leading-7 text-slate-800 md:text-base">
      {lines.map((line, index) => (
        <span className={getLineClass(line)} key={`${index}-${line}`}>
          {line}
          {index < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </pre>
  );
}
