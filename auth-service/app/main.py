from contextlib import asynccontextmanager

import jwt
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config, login_limiter
from .database import Base, SessionLocal, engine, ensure_users_autoincrement, get_db
from .models import User
from .schemas import LoginIn, PasswordChangeIn, PasswordConfirmIn, RegisterIn, TokenOut, UserOut
from .security import create_token, decode_token, hash_password, verify_password


def seed_admin() -> None:
    """Crée le compte admin, ou met à jour son mot de passe s'il a changé dans .env."""
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.username == config.ADMIN_USERNAME))
        if admin:
            if not verify_password(config.ADMIN_PASSWORD, admin.password_hash):
                admin.password_hash = hash_password(config.ADMIN_PASSWORD)
                db.commit()
            return
        db.add(
            User(
                username=config.ADMIN_USERNAME,
                password_hash=hash_password(config.ADMIN_PASSWORD),
                role="admin",
            )
        )
        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_users_autoincrement()
    Base.metadata.create_all(engine)
    seed_admin()
    yield


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    if x_internal_key != config.INTERNAL_API_KEY:
        raise HTTPException(403, "Accès réservé aux services internes")


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    """Utilisateur correspondant au jeton JWT de l'en-tête Authorization."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token manquant")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    return user


app = FastAPI(title="Anime OST - Auth Service", lifespan=lifespan)
router = APIRouter(prefix="/auth", dependencies=[Depends(require_internal_key)])


@app.get("/health")
def health():
    return {"status": "ok"}


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(409, "Ce nom d'utilisateur est déjà pris")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    # Compte bloqué après trop d'échecs (même si le mot de passe est juste cette fois)
    locked = login_limiter.seconds_locked(body.username)
    if locked:
        minutes = max(1, -(-locked // 60))
        raise HTTPException(
            429, f"Trop de tentatives : réessaie dans {minutes} min", headers={"Retry-After": str(locked)}
        )
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_password(body.password, user.password_hash):
        # Compté aussi pour les noms inconnus : la réponse ne révèle pas si le compte existe
        login_limiter.record_failure(body.username)
        raise HTTPException(401, "Identifiants invalides")
    login_limiter.record_success(body.username)
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/verify", response_model=UserOut)
def verify(user: User = Depends(current_user)):
    return user


@router.put("/password", status_code=204)
def change_password(body: PasswordChangeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(403, "Mot de passe actuel incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(422, "Le nouveau mot de passe doit être différent de l'actuel")
    if user.username == config.ADMIN_USERNAME:
        raise HTTPException(403, "Le mot de passe du compte admin principal se change dans le fichier .env")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return Response(status_code=204)


@router.delete("/me", response_model=UserOut)
def delete_account(body: PasswordConfirmIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Supprime le compte (mot de passe demandé). Renvoie le compte supprimé : le BFF efface
    ensuite ses données dans l'API Métier."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(403, "Mot de passe incorrect")
    if user.username == config.ADMIN_USERNAME:
        raise HTTPException(403, "Le compte admin principal ne peut pas être supprimé")
    deleted = UserOut.model_validate(user)
    db.delete(user)
    db.commit()
    return deleted


app.include_router(router)
