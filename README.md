# AnimeOST

[![Tests](https://github.com/Moums75/anime-ost/actions/workflows/tests.yml/badge.svg)](https://github.com/Moums75/anime-ost/actions/workflows/tests.yml)

Site de référencement d'OST d'anime (openings, endings, bandes originales), construit en architecture microservices.
Projet M1. Deux langages : **TypeScript** (front + BFF) et **Python** (microservices).

## Architecture

```
                 TypeScript                    Python
┌─────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────┐
│  Front  │───▶│     BFF     │───▶│  API Métier OST  │───▶│ ost.db  │
│ React   │    │  Express    │    │  FastAPI :8002   │    └─────────┘
│ :5173   │    │   :3000     │    └──────────────────┘
└─────────┘    └──────┬──────┘
                      │           ┌──────────────────┐    ┌─────────┐
                      └──────────▶│    API Auth      │───▶│ auth.db │
                                  │  FastAPI :8001   │    └─────────┘
                                  └──────────────────┘
```

| Brique | Dossier | Langage | Rôle |
|---|---|---|---|
| Front | `frontend/` | TypeScript (React + Vite) | Interface web. Ne parle **qu'au BFF**. |
| BFF | `bff/` | TypeScript (Node + Express) | Point d'entrée unique du front : vérifie l'utilisateur auprès de l'API Auth, contrôle les droits (user/admin), appelle l'API Métier et agrège les réponses (ex. ajoute le champ `favorite` à chaque OST). |
| API Auth | `auth-service/` | Python (FastAPI) | Inscription, connexion, émission et vérification des JWT. Mots de passe hachés avec bcrypt. |
| API Métier | `ost-service/` | Python (FastAPI) | Animes, OST, favoris. |
| BDD | `*.db` | SQLite | **Une base par microservice** : chaque service possède ses données. |

### Sécurité
- Le front envoie le JWT au BFF (`Authorization: Bearer …`). Le BFF le fait vérifier par l'API Auth (`GET /auth/verify`).
- Les microservices Python exigent un en-tête `X-Internal-Key`. Seul le BFF connaît cette clé, donc on ne peut pas les appeler directement depuis le navigateur.
- Les routes d'administration (ajout/suppression) sont réservées au rôle `admin`.

## Lancer le projet

### 1. Les secrets (`.env`)

Les mots de passe et clés ne sont pas dans le code : ils sont dans un fichier `.env` à la racine, **ignoré par Git**.

```powershell
copy .env.example .env   # puis remplace chaque "change-moi"
# un secret aléatoire : python -c "import secrets; print(secrets.token_hex(32))"
```

Le compte admin est créé (ou son mot de passe mis à jour) au démarrage avec `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Sans `.env`, des valeurs de développement sont utilisées et un avertissement s'affiche.

### 2a. En local (Windows)

Prérequis : Node.js 20+ et Python 3.11+.

```powershell
.\setup.ps1   # une seule fois : venv Python + npm install (avec les outils de test)
.\start.ps1   # ouvre 4 fenêtres (API Auth, API OST, BFF, Front)
```

Ouvre ensuite http://localhost:5173.

### 2b. Avec Docker (n'importe quelle machine)

Prérequis : Docker Desktop (ou Docker Engine + Compose).

```bash
docker compose up --build
```

Ouvre ensuite http://localhost:8080. Le front est servi par **nginx**, qui relaie `/api` vers le BFF.
**Seul le port 8080 est exposé** : le BFF et les deux API ne sont joignables que sur le réseau interne de Docker.
Les bases SQLite et les fichiers audio sont dans des volumes (`auth-data`, `ost-data`), conservés entre deux redémarrages (`docker compose down -v` pour tout effacer).

Commandes utiles (Docker Desktop doit être lancé) :

| Commande | Effet |
|---|---|
| `docker compose up --build -d` | construit et lance tout en arrière-plan (3 à 5 min la 1re fois) |
| `docker compose up -d` | relance sans reconstruire (environ 20 s) |
| `docker compose ps` | état des 4 services (`healthy` = prêt) |
| `docker compose logs -f bff` | journaux d'un service en direct (Ctrl+C pour quitter) |
| `docker compose down` | arrête et supprime les conteneurs, **garde les données** |
| `docker compose down -v` | arrête et **efface les données** (bases + fichiers audio) |

La version Docker a ses propres bases (dans les volumes), distinctes de celles de `start.ps1`. Les deux peuvent tourner en même temps (ports 8080 et 5173).

Les BDD sont créées automatiquement au premier démarrage, avec un jeu de données de démo (Naruto, Attack on Titan, Evangelion…).
En local, pour repartir de zéro, supprime `auth-service/auth.db` et `ost-service/ost.db`.

### Ajouter des fichiers audio en une fois

Mets tes MP3 (des fichiers dont tu as les droits) dans un dossier, nommés comme l'OST (`Gurenge.mp3`, `LiSA - Gurenge.mp3`…), puis :

```powershell
python scripts\import_audio.py C:\chemin\vers\mes-mp3          # aperçu des correspondances
python scripts\import_audio.py C:\chemin\vers\mes-mp3 --send   # envoi (identifiants admin du .env)
```

## Tests

67 tests automatisés, rejoués à chaque push par GitHub Actions (`.github/workflows/tests.yml`) :

| Partie | Outil | Ce qui est testé |
|---|---|---|
| API Auth | pytest (17) | inscription, connexion, JWT, hachage bcrypt, blocage après 5 échecs, changement de mot de passe, suppression de compte, ids jamais réutilisés |
| API Métier | pytest (25) | catalogue, pagination, recherche, envoi et streaming audio (Range / 206), favoris, historique, playlists, scores et classements (anti-triche, égalités), suppression des données |
| BFF | node:test (6) | extraction des ID YouTube, adaptation des OST pour le front, limite par IP |
| Front | Vitest (19) | moteur du mini-jeu (jugements, combo, score, notes), génération des notes |

```powershell
.\test.ps1          # tout lancer
```

Chaque service peut aussi être testé seul : `python -m pytest` (dans un service Python, avec son venv) ou `npm test` (bff, frontend). Les tests Python utilisent une base temporaire : ils ne touchent jamais à tes données.

## Documentation des API

FastAPI génère une doc Swagger interactive :
- API Auth : http://localhost:8001/docs
- API Métier : http://localhost:8002/docs

(Pour tester depuis Swagger, renseigne l'en-tête `X-Internal-Key: dev-internal-key`.)

### Routes du BFF (celles qu'utilise le front)

| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | connecté |
| GET | `/api/animes` | public |
| GET | `/api/animes/:id` | public (favoris marqués si connecté) |
| GET | `/api/osts?q=&anime_id=&kind=&limit=&offset=` → `{ items, total }` | public (favoris marqués si connecté) |
| GET | `/api/favorites` | connecté |
| PUT / DELETE | `/api/favorites/:ostId` | connecté |
| GET / POST / DELETE | `/api/history` (+ `DELETE /api/history/:id`) | connecté |
| GET / POST | `/api/playlists` | connecté |
| GET / PATCH / DELETE | `/api/playlists/:id` | connecté (sa playlist uniquement) |
| PUT / DELETE | `/api/playlists/:id/osts/:ostId` | connecté |
| PUT | `/api/playlists/:id/order` (`{ ost_ids: [...] }`) | connecté |
| POST | `/api/animes`, `/api/osts` | admin |
| DELETE | `/api/animes/:id`, `/api/osts/:id` | admin |

## Historique d'écoute et playlists

- **Historique** : le lecteur enregistre une écoute dès que la piste démarre vraiment (utilisateur connecté). Réécouter la même OST dans les 30 minutes met juste l'heure à jour, sans créer de doublon. Seules les 500 dernières écoutes sont gardées. La page *Historique* regroupe les écoutes par jour et se met à jour en direct. L'accueil affiche « Écoutés récemment ».
- **Playlists** : bouton « Ajouter à une playlist » sur chaque carte, chaque ligne et dans le lecteur. On peut aussi créer une playlist directement depuis ce menu. Chaque playlist peut être lue dans l'ordre ou en aléatoire, renommée, réordonnée (↑ ↓) ou supprimée. Une OST n'apparaît qu'une fois par playlist.
- Les données sont dans `ost.db` (tables `listening_history`, `playlists`, `playlist_items`). Le `user_id` vient du jeton vérifié par le BFF : un utilisateur ne peut ni voir ni modifier la bibliothèque d'un autre (404).

## Mini-jeu « OST Rush »

Jeu de rythme façon *piano tiles* / *Dance Dance Revolution* (page **Mini-jeu**, ou bouton manette dans le lecteur pour jouer sur le titre en cours) :
- les flèches descendent au rythme de la musique : on appuie quand elles touchent la ligne, avec ← ↓ ↑ → (ou D F J K) au clavier, ou en touchant les grosses flèches à l'écran (ou les couloirs) sur téléphone et tablette ;
- jugements Parfait (±50 ms) / Super (±100 ms) / Bien (±150 ms) / Raté, combo (bonus jusqu'à ×2), précision, note finale S à D, record par titre et par niveau (gardé dans le navigateur) ;
- 3 niveaux : Facile, Normal, Difficile (vitesse de chute et densité de notes) ;
- **titre avec fichier audio** : le son est décodé dans le navigateur (Web Audio API) et les notes sont posées sur les attaques détectées (spectral flux + seuil adaptatif). Testé sur un morceau aux battements connus : 41/41 retrouvés, 0 fausse note, 6 ms d'écart moyen ;
- **titre YouTube** : le site n'a pas accès au son de l'iframe, le rythme est donc *généré*, mais toujours identique pour un titre et un niveau donnés (générateur pseudo-aléatoire initialisé avec l'id de l'OST) ;
- la partie est synchronisée sur la position réelle du lecteur : pause (Échap / Espace) = jeu en pause.

### Classements (API)

- À la fin d'une partie, un joueur connecté envoie son score au BFF (`POST /api/game/scores`). Le BFF ajoute l'identité tirée du jeton : on ne peut pas jouer au nom d'un autre.
- L'API Métier garde **le meilleur score par joueur, par titre et par niveau** (table `game_scores`), avec le nombre de parties jouées. Elle **recalcule** la précision et la note, et **refuse les scores incohérents** : score supérieur au maximum possible, ou combo plus grand que le nombre de notes touchées. Le jeu tourne dans le navigateur, donc une triche plus fine reste possible : seule une vérification de la partie complète côté serveur l'empêcherait.
- Le pseudo est copié dans `game_scores` au moment de l'envoi. Cela évite d'interroger le service d'auth à chaque affichage, et c'est sans risque puisqu'un pseudo ne peut pas changer.
- Page **Classements** (`/jeu/classement`) : meilleurs joueurs (somme des meilleurs scores), classement par titre et par niveau (même rang en cas d'égalité), et « Mes records » avec le rang sur chaque titre. L'écran de fin de partie affiche le rang et le top 5 du titre.
- En invité, les records restent dans le navigateur.

| Méthode | Route BFF | Accès |
|---|---|---|
| POST | `/api/game/scores` | connecté |
| GET | `/api/game/leaderboard/:ostId?difficulty=normal&limit=10` | public |
| GET | `/api/game/players` | public |
| GET | `/api/game/me/scores` | connecté |

Code : `frontend/src/game/` (`chart.ts` génération des notes, `engine.ts` règles et score, `draw.ts` rendu canvas, `RhythmGame.tsx` partie) et `pages/GamePage.tsx`.

## Variables d'environnement

Elles se règlent dans `.env` (modèle : `.env.example`). Toutes ont une valeur par défaut pour le développement.

| Variable | Service | Défaut |
|---|---|---|
| `INTERNAL_API_KEY` | les 3 back-ends (doit être identique) | `dev-internal-key` |
| `JWT_SECRET` | auth-service | valeur de dev |
| `JWT_EXPIRES_MINUTES` | auth-service | `120` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | auth-service | `admin` / `admin123` |
| `DATABASE_URL` | auth-service, ost-service | SQLite dans le dossier du service |
| `COVER_LOOKUP_ENABLED` | ost-service | `1` (mettre `0` pour ne pas appeler AniList) |
| `MAX_AUDIO_MB` / `MAX_COVER_MB` | ost-service | `30` / `5` |
| `AUTH_SERVICE_URL` / `OST_SERVICE_URL` | bff | `http://localhost:8001` / `:8002` |

`DATABASE_URL` accepte n'importe quelle URL SQLAlchemy : on peut passer à PostgreSQL sans changer le code (il faut juste installer le driver `psycopg`).

## Lecture des OST

Un seul lecteur (en bas de page) gère deux sources, par ordre de priorité :

1. **Fichier audio** hébergé par l'API Métier (envoyé par un admin) ;
2. sinon, la **vidéo YouTube officielle** de la chanson, jouée via l'[API IFrame YouTube](https://developers.google.com/youtube/iframe_api_reference). La vidéo reste visible dans un panneau au-dessus du lecteur, comme l'exigent les conditions d'utilisation de YouTube ;
3. sinon (pas de vidéo officielle connue), la carte ouvre une recherche YouTube.

Le BFF extrait l'ID de la vidéo du lien YouTube (`youtube_id`) pour que le front n'ait rien à analyser.

### Animations pendant l'écoute

Pendant la lecture, un petit personnage en pixel art apparaît de temps en temps sur le bord du lecteur : Naruto, Zenitsu ou Inosuke qui traversent l'écran, ou un combat Kyûbi contre Orochimaru. La première apparition a lieu après environ 8 s, puis toutes les 35 à 70 s ([Mascots.tsx](frontend/src/components/Mascots.tsx)).
- Purement décoratif : `pointer-events: none`, donc rien n'est jamais bloqué. Rien ne se passe en pause, onglet caché, ou si le système demande de réduire les animations (`prefers-reduced-motion`).
- Les GIF d'origine (fan art trouvé sur Pinterest) ont été convertis en WebP animés dans `frontend/src/assets/mascots/` : fond blanc détouré, recadrage sur le personnage, poids divisé par deux ou plus.

### Catalogue de démo

`ost-service/app/seed.py` contient 21 animes et ~40 OST (Naruto, One Piece, Attack on Titan, Demon Slayer, Jujutsu Kaisen, Frieren, Oshi no Ko, Chainsaw Man…). Il est **synchronisé à chaque démarrage** : les titres manquants sont ajoutés, mais ce qu'un admin a ajouté ou modifié n'est jamais écrasé.

Les vidéos référencées sont des uploads de **chaînes officielles** (artistes, labels comme King Records ou Pony Canyon, ayants droit comme la chaîne ONE PIECE ou VIZ). Leur intégration a été vérifiée via l'API oEmbed de YouTube. Aucune musique n'est copiée sur le serveur.

### Pochettes (API externe AniList)

L'API Métier récupère la pochette de chaque anime sur l'API GraphQL publique [AniList](https://docs.anilist.co), à partir de son ID MyAnimeList, ou de son titre à défaut. On ne stocke que l'URL de l'image, qui reste hébergée par AniList. La récupération tourne en arrière-plan au démarrage. Si AniList est injoignable, le site fonctionne quand même et affiche des pochettes générées. Une OST sans pochette propre prend celle de son anime.

### Fichiers audio (streaming)

L'audio est servi par **l'API Métier** et relayé par le BFF :

```
<audio src="/api/osts/12/audio?v=…">  →  BFF  →  API Métier (FileResponse)  →  media/audio/12-xxxx.mp3
```

- L'admin envoie un fichier audio (mp3, m4a, ogg, wav, flac…, 30 Mo max) et une pochette (jpg, png, webp, 5 Mo max) depuis la page **Admin**, pour une nouvelle OST ou une OST existante.
- Les fichiers sont stockés dans `ost-service/media/` ; la BDD ne garde que leur nom.
- Le streaming gère l'en-tête HTTP **Range** (réponse `206 Partial Content`) : le navigateur lit le morceau au fur et à mesure et peut se déplacer dedans sans tout télécharger. Le BFF transmet ce flux sans le charger en mémoire.
- Le BFF transforme les noms de fichiers internes en URLs (`audio_url`, `cover_url`) pour le front.
- Le lecteur en bas de page enchaîne les pistes de la liste en cours (précédent / suivant), avec barre de progression, volume, barre d'espace = pause, et les touches multimédia du clavier.

| Méthode | Route BFF | Accès |
|---|---|---|
| GET | `/api/osts/:id/audio`, `/api/osts/:id/cover` | public |
| PUT | `/api/osts/:id/audio`, `/api/osts/:id/cover` (multipart, champ `file`) | admin |

> Les fichiers audio ne sont pas fournis : utilise des fichiers dont tu as les droits. Pour un projet d'école en local c'est sans souci, mais ne mets pas en ligne publiquement des musiques protégées.
