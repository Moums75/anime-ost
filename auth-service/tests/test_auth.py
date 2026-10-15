from fastapi.testclient import TestClient

from app.main import app


def test_health_is_public():
    with TestClient(app) as c:
        assert c.get("/health").json() == {"status": "ok"}


def test_internal_key_is_required():
    with TestClient(app) as c:
        r = c.post("/auth/login", json={"username": "admin", "password": "x"})
    assert r.status_code == 403


# ---------- Inscription / connexion ----------

def test_register_returns_token_and_user(client):
    r = client.post("/auth/register", json={"username": "alice", "password": "secret123"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["username"] == "alice"
    assert body["user"]["role"] == "user"
    assert body["access_token"]


def test_register_duplicate_username(client, new_user):
    username, _, _ = new_user()
    r = client.post("/auth/register", json={"username": username, "password": "secret123"})
    assert r.status_code == 409


def test_register_validation(client):
    assert client.post("/auth/register", json={"username": "ab", "password": "secret123"}).status_code == 422
    assert client.post("/auth/register", json={"username": "bad name!", "password": "secret123"}).status_code == 422
    assert client.post("/auth/register", json={"username": "shortpwd", "password": "123"}).status_code == 422
    # bcrypt ne lit que 72 octets : on refuse au-delà plutôt que de tronquer en silence
    assert client.post("/auth/register", json={"username": "longpwd", "password": "é" * 40}).status_code == 422


def test_password_is_hashed(client, new_user):
    from app.database import SessionLocal
    from app.models import User
    from sqlalchemy import select

    username, password, _ = new_user()
    with SessionLocal() as db:
        stored = db.scalar(select(User).where(User.username == username)).password_hash
    assert stored != password and stored.startswith("$2")


def test_login_and_verify(client, new_user):
    username, password, _ = new_user()
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["username"] == username


def test_login_wrong_password(client, new_user):
    username, _, _ = new_user()
    r = client.post("/auth/login", json={"username": username, "password": "mauvais"})
    assert r.status_code == 401


def test_verify_rejects_bad_tokens(client):
    assert client.get("/auth/verify").status_code == 401
    assert client.get("/auth/verify", headers={"Authorization": "Bearer pas-un-jwt"}).status_code == 401


def test_admin_is_seeded(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "admin-test-password"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


# ---------- Anti force brute ----------

def test_account_locked_after_5_failures(client, new_user):
    username, password, _ = new_user()
    for _ in range(5):
        assert client.post("/auth/login", json={"username": username, "password": "faux"}).status_code == 401
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 429  # bloqué même avec le bon mot de passe
    assert int(r.headers["Retry-After"]) > 0


def test_success_resets_failure_counter(client, new_user):
    username, password, _ = new_user()
    for _ in range(4):
        client.post("/auth/login", json={"username": username, "password": "faux"})
    assert client.post("/auth/login", json={"username": username, "password": password}).status_code == 200
    for _ in range(4):
        client.post("/auth/login", json={"username": username, "password": "faux"})
    assert client.post("/auth/login", json={"username": username, "password": password}).status_code == 200


def test_lock_does_not_affect_other_accounts(client, new_user):
    locked, _, _ = new_user()
    other, other_password, _ = new_user()
    for _ in range(5):
        client.post("/auth/login", json={"username": locked, "password": "faux"})
    assert client.post("/auth/login", json={"username": other, "password": other_password}).status_code == 200


# ---------- Mon compte ----------

def test_change_password(client, new_user):
    username, password, headers = new_user()
    bad = client.put("/auth/password", headers=headers, json={"current_password": "faux", "new_password": "nouveau123"})
    assert bad.status_code == 403
    same = client.put("/auth/password", headers=headers, json={"current_password": password, "new_password": password})
    assert same.status_code == 422
    ok = client.put("/auth/password", headers=headers, json={"current_password": password, "new_password": "nouveau123"})
    assert ok.status_code == 204
    assert client.post("/auth/login", json={"username": username, "password": password}).status_code == 401
    assert client.post("/auth/login", json={"username": username, "password": "nouveau123"}).status_code == 200


def test_delete_account(client, new_user):
    username, password, headers = new_user()
    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": "faux"}).status_code == 403
    r = client.request("DELETE", "/auth/me", headers=headers, json={"password": password})
    assert r.status_code == 200 and r.json()["username"] == username
    assert client.get("/auth/verify", headers=headers).status_code == 401  # le jeton ne sert plus à rien
    assert client.post("/auth/login", json={"username": username, "password": password}).status_code == 401


def test_deleted_id_is_never_reused(client, new_user):
    _, password, headers = new_user()
    deleted_id = client.get("/auth/verify", headers=headers).json()["id"]
    client.request("DELETE", "/auth/me", headers=headers, json={"password": password})
    _, _, new_headers = new_user()
    assert client.get("/auth/verify", headers=new_headers).json()["id"] > deleted_id


def test_main_admin_is_protected(client):
    token = client.post("/auth/login", json={"username": "admin", "password": "admin-test-password"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": "admin-test-password"}).status_code == 403
    change = client.put("/auth/password", headers=headers, json={"current_password": "admin-test-password", "new_password": "autre123"})
    assert change.status_code == 403
