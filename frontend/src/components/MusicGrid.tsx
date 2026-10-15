import type { Ost } from "../types";
import MusicCard from "./MusicCard";

interface Props {
  osts: Ost[];
  onChange?: (ost: Ost) => void;
  empty: string;
}

export default function MusicGrid({ osts, onChange, empty }: Props) {
  if (osts.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="music-grid">
      {osts.map((ost, i) => (
        <MusicCard key={ost.id} ost={ost} number={i + 1} queue={osts} onChange={onChange} />
      ))}
    </div>
  );
}

/** Remplace une OST mise à jour (ex. favori) dans une liste */
export const replaceOst = (list: Ost[], updated: Ost) => list.map((o) => (o.id === updated.id ? updated : o));
