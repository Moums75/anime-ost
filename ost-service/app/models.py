from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Anime(Base):
    __tablename__ = "animes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    studio: Mapped[str] = mapped_column(String(80))
    year: Mapped[int]
    # Identifiant MyAnimeList, utilisé pour retrouver la pochette officielle via AniList
    mal_id: Mapped[int | None] = mapped_column(default=None)
    image_url: Mapped[str | None] = mapped_column(String(300), default=None)

    osts: Mapped[list["Ost"]] = relationship(
        back_populates="anime", cascade="all, delete-orphan", order_by="Ost.title"
    )

    @property
    def ost_count(self) -> int:
        return len(self.osts)


class Ost(Base):
    __tablename__ = "osts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150), index=True)
    artist: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(10))  # opening | ending | ost | insert
    youtube_url: Mapped[str] = mapped_column(String(300))
    anime_id: Mapped[int] = mapped_column(ForeignKey("animes.id", ondelete="CASCADE"))
    # Noms des fichiers stockés dans MEDIA_DIR (None tant que l'admin n'a rien envoyé)
    audio_filename: Mapped[str | None] = mapped_column(String(100), default=None)
    cover_filename: Mapped[str | None] = mapped_column(String(100), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    anime: Mapped[Anime] = relationship(back_populates="osts")
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="ost", cascade="all, delete-orphan"
    )

    @property
    def anime_title(self) -> str:
        return self.anime.title

    @property
    def anime_image_url(self) -> str | None:
        return self.anime.image_url


class Favorite(Base):
    """Lien utilisateur <-> OST. user_id vient du service d'auth (autre BDD), donc pas de FK."""

    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    ost_id: Mapped[int] = mapped_column(
        ForeignKey("osts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    ost: Mapped[Ost] = relationship(back_populates="favorites")


class ListeningEntry(Base):
    """Une écoute dans l'historique d'un utilisateur."""

    __tablename__ = "listening_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)  # référence logique (service d'auth)
    ost_id: Mapped[int] = mapped_column(ForeignKey("osts.id", ondelete="CASCADE"))
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    ost: Mapped[Ost] = relationship()


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)  # référence logique (service d'auth)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    items: Mapped[list["PlaylistItem"]] = relationship(
        back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistItem.position"
    )

    @property
    def osts(self) -> list[Ost]:
        return [item.ost for item in self.items]

    @property
    def ost_count(self) -> int:
        return len(self.items)

    @property
    def ost_ids(self) -> list[int]:
        return [item.ost_id for item in self.items]

    @property
    def preview(self) -> list[Ost]:
        """Les 4 premières OST : servent à composer la mosaïque de pochettes."""
        return self.osts[:4]


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    playlist_id: Mapped[int] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True
    )
    ost_id: Mapped[int] = mapped_column(ForeignKey("osts.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int]
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    playlist: Mapped[Playlist] = relationship(back_populates="items")
    ost: Mapped[Ost] = relationship()


class GameScore(Base):
    """Meilleur score d'un joueur sur une OST à une difficulté donnée (mini-jeu OST Rush)."""

    __tablename__ = "game_scores"
    __table_args__ = (UniqueConstraint("user_id", "ost_id", "difficulty"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)  # référence logique (service d'auth)
    # Copie du pseudo, fournie par le BFF depuis le jeton vérifié : évite d'interroger le
    # service d'auth à chaque affichage du classement (un pseudo ne peut pas changer).
    username: Mapped[str] = mapped_column(String(30))
    ost_id: Mapped[int] = mapped_column(ForeignKey("osts.id", ondelete="CASCADE"), index=True)
    difficulty: Mapped[str] = mapped_column(String(10))  # easy | normal | hard
    score: Mapped[int]
    accuracy: Mapped[float] = mapped_column(Float)
    grade: Mapped[str] = mapped_column(String(1))
    max_combo: Mapped[int]
    perfect: Mapped[int]
    great: Mapped[int]
    good: Mapped[int]
    miss: Mapped[int]
    attempts: Mapped[int] = mapped_column(default=1)  # nombre de parties jouées (pas seulement les records)
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    ost: Mapped[Ost] = relationship()
