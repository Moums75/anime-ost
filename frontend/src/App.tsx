import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Navbar from "./components/Navbar";
import PlayerBar from "./components/PlayerBar";
import { usePlayer } from "./player";
import Admin from "./pages/Admin";
import AnimeDetail from "./pages/AnimeDetail";
import Animes from "./pages/Animes";
import AuthForm from "./pages/AuthForm";
import Favorites from "./pages/Favorites";
import GamePage from "./pages/GamePage";
import Leaderboards from "./pages/Leaderboards";
import History from "./pages/History";
import Home from "./pages/Home";
import MusicList from "./pages/MusicList";
import PlaylistDetail from "./pages/PlaylistDetail";
import Playlists from "./pages/Playlists";

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { current } = usePlayer();

  return (
    <>
      <Navbar />
      <main className={`container ${current ? "with-player" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/musiques" element={<MusicList />} />
          <Route path="/animes" element={<Animes />} />
          <Route path="/animes/:id" element={<AnimeDetail />} />
          <Route path="/jeu" element={<GamePage />} />
          <Route path="/jeu/classement" element={<Leaderboards />} />
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/register" element={<AuthForm mode="register" />} />
          <Route path="/favorites" element={<Protected><Favorites /></Protected>} />
          <Route path="/playlists" element={<Protected><Playlists /></Protected>} />
          <Route path="/playlists/:id" element={<Protected><PlaylistDetail /></Protected>} />
          <Route path="/historique" element={<Protected><History /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<p className="muted">Page introuvable.</p>} />
        </Routes>
      </main>
      <PlayerBar />
    </>
  );
}
