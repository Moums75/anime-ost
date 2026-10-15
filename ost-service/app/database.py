from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if is_sqlite else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)

if is_sqlite:
    # SQLite n'applique les clés étrangères (ON DELETE CASCADE) que si on l'active
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


class Base(DeclarativeBase):
    pass


# Colonnes ajoutées après la première version du schéma : (table, colonne, type SQL)
LATER_COLUMNS = [
    ("osts", "audio_filename", "VARCHAR(100)"),
    ("osts", "cover_filename", "VARCHAR(100)"),
    ("animes", "mal_id", "INTEGER"),
    ("animes", "image_url", "VARCHAR(300)"),
]


def add_missing_columns() -> None:
    """Mini-migration : ajoute les colonnes apparues après la création de la BDD."""
    inspector = inspect(engine)
    existing = {table: {col["name"] for col in inspector.get_columns(table)} for table in ("osts", "animes")}
    with engine.begin() as conn:
        for table, column, sql_type in LATER_COLUMNS:
            if column not in existing[table]:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
