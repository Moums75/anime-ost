import threading
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from .anilist import fill_cover, fill_missing_covers
from .database import Base, SessionLocal, add_missing_columns, engine, get_db
from .deps import get_or_404, require_internal_key
from .game import router as game_router
from .library import router as library_router
from .media import MediaKind, delete_media, media_path, media_type, save_upload
from .models import Anime, Favorite, Ost
from .schemas import AnimeDetail, AnimeIn, AnimeOut, Kind, OstIn, OstOut, OstPage
from .seed import SEARCH_PREFIX, sync_catalog


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    add_missing_columns()
    with SessionLocal() as db:
        sync_catalog(db)
    # Les pochettes viennent d'une API externe : on ne bloque pas le démarrage pour elles
    threading.Thread(target=_fill_covers_in_background, daemon=True).start()
    yield


def _fill_covers_in_background() -> None:
    with SessionLocal() as db:
        fill_missing_covers(db)


app = FastAPI(title="Anime OST - API Métier", lifespan=lifespan)
router = APIRouter(dependencies=[Depends(require_internal_key)])


def delete_ost_files(osts: list[Ost]) -> None:
    for ost in osts:
        delete_media("audio", ost.audio_filename)
        delete_media("cover", ost.cover_filename)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Animes ----------

@router.get("/animes", response_model=list[AnimeOut])
def list_animes(db: Session = Depends(get_db)):
    return db.scalars(select(Anime).order_by(Anime.title)).all()


@router.get("/animes/{anime_id}", response_model=AnimeDetail)
def get_anime(anime_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Anime, anime_id, "Anime")


@router.post("/animes", response_model=AnimeOut, status_code=201)
def create_anime(body: AnimeIn, db: Session = Depends(get_db)):
    if db.scalar(select(Anime).where(Anime.title == body.title)):
        raise HTTPException(409, "Cet anime existe déjà")
    anime = Anime(**body.model_dump())
    fill_cover(anime)
    db.add(anime)
    db.commit()
    db.refresh(anime)
    return anime


@router.delete("/animes/{anime_id}", status_code=204)
def delete_anime(anime_id: int, db: Session = Depends(get_db)):
    anime = get_or_404(db, Anime, anime_id, "Anime")
    osts = list(anime.osts)
    db.delete(anime)
    db.commit()
    delete_ost_files(osts)
    return Response(status_code=204)


# ---------- OST ----------

@router.get("/osts", response_model=OstPage)
def list_osts(
    q: str | None = None,
    anime_id: int | None = None,
    kind: Kind | None = None,
    limit: int = Query(24, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Ost).join(Ost.anime)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(Ost.title.ilike(pattern), Ost.artist.ilike(pattern), Anime.title.ilike(pattern))
        )
    if anime_id is not None:
        stmt = stmt.where(Ost.anime_id == anime_id)
    if kind:
        stmt = stmt.where(Ost.kind == kind)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    # D'abord les titres avec fichier audio, puis ceux avec une vidéo YouTube, puis les simples liens
    playability = case(
        (Ost.audio_filename.is_not(None), 0),
        (Ost.youtube_url.startswith(SEARCH_PREFIX), 2),
        else_=1,
    )
    stmt = stmt.order_by(playability, Ost.created_at.desc(), Ost.id.desc())
    items = db.scalars(stmt.limit(limit).offset(offset)).all()
    return OstPage(items=items, total=total)


@router.get("/osts/{ost_id}", response_model=OstOut)
def get_ost(ost_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Ost, ost_id, "OST")


@router.post("/osts", response_model=OstOut, status_code=201)
def create_ost(body: OstIn, db: Session = Depends(get_db)):
    get_or_404(db, Anime, body.anime_id, "Anime")
    ost = Ost(**body.model_dump())
    db.add(ost)
    db.commit()
    db.refresh(ost)
    return ost


@router.delete("/osts/{ost_id}", status_code=204)
def delete_ost(ost_id: int, db: Session = Depends(get_db)):
    ost = get_or_404(db, Ost, ost_id, "OST")
    db.delete(ost)
    db.commit()
    delete_ost_files([ost])
    return Response(status_code=204)


# ---------- Fichiers audio & pochettes ----------

FILENAME_COLUMN = {"audio": "audio_filename", "cover": "cover_filename"}


@router.put("/osts/{ost_id}/{kind}", response_model=OstOut)
def upload_media(ost_id: int, kind: MediaKind, file: UploadFile, db: Session = Depends(get_db)):
    ost = get_or_404(db, Ost, ost_id, "OST")
    column = FILENAME_COLUMN[kind]
    old_filename = getattr(ost, column)
    setattr(ost, column, save_upload(kind, ost.id, file))
    db.commit()
    delete_media(kind, old_filename)
    db.refresh(ost)
    return ost


@router.get("/osts/{ost_id}/{kind}")
def stream_media(ost_id: int, kind: MediaKind, db: Session = Depends(get_db)):
    """Renvoie le fichier. FileResponse gère l'en-tête Range : le navigateur peut
    lire la musique en streaming et se déplacer dans le morceau sans tout télécharger."""
    ost = get_or_404(db, Ost, ost_id, "OST")
    filename = getattr(ost, FILENAME_COLUMN[kind])
    if not filename or not media_path(kind, filename).is_file():
        raise HTTPException(404, "Aucun fichier pour cette OST")
    return FileResponse(media_path(kind, filename), media_type=media_type(filename))


# ---------- Favoris ----------

@router.get("/users/{user_id}/favorites", response_model=list[OstOut])
def list_favorites(user_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Ost)
        .join(Favorite)
        .where(Favorite.user_id == user_id)
        .order_by(Favorite.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.put("/users/{user_id}/favorites/{ost_id}", status_code=204)
def add_favorite(user_id: int, ost_id: int, db: Session = Depends(get_db)):
    get_or_404(db, Ost, ost_id, "OST")
    if not db.get(Favorite, (user_id, ost_id)):
        db.add(Favorite(user_id=user_id, ost_id=ost_id))
        db.commit()
    return Response(status_code=204)


@router.delete("/users/{user_id}/favorites/{ost_id}", status_code=204)
def remove_favorite(user_id: int, ost_id: int, db: Session = Depends(get_db)):
    favorite = db.get(Favorite, (user_id, ost_id))
    if favorite:
        db.delete(favorite)
        db.commit()
    return Response(status_code=204)


app.include_router(router)
app.include_router(library_router, dependencies=[Depends(require_internal_key)])
app.include_router(game_router, dependencies=[Depends(require_internal_key)])
