import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SetlistCard from "../components/SetlistCard";
import { fetchMainSetlists, createSetlist, deleteSetlist, fetchChordSheets, fetchRecentlyViewedChordSheets } from "../services/api";
import { useAuth } from "../components/AuthContext";

export default function HomePage({ mode = "home" }) {
  const { isAuthenticated, user } = useAuth();
  const isSetlistsOnlyMode = mode === "setlists";
  const [setlists, setSetlists] = useState([]);
  const [chordSheets, setChordSheets] = useState([]);
  const [recentSheets, setRecentSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chordLoading, setChordLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState("");
  const [chordError, setChordError] = useState("");

  const [heroSlide, setHeroSlide] = useState(0);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    loadSetlists();
    loadChordSheets();
    if (isAuthenticated) {
      loadRecentSheets();
    }
  }, [isAuthenticated]);

  const loadSetlists = async () => {
    setLoading(true);
    try {
      const data = await fetchMainSetlists();
      setSetlists(data);
    } catch {
      setError("Não foi possível conectar à API do MusicGym. Verifique o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const loadChordSheets = async () => {
    setChordLoading(true);
    try {
      const data = await fetchChordSheets();
      setChordSheets(data);
    } catch {
      setChordError("Não foi possível carregar as cifras.");
    } finally {
      setChordLoading(false);
    }
  };

  const loadRecentSheets = async () => {
    setRecentLoading(true);
    try {
      const data = await fetchRecentlyViewedChordSheets();
      setRecentSheets(data);
    } catch {
      // Silently fail
    } finally {
      setRecentLoading(false);
    }
  };

  const handleCreateSetlist = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    if (!newName.trim()) {
      setCreateError("O nome do setlist é obrigatório.");
      setCreateLoading(false);
      return;
    }

    try {
      const data = await createSetlist(newName, newDescription, false);
      setSetlists((prev) => [data, ...prev]);
      setNewName("");
      setNewDescription("");
      setShowCreateForm(false);
    } catch {
      setCreateError("Erro ao criar setlist. Tente novamente.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteSetlist = async (id) => {
    if (!window.confirm("Deseja realmente excluir este setlist?")) return;
    try {
      await deleteSetlist(id);
      setSetlists((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Erro ao deletar setlist. Verifique se você é o autor.");
    }
  };

  const heroSlides = [
    {
      title: (
        <>
          Organize seu repertório<br />
          <span className="text-blue-600">com simplicidade</span>
        </>
      ),
      description:
        "Explore setlists públicos, abra qualquer repertório e organize as cifras com drag & drop. Tudo em um só lugar.",
      actions: isAuthenticated ? (
        <button onClick={() => setShowCreateForm((v) => !v)} className="btn-primary">
          {showCreateForm ? "Fechar Formulário" : "+ Criar Setlist"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-4 py-2">
            🎸 Crie sua conta para montar e gerenciar seus setlists
          </div>
          <Link to="/register" className="btn-primary text-xs px-4 py-2">
            Cadastrar
          </Link>
          <Link to="/login" className="btn-ghost text-xs px-4 py-2">
            Entrar
          </Link>
        </div>
      ),
    },
    {
      title: (
        <>
          Crie suas cifras<br />
          <span className="text-blue-600">e toque com auto-scroll</span>
        </>
      ),
      description:
        "Cadastre músicas, adicione tom e YouTube, depois toque em sequência com navegação entre faixas do setlist.",
      actions: isAuthenticated ? (
        <div className="flex flex-wrap gap-3">
          <Link to="/cifras/nova" className="btn-primary">
            + Criar Cifra
          </Link>
          <Link to="/cifras" className="btn-outline text-xs px-4 py-2">
            Explorar Cifras
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link to="/login" className="btn-primary text-xs px-4 py-2">
            Entrar para Criar
          </Link>
          <Link to="/cifras" className="btn-outline text-xs px-4 py-2 bg-white">
            Ver Cifras
          </Link>
        </div>
      ),
    },
  ];

  const visibleHeroSlides = isSetlistsOnlyMode ? [heroSlides[0]] : heroSlides;

  const visibleChordSheets = chordSheets.slice(0, 6);

  return (
    <section className="space-y-10 animate-fade-in">
      {/* ── Carrossel: só aparece para usuários não logados ── */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 md:p-12 shadow-card">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-0 h-48 w-48 rounded-full bg-slate-400/12 blur-2xl" />

          <div className="relative min-h-[260px]">
            {visibleHeroSlides.map((slide, idx) => (
              <div
                key={idx}
                className={`transition-all duration-300 ${heroSlide === idx ? "opacity-100 translate-x-0" : "pointer-events-none absolute inset-0 opacity-0 translate-x-4"}`}
              >
                <span className="label-section">Comunidade</span>
                <h2 className="mt-3 text-4xl font-black text-slate-900 leading-tight max-w-lg">{slide.title}</h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">{slide.description}</p>
                <div className="mt-8 flex flex-wrap gap-4 items-center">{slide.actions}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {visibleHeroSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setHeroSlide(idx)}
                  className={`h-2.5 rounded-full transition-all ${heroSlide === idx ? "w-8 bg-blue-600" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setHeroSlide((prev) => (prev === 0 ? visibleHeroSlides.length - 1 : prev - 1))
                }
                className="btn-outline text-xs px-3 py-1.5"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setHeroSlide((prev) => (prev + 1) % visibleHeroSlides.length)}
                className="btn-outline text-xs px-3 py-1.5"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cifras acessadas recentemente (primeiro item quando logado) ── */}
      {isAuthenticated && !isSetlistsOnlyMode && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="label-section">Histórico</span>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">Continuar de onde parou</h3>
            </div>
            <Link to="/recentes" className="btn-outline text-xs px-4 py-2">Ver todas</Link>
          </div>

          {recentLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={`r-${i}`} className="panel h-40 animate-pulse" />
              ))}
            </div>
          ) : recentSheets.length === 0 ? (
            <div className="panel p-8 text-center text-slate-500">
              Nenhuma cifra acessada recentemente.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentSheets.slice(0, 6).map((sheet, idx) => {
                const isOwner = isAuthenticated && user && user.id === sheet.created_by_id;
                return (
                  <article
                    key={sheet.id}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    className="panel group flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow hover:border-slate-300 animate-fade-in"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="badge">{sheet.key_signature ? `Tom: ${sheet.key_signature}` : "Sem Tom"}</span>
                        {isOwner && <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600">Sua Cifra</span>}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{sheet.title}</h3>
                      <p className="text-sm font-semibold text-slate-500 mt-1">{sheet.artist}</p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Link to={`/cifras/${sheet.id}`} className="btn-primary text-xs px-4 py-2">Tocar Cifra</Link>
                      {isAuthenticated && (
                        <Link to={`/cifras/${sheet.id}/editar`} className="btn-outline text-xs px-3 py-1.5">✏️</Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateSetlist} className="panel p-6 space-y-4 max-w-lg animate-slide-in">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Novo Setlist</h3>
            <p className="text-xs text-slate-500 mt-0.5">Insira as informações do novo repertório.</p>
          </div>

          {createError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nome do Repertório *</label>
            <input
              type="text"
              required
              placeholder="Ex: Culto Domingo, Show de Sábado"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Descrição (Opcional)</label>
            <textarea
              placeholder="Ex: Setlist principal com louvor e adoração"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreateForm(false)} className="btn-ghost text-xs px-4 py-2">
              Cancelar
            </button>
            <button type="submit" disabled={createLoading} className="btn-primary text-xs px-4 py-2">
              {createLoading ? "Criando..." : "Salvar Setlist"}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <div>
          <span className="label-section">Setlists</span>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">Principais setlists</h3>
        </div>
        <div className="flex items-center gap-2">
          {!isSetlistsOnlyMode && (
            <Link to="/setlists" className="btn-outline text-xs px-4 py-2">
              Ver todas as setlists
            </Link>
          )}
          <span className="badge">{setlists.length} encontrados</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel h-48 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : error ? (
        <div className="panel p-6 text-center text-slate-500">{error}</div>
      ) : setlists.length === 0 ? (
        <div className="panel p-12 text-center text-slate-500">Nenhum setlist cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {setlists.map((setlist, i) => (
            <SetlistCard key={setlist.id} setlist={setlist} style={{ animationDelay: `${i * 0.08}s` }} onDelete={handleDeleteSetlist} />
          ))}
        </div>
      )}

      {!isSetlistsOnlyMode && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="label-section">Cifras</span>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">Cifras recentes</h3>
            </div>
            <Link to="/cifras" className="btn-outline text-xs px-4 py-2">Ver todas</Link>
          </div>

          {chordLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={`c-${i}`} className="panel h-40 animate-pulse" />
              ))}
            </div>
          ) : chordError ? (
            <div className="panel p-6 text-center text-slate-500">{chordError}</div>
          ) : visibleChordSheets.length === 0 ? (
            <div className="panel p-12 text-center text-slate-500">Nenhuma cifra cadastrada.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleChordSheets.map((sheet, idx) => {
                const isOwner = isAuthenticated && user && user.id === sheet.created_by_id;
                return (
                  <article
                    key={sheet.id}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    className="panel group flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow hover:border-slate-300 animate-fade-in"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="badge">{sheet.key_signature ? `Tom: ${sheet.key_signature}` : "Sem Tom"}</span>
                        {isOwner && <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600">Sua Cifra</span>}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{sheet.title}</h3>
                      <p className="text-sm font-semibold text-slate-500 mt-1">{sheet.artist}</p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Link to={`/cifras/${sheet.id}`} className="btn-primary text-xs px-4 py-2">Tocar Cifra</Link>
                      {isAuthenticated && (
                        <Link to={`/cifras/${sheet.id}/editar`} className="btn-outline text-xs px-3 py-1.5">✏️</Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
