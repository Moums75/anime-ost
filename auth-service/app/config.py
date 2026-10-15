import os
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(SERVICE_DIR / 'auth.db').as_posix()}")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-a-changer-en-production-32+")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "120"))
# Clé partagée avec le BFF : seul lui a le droit d'appeler ce service.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
