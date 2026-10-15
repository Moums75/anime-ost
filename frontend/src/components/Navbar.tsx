import { startTransition } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { MusicIcon } from "./Icons";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="logo">
        <span className="logo__mark"><MusicIcon /></span>
        <span>
          <span className="logo__name">Anime<span className="gradient-text">OST</span></span>
          <span className="logo__sub">Openings · Endings · OST</span>
        </span>
      </Link>
      <nav className="navbar__links">
        <NavLink to="/" end>Accueil</NavLink>
        <NavLink to="/musiques">Musiques</NavLink>
        <NavLink to="/animes">Animes</NavLink>
        <NavLink to="/jeu">Mini-jeu</NavLink>
        {user && <NavLink to="/favorites">Favoris</NavLink>}
        {user && <NavLink to="/playlists">Playlists</NavLink>}
        {user && <NavLink to="/historique">Historique</NavLink>}
        {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="navbar__user">
        {user ? (
          <>
            <Link to="/compte" className="avatar" title={`Mon compte (${user.username})`}>{user.username[0].toUpperCase()}</Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                // Même transition que la navigation : sinon une page protégée redirigerait vers /login
                navigate("/");
                startTransition(logout);
              }}
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Connexion</Link>
            <Link to="/register" className="btn btn-sm">Inscription</Link>
          </>
        )}
      </div>
    </header>
  );
}
