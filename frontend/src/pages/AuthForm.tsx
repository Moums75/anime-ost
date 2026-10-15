import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (isLogin ? auth.login : auth.register)(username, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth-form" onSubmit={submit}>
      <h1>{isLogin ? "Connexion" : "Inscription"}</h1>
      <label>
        Nom d'utilisateur
        <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={isLogin ? undefined : 6}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>
        {isLogin ? "Se connecter" : "Créer mon compte"}
      </button>
      <p className="muted">
        {isLogin ? (
          <>Pas de compte ? <Link to="/register">Inscris-toi</Link></>
        ) : (
          <>Déjà inscrit ? <Link to="/login">Connecte-toi</Link></>
        )}
      </p>
    </form>
  );
}
