from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if is_sqlite else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def ensure_users_autoincrement() -> None:
    """Migration : sans AUTOINCREMENT, SQLite réattribue l'id d'un compte supprimé au compte
    suivant, qui hériterait alors des données restées dans les autres services."""
    if not is_sqlite:
        return
    with engine.begin() as conn:
        sql = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")).scalar()
        if not sql or "AUTOINCREMENT" in sql.upper():
            return
        conn.execute(text("ALTER TABLE users RENAME TO users_old"))
        conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))
        Base.metadata.tables["users"].create(conn)
        conn.execute(text(
            "INSERT INTO users (id, username, password_hash, role, created_at) "
            "SELECT id, username, password_hash, role, created_at FROM users_old"
        ))
        conn.execute(text("DROP TABLE users_old"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
