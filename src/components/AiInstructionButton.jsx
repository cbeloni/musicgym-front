import { useCallback, useEffect, useRef, useState } from "react";

// Copia a instrução de IA da ferramenta para a área de transferência.
export default function AiInstructionButton({ instruction, className = "btn-outline text-xs px-3 py-2" }) {
  const [state, setState] = useState("idle"); // idle | copied | error
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const fallbackCopy = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  };

  const copy = useCallback(async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(instruction);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = fallbackCopy(instruction);

    setState(ok ? "copied" : "error");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState("idle"), 2600);
  }, [instruction]);

  return (
    <button
      type="button"
      className={className}
      onClick={copy}
      aria-live="polite"
      title="Copiar as instruções para usar com uma IA"
    >
      {state === "copied" ? "Instrução copiada" : state === "error" ? "Não foi possível copiar" : "IA Instruction"}
    </button>
  );
}
