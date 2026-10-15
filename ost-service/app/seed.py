"""Catalogue de démo, synchronisé à chaque démarrage.

- ajoute les animes / OST manquants (comparaison par titre) ;
- complète l'identifiant MyAnimeList des animes ;
- remplace les anciens liens de *recherche* YouTube par la vidéo officielle quand on la connaît.
Les données ajoutées ou modifiées par un admin ne sont jamais écrasées.

Les vidéos sont des uploads de chaînes officielles (artistes, labels, ayants droit) dont
l'intégration est autorisée : elles sont lues via le lecteur YouTube intégré au site.
Quand aucune vidéo officielle n'a été trouvée (None), on garde un lien de recherche YouTube.
"""

from urllib.parse import quote_plus

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Anime, Ost

# (titre, studio, année, id MyAnimeList, [(titre OST, artiste, type, id vidéo YouTube officielle)])
CATALOG = [
    ("Naruto", "Pierrot", 2002, 20, [
        ("Haruka Kanata", "Asian Kung-Fu Generation", "opening", "k9DiT4ol0Gg"),
        ("GO!!!", "FLOW", "opening", "WobAS2RKg30"),
        ("Sadness and Sorrow", "Toshio Masuda", "ost", None),
        ("The Raising Fighting Spirit", "Toshio Masuda", "ost", None),
    ]),
    ("Naruto Shippuden", "Pierrot", 2007, 1735, [
        ("Blue Bird", "Ikimono-gakari", "opening", "KpsJWFuVTdI"),
        ("Silhouette", "KANA-BOON", "opening", "ZFoJYI7Q4iA"),
    ]),
    ("One Piece", "Toei Animation", 1999, 21, [
        ("We Are!", "Hiroshi Kitadani", "opening", "r7n-L5B0bBw"),
        ("Overtaken", "Kohei Tanaka", "ost", None),
    ]),
    ("Attack on Titan", "Wit Studio", 2013, 16498, [
        ("Guren no Yumiya", "Linked Horizon", "opening", "2B6nj38AdD0"),
        ("Shinzou wo Sasageyo!", "Linked Horizon", "opening", "8QPyFlJNmus"),
        ("The Rumbling", "SiM", "opening", "OBqw818mQ1E"),
        ("Vogel im Käfig", "Hiroyuki Sawano", "ost", None),
    ]),
    ("Fullmetal Alchemist: Brotherhood", "Bones", 2009, 5114, [
        ("Again", "YUI", "opening", "w5OUAY1j3gQ"),
        ("Brothers", "Akira Senju", "ost", None),
    ]),
    ("Cowboy Bebop", "Sunrise", 1998, 1, [
        ("Tank!", "Seatbelts", "opening", "d75ov4HvRrM"),
        ("The Real Folk Blues", "Seatbelts feat. Mai Yamane", "ending", None),
    ]),
    ("Neon Genesis Evangelion", "Gainax", 1995, 30, [
        ("A Cruel Angel's Thesis", "Yoko Takahashi", "opening", "o6wtDPVkKqI"),
        ("Fly Me to the Moon", "Claire Littley", "ending", None),
    ]),
    ("Demon Slayer", "ufotable", 2019, 38000, [
        ("Gurenge", "LiSA", "opening", "x1FV6IrjZCY"),
        ("Homura", "LiSA", "ending", "4DxL6IKmXx4"),
        ("Kamado Tanjiro no Uta", "Go Shiina feat. Nami Nakagawa", "insert", None),
    ]),
    ("Jujutsu Kaisen", "MAPPA", 2020, 40748, [
        ("Kaikai Kitan", "Eve", "opening", "1tk1pqwrOys"),
        ("Ao no Sumika", "Tatsuya Kitani", "opening", "zuoVd2QNxJo"),
        ("SPECIALZ", "King Gnu", "opening", "fhzKLBZJC3w"),
    ]),
    ("Le Voyage de Chihiro", "Studio Ghibli", 2001, 199, [
        ("One Summer's Day", "Joe Hisaishi", "ost", "TK1Ij_-mank"),
    ]),
    ("Frieren", "Madhouse", 2023, 52991, [
        ("Yuusha", "YOASOBI", "opening", "OIBODIPC_8Y"),
    ]),
    ("Oshi no Ko", "Doga Kobo", 2023, 52034, [
        ("Idol", "YOASOBI", "opening", "ZRtdQ81jPUQ"),
    ]),
    ("Chainsaw Man", "MAPPA", 2022, 44511, [
        ("KICK BACK", "Kenshi Yonezu", "opening", "M2cckDmNLMI"),
    ]),
    ("Spy x Family", "Wit Studio & CloverWorks", 2022, 50265, [
        ("Mixed Nuts", "Official HIGE DANdism", "opening", "CbH2F0kXgTY"),
        ("Comedy", "Gen Hoshino", "ending", "D_Oyplmhhv0"),
    ]),
    ("Tokyo Ghoul", "Pierrot", 2014, 22319, [
        ("unravel", "TK from Ling tosite sigure", "opening", "Fve_lHIPa-I"),
    ]),
    ("Your Name", "CoMix Wave Films", 2016, 32281, [
        ("Zenzenzense", "RADWIMPS", "insert", "PDSkFeMVNFs"),
    ]),
    ("My Hero Academia", "Bones", 2016, 31964, [
        ("THE DAY", "Porno Graffitti", "opening", "Th7MAZYFIMc"),
        ("Peace Sign", "Kenshi Yonezu", "opening", "9aJVr5tTTWk"),
    ]),
    ("Sword Art Online", "A-1 Pictures", 2012, 11757, [
        ("crossing field", "LiSA", "opening", "1aPOj0ERTEc"),
    ]),
    ("Code Geass", "Sunrise", 2006, 1575, [
        ("COLORS", "FLOW", "opening", "H7cykKMpp_I"),
    ]),
    ("Bleach", "Pierrot", 2004, 269, [
        ("Asterisk", "ORANGE RANGE", "opening", "wW9TwZdWpjw"),
    ]),
    ("Death Note", "Madhouse", 2006, 1535, [
        ("the WORLD", "Nightmare", "opening", None),
    ]),
]

SEARCH_PREFIX = "https://www.youtube.com/results?search_query="


def youtube_url(video_id: str | None, *search_terms: str) -> str:
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return SEARCH_PREFIX + quote_plus(" ".join(search_terms))


def sync_catalog(db: Session) -> None:
    animes = {a.title: a for a in db.scalars(select(Anime))}
    for title, studio, year, mal_id, osts in CATALOG:
        anime = animes.get(title)
        if anime is None:
            anime = Anime(title=title, studio=studio, year=year)
            db.add(anime)
        if anime.mal_id is None:
            anime.mal_id = mal_id

        existing = {o.title: o for o in anime.osts}
        for ost_title, artist, kind, video_id in osts:
            url = youtube_url(video_id, title, ost_title, artist)
            ost = existing.get(ost_title)
            if ost is None:
                anime.osts.append(Ost(title=ost_title, artist=artist, kind=kind, youtube_url=url))
            elif video_id and ost.youtube_url.startswith(SEARCH_PREFIX):
                ost.youtube_url = url
    db.commit()
