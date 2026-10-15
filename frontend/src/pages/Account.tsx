import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useLibrary } from "../library";

type Message = { text: string; error?: boolean } | null;

export default function Account() {
  const { user, logout } = useAuth();
  const { playlists } = useLibrary();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ history: 0, favorites: 0, records: 0 });

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([api.history(1), api.favorites(), api.myScores()])
      .then(([history, favorites, scores]) =>
        setCounts({ history: history.total, favorites: favorites.length, records: scores.length }),
      )
      .catch(() => undefined);
  }, []);

  if (!user) return null;
  const isMainAdmin = user.role === "admin";

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPasswordMessage({ text: "Les deux nouveaux mots de passe ne sont pas identiques.", error: true });
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordMessage({ text: "Mot de passe modifié ✔" });
    } catch (err) {
      setPasswordMessage({ text: (err as Error).message, error: true });
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await api.deleteAccount(deletePassword);
      // React Router navigue dans une transition : on y met aussi la déconnexion pour que les deux
      // s'appliquent ensemble (sinon la page protégée redirige d'abord vers /login).
      navigate("/", { replace: true });
      startTransition(logout);
    } catch (err) {
      setDeleteMessage({ text: (err as Error).message, error: true });
      setDeleting(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{isMainAdmin ? "Administrateur" : "Utilisateur"}</p>
          <h1>
            Mon <span className="gradient-text">compte</span>
          </h1>
          <p className="muted">Connecté en tant que <strong>{user.username}</strong>.</p>
        </div>
      </header>

      <div className="account-stats">
        <Link to="/historique"><strong>{counts.history}</strong><span>écoutes</span></Link>
        <Link to="/favorites"><strong>{counts.favorites}</strong><span>favoris</span></Link>
        <Link to="/playlists"><strong>{playlists.length}</strong><span>playlists</span></Link>
        <Link to="/jeu/classement"><strong>{counts.records}</strong><span>records OST Rush</span></Link>
      </div>

      <div className="account-grid">
        <form className="panel form" onSubmit={changePassword}>
          <h2>Changer de mot de passe</h2>
          {isMainAdmin ? (
            <p className="muted">Le mot de passe du compte admin principal se change dans le fichier <code>.env</code> (ADMIN_PASSWORD), puis en redémarrant le service d'authentification.</p>
          ) : (
            <>
              <label className="field">
                <span>Mot de passe actuel</span>
                <input id="current-password" type="password" autoComplete="current-password" required
                  value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
              </label>
              <label className="field">
                <span>Nouveau mot de passe (6 caractères minimum)</span>
                <input id="new-password" type="password" autoComplete="new-password" required minLength={6}
                  value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
              </label>
              <label className="field">
                <span>Confirme le nouveau mot de passe</span>
                <input id="confirm-password" type="password" autoComplete="new-password" required minLength={6}
                  value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
              </label>
              {passwordMessage && <p className={`notice ${passwordMessage.error ? "notice--error" : ""}`}>{passwordMessage.text}</p>}
              <button className="btn" disabled={savingPassword}>{savingPassword ? "Enregistrement…" : "Changer le mot de passe"}</button>
            </>
          )}
        </form>

        <form className="panel form danger-zone" onSubmit={deleteAccount}>
          <h2>Supprimer mon compte</h2>
          {isMainAdmin ? (
            <p className="muted">Le compte admin principal ne peut pas être supprimé.</p>
          ) : (
            <>
              <p className="muted">
                Ton compte et toutes tes données seront effacés définitivement : historique, favoris, playlists et scores du classement.
              </p>
              <label className="field">
                <span>Ton mot de passe, pour confirmer</span>
                <input id="delete-password" type="password" autoComplete="current-password" required
                  value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </label>
              <label className="checkbox">
                <input id="delete-understood" type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <span>Je comprends que cette action est définitive.</span>
              </label>
              {deleteMessage && <p className="notice notice--error">{deleteMessage.text}</p>}
              <button className="btn btn-danger" disabled={!understood || !deletePassword || deleting}>
                {deleting ? "Suppression…" : "Supprimer définitivement mon compte"}
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}
