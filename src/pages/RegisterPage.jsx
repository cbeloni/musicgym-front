import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, displayName, password);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Erro ao criar conta. Tente usar outro e-mail."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md w-full animate-fade-in py-8">
      <div className="panel p-8 relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50">
        {/* Decorative blob */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        
        <header className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-glow text-white font-black text-xl mb-4">
            ♪
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            Criar conta grátis
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 font-medium uppercase tracking-wider">
            Faça parte do MusicGym
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 animate-slide-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Seu Nome / Apelido
            </label>
            <input
              type="text"
              required
              placeholder="Como quer ser chamado"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              E-mail
            </label>
            <input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Senha
            </label>
            <input
              type="password"
              required
              placeholder="Mínimo de 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary justify-center py-3 text-sm font-bold shadow-md rounded-xl"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Cadastrar e Entrar"
            )}
          </button>
        </form>

        <footer className="mt-8 text-center text-xs text-slate-500 font-medium">
          Já possui uma conta?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Faça login aqui
          </Link>
        </footer>
      </div>
    </div>
  );
}
