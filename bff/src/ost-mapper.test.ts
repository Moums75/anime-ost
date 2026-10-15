import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toClientOst, youtubeId } from "./ost-mapper.js";
import type { Ost } from "./types.js";

describe("youtubeId", () => {
  it("reconnaît les différentes formes de liens", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      assert.equal(youtubeId(url), "dQw4w9WgXcQ", url);
    }
  });

  it("renvoie null quand ce n'est pas une vidéo précise", () => {
    assert.equal(youtubeId("https://www.youtube.com/results?search_query=naruto"), null);
    assert.equal(youtubeId("https://evil.example/watch?v=dQw4w9WgXcQ"), null);
    assert.equal(youtubeId("https://www.youtube.com/watch?v=trop-court"), null);
    assert.equal(youtubeId("pas une url"), null);
  });
});

describe("toClientOst", () => {
  const ost: Ost = {
    id: 12,
    title: "Gurenge",
    artist: "LiSA",
    kind: "opening",
    youtube_url: "https://www.youtube.com/watch?v=x1FV6IrjZCY",
    anime_id: 3,
    anime_title: "Demon Slayer",
    anime_image_url: "https://cdn.example/cover.jpg",
    audio_filename: null,
    cover_filename: null,
  };

  it("cache les noms de fichiers internes et donne des URLs", () => {
    const client = toClientOst({ ...ost, audio_filename: "12-abc.mp3", cover_filename: "12-def.png" }, new Set());
    assert.equal(client.audio_url, "/api/osts/12/audio?v=12-abc.mp3");
    assert.equal(client.cover_url, "/api/osts/12/cover?v=12-def.png");
    assert.ok(!("audio_filename" in client) && !("cover_filename" in client) && !("anime_image_url" in client));
  });

  it("prend la pochette de l'anime et l'id YouTube à défaut", () => {
    const client = toClientOst(ost, new Set([12]));
    assert.equal(client.audio_url, null);
    assert.equal(client.cover_url, "https://cdn.example/cover.jpg");
    assert.equal(client.youtube_id, "x1FV6IrjZCY");
    assert.equal(client.favorite, true);
  });
});
