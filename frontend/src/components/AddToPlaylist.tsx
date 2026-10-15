import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useLibrary } from "../library";
import type { Ost } from "../types";
import { CheckIcon, PlaylistAddIcon, PlusIcon } from "./Icons";

const MENU_WIDTH = 260;

interface Props {
  ost: Ost;
  className?: string;
}

/**
 * Bouton « Ajouter à une playlist » + son menu. Le menu est rendu dans <body> (portal)
 * pour ne pas être coupé par les cartes (overflow: hidden) ni par la barre du lecteur.
 */
export default function AddToPlaylist({ ost, className = "icon-btn" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!user) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        title="Ajouter à une playlist"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation(); // ne lance pas la lecture de la carte
          setOpen((o) => !o);
        }}
      >
        <PlaylistAddIcon />
      </button>
      {open && <PlaylistMenu ost={ost} anchor={buttonRef.current!} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlaylistMenu({ ost, anchor, onClose }: { ost: Ost; anchor: HTMLElement; onClose: () => void }) {
  const { playlists, createPlaylist, togglePlaylist } = useLibrary();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");

  // Sous le bouton, ou au-dessus s'il n'y a pas la place (ex. bouton du lecteur en bas)
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + 8;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
  }, [anchor, playlists.length]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // La page défile : le menu ne serait plus collé à son bouton, on le ferme (sauf défilement du menu lui-même)
    const onScroll = (e: Event) => !menuRef.current?.contains(e.target as Node) && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  const run = async (key: number | "new", action: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    run("new", async () => {
      const playlist = await createPlaylist(name.trim());
      await togglePlaylist(playlist, ost);
      setName("");
    });
  };

  // Les événements d'un portal remontent quand même jusqu'à la carte React parente :
  // on les arrête ici pour qu'un clic (ou une espace tapée dans le champ) ne lance pas la lecture.
  const stop = (e: SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      ref={menuRef}
      className="playlist-menu"
      role="menu"
      style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
      onClick={stop}
      onKeyDown={stop}
    >
      <p className="playlist-menu__title">Ajouter « {ost.title} » à…</p>
      {playlists.length === 0 && <p className="playlist-menu__empty">Aucune playlist pour l'instant.</p>}
      <ul>
        {playlists.map((p) => {
          const inside = p.ost_ids.includes(ost.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={inside}
                className={inside ? "is-in" : ""}
                disabled={busy !== null}
                onClick={() => run(p.id, () => togglePlaylist(p, ost))}
              >
                <span className="playlist-menu__check">{inside && <CheckIcon />}</span>
                <span className="playlist-menu__name">{p.name}</span>
                <span className="playlist-menu__count">{p.ost_count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <form className="playlist-menu__new" onSubmit={create}>
        <input
          id={`new-playlist-${ost.id}`}
          placeholder="Nouvelle playlist…"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nom de la nouvelle playlist"
        />
        <button type="submit" className="icon-btn" disabled={!name.trim() || busy !== null} title="Créer et ajouter">
          <PlusIcon />
        </button>
      </form>
      {error && <p className="error playlist-menu__error">{error}</p>}
      <Link to="/playlists" className="playlist-menu__link" onClick={onClose}>Voir mes playlists →</Link>
    </div>,
    document.body,
  );
}
