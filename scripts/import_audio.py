"""Importe en une fois des fichiers audio dans le catalogue (via le BFF, comme l'admin).

Les fichiers sont associés aux OST d'après leur nom :
    Gurenge.mp3            LiSA - Gurenge.mp3            Demon Slayer - Gurenge.m4a

Usage :
    python scripts/import_audio.py DOSSIER            # aperçu, n'envoie rien
    python scripts/import_audio.py DOSSIER --send     # envoie les fichiers associés
Options : --url http://localhost:8080 (Docker) · --replace (remplace un audio existant)

Identifiants admin : ADMIN_USERNAME / ADMIN_PASSWORD du fichier .env (ou variables d'environnement).
Utilise uniquement des fichiers dont tu as les droits.
"""

import argparse
import json
import mimetypes
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import uuid
from pathlib import Path

AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac", ".webm"}
ROOT = Path(__file__).resolve().parent.parent


def normalize(text: str) -> str:
    """« Kaikai Kitan (TV size) » → « kaikai kitan tv size » : sans accents ni ponctuation."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def read_env() -> dict[str, str]:
    values = {}
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    values.update({k: v for k, v in os.environ.items() if k.startswith("ADMIN_")})
    return values


def api(base: str, path: str, *, method="GET", token=None, body=None, data=None, content_type=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
        content_type = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except ValueError:
            pass
        raise SystemExit(f"Erreur {err.code} sur {path} : {detail}") from None
    except urllib.error.URLError as err:
        raise SystemExit(f"Impossible de joindre {base} ({err.reason}). Le site est-il lancé ?") from None


def match(file: Path, osts: list[dict]) -> list[dict]:
    """OST dont le titre correspond au nom du fichier (en entier, ou une partie séparée par « - »)."""
    stem = file.stem
    parts = {normalize(stem)} | {normalize(p) for p in stem.split(" - ")}
    exact = [o for o in osts if normalize(o["title"]) in parts]
    if exact:
        return exact
    whole = normalize(stem)
    # Le titre est contenu dans le nom du fichier : « Kaikai Kitan (TV size) »
    inside = [o for o in osts if len(normalize(o["title"])) >= 4 and normalize(o["title"]) in whole]
    if inside:
        return inside
    # Le nom du fichier est contenu (en mots entiers) dans le titre : « Lovers » → « Naruto Shippuden Opening 9 - Lovers »
    words = [p for p in parts if len(p) >= 4]
    return [o for o in osts if any(f" {w} " in f" {normalize(o['title'])} " for w in words)]


def upload(base: str, token: str, ost_id: int, file: Path) -> dict:
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
    head = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file.name}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode()
    body = head + file.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    return api(base, f"/api/osts/{ost_id}/audio", method="PUT", token=token, data=body,
               content_type=f"multipart/form-data; boundary={boundary}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Importe des fichiers audio dans le catalogue AnimeOST.")
    parser.add_argument("folder", type=Path, help="dossier contenant les fichiers audio")
    parser.add_argument("--send", action="store_true", help="envoyer pour de vrai (sinon : aperçu)")
    parser.add_argument("--replace", action="store_true", help="remplacer l'audio des OST qui en ont déjà un")
    parser.add_argument("--url", default="http://localhost:3000", help="adresse du BFF (Docker : http://localhost:8080)")
    args = parser.parse_args()

    files = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in AUDIO_EXTENSIONS) if args.folder.is_dir() else []
    if not files:
        raise SystemExit(f"Aucun fichier audio dans {args.folder} ({', '.join(sorted(AUDIO_EXTENSIONS))})")

    env = read_env()
    username, password = env.get("ADMIN_USERNAME", "admin"), env.get("ADMIN_PASSWORD")
    if not password:
        raise SystemExit("ADMIN_PASSWORD introuvable : définis-le dans .env")
    login = api(args.url, "/api/auth/login", method="POST", body={"username": username, "password": password})
    if login["user"]["role"] != "admin":
        raise SystemExit(f"{username} n'est pas administrateur")
    token = login["access_token"]
    osts = api(args.url, "/api/osts?limit=200", token=token)["items"]

    plan, problems = [], []
    for file in files:
        found = match(file, osts)
        if len(found) == 1:
            ost = found[0]
            if ost["audio_url"] and not args.replace:
                problems.append(f"  = {file.name} → « {ost['title'].strip()} » a déjà un audio (--replace pour le remplacer)")
            else:
                plan.append((file, ost))
        elif not found:
            problems.append(f"  ? {file.name} → aucune OST ne correspond (renomme le fichier comme le titre)")
        else:
            names = ", ".join(f"« {o['title'].strip()} » ({o['anime_title']})" for o in found)
            problems.append(f"  ! {file.name} → plusieurs OST possibles : {names}")

    print(f"{len(files)} fichier(s), {len(plan)} associé(s) :")
    for file, ost in plan:
        size = file.stat().st_size / 1024 / 1024
        print(f"  ✓ {file.name} ({size:.1f} Mo) → « {ost['title'].strip()} » — {ost['anime_title']}")
    if problems:
        print("Ignorés :")
        print("\n".join(problems))

    if not args.send:
        print("\nAperçu seulement. Relance avec --send pour envoyer.")
        return
    for file, ost in plan:
        result = upload(args.url, token, ost["id"], file)
        print(f"  envoyé : {file.name} → {result['audio_url']}")
    print(f"\n{len(plan)} fichier(s) envoyé(s). Le mini-jeu les jouera en mode « audio analysé ».")


if __name__ == "__main__":
    main()
