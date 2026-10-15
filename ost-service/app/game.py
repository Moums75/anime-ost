"""Mini-jeu OST Rush : enregistrement des scores et classements.

Le jeu tourne dans le navigateur, donc le score reçu peut avoir été trafiqué. On ne peut
pas tout empêcher sans rejouer la partie côté serveur, mais on refuse les scores
incohérents et on recalcule nous-mêmes la précision et la note.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_or_404
from .models import GameScore, Ost
from .schemas import (
    Difficulty, JudgementCounts, PlayerRanking, PlayerScore, RankedScore, ScoreIn, ScoreOut, SubmitResult,
)

router = APIRouter()

# Mêmes règles que le jeu (frontend/src/game/engine.ts)
POINTS = {"perfect": 300, "great": 200, "good": 100}
ACCURACY = {"perfect": 1.0, "great": 0.7, "good": 0.4, "miss": 0.0}
MAX_COMBO_BONUS = 2  # le bonus de combo plafonne à ×2


def accuracy_of(counts: JudgementCounts) -> float:
    total = counts.perfect + counts.great + counts.good + counts.miss
    if total == 0:
        return 0.0
    return sum(getattr(counts, j) * w for j, w in ACCURACY.items()) / total


def grade_of(accuracy: float) -> str:
    for threshold, letter in ((0.95, "S"), (0.85, "A"), (0.7, "B"), (0.55, "C")):
        if accuracy >= threshold:
            return letter
    return "D"


def check_consistency(body: ScoreIn) -> None:
    c = body.counts
    hits = c.perfect + c.great + c.good
    if hits + c.miss == 0:
        raise HTTPException(422, "Partie vide")
    max_score = sum(getattr(c, j) * p for j, p in POINTS.items()) * MAX_COMBO_BONUS
    if body.score > max_score:
        raise HTTPException(422, "Score incohérent avec les notes jouées")
    if body.max_combo > hits:
        raise HTTPException(422, "Combo incohérent avec les notes jouées")


def rank_of(db: Session, ost_id: int, difficulty: str, score: int) -> int:
    better = db.scalar(
        select(func.count()).select_from(GameScore)
        .where(GameScore.ost_id == ost_id, GameScore.difficulty == difficulty, GameScore.score > score)
    )
    return better + 1


@router.post("/users/{user_id}/scores", response_model=SubmitResult)
def submit_score(user_id: int, body: ScoreIn, db: Session = Depends(get_db)):
    get_or_404(db, Ost, body.ost_id, "OST")
    check_consistency(body)
    accuracy = accuracy_of(body.counts)
    fields = dict(
        score=body.score, accuracy=round(accuracy, 4), grade=grade_of(accuracy), max_combo=body.max_combo,
        perfect=body.counts.perfect, great=body.counts.great, good=body.counts.good, miss=body.counts.miss,
        played_at=datetime.now(timezone.utc),
    )

    best = db.scalar(
        select(GameScore).where(
            GameScore.user_id == user_id, GameScore.ost_id == body.ost_id, GameScore.difficulty == body.difficulty
        )
    )
    new_record = best is None or body.score > best.score
    if best is None:
        best = GameScore(user_id=user_id, username=body.username, ost_id=body.ost_id, difficulty=body.difficulty, **fields)
        db.add(best)
    else:
        best.attempts += 1
        best.username = body.username
        if new_record:
            for key, value in fields.items():
                setattr(best, key, value)
    db.commit()
    db.refresh(best)

    players = db.scalar(
        select(func.count()).select_from(GameScore)
        .where(GameScore.ost_id == body.ost_id, GameScore.difficulty == body.difficulty)
    )
    return SubmitResult(
        best=best, new_record=new_record, rank=rank_of(db, body.ost_id, body.difficulty, best.score), players=players
    )


@router.get("/leaderboard/osts/{ost_id}", response_model=list[RankedScore])
def ost_leaderboard(
    ost_id: int,
    difficulty: Difficulty = "normal",
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Classement d'un titre : le meilleur score de chaque joueur (à égalité, le premier arrivé passe devant)."""
    get_or_404(db, Ost, ost_id, "OST")
    rows = db.scalars(
        select(GameScore)
        .where(GameScore.ost_id == ost_id, GameScore.difficulty == difficulty)
        .order_by(GameScore.score.desc(), GameScore.played_at)
        .limit(limit)
    ).all()
    # Rang "compétition" : deux scores égaux ont le même rang
    ranked, previous, rank = [], None, 0
    for i, row in enumerate(rows, 1):
        if row.score != previous:
            rank, previous = i, row.score
        ranked.append(RankedScore(**ScoreOut.model_validate(row).model_dump(), rank=rank))
    return ranked


@router.get("/users/{user_id}/scores", response_model=list[PlayerScore])
def player_scores(user_id: int, db: Session = Depends(get_db)):
    """Tous les records d'un joueur, avec son rang sur chaque titre."""
    rows = db.scalars(
        select(GameScore).where(GameScore.user_id == user_id).order_by(GameScore.played_at.desc())
    ).all()
    return [
        PlayerScore(
            **ScoreOut.model_validate(row).model_dump(),
            ost=row.ost,
            rank=rank_of(db, row.ost_id, row.difficulty, row.score),
        )
        for row in rows
    ]


@router.get("/leaderboard/players", response_model=list[PlayerRanking])
def players_ranking(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Classement général : somme des meilleurs scores de chaque joueur sur tous les titres et niveaux."""
    total = func.sum(GameScore.score).label("total_score")
    rows = db.execute(
        select(
            GameScore.user_id,
            func.max(GameScore.username).label("username"),
            total,
            func.count(func.distinct(GameScore.ost_id)).label("titles"),
            func.sum(case((GameScore.grade == "S", 1), else_=0)).label("s_grades"),
        )
        .group_by(GameScore.user_id)
        .order_by(total.desc())
        .limit(limit)
    ).all()
    return [
        PlayerRanking(rank=i, user_id=r.user_id, username=r.username, total_score=r.total_score, titles=r.titles, s_grades=r.s_grades)
        for i, r in enumerate(rows, 1)
    ]
