"""Mini-jeu OST Rush : enregistrement des scores et classements."""

import pytest


def submit(client, user_id, ost_id, score, perfect=30, great=5, good=0, miss=5, max_combo=20, difficulty="normal", username=None):
    return client.post(
        f"/users/{user_id}/scores",
        json={
            "ost_id": ost_id,
            "difficulty": difficulty,
            "username": username or f"joueur{user_id}",
            "score": score,
            "max_combo": max_combo,
            "counts": {"perfect": perfect, "great": great, "good": good, "miss": miss},
        },
    )


def test_best_score_is_kept(client, anime, user_id):
    ost = anime["osts"][0]["id"]
    first = submit(client, user_id, ost, 9000).json()
    assert first["new_record"] and first["rank"] == 1 and first["players"] == 1
    worse = submit(client, user_id, ost, 5000).json()
    assert not worse["new_record"] and worse["best"]["score"] == 9000 and worse["best"]["attempts"] == 2
    better = submit(client, user_id, ost, 12000, perfect=38, great=2, miss=0, max_combo=40).json()
    assert better["new_record"] and better["best"]["score"] == 12000 and better["best"]["attempts"] == 3


def test_accuracy_and_grade_are_computed_by_the_server(client, anime, user_id):
    best = submit(client, user_id, anime["osts"][0]["id"], 1000, perfect=19, great=0, good=0, miss=1, max_combo=19).json()["best"]
    assert best["accuracy"] == pytest.approx(0.95)
    assert best["grade"] == "S"


@pytest.mark.parametrize(
    "payload, message",
    [
        ({"score": 999_999, "perfect": 5, "great": 0, "good": 0, "miss": 0, "max_combo": 5}, "Score incohérent"),
        ({"score": 100, "perfect": 5, "great": 0, "good": 0, "miss": 0, "max_combo": 50}, "Combo incohérent"),
        ({"score": 0, "perfect": 0, "great": 0, "good": 0, "miss": 0, "max_combo": 0}, "Partie vide"),
    ],
)
def test_impossible_scores_are_refused(client, anime, user_id, payload, message):
    r = submit(client, user_id, anime["osts"][0]["id"], **payload)
    assert r.status_code == 422 and message in r.json()["detail"]


def test_invalid_difficulty(client, anime, user_id):
    assert submit(client, user_id, anime["osts"][0]["id"], 100, difficulty="legendaire").status_code == 422


def test_leaderboard_ranks_with_ties_and_per_difficulty(client, anime, user_id):
    ost = anime["osts"][1]["id"]
    a, b, c = user_id, user_id + 10_000, user_id + 20_000
    submit(client, a, ost, 12000, perfect=40, miss=0, max_combo=40)
    submit(client, b, ost, 12000, perfect=40, miss=0, max_combo=40)
    submit(client, c, ost, 8000)
    submit(client, c, ost, 500, difficulty="hard", perfect=2, great=0, miss=0, max_combo=2)

    board = client.get(f"/leaderboard/osts/{ost}", params={"difficulty": "normal"}).json()
    assert [(row["user_id"], row["rank"]) for row in board] == [(a, 1), (b, 1), (c, 3)]  # égalité = même rang
    hard = client.get(f"/leaderboard/osts/{ost}", params={"difficulty": "hard"}).json()
    assert [row["user_id"] for row in hard] == [c]


def test_players_ranking_and_my_scores(client, anime, user_id):
    o1, o2 = anime["osts"][0]["id"], anime["osts"][2]["id"]
    submit(client, user_id, o1, 3000, username="champion")
    submit(client, user_id, o2, 4000, username="champion")
    me = next(p for p in client.get("/leaderboard/players", params={"limit": 100}).json() if p["user_id"] == user_id)
    assert me["username"] == "champion" and me["total_score"] == 7000 and me["titles"] == 2
    mine = client.get(f"/users/{user_id}/scores").json()
    assert {s["ost"]["id"] for s in mine} == {o1, o2} and all(s["rank"] >= 1 for s in mine)


def test_scores_are_deleted_with_user_data(client, anime, user_id):
    submit(client, user_id, anime["osts"][0]["id"], 1000)
    assert client.delete(f"/users/{user_id}").json()["game_scores"] == 1
    assert client.get(f"/users/{user_id}/scores").json() == []
