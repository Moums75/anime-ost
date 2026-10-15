import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CloseIcon, PlayIcon, TrashIcon } from "../components/Icons";
import TrackRow from "../components/TrackRow";
import { HISTORY_EVENT } from "../library";
import { usePlayer } from "../player";
import { isPlayable, type HistoryEntry, type Ost } from "../types";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  const label = longDay.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Regroupe les écoutes par jour, dans l'ordre (les plus récentes d'abord). */
function groupByDay(entries: HistoryEntry[]) {
  const groups: { label: string; entries: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(new Date(entry.played_at));
    if (groups.at(-1)?.label !== label) groups.push({ label, entries: [] });
    groups.at(-1)!.entries.push(entry);
  }
  return groups;
}

/** Une même OST peut apparaître plusieurs fois : la file de lecture ne la garde qu'une fois. */
const uniqueOsts = (entries: HistoryEntry[]): Ost[] => [...new Map(entries.map((e) => [e.ost.id, e.ost])).values()];

export default function History() {
  const player = usePlayer();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .history(200)
      .then((page) => {
        setEntries(page.items);
        setTotal(page.total);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Se met à jour tout seul quand une nouvelle écoute est enregistrée par le lecteur
  useEffect(() => {
    load();
    window.addEventListener(HISTORY_EVENT, load);
    return () => window.removeEventListener(HISTORY_EVENT, load);
  }, [load]);

  const remove = async (entry: HistoryEntry) => {
    await api.removeFromHistory(entry.id);
    setEntries((list) => list.filter((e) => e.id !== entry.id));
    setTotal((n) => n - 1);
  };

  const clear = async () => {
    if (!confirm("Effacer tout ton historique d'écoute ?")) return;
    await api.clearHistory();
    setEntries([]);
    setTotal(0);
  };

  const queue = uniqueOsts(entries);
  const first = queue.find(isPlayable);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Ton historique · {total} écoute{total > 1 ? "s" : ""}</p>
          <h1>
            Écouté <span className="gradient-text">récemment</span>
          </h1>
          <p className="muted">Retrouve ce que tu as écouté et relance-le en un clic.</p>
        </div>
        {entries.length > 0 && (
          <div className="page-actions">
            {first && (
              <button className="btn btn-lg" onClick={() => player.play(first, queue)}>
                <PlayIcon /> Tout réécouter
              </button>
            )}
            <button className="btn btn-ghost" onClick={clear}>
              <TrashIcon /> Effacer l'historique
            </button>
          </div>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {!loading && entries.length === 0 && !error && (
        <div className="empty-state">
          <p>Rien pour l'instant. Lance une OST : elle apparaîtra ici.</p>
          <Link to="/musiques" className="btn">Parcourir les musiques</Link>
        </div>
      )}

      {groupByDay(entries).map((group) => (
        <section key={group.label} className="history-day">
          <h2 className="history-day__title">{group.label}</h2>
          <ul className="track-list">
            {group.entries.map((entry) => (
              <TrackRow
                key={entry.id}
                ost={entry.ost}
                queue={queue}
                meta={time.format(new Date(entry.played_at))}
                actions={
                  <button className="icon-btn" title="Retirer de l'historique" onClick={() => remove(entry)}>
                    <CloseIcon />
                  </button>
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
