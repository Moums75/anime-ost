"""Client minimal de l'API publique AniList (https://docs.anilist.co) pour les pochettes.

Les images ne sont pas copiées chez nous : on stocke seulement leur URL (CDN AniList).
"""

import json
import logging
import time
import urllib.request

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config
from .models import Anime

log = logging.getLogger(__name__)
TIMEOUT_SECONDS = 8

BATCH_QUERY = """
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: ANIME) { idMal coverImage { extraLarge } }
  }
}"""

SEARCH_QUERY = """
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) { idMal coverImage { extraLarge } }
}"""


def _graphql(query: str, variables: dict) -> dict:
    request = urllib.request.Request(
        config.ANILIST_URL,
        data=json.dumps({"query": query, "variables": variables}).encode(),
        # AniList refuse (403) le User-Agent par défaut de urllib
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AnimeOST/1.0 (projet etudiant M1)",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.load(response)["data"]


def covers_by_mal_id(mal_ids: list[int]) -> dict[int, str]:
    """Pochettes de plusieurs animes en une seule requête."""
    covers: dict[int, str] = {}
    for start in range(0, len(mal_ids), 50):
        data = _graphql(BATCH_QUERY, {"ids": mal_ids[start:start + 50]})
        for media in data["Page"]["media"]:
            covers[media["idMal"]] = media["coverImage"]["extraLarge"]
    return covers


def search_cover(title: str) -> tuple[int | None, str] | None:
    """Cherche un anime par son titre ; renvoie (mal_id, url de la pochette)."""
    media = _graphql(SEARCH_QUERY, {"search": title}).get("Media")
    if not media:
        return None
    return media["idMal"], media["coverImage"]["extraLarge"]


def fill_cover(anime: Anime) -> None:
    """Complète la pochette d'un anime (sans lever d'erreur si AniList est injoignable)."""
    if not config.COVER_LOOKUP_ENABLED:
        return
    try:
        if anime.mal_id:
            anime.image_url = covers_by_mal_id([anime.mal_id]).get(anime.mal_id)
        elif found := search_cover(anime.title):
            anime.mal_id, anime.image_url = found
    except Exception as exc:  # réseau, quota, format inattendu…
        log.warning("Pochette introuvable pour %s : %s", anime.title, exc)


def fill_missing_covers(db: Session) -> None:
    """Complète toutes les pochettes manquantes (appelé au démarrage, en arrière-plan)."""
    if not config.COVER_LOOKUP_ENABLED:
        return
    missing = db.scalars(select(Anime).where(Anime.image_url.is_(None))).all()
    with_id = [a for a in missing if a.mal_id]
    try:
        covers = covers_by_mal_id([a.mal_id for a in with_id]) if with_id else {}
    except Exception as exc:
        log.warning("AniList injoignable, pochettes non mises à jour : %s", exc)
        return
    for anime in with_id:
        anime.image_url = covers.get(anime.mal_id)
    for anime in (a for a in missing if not a.mal_id):
        fill_cover(anime)
        time.sleep(0.7)  # AniList limite le nombre de requêtes par minute
    db.commit()
