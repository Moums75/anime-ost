"""Dépendances partagées par les routes de l'API Métier."""

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from . import config


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    if x_internal_key != config.INTERNAL_API_KEY:
        raise HTTPException(403, "Accès réservé aux services internes")


def get_or_404(db: Session, model, obj_id, label: str):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{label} introuvable")
    return obj
