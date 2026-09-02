import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChordSheetPage from "./pages/ChordSheetPage";
import SetlistBuilderPage from "./pages/SetlistBuilderPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import ChordSheetListPage from "./pages/ChordSheetListPage";
import ChordSheetFormPage from "./pages/ChordSheetFormPage";
import RecentlyViewedPage from "./pages/RecentlyViewedPage";
import SharedChordSheetPage from "./pages/SharedChordSheetPage";
import SharedSetlistPage from "./pages/SharedSetlistPage";
import DrumMachinePage from "./pages/DrumMachinePage";
import { AuthProvider, useAuth } from "./components/AuthContext";

function MainAppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/20">
      <header id="main-header" className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3 group" onClick={closeMobileMenu}>
            <img
              src="/logo.png"
              alt="MusicGym"
              className="h-9 w-auto transition-transform duration-200 group-hover:scale-105"
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Academia Musical</p>
              <h1 className="text-lg font-black text-slate-900 leading-none">MusicGym</h1>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden md:flex items-center gap-2">
              <Link className="btn-ghost" to="/">Home</Link>
              <Link className="btn-ghost" to="/setlists">Setlists</Link>
              <Link className="btn-ghost" to="/cifras">Cifras</Link>
              <Link className="btn-ghost" to="/drum-machine">Drum Machine</Link>
              {isAuthenticated && (
                <Link className="btn-ghost" to="/recentes">Recentes</Link>
              )}
            </nav>

            <button
              type="button"
              className="inline-flex md:hidden btn-outline text-xs px-3 py-2"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div className="h-6 w-[1px] bg-slate-200 hidden md:block" />

            <div className="hidden sm:flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <Link className="btn-outline text-xs px-3.5 py-1.5" to="/cifras/nova">+ Cifra</Link>
                  <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1 py-1">
                    <span className="text-xs font-bold text-slate-700 max-w-28 truncate">{user?.display_name || user?.email}</span>
                    <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center uppercase shadow-sm">
                      {user?.display_name?.substring(0, 2) || "U"}
                    </div>
                  </div>
                  <button onClick={logout} className="btn-ghost text-xs px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">Sair</button>
                </>
              ) : (
                <>
                  <Link className="btn-ghost text-xs px-4 py-2" to="/cifras">Explorar</Link>
                  <Link className="btn-outline text-xs px-4 py-2" to="/register">Cadastrar</Link>
                  <Link className="btn-primary text-xs px-4 py-2" to="/login">Entrar</Link>
                </>
              )}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-4 pt-3">
            <div className="flex flex-col gap-2">
              <Link to="/" className="btn-ghost justify-start" onClick={closeMobileMenu}>Home</Link>
              <Link to="/setlists" className="btn-ghost justify-start" onClick={closeMobileMenu}>Setlists</Link>
              <Link to="/cifras" className="btn-ghost justify-start" onClick={closeMobileMenu}>Cifras</Link>
              <Link to="/drum-machine" className="btn-ghost justify-start" onClick={closeMobileMenu}>Drum Machine</Link>
              {isAuthenticated && (
                <Link to="/recentes" className="btn-ghost justify-start" onClick={closeMobileMenu}>Recentes</Link>
              )}
              {isAuthenticated ? (
                <>
                  <Link to="/cifras/nova" className="btn-outline justify-center text-xs px-4 py-2" onClick={closeMobileMenu}>+ Cifra</Link>
                  <button
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                    className="btn-ghost justify-center text-xs px-4 py-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-outline justify-center text-xs px-4 py-2" onClick={closeMobileMenu}>Cadastrar</Link>
                  <Link to="/login" className="btn-primary justify-center text-xs px-4 py-2" onClick={closeMobileMenu}>Entrar</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">
        <Routes>
          <Route path="/" element={<HomePage mode="home" />} />
          <Route path="/setlists" element={<HomePage mode="setlists" />} />
          <Route path="/cifras" element={<ChordSheetListPage />} />
          <Route path="/cifras/nova" element={<ChordSheetFormPage />} />
          <Route path="/cifras/:id" element={<ChordSheetPage />} />
          <Route path="/cifras/:id/editar" element={<ChordSheetFormPage />} />
          <Route path="/drum-machine" element={<DrumMachinePage />} />
          <Route path="/recentes" element={<RecentlyViewedPage />} />
          <Route path="/c/:shareToken" element={<SharedChordSheetPage />} />
          <Route path="/s/:shareToken" element={<SharedSetlistPage />} />
          <Route path="/setlists/:id/edit" element={<SetlistBuilderPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} MusicGym — Academia Musical para músicos
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
