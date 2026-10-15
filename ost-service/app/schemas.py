from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

Kind = Literal["opening", "ending", "ost", "insert"]

# SQLite rend des dates sans fuseau alors qu'elles sont en UTC : on le précise pour que
# le navigateur les convertisse correctement en heure locale.
UtcDatetime = Annotated[datetime, AfterValidator(lambda v: v if v.tzinfo else v.replace(tzinfo=timezone.utc))]


class AnimeIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    studio: str = Field(min_length=1, max_length=80)
    year: int = Field(ge=1900, le=2100)
    # Facultatif : sinon la pochette est cherchée sur AniList à partir du titre
    mal_id: int | None = Field(default=None, ge=1)


class AnimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    studio: str
    year: int
    mal_id: int | None
    image_url: str | None
    ost_count: int


class OstIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    artist: str = Field(min_length=1, max_length=120)
    kind: Kind
    youtube_url: str = Field(max_length=300, pattern=r"^https?://")
    anime_id: int


class OstOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    artist: str
    kind: Kind
    youtube_url: str
    anime_id: int
    anime_title: str
    anime_image_url: str | None
    audio_filename: str | None
    cover_filename: str | None


class OstPage(BaseModel):
    items: list[OstOut]
    total: int


class AnimeDetail(AnimeOut):
    osts: list[OstOut]


# ---------- Historique ----------

class HistoryIn(BaseModel):
    ost_id: int


class HistoryEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    played_at: UtcDatetime
    ost: OstOut


class HistoryPage(BaseModel):
    items: list[HistoryEntryOut]
    total: int


# ---------- Playlists ----------

class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=300)


class PlaylistPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=300)


class PlaylistOrder(BaseModel):
    ost_ids: list[int]


class PlaylistSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    ost_count: int
    ost_ids: list[int]
    preview: list[OstOut]
    created_at: UtcDatetime
    updated_at: UtcDatetime


class PlaylistDetail(PlaylistSummary):
    osts: list[OstOut]


# ---------- Mini-jeu : scores et classements ----------

Difficulty = Literal["easy", "normal", "hard"]


class JudgementCounts(BaseModel):
    perfect: int = Field(ge=0, le=5000)
    great: int = Field(ge=0, le=5000)
    good: int = Field(ge=0, le=5000)
    miss: int = Field(ge=0, le=5000)


class ScoreIn(BaseModel):
    ost_id: int
    difficulty: Difficulty
    username: str = Field(min_length=1, max_length=30)
    score: int = Field(ge=0)
    max_combo: int = Field(ge=0)
    counts: JudgementCounts


class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    ost_id: int
    difficulty: Difficulty
    score: int
    accuracy: float
    grade: str
    max_combo: int
    perfect: int
    great: int
    good: int
    miss: int
    attempts: int
    played_at: UtcDatetime


class RankedScore(ScoreOut):
    rank: int


class SubmitResult(BaseModel):
    best: ScoreOut
    new_record: bool
    rank: int
    players: int


class PlayerScore(ScoreOut):
    """Record d'un joueur sur un titre, avec l'OST (page « Mes records »)."""
    ost: OstOut
    rank: int


class PlayerRanking(BaseModel):
    rank: int
    user_id: int
    username: str
    total_score: int
    titles: int
    s_grades: int
