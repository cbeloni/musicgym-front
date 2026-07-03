import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { createChordSheet, fetchChordSheet, updateChordSheet } from "../services/api";

export default function ChordSheetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isEditMode = !!id;

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [keySignature, setKeySignature] = useState("");
  const [imageDataList, setImageDataList] = useState([]);
  const [entryMode, setEntryMode] = useState("text");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [createdById, setCreatedById] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);

  const canEditPrivacy = !isEditMode || (isAuthenticated && user?.id === createdById);

  const hasImages = imageDataList.length > 0;
  const hasContent = content.trim().length > 0;

  const selectTextMode = () => {
    setEntryMode("text");
    setError("");
  };

  const selectImageMode = () => {
    setEntryMode("image");
    setError("");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      reader.readAsDataURL(file);
    });

  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setError("Selecione apenas arquivos de imagem válidos.");
      e.target.value = "";
      return;
    }

    try {
      const nextImages = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      setImageDataList((prev) => [...prev, ...nextImages.filter(Boolean)]);
      setEntryMode("image");
    } catch (err) {
      setError(err.message || "Não foi possível ler a imagem selecionada.");
    } finally {
      e.target.value = "";
    }
  };

  const handleClearImage = () => {
    setImageDataList([]);
  };

  const removeImageAt = (index) => {
    setImageDataList((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (isEditMode) {
      loadChordSheet();
    }
  }, [id]);

  const loadChordSheet = async () => {
    setFetching(true);
    try {
      const data = await fetchChordSheet(id);
      setTitle(data.title);
      setArtist(data.artist);
      setKeySignature(data.key_signature || "");
      setImageDataList(Array.isArray(data.image_data) ? data.image_data : []);
      setYoutubeUrl(data.youtube_url || "");
      setContent(data.content);
      setIsPrivate(Boolean(data.is_private));
      setCreatedById(data.created_by_id);
      setEntryMode(data.image_data?.length ? "image" : "text");
    } catch (err) {
      setError("Erro ao carregar a cifra para edição.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validação simples
    if (!title.trim() || !artist.trim()) {
      setError("Por favor, preencha os campos obrigatórios (Título e Artista).");
      setLoading(false);
      return;
    }

    if (entryMode === "text" && !hasContent) {
      setError("Adicione a cifra em texto.");
      setLoading(false);
      return;
    }

    if (entryMode === "image" && !hasImages) {
      setError("Selecione uma ou mais imagens, ou tire uma foto.");
      setLoading(false);
      return;
    }

    try {
      if (isEditMode) {
        await updateChordSheet(
          id,
          title,
          artist,
          keySignature,
          entryMode === "text" ? content : "",
          entryMode === "image" ? imageDataList : [],
          youtubeUrl,
          1,
          isPrivate
        );
        navigate(`/cifras/${id}`);
      } else {
        const newSheet = await createChordSheet(
          title,
          artist,
          keySignature,
          entryMode === "text" ? content : "",
          entryMode === "image" ? imageDataList : [],
          youtubeUrl,
          1,
          isPrivate
        );
        navigate(`/cifras/${newSheet.id}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Erro ao salvar a cifra. Verifique os dados inseridos."
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="panel p-12 text-center animate-pulse">
        Carregando informações da cifra...
      </div>
    );
  }

  return (
    <section className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <header className="panel p-8 relative overflow-hidden bg-gradient-to-r from-white to-slate-50">
        <div className="pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <span className="label-section">Formulário</span>
        <h2 className="mt-3 text-3xl font-black text-slate-900">
          {isEditMode ? "Editar Cifra" : "Criar Nova Cifra"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Insira os detalhes da música, a cifra em texto ou uma imagem da cifra.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 animate-slide-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="panel p-6 space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Título da Música *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Oceans"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Artista / Banda *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Hillsong United"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Tom da Música
            </label>
            <input
              type="text"
              placeholder="Ex: Am, G, F#m"
              value={keySignature}
              onChange={(e) => setKeySignature(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Link do YouTube (Opcional)
            </label>
            <input
              type="url"
              placeholder="Ex: https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Tipo de conteúdo */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Tipo de Conteúdo
            </label>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              Selecione um
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={selectTextMode}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                entryMode === "text"
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-bold">Cifra em texto</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">
                Mostra a área de edição da cifra com acordes e letras.
              </div>
            </button>
            <button
              type="button"
              onClick={selectImageMode}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                entryMode === "image"
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-bold">Imagem da cifra</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">
                Mostra o envio por arquivo ou foto da cifra.
              </div>
            </button>
          </div>
        </div>

        {entryMode === "image" ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Imagem da Cifra
              </label>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Upload, câmera ou múltiplas
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleImageFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={!imageDataList.length}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpar tudo
                </button>
              </div>
              <div className="text-[11px] leading-5 text-slate-500">
                Selecione várias imagens ou use a câmera do celular para anexar fotos da cifra.
              </div>
              {imageDataList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {imageDataList.map((image, index) => (
                    <div key={`${index}-${image.slice(0, 24)}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold uppercase text-slate-500">
                          Imagem {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeImageAt(index)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Remover
                        </button>
                      </div>
                      <img
                        src={image}
                        alt={`Prévia da imagem da cifra ${index + 1}`}
                        className="max-h-64 w-full rounded-lg object-contain bg-white"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                  Nenhuma imagem selecionada.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Cifra e Letra
              </label>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Texto monoespaçado
              </span>
            </div>
            <textarea
              rows={15}
              placeholder={`[Intro]\nAm  F  C  G\n\n[Verso]\nAm                F\nYou call me out upon the waters\nC                    G\nThe great unknown where feet may fail...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-800 transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        )}

        {/* Privacidade */}
        <div className="pt-4 border-t border-slate-200">
          <label className={`flex items-center gap-3 group ${canEditPrivacy ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => canEditPrivacy && setIsPrivate(e.target.checked)}
              disabled={!canEditPrivacy}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Privado</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Não aparece na listagem pública. Qualquer pessoa com o link pode visualizar.
              </p>
            </div>
          </label>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-outline"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              isEditMode ? "Salvar Alterações" : "Criar Cifra"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
