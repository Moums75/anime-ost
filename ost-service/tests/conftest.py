"""Configuration des tests : base SQLite et dossier media temporaires, AniList désactivé."""

import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp(prefix="animeost-ost-tests-")
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_tmp}/ost-test.db",
        "MEDIA_DIR": os.path.join(_tmp, "media"),
        "INTERNAL_API_KEY": "test-internal-key",
        "COVER_LOOKUP_ENABLED": "0",  # pas d'appel réseau pendant les tests
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

INTERNAL = {"X-Internal-Key": "test-internal-key"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app, headers=INTERNAL) as c:  # "with" lance le démarrage (tables + catalogue)
        yield c


@pytest.fixture
def anime(client):
    """Un anime de test avec 3 OST, supprimé après le test."""
    import uuid

    a = client.post("/animes", json={"title": f"Test {uuid.uuid4().hex[:8]}", "studio": "Studio", "year": 2024}).json()
    osts = [
        client.post(
            "/osts",
            json={"title": f"Titre {i}", "artist": "Artiste", "kind": "opening", "youtube_url": "https://www.youtube.com/watch?v=abcdefghijk", "anime_id": a["id"]},
        ).json()
        for i in range(3)
    ]
    yield {**a, "osts": osts}
    client.delete(f"/animes/{a['id']}")


_user = 1000


@pytest.fixture
def user_id():
    """Un id d'utilisateur neuf (les ids viennent normalement du service d'auth)."""
    global _user
    _user += 1
    return _user
