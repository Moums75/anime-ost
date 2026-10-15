import io
import math
import struct
import wave

from fastapi.testclient import TestClient

from app.main import app
from app.seed import CATALOG


def test_internal_key_is_required():
    with TestClient(app) as c:
        assert c.get("/animes").status_code == 403
        assert c.get("/animes", headers={"X-Internal-Key": "mauvaise"}).status_code == 403


def test_demo_catalog_is_seeded(client):
    titles = {a["title"] for a in client.get("/animes").json()}
    assert {"Naruto", "One Piece", "Attack on Titan", "Frieren"} <= titles


def test_osts_pagination(client):
    page = client.get("/osts", params={"limit": 5}).json()
    assert len(page["items"]) == 5
    assert page["total"] == sum(len(osts) for *_, osts in CATALOG)  # base neuve : le catalogue de démo
    second = client.get("/osts", params={"limit": 5, "offset": 5}).json()
    assert not {o["id"] for o in page["items"]} & {o["id"] for o in second["items"]}


def test_osts_search_and_filters(client):
    found = client.get("/osts", params={"q": "lisa"}).json()["items"]
    assert found and all("lisa" in (o["artist"] + o["title"] + o["anime_title"]).lower() for o in found)
    endings = client.get("/osts", params={"kind": "ending", "limit": 200}).json()["items"]
    assert endings and all(o["kind"] == "ending" for o in endings)


def test_create_and_delete_anime_cascades(client, anime):
    detail = client.get(f"/animes/{anime['id']}").json()
    assert detail["ost_count"] == 3 and len(detail["osts"]) == 3
    ost_id = anime["osts"][0]["id"]
    assert client.delete(f"/animes/{anime['id']}").status_code == 204
    assert client.get(f"/osts/{ost_id}").status_code == 404


def test_validation(client, anime):
    assert client.post("/animes", json={"title": anime["title"], "studio": "x", "year": 2020}).status_code == 409
    bad_kind = {"title": "x", "artist": "x", "kind": "remix", "youtube_url": "https://y.t", "anime_id": anime["id"]}
    assert client.post("/osts", json=bad_kind).status_code == 422
    no_anime = {"title": "x", "artist": "x", "kind": "ost", "youtube_url": "https://y.t", "anime_id": 999999}
    assert client.post("/osts", json=no_anime).status_code == 404


def _wav_bytes(seconds: float = 1.0) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(i / 5))) for i in range(int(8000 * seconds))))
    return buf.getvalue()


def test_audio_upload_and_range_streaming(client, anime):
    ost_id = anime["osts"][0]["id"]
    data = _wav_bytes()
    up = client.put(f"/osts/{ost_id}/audio", files={"file": ("son.wav", data, "audio/wav")})
    assert up.status_code == 200 and up.json()["audio_filename"].endswith(".wav")

    full = client.get(f"/osts/{ost_id}/audio")
    assert full.status_code == 200 and full.content == data
    partial = client.get(f"/osts/{ost_id}/audio", headers={"Range": "bytes=100-199"})
    assert partial.status_code == 206
    assert partial.content == data[100:200]
    assert partial.headers["content-range"] == f"bytes 100-199/{len(data)}"


def test_upload_rejects_bad_format(client, anime):
    ost_id = anime["osts"][0]["id"]
    r = client.put(f"/osts/{ost_id}/audio", files={"file": ("virus.exe", b"MZ...", "application/octet-stream")})
    assert r.status_code == 415


def test_deleting_ost_deletes_its_file(client, anime):
    from app.media import media_path

    ost_id = anime["osts"][1]["id"]
    filename = client.put(f"/osts/{ost_id}/audio", files={"file": ("son.wav", _wav_bytes(0.2), "audio/wav")}).json()["audio_filename"]
    assert media_path("audio", filename).is_file()
    client.delete(f"/osts/{ost_id}")
    assert not media_path("audio", filename).exists()
