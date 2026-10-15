/**
 * Petit wrapper autour de l'API IFrame officielle de YouTube
 * (https://developers.google.com/youtube/iframe_api_reference).
 */

interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: object) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// États renvoyés par onStateChange
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Impossible de charger YouTube"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface YouTubeEvents {
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: () => void;
}

export class YouTubeEngine {
  private player: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;
  private target: HTMLDivElement | null = null;
  /** Vidéo demandée en dernier : évite qu'une vidéo démarre après qu'on a changé de piste */
  private wantedId: string | null = null;

  constructor(private host: HTMLElement, private events: YouTubeEvents) {}

  private getPlayer(): Promise<YTPlayer> {
    this.ready ??= loadApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          // YouTube remplace l'élément cible par son iframe : on lui donne un div à nous
          this.target = document.createElement("div");
          this.host.appendChild(this.target);
          const player = new YT.Player(this.target, {
            width: "100%",
            height: "100%",
            playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
            events: {
              onReady: () => {
                this.player = player;
                resolve(player);
              },
              onStateChange: (e: { data: number }) => {
                if (e.data === PLAYING) this.events.onPlay();
                else if (e.data === PAUSED) this.events.onPause();
                else if (e.data === ENDED) this.events.onEnded();
              },
              onError: () => this.events.onError(),
            },
          });
        }),
    );
    return this.ready;
  }

  /** Charge l'API et le lecteur à l'avance pour que la 1re lecture démarre vite */
  preload() {
    this.getPlayer().catch(() => undefined);
  }

  async load(videoId: string, volume: number) {
    this.wantedId = videoId;
    try {
      const player = await this.getPlayer();
      if (this.wantedId !== videoId) return;
      player.setVolume(Math.round(volume * 100));
      player.loadVideoById(videoId);
    } catch {
      this.events.onError();
    }
  }

  play() {
    this.player?.playVideo();
  }

  pause() {
    this.player?.pauseVideo();
  }

  stop() {
    this.wantedId = null;
    this.player?.stopVideo();
  }

  seek(seconds: number) {
    this.player?.seekTo(seconds, true);
  }

  setVolume(volume: number) {
    this.player?.setVolume(Math.round(volume * 100));
  }

  get currentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  get duration(): number {
    return this.player?.getDuration() ?? 0;
  }

  destroy() {
    this.wantedId = null;
    this.player?.destroy();
    this.target?.remove();
    this.player = null;
    this.ready = null;
  }
}
