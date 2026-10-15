"""Configuration des tests : base SQLite temporaire et secrets de test.

Les variables sont définies AVANT d'importer l'application (config.py les lit à l'import,
et le .env du projet n'écrase jamais une variable déjà définie).
"""

import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp(prefix="animeost-auth-tests-")
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_tmp}/auth-test.db",
        "INTERNAL_API_KEY": "test-internal-key",
        "JWT_SECRET": "test-secret-" + "x" * 40,
        "ADMIN_USERNAME": "admin",
        "ADMIN_PASSWORD": "admin-test-password",
        "LOGIN_MAX_FAILURES": "5",
        "LOGIN_LOCK_MINUTES": "5",
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app import login_limiter  # noqa: E402
from app.main import app  # noqa: E402

INTERNAL = {"X-Internal-Key": "test-internal-key"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app, headers=INTERNAL) as c:  # "with" lance le démarrage (création des tables, admin)
        yield c


@pytest.fixture(autouse=True)
def _reset_limiter():
    login_limiter.reset()
    yield


_counter = 0


@pytest.fixture
def new_user(client):
    """Crée un utilisateur unique ; renvoie (username, password, headers d'authentification)."""

    def make(password: str = "secret123"):
        global _counter
        _counter += 1
        username = f"user{_counter}"
        r = client.post("/auth/register", json={"username": username, "password": password})
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        return username, password, {"Authorization": f"Bearer {token}"}

    return make
