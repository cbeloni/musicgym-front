import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import VirtualPiano from "../components/VirtualPiano";
import { useAuth } from "../components/AuthContext";
import { createPianoSequence, deletePianoSequence, fetchPianoSequences, updatePianoSequence } from "../services/api";

export default function VirtualPianoPage() {
  const [, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [savedWarmups, setSavedWarmups] = useState([]);
  const [selectedWarmupId, setSelectedWarmupId] = useState("");
  const [warmupSearch, setWarmupSearch] = useState("");
  const [warmupMenuOpen, setWarmupMenuOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pendingSequence, setPendingSequence] = useState("");
  const [warmupName, setWarmupName] = useState("");
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedWarmups([]);
      return;
    }
    fetchPianoSequences()
      .then(setSavedWarmups)
      .catch(() => setSavedWarmups([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!pickerRef.current?.contains(event.target)) setWarmupMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const selectedWarmup = savedWarmups.find((item) => String(item.id) === String(selectedWarmupId));
  const warmupWithName = savedWarmups.find(
    (item) => item.name.trim().toLowerCase() === warmupName.trim().toLowerCase()
  );
  const filteredWarmups = useMemo(() => {
    const search = warmupSearch.trim().toLocaleLowerCase();
    if (!search) return savedWarmups;
    return savedWarmups.filter((item) => item.name.toLocaleLowerCase().includes(search));
  }, [warmupSearch, savedWarmups]);

  const requestSaveWarmup = (sequence) => {
    setPendingSequence(sequence);
    setWarmupName(selectedWarmup?.name || "");
    setSaveModalOpen(true);
  };

  const persistWarmup = async () => {
    const name = warmupName.trim() || `Sequência ${savedWarmups.length + 1}`;
    try {
      const warmup = warmupWithName
        ? await updatePianoSequence(warmupWithName.id, name, pendingSequence)
        : await createPianoSequence(name, pendingSequence);
      setSavedWarmups((current) =>
        warmupWithName
          ? current.map((item) => (item.id === warmup.id ? warmup : item))
          : [warmup, ...current]
      );
      setSelectedWarmupId(String(warmup.id));
      setWarmupName("");
      setPendingSequence("");
      setSaveModalOpen(false);
    } catch {
      window.alert("Não foi possível salvar a sequência. Verifique se você está autenticado.");
    }
  };

  const loadWarmup = (warmup) => {
    setSelectedWarmupId(String(warmup.id));
    setWarmupMenuOpen(false);
    if (!warmup) return;
    setSearchParams({ sequencia: warmup.sequence });
  };

  const removeWarmup = async (warmup) => {
    if (!window.confirm(`Remover a sequência “${warmup.name}”?`)) return;
    try {
      await deletePianoSequence(warmup.id);
      setSavedWarmups((current) => current.filter((item) => item.id !== warmup.id));
      if (String(warmup.id) === String(selectedWarmupId)) setSelectedWarmupId("");
    } catch {
      window.alert("Não foi possível remover a sequência. Verifique se você está autenticado.");
    }
  };

  return (
    <section className="virtual-piano-page">
      <div className="virtual-piano-heading">
        <div>
          <p className="label-section">Ferramenta musical</p>
          <h2>Virtual Piano</h2>
          <p className="virtual-piano-subtitle">
            Ao usar o microfone, use fone de ouvido — assim o som do piano não entra na captação e a
            nota da sua voz é identificada com precisão.
          </p>
        </div>
        <Link to="/" className="btn-ghost drum-back-link">
          ← Voltar para o início
        </Link>
      </div>

      <VirtualPiano
        onSave={isAuthenticated ? requestSaveWarmup : undefined}
        toolbarExtra={
          <div className="drum-rhythm-picker" ref={pickerRef}>
            <button
              type="button"
              className="drum-rhythm-trigger"
              onClick={() => setWarmupMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={warmupMenuOpen}
              aria-label="Selecionar sequência salva"
            >
              <span className="min-w-0 truncate">{selectedWarmup?.name || "Sequências salvas"}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            {warmupMenuOpen && (
              <div className="drum-rhythm-menu" role="dialog" aria-label="Pesquisar sequências salvas">
                <input
                  autoFocus
                  className="drum-library-input drum-rhythm-search"
                  value={warmupSearch}
                  onChange={(event) => setWarmupSearch(event.target.value)}
                  placeholder="Pesquisar sequências"
                  aria-label="Pesquisar sequências salvas"
                />
                <div className="drum-rhythm-options" role="listbox" aria-label="Sequências salvas">
                  {filteredWarmups.length > 0 ? (
                    filteredWarmups.map((warmup) => (
                      <div className="warmup-option-row" role="presentation" key={warmup.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={String(warmup.id) === String(selectedWarmupId)}
                          className="drum-rhythm-option"
                          onClick={() => loadWarmup(warmup)}
                        >
                          <span className="warmup-option-name truncate">{warmup.name}</span>
                          <span className="warmup-option-sequence">{warmup.sequence}</span>
                        </button>
                        <button
                          type="button"
                          className="warmup-option-delete"
                          onClick={() => removeWarmup(warmup)}
                          aria-label={`Remover a sequência ${warmup.name}`}
                          title="Remover sequência"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="drum-rhythm-empty">
                      {isAuthenticated
                        ? "Nenhuma sequência salva"
                        : "Entre na sua conta para salvar sequências"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      />

      <p className="drum-machine-footnote">
        As teclas pretas soam ao segurar <strong>Shift</strong> com o atalho da tecla branca à esquerda.
        As amostras de áudio vêm do projeto piano-sound-samples.
      </p>

      {saveModalOpen && (
        <div
          className="drum-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-6 md:pt-10"
          role="dialog"
          aria-modal="true"
          aria-label="Salvar sequência"
        >
          <div className="drum-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="label-section">Virtual Piano</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Salvar sequência</h3>
            <p className="mt-2 break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
              {pendingSequence}
            </p>
            <label
              className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500"
              htmlFor="warmup-name"
            >
              Nome da sequência
            </label>
            <input
              id="warmup-name"
              autoFocus
              className="drum-library-input mt-2"
              value={warmupName}
              onChange={(event) => setWarmupName(event.target.value)}
              placeholder="Ex.: Arpejo de Dó maior"
            />
            {warmupWithName && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Já existe uma sequência com este nome: ela será atualizada com a sequência atual.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setSaveModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={persistWarmup}>
                {warmupWithName ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
