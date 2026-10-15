"""Stockage des fichiers audio et des pochettes sur disque."""

from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from . import config

MediaKind = Literal["audio", "cover"]

ALLOWED_EXTENSIONS: dict[MediaKind, dict[str, str]] = {
    "audio": {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
    },
    "cover": {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    },
}
MAX_BYTES: dict[MediaKind, int] = {
    "audio": config.MAX_AUDIO_MB * 1024 * 1024,
    "cover": config.MAX_COVER_MB * 1024 * 1024,
}
CHUNK_SIZE = 1024 * 1024


def media_path(kind: MediaKind, filename: str) -> Path:
    return config.MEDIA_DIR / kind / filename


def media_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    for types in ALLOWED_EXTENSIONS.values():
        if suffix in types:
            return types[suffix]
    return "application/octet-stream"


def save_upload(kind: MediaKind, owner_id: int, upload: UploadFile) -> str:
    """Écrit le fichier sur disque (en vérifiant format et taille) et renvoie son nom."""
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS[kind]:
        allowed = ", ".join(ALLOWED_EXTENSIONS[kind])
        raise HTTPException(415, f"Format non supporté. Formats acceptés : {allowed}")

    filename = f"{owner_id}-{uuid4().hex[:10]}{suffix}"
    path = media_path(kind, filename)
    path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with path.open("wb") as out:
        while chunk := upload.file.read(CHUNK_SIZE):
            written += len(chunk)
            if written > MAX_BYTES[kind]:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(413, f"Fichier trop lourd ({MAX_BYTES[kind] // 1024 // 1024} Mo max)")
            out.write(chunk)
    if written == 0:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "Fichier vide")
    return filename


def delete_media(kind: MediaKind, filename: str | None) -> None:
    if filename:
        media_path(kind, filename).unlink(missing_ok=True)
