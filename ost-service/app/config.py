import logging
import os
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Charge le fichier .env à la racine du projet (sans écraser les variables déjà définies).

    En local, les secrets viennent de ce fichier ; dans Docker, de docker-compose (env_file).
    """
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(SERVICE_DIR.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(SERVICE_DIR / 'ost.db').as_posix()}")
# Dossier où sont stockés les fichiers audio et les pochettes envoyés par les admins
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", SERVICE_DIR / "media"))
MAX_AUDIO_MB = int(os.getenv("MAX_AUDIO_MB", "30"))
MAX_COVER_MB = int(os.getenv("MAX_COVER_MB", "5"))
# API publique AniList (GraphQL) utilisée pour récupérer les pochettes des animes
ANILIST_URL = os.getenv("ANILIST_URL", "https://graphql.anilist.co")
COVER_LOOKUP_ENABLED = os.getenv("COVER_LOOKUP_ENABLED", "1") == "1"
# Clé partagée avec le BFF : seul lui a le droit d'appeler ce service.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key")


# Valeurs de développement : à remplacer via .env (voir .env.example)
_DEV_DEFAULTS = {"INTERNAL_API_KEY": "dev-internal-key"}
for _name, _default in _DEV_DEFAULTS.items():
    if globals()[_name] == _default:
        logging.getLogger("uvicorn.error").warning("%s utilise sa valeur de développement : définis-la dans .env", _name)
