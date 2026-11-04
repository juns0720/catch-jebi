import { STAMP_LABEL, TIERS } from '@/types';
import type { RunResult, Tier } from '@/types';
import { badgeDataUrl } from './badges';

export interface ShareImageOpts { nickname: string | null; tier: Tier; siteUrl: string; ghostName?: string; ghostMs?: number; }

const W = 1080, H = 1350;
const PAPER = '#f3ead3', INK = '#2b2317', SEAL = '#c0392b', MUTED = '#6b5d45';
const DISPLAY = '"Song Myung", "Noto Serif KR", serif';
const BODY = '"Gowun Dodum", "Malgun Gothic", sans-serif';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('badge image load failed'));
    img.src = src;
  });
}

function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, size: number, color: string, maxW = 800) {
  ctx.fillStyle = color;
  let px = size;
  do { ctx.font = `${px}px ${font}`; px -= 2; } while (ctx.measureText(s).width > maxW && px > 20);
  ctx.fillText(s, W / 2, y);
}

export async function renderResultImage(r: RunResult, o: ShareImageOpts): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`160px "Song Myung"`), document.fonts.load(`44px "Gowun Dodum"`)]);
  } catch { /* 폰트 실패 시 폴백 서체 */ }

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#0e141d';
  ctx.fillRect(0, 0, W, H);

  // 쪽지 카드
  const cx = 90, cy = 90, cw = W - 180, ch = H - 180;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  ctx.fillStyle = PAPER;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,50,20,.09)'; ctx.lineWidth = 3;
  for (const k of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.moveTo(cx, cy + ch * k); ctx.lineTo(cx + cw, cy + ch * k); ctx.stroke(); }

  const tierName = (TIERS.find(t => t.id === o.tier) ?? TIERS[0]).name;
  const sec = (ms: number) => (ms / 1000).toFixed(1);

  if (o.nickname) text(ctx, o.nickname, 160, BODY, 40, MUTED);

  try {
    const img = await loadImage(badgeDataUrl(o.tier, { bird: '#1a2335', seal: SEAL, belly: '#fbf6e8', gold: '#d4a63a' }, 256));
    ctx.drawImage(img, W / 2 - 140, 185, 280, 280);
  } catch { /* 뱃지 없이 진행 */ }

  text(ctx, `레벨 ${r.level} · ${tierName}`, 540, DISPLAY, 60, INK);

  if (r.cleared) text(ctx, `${sec(r.timeMs)}초`, 720, DISPLAY, 160, INK);
  else text(ctx, `레벨 ${r.level}에서 제비에게 짐`, 700, DISPLAY, 76, SEAL);

  text(ctx, `꽝 ${r.blanks} · 헛손질 ${r.misses} · 명중률 ${Math.round(r.accuracy * 100)}%`, 800, BODY, 46, INK);

  if (o.ghostName && o.ghostMs != null) text(ctx, `${o.ghostName} ${sec(o.ghostMs)}초 vs 나`, 866, BODY, 38, MUTED);

  // 도장: 겹쳐서 랜덤 각도
  const n = r.stamps.length;
  const gap = Math.min(230, 640 / Math.max(n, 1));
  r.stamps.forEach((st, i) => {
    const label = STAMP_LABEL[st];
    ctx.save();
    ctx.translate(W / 2 + (i - (n - 1) / 2) * gap, 1030 + rand(-30, 30));
    ctx.rotate((rand(-15, 10) * Math.PI) / 180);
    ctx.globalAlpha = 0.9;
    ctx.font = `68px ${DISPLAY}`;
    const tw = ctx.measureText(label).width + 40, th = 100;
    ctx.strokeStyle = SEAL; ctx.fillStyle = SEAL; ctx.lineWidth = 8;
    ctx.strokeRect(-tw / 2, -th / 2, tw, th);
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 4);
    ctx.restore();
  });

  text(ctx, `Catch The Jebi · ${o.siteUrl}`, 1215, BODY, 36, MUTED);

  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
