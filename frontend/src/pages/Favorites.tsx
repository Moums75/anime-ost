import { useEffect, useState } from "react";
import { api } from "../api";
import { PlayIcon } from "../components/Icons";
import MusicGrid, { replaceOst } from "../components/MusicGrid";
import { usePlayer } from "../player";
import { isPlayable, type Ost } from "../types";

export default function Favorites() {
  const player = usePlayer();
  const [osts, setOsts] = useState<Ost[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.favorites().then(setOsts).catch((e) => setError(e.message));
  }, []);

  // Une OST retirée des favoris disparaît de la liste
  const favorites = osts.filter((o) => o.favorite);
  const firstPlayable = favorites.find(isPlayable);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Ta playlist · {favorites.length} titres</p>
          <h1>
            Mes <span className="gradient-text">favoris</span>
          </h1>
        </div>
        {firstPlayable && (
          <button className="btn btn-lg" onClick={() => player.play(firstPlayable, favorites)}>
            <PlayIcon /> Tout écouter
          </button>
        )}
      </header>
      {error && <p className="error">{error}</p>}
      <MusicGrid
        osts={favorites}
        onChange={(o) => setOsts((l) => replaceOst(l, o))}
        empty="Tu n'as pas encore de favoris. Clique sur le cœur d'une carte pour en ajouter."
      />
    </>
  );
}
