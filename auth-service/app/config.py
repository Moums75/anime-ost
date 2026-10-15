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

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(SERVICE_DIR / 'auth.db').as_posix()}")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-a-changer-en-production-32+")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "120"))
# Clé partagée avec le BFF : seul lui a le droit d'appeler ce service.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
# Connexion : nombre d'échecs tolérés par compte avant blocage temporaire
LOGIN_MAX_FAILURES = int(os.getenv("LOGIN_MAX_FAILURES", "5"))
LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", "5"))


# Valeurs de développement : à remplacer via .env (voir .env.example)
_DEV_DEFAULTS = {"INTERNAL_API_KEY": "dev-internal-key", "JWT_SECRET": "dev-secret-a-changer-en-production-32+", "ADMIN_PASSWORD": "admin123"}
for _name, _default in _DEV_DEFAULTS.items():
    if globals()[_name] == _default:
        logging.getLogger("uvicorn.error").warning("%s utilise sa valeur de développement : définis-la dans .env", _name)
