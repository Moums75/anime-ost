import os
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent

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
