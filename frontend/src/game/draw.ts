import type { Game, Judgement } from "./engine";
import { JUDGEMENT_LABELS } from "./engine";

/** Couleurs des 4 flèches ← ↓ ↑ →, reprises du dégradé du site */
export const LANE_COLORS = ["#22d3ee", "#a855f7", "#ec4899", "#f5d27a"];
const ROTATIONS = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
const JUDGEMENT_COLORS: Record<Judgement, string> = {
  perfect: "#f5d27a",
  great: "#22d3ee",
  good: "#a855f7",
  miss: "#f87171",
};

/** Effets visuels déclenchés par les appuis (horodatés avec performance.now()) */
export interface Effects {
  pressedAt: number[];
  hits: ({ at: number; judgement: Judgement } | null)[];
  last: { judgement: Judgement; at: number } | null;
}

export const createEffects = (): Effects => ({ pressedAt: [0, 0, 0, 0], hits: [null, null, null, null], last: null });

export interface Layout {
  width: number;
  height: number;
  laneWidth: number;
  x0: number;
  hitY: number;
}

export function computeLayout(width: number, height: number): Layout {
  const laneWidth = Math.min(width / 4, 110);
  return { width, height, laneWidth, x0: (width - laneWidth * 4) / 2, hitY: height - laneWidth * 0.8 };
}

/** Index de la flèche sous une abscisse (pour les appuis directement sur le canvas) */
export function laneAt(layout: Layout, x: number): number | null {
  const lane = Math.floor((x - layout.x0) / layout.laneWidth);
  return lane >= 0 && lane < 4 ? lane : null;
}

/** Flèche pointant vers le haut, centrée sur (0, 0) */
function arrowPath(ctx: CanvasRenderingContext2D, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, -s * 0.05);
  ctx.lineTo(s * 0.42, -s * 0.05);
  ctx.lineTo(s * 0.42, s * 0.85);
  ctx.quadraticCurveTo(s * 0.42, s, s * 0.27, s);
  ctx.lineTo(-s * 0.27, s);
  ctx.quadraticCurveTo(-s * 0.42, s, -s * 0.42, s * 0.85);
  ctx.lineTo(-s * 0.42, -s * 0.05);
  ctx.lineTo(-s, -s * 0.05);
  ctx.closePath();
}

function drawArrow(ctx: CanvasRenderingContext2D, lane: number, cx: number, cy: number, size: number, mode: "fill" | "outline", alpha = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ROTATIONS[lane]);
  ctx.globalAlpha = alpha;
  arrowPath(ctx, size);
  if (mode === "fill") {
    ctx.shadowColor = LANE_COLORS[lane];
    ctx.shadowBlur = 16;
    ctx.fillStyle = LANE_COLORS[lane];
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.stroke();
  } else {
    ctx.lineWidth = 3;
    ctx.strokeStyle = LANE_COLORS[lane];
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dessine une image du jeu à l'instant `t` (secondes dans le morceau).
 * `travel` = durée de chute d'une note, `now` = performance.now() pour les effets.
 */
export function drawFrame(ctx: CanvasRenderingContext2D, layout: Layout, game: Game, t: number, travel: number, fx: Effects, now: number) {
  const { width, height, laneWidth: lw, x0, hitY } = layout;
  ctx.clearRect(0, 0, width, height);
  const size = lw * 0.72;

  // Couloirs + flash quand on appuie
  for (let lane = 0; lane < 4; lane++) {
    const x = x0 + lane * lw;
    ctx.fillStyle = lane % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.045)";
    ctx.fillRect(x, 0, lw, height);
    const since = now - fx.pressedAt[lane];
    if (since < 160) {
      const glow = ctx.createLinearGradient(0, hitY, 0, hitY - lw * 3);
      glow.addColorStop(0, LANE_COLORS[lane] + "55");
      glow.addColorStop(1, LANE_COLORS[lane] + "00");
      ctx.globalAlpha = 1 - since / 160;
      ctx.fillStyle = glow;
      ctx.fillRect(x, hitY - lw * 3, lw, lw * 3);
      ctx.globalAlpha = 1;
    }
  }

  // Ligne de frappe
  const line = ctx.createLinearGradient(x0, 0, x0 + lw * 4, 0);
  LANE_COLORS.forEach((c, i) => line.addColorStop(i / 3, c));
  ctx.fillStyle = line;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x0, hitY - 1, lw * 4, 2);
  ctx.globalAlpha = 1;

  // Cibles (contours), qui grossissent un peu à l'appui
  for (let lane = 0; lane < 4; lane++) {
    const since = now - fx.pressedAt[lane];
    const bump = since < 100 ? 1.08 : 1;
    drawArrow(ctx, lane, x0 + lane * lw + lw / 2, hitY, size * bump, "outline", 0.75);
  }

  // Notes : de -size (en haut) jusqu'à la ligne de frappe en `travel` secondes
  const distance = hitY + size;
  for (let i = 0; i < game.notes.length; i++) {
    const note = game.notes[i];
    const dt = note.time - t;
    if (dt > travel + 0.1) break; // pas encore visible (notes triées)
    const judged = game.judged[i];
    if (judged && judged !== "miss") continue; // jouée : elle disparaît
    if (dt < -0.6) continue;
    const y = hitY - (dt / travel) * distance;
    drawArrow(ctx, note.lane, x0 + note.lane * lw + lw / 2, y, size, "fill", judged === "miss" ? 0.25 : 1);
  }

  // Onde de choc sur les notes réussies
  for (let lane = 0; lane < 4; lane++) {
    const hit = fx.hits[lane];
    if (!hit) continue;
    const p = (now - hit.at) / 320;
    if (p >= 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = JUDGEMENT_COLORS[hit.judgement];
    ctx.lineWidth = 4 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(x0 + lane * lw + lw / 2, hitY, size * (0.55 + p * 0.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Jugement + combo au centre
  if (fx.last && now - fx.last.at < 600) {
    const p = (now - fx.last.at) / 600;
    ctx.save();
    ctx.globalAlpha = 1 - p * p;
    ctx.textAlign = "center";
    ctx.fillStyle = JUDGEMENT_COLORS[fx.last.judgement];
    ctx.shadowColor = JUDGEMENT_COLORS[fx.last.judgement];
    ctx.shadowBlur = 18;
    ctx.font = `900 ${Math.round(lw * 0.36)}px Inter, system-ui, sans-serif`;
    ctx.fillText(JUDGEMENT_LABELS[fx.last.judgement].toUpperCase(), width / 2, hitY - lw * 2.1 - p * 10);
    ctx.restore();
  }
  if (game.combo >= 5) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `900 ${Math.round(lw * 0.5)}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(game.combo), width / 2, hitY - lw * 2.9);
    ctx.font = `700 ${Math.round(lw * 0.16)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("COMBO", width / 2, hitY - lw * 2.65);
    ctx.restore();
  }
}
