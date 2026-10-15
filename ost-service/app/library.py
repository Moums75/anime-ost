"""Bibliothèque personnelle d'un utilisateur : historique d'écoute et playlists.

`user_id` vient du service d'auth (autre base) : c'est le BFF qui le fournit après
avoir vérifié le jeton, l'API Métier lui fait donc confiance.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_or_404
from .models import Favorite, GameScore, ListeningEntry, Ost, Playlist, PlaylistItem
from .schemas import (
    HistoryEntryOut, HistoryIn, HistoryPage, PlaylistDetail, PlaylistIn, PlaylistOrder,
    PlaylistPatch, PlaylistSummary,
)

router = APIRouter(prefix="/users/{user_id}")

# Réécouter la même OST peu après ne crée pas une nouvelle ligne : on rafraîchit l'heure
SAME_LISTEN_WINDOW = timedelta(minutes=30)
MAX_HISTORY = 500


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    # SQLite renvoie des dates sans fuseau : on les considère en UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# ---------- Suppression de compte ----------

@router.delete("")
def delete_user_data(user_id: int, db: Session = Depends(get_db)):
    """Efface tout ce qui appartient à un utilisateur (appelé par le BFF à la suppression du compte)."""
    deleted = {}
    for label, model in (("favorites", Favorite), ("history", ListeningEntry), ("game_scores", GameScore)):
        deleted[label] = db.execute(delete(model).where(model.user_id == user_id)).rowcount
    playlists = db.scalars(select(Playlist).where(Playlist.user_id == user_id)).all()
    for playlist in playlists:
        db.delete(playlist)  # supprime aussi son contenu (cascade)
    deleted["playlists"] = len(playlists)
    db.commit()
    return deleted


# ---------- Historique ----------

@router.get("/history", response_model=HistoryPage)
def list_history(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    base = select(ListeningEntry).where(ListeningEntry.user_id == user_id)
    total = db.scalar(select(func.count()).select_from(base.subquery()))
    items = db.scalars(
        base.order_by(ListeningEntry.played_at.desc(), ListeningEntry.id.desc()).limit(limit).offset(offset)
    ).all()
    return HistoryPage(items=items, total=total)


@router.post("/history", response_model=HistoryEntryOut, status_code=201)
def add_to_history(user_id: int, body: HistoryIn, db: Session = Depends(get_db)):
    get_or_404(db, Ost, body.ost_id, "OST")
    last = db.scalar(
        select(ListeningEntry)
        .where(ListeningEntry.user_id == user_id)
        .order_by(ListeningEntry.played_at.desc(), ListeningEntry.id.desc())
        .limit(1)
    )
    now = _now()
    if last and last.ost_id == body.ost_id and now - _as_utc(last.played_at) < SAME_LISTEN_WINDOW:
        last.played_at = now
        entry = last
    else:
        entry = ListeningEntry(user_id=user_id, ost_id=body.ost_id, played_at=now)
        db.add(entry)
    db.flush()

    # On ne garde que les MAX_HISTORY dernières écoutes
    too_old = (
        select(ListeningEntry.id)
        .where(ListeningEntry.user_id == user_id)
        .order_by(ListeningEntry.played_at.desc(), ListeningEntry.id.desc())
        .offset(MAX_HISTORY)
    )
    db.execute(delete(ListeningEntry).where(ListeningEntry.id.in_(too_old)))
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/history/{entry_id}", status_code=204)
def remove_history_entry(user_id: int, entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(ListeningEntry, entry_id)
    if entry and entry.user_id == user_id:
        db.delete(entry)
        db.commit()
    return Response(status_code=204)


@router.delete("/history", status_code=204)
def clear_history(user_id: int, db: Session = Depends(get_db)):
    db.execute(delete(ListeningEntry).where(ListeningEntry.user_id == user_id))
    db.commit()
    return Response(status_code=204)


# ---------- Playlists ----------

def _own_playlist(db: Session, user_id: int, playlist_id: int) -> Playlist:
    playlist = db.get(Playlist, playlist_id)
    # 404 (et pas 403) : on ne révèle pas l'existence des playlists des autres
    if not playlist or playlist.user_id != user_id:
        raise HTTPException(404, "Playlist introuvable")
    return playlist


@router.get("/playlists", response_model=list[PlaylistSummary])
def list_playlists(user_id: int, db: Session = Depends(get_db)):
    stmt = select(Playlist).where(Playlist.user_id == user_id).order_by(Playlist.updated_at.desc())
    return db.scalars(stmt).all()


@router.post("/playlists", response_model=PlaylistSummary, status_code=201)
def create_playlist(user_id: int, body: PlaylistIn, db: Session = Depends(get_db)):
    playlist = Playlist(user_id=user_id, name=body.name.strip(), description=body.description.strip())
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.get("/playlists/{playlist_id}", response_model=PlaylistDetail)
def get_playlist(user_id: int, playlist_id: int, db: Session = Depends(get_db)):
    return _own_playlist(db, user_id, playlist_id)


@router.patch("/playlists/{playlist_id}", response_model=PlaylistSummary)
def update_playlist(user_id: int, playlist_id: int, body: PlaylistPatch, db: Session = Depends(get_db)):
    playlist = _own_playlist(db, user_id, playlist_id)
    if body.name is not None:
        playlist.name = body.name.strip()
    if body.description is not None:
        playlist.description = body.description.strip()
    db.commit()
    db.refresh(playlist)
    return playlist


@router.delete("/playlists/{playlist_id}", status_code=204)
def delete_playlist(user_id: int, playlist_id: int, db: Session = Depends(get_db)):
    db.delete(_own_playlist(db, user_id, playlist_id))
    db.commit()
    return Response(status_code=204)


@router.put("/playlists/{playlist_id}/osts/{ost_id}", response_model=PlaylistSummary)
def add_to_playlist(user_id: int, playlist_id: int, ost_id: int, db: Session = Depends(get_db)):
    playlist = _own_playlist(db, user_id, playlist_id)
    get_or_404(db, Ost, ost_id, "OST")
    if ost_id not in playlist.ost_ids:  # pas de doublon dans une playlist
        last_position = max((item.position for item in playlist.items), default=-1)
        playlist.items.append(PlaylistItem(ost_id=ost_id, position=last_position + 1))
        playlist.updated_at = _now()
        db.commit()
        db.refresh(playlist)
    return playlist


@router.delete("/playlists/{playlist_id}/osts/{ost_id}", response_model=PlaylistSummary)
def remove_from_playlist(user_id: int, playlist_id: int, ost_id: int, db: Session = Depends(get_db)):
    playlist = _own_playlist(db, user_id, playlist_id)
    item = next((i for i in playlist.items if i.ost_id == ost_id), None)
    if item:
        playlist.items.remove(item)
        playlist.updated_at = _now()
        db.commit()
        db.refresh(playlist)
    return playlist


@router.put("/playlists/{playlist_id}/order", response_model=PlaylistDetail)
def reorder_playlist(user_id: int, playlist_id: int, body: PlaylistOrder, db: Session = Depends(get_db)):
    playlist = _own_playlist(db, user_id, playlist_id)
    if sorted(body.ost_ids) != sorted(playlist.ost_ids):
        raise HTTPException(400, "La nouvelle liste doit contenir exactement les mêmes OST")
    position = {ost_id: i for i, ost_id in enumerate(body.ost_ids)}
    for item in playlist.items:
        item.position = position[item.ost_id]
    playlist.updated_at = _now()
    db.commit()
    db.expire(playlist, ["items"])  # recharge les items dans le nouvel ordre
    return playlist
