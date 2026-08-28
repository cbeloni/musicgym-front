import { Link } from "react-router-dom";
import DrumMachineEditor from "../components/DrumMachineEditor";

export default function DrumMachinePage() {
  return <section className="drum-machine-page">
    <div className="drum-machine-heading">
      <div><p className="label-section">Ferramenta musical</p><h2>Drum Machine</h2><p className="drum-machine-subtitle">Monte uma batida, compartilhe o link e encontre o pulso do seu próximo repertório.</p></div>
      <Link to="/" className="btn-ghost drum-back-link">← Voltar para o início</Link>
    </div>
    <DrumMachineEditor syncUrl />
    <p className="drum-machine-footnote">Clique nos quadrados para ligar ou desligar cada peça. O marcador acompanha a reprodução em 16 passos.</p>
  </section>;
}
