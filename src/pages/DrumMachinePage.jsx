import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DrumMachineEditor from "../components/DrumMachineEditor";
import { useAuth } from "../components/AuthContext";
import { createDrumMachineRhythm, fetchDrumMachineRhythms, updateDrumMachineRhythm } from "../services/api";

export default function DrumMachinePage() {
  const [, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [savedRhythms, setSavedRhythms] = useState([]);
  const [selectedRhythmId, setSelectedRhythmId] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [rhythmName, setRhythmName] = useState("");
  const [rhythmSearch, setRhythmSearch] = useState("");
  const [rhythmMenuOpen, setRhythmMenuOpen] = useState(false);
  const rhythmPickerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { setSavedRhythms([]); return; }
    fetchDrumMachineRhythms().then(setSavedRhythms).catch(() => setSavedRhythms([]));
  }, [isAuthenticated]);

  const requestSaveRhythm = (url) => {
    const selected = savedRhythms.find((rhythm) => String(rhythm.id) === String(selectedRhythmId));
    setPendingUrl(url);
    setRhythmName(selected?.name || "");
    setSaveModalOpen(true);
  };

  const selectedRhythm = savedRhythms.find((rhythm) => String(rhythm.id) === String(selectedRhythmId));
  const rhythmWithName = savedRhythms.find((rhythm) => rhythm.name.trim().toLowerCase() === rhythmName.trim().toLowerCase());
  const filteredRhythms = useMemo(() => {
    const search = rhythmSearch.trim().toLocaleLowerCase();
    if (!search) return savedRhythms;
    return savedRhythms.filter((rhythm) => rhythm.name.toLocaleLowerCase().includes(search));
  }, [rhythmSearch, savedRhythms]);

  useEffect(() => {
    const closeRhythmMenu = (event) => {
      if (!rhythmPickerRef.current?.contains(event.target)) setRhythmMenuOpen(false);
    };
    document.addEventListener("mousedown", closeRhythmMenu);
    return () => document.removeEventListener("mousedown", closeRhythmMenu);
  }, []);

  const persistRhythm = async () => {
    const name = rhythmName.trim() || `Ritmo ${savedRhythms.length + 1}`;
    try {
      const rhythm = rhythmWithName
        ? await updateDrumMachineRhythm(rhythmWithName.id, name, pendingUrl)
        : await createDrumMachineRhythm(name, pendingUrl);
      setSavedRhythms((current) => rhythmWithName ? current.map((item) => item.id === rhythm.id ? rhythm : item) : [rhythm, ...current]);
      setSelectedRhythmId(rhythm.id);
      setRhythmName("");
      setPendingUrl("");
      setSaveModalOpen(false);
    } catch {
      window.alert("Não foi possível salvar o ritmo. Verifique se você está autenticado.");
    }
  };

  const loadRhythm = (rhythm) => {
    setSelectedRhythmId(String(rhythm.id));
    setRhythmMenuOpen(false);
    if (!rhythm) return;
    const data = new URL(rhythm.drum_machine, window.location.origin).searchParams.get("data");
    if (data) setSearchParams({ data });
  };

  return <section className="drum-machine-page">
    <div className="drum-machine-heading">
      <div><p className="label-section">Ferramenta musical</p><h2>Drum Machine</h2><p className="drum-machine-subtitle">Monte uma batida, compartilhe o link e encontre o pulso do seu próximo repertório.</p></div>
      <Link to="/" className="btn-ghost drum-back-link">← Voltar para o início</Link>
    </div>
    <DrumMachineEditor
      syncUrl
      onSave={isAuthenticated ? requestSaveRhythm : undefined}
      toolbarExtra={<div className="drum-rhythm-picker" ref={rhythmPickerRef}>
        <button type="button" className="drum-rhythm-trigger" onClick={() => setRhythmMenuOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={rhythmMenuOpen} aria-label="Selecionar ritmo salvo">
          <span>{selectedRhythm?.name || "Ritmos salvos"}</span><span aria-hidden="true">⌄</span>
        </button>
        {rhythmMenuOpen && <div className="drum-rhythm-menu" role="dialog" aria-label="Pesquisar ritmos salvos">
          <input
            autoFocus
            className="drum-library-input drum-rhythm-search"
            value={rhythmSearch}
            onChange={(event) => setRhythmSearch(event.target.value)}
            placeholder="Pesquisar ritmos"
            aria-label="Pesquisar ritmos salvos"
          />
          <div className="drum-rhythm-options" role="listbox" aria-label="Ritmos salvos">
            {filteredRhythms.length > 0
              ? filteredRhythms.map((rhythm) => <button type="button" role="option" aria-selected={String(rhythm.id) === String(selectedRhythmId)} className="drum-rhythm-option" key={rhythm.id} onClick={() => loadRhythm(rhythm)}>{rhythm.name}</button>)
              : <p className="drum-rhythm-empty">Nenhum ritmo encontrado</p>}
          </div>
        </div>}
      </div>}
    />
    {saveModalOpen && <div className="drum-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-6 md:pt-10" role="dialog" aria-modal="true" aria-label="Salvar ritmo">
      <div className="drum-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <p className="label-section">Drum Machine</p>
        <h3 className="mt-1 text-2xl font-black text-slate-900">Salvar ritmo</h3>
        <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="rhythm-name">Nome do ritmo</label>
        <input id="rhythm-name" autoFocus className="drum-library-input mt-2" value={rhythmName} onChange={(event) => setRhythmName(event.target.value)} placeholder="Ex.: Pop rock 1" />
        {rhythmWithName && <p className="mt-2 text-xs font-semibold text-amber-700">O ritmo com este nome será atualizado e substituído pela batida atual.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setSaveModalOpen(false)}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={persistRhythm}>{rhythmWithName ? "Atualizar" : "Salvar"}</button>
        </div>
      </div>
    </div>}
    <p className="drum-machine-footnote">Clique nos quadrados para ligar ou desligar cada peça. O marcador acompanha a reprodução em 16 passos.</p>
  </section>;
}
