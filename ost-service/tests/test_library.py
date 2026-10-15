"""Favoris, historique d'écoute, playlists, suppression des données d'un utilisateur."""


def test_favorites(client, anime, user_id):
    ost_id = anime["osts"][0]["id"]
    assert client.put(f"/users/{user_id}/favorites/{ost_id}").status_code == 204
    assert client.put(f"/users/{user_id}/favorites/{ost_id}").status_code == 204  # idempotent
    assert [o["id"] for o in client.get(f"/users/{user_id}/favorites").json()] == [ost_id]
    client.delete(f"/users/{user_id}/favorites/{ost_id}")
    assert client.get(f"/users/{user_id}/favorites").json() == []


def test_history_merges_same_ost_and_orders_recent_first(client, anime, user_id):
    a, b = anime["osts"][0]["id"], anime["osts"][1]["id"]
    for ost_id in (a, a, b):
        assert client.post(f"/users/{user_id}/history", json={"ost_id": ost_id}).status_code == 201
    page = client.get(f"/users/{user_id}/history").json()
    assert page["total"] == 2  # la 2e écoute de A, juste après la 1re, n'a pas créé de ligne
    assert [e["ost"]["id"] for e in page["items"]] == [b, a]
    assert page["items"][0]["played_at"].endswith("Z")  # dates en UTC explicite


def test_history_is_private_and_clearable(client, anime, user_id):
    other = user_id + 50_000
    client.post(f"/users/{user_id}/history", json={"ost_id": anime["osts"][0]["id"]})
    entry_id = client.get(f"/users/{user_id}/history").json()["items"][0]["id"]
    client.delete(f"/users/{other}/history/{entry_id}")  # un autre utilisateur ne peut pas la supprimer
    assert client.get(f"/users/{user_id}/history").json()["total"] == 1
    client.delete(f"/users/{user_id}/history")
    assert client.get(f"/users/{user_id}/history").json()["total"] == 0


def test_playlist_lifecycle(client, anime, user_id):
    ids = [o["id"] for o in anime["osts"]]
    playlist = client.post(f"/users/{user_id}/playlists", json={"name": "  Openings  "}).json()
    assert playlist["name"] == "Openings" and playlist["ost_count"] == 0
    pid = playlist["id"]

    for ost_id in ids + [ids[0]]:  # le doublon est ignoré
        client.put(f"/users/{user_id}/playlists/{pid}/osts/{ost_id}")
    detail = client.get(f"/users/{user_id}/playlists/{pid}").json()
    assert [o["id"] for o in detail["osts"]] == ids

    reordered = client.put(f"/users/{user_id}/playlists/{pid}/order", json={"ost_ids": ids[::-1]}).json()
    assert [o["id"] for o in reordered["osts"]] == ids[::-1]
    assert client.put(f"/users/{user_id}/playlists/{pid}/order", json={"ost_ids": ids[:1]}).status_code == 400

    renamed = client.patch(f"/users/{user_id}/playlists/{pid}", json={"name": "Cultes"}).json()
    assert renamed["name"] == "Cultes"
    after = client.delete(f"/users/{user_id}/playlists/{pid}/osts/{ids[0]}").json()
    assert ids[0] not in after["ost_ids"]

    assert client.delete(f"/users/{user_id}/playlists/{pid}").status_code == 204
    assert client.get(f"/users/{user_id}/playlists").json() == []


def test_playlists_are_private(client, user_id):
    pid = client.post(f"/users/{user_id}/playlists", json={"name": "Perso"}).json()["id"]
    intruder = user_id + 50_000
    assert client.get(f"/users/{intruder}/playlists/{pid}").status_code == 404
    assert client.delete(f"/users/{intruder}/playlists/{pid}").status_code == 404
    assert client.get(f"/users/{user_id}/playlists/{pid}").status_code == 200


def test_deleting_an_ost_removes_it_everywhere(client, anime, user_id):
    ost_id = anime["osts"][2]["id"]
    client.put(f"/users/{user_id}/favorites/{ost_id}")
    client.post(f"/users/{user_id}/history", json={"ost_id": ost_id})
    pid = client.post(f"/users/{user_id}/playlists", json={"name": "x"}).json()["id"]
    client.put(f"/users/{user_id}/playlists/{pid}/osts/{ost_id}")
    client.delete(f"/osts/{ost_id}")
    assert client.get(f"/users/{user_id}/favorites").json() == []
    assert client.get(f"/users/{user_id}/history").json()["total"] == 0
    assert client.get(f"/users/{user_id}/playlists/{pid}").json()["ost_count"] == 0


def test_delete_user_data(client, anime, user_id):
    ost_id = anime["osts"][0]["id"]
    client.put(f"/users/{user_id}/favorites/{ost_id}")
    client.post(f"/users/{user_id}/history", json={"ost_id": ost_id})
    pid = client.post(f"/users/{user_id}/playlists", json={"name": "x"}).json()["id"]
    client.put(f"/users/{user_id}/playlists/{pid}/osts/{ost_id}")
    deleted = client.delete(f"/users/{user_id}").json()
    assert deleted == {"favorites": 1, "history": 1, "game_scores": 0, "playlists": 1}
    assert client.get(f"/users/{user_id}/playlists").json() == []
