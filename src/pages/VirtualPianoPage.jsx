import { Link } from "react-router-dom";
import VirtualPiano from "../components/VirtualPiano";

export default function VirtualPianoPage() {
  return (
    <section className="virtual-piano-page">
      <div className="virtual-piano-heading">
        <div>
          <p className="label-section">Ferramenta musical</p>
          <h2>Virtual Piano</h2>
          <p className="virtual-piano-subtitle">
            Um piano de 61 teclas (C2 a C7) para estudar ouvido, tirar melodias de ouvido e testar
            harmonias — usando o mouse, o toque ou os atalhos do teclado do computador.
          </p>
        </div>
        <Link to="/" className="btn-ghost drum-back-link">
          ← Voltar para o início
        </Link>
      </div>

      <VirtualPiano />

      <p className="drum-machine-footnote">
        As teclas pretas soam ao segurar <strong>Shift</strong> com o atalho da tecla branca à esquerda.
        As amostras de áudio vêm do projeto piano-sound-samples.
      </p>
    </section>
  );
}
