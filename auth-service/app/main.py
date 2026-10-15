from contextlib import asynccontextmanager

import jwt
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config
from .database import Base, SessionLocal, engine, get_db
from .models import User
from .schemas import LoginIn, RegisterIn, TokenOut, UserOut
from .security import create_token, decode_token, hash_password, verify_password


def seed_admin() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.username == config.ADMIN_USERNAME)):
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
    Base.metadata.create_all(engine)
    seed_admin()
    yield


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    if x_internal_key != config.INTERNAL_API_KEY:
        raise HTTPException(403, "Accès réservé aux services internes")


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
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Identifiants invalides")
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/verify", response_model=UserOut)
def verify(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
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


app.include_router(router)
