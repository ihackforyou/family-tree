import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import type { CaseFile } from './types';
import { localeOf, t } from './i18n';

const MAX_SIDE = 6000;

function download(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function safeName(s: string) {
  return s.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').slice(0, 60) || 'family-tree';
}

async function sha256(text: string): Promise<string> {
  if (!crypto?.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Render the whole tree (not just the visible part) to a PNG data URL, in the light theme. */
async function captureTree(nodes: Node[]): Promise<{ url: string; w: number; h: number }> {
  const el = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!el) throw new Error(t('err.noCanvas'));
  const bounds = getNodesBounds(nodes);
  const pad = 40;
  let w = bounds.width + pad * 2;
  let h = bounds.height + pad * 2;
  const scale = Math.min(1.5, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const vp = getViewportForBounds(bounds, w, h, 0.02, 4, 0.02);

  const root = document.documentElement;
  const prevTheme = root.dataset.theme;
  root.dataset.theme = 'light';
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const url = await toPng(el, {
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      pixelRatio: 1,
      style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      filter: (n) => !(n instanceof HTMLElement && n.classList?.contains('plus')),
    });
    return { url, w, h };
  } finally {
    root.dataset.theme = prevTheme ?? 'dark';
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Tree image + case header + watermark + footer, drawn on one canvas (canvas renders Devanagari correctly). */
async function compose(cf: CaseFile, nodes: Node[], userName: string) {
  const shot = await captureTree(nodes);
  const img = await loadImage(shot.url);
  const header = 110;
  const footer = 46;
  const W = Math.max(shot.w, 1200);
  const H = shot.h + header + footer;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, (W - shot.w) / 2, header);

  const font = (px: number, wt = 400) => `${wt} ${px}px Inter, "Noto Sans Devanagari", sans-serif`;
  ctx.fillStyle = '#0f172a';
  ctx.font = font(28, 700);
  ctx.fillText(cf.title, 32, 46);
  ctx.font = font(16);
  ctx.fillStyle = '#475569';
  const now = new Date();
  const bits = [
    cf.firNo && `FIR: ${cf.firNo}`,
    cf.policeStation && t('export.ps', { v: cf.policeStation }),
    cf.focusId && cf.persons[cf.focusId] && `Focus: ${cf.persons[cf.focusId].name}`,
    t('export.people', { n: Object.keys(cf.persons).length }),
    `Export: ${now.toLocaleString(localeOf())}`,
    `User: ${userName}`,
  ].filter(Boolean);
  ctx.fillText(bits.join('   ·   '), 32, 78);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, header - 8, W, 2);

  // watermark
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#b91c1c';
  ctx.font = font(Math.max(48, Math.min(W, H) / 12), 800);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.atan2(H, W));
  ctx.textAlign = 'center';
  ctx.fillText('CONFIDENTIAL – LAW ENFORCEMENT', 0, 0);
  ctx.restore();

  const hash = await sha256(JSON.stringify({ persons: cf.persons, edges: cf.edges }));
  ctx.fillStyle = '#64748b';
  ctx.font = font(13);
  ctx.fillText(`Suspect Family Tree · Investigation Camp · data SHA-256: ${hash.slice(0, 32)}…`, 32, H - 18);
  return { canvas: c, hash };
}

export async function exportPNG(cf: CaseFile, nodes: Node[], userName: string) {
  const { canvas } = await compose(cf, nodes, userName);
  download(canvas.toDataURL('image/png'), `${safeName(cf.title)}.png`);
}

export async function exportPDF(cf: CaseFile, nodes: Node[], userName: string) {
  const { canvas } = await compose(cf, nodes, userName);
  const { jsPDF } = await import('jspdf');
  const landscape = canvas.width >= canvas.height;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a3' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const r = Math.min((pw - 40) / canvas.width, (ph - 40) / canvas.height);
  const w = canvas.width * r;
  const h = canvas.height * r;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
  pdf.setProperties({ title: cf.title, subject: 'Suspect Family Tree', creator: 'Investigation Camp' });
  const url = URL.createObjectURL(pdf.output('blob'));
  download(url, `${safeName(cf.title)}.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportJSON(cf: CaseFile) {
  const blob = new Blob([JSON.stringify(cf, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `${safeName(cf.title)}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readJSONFile(file: File): Promise<CaseFile> {
  return file.text().then((t) => JSON.parse(t) as CaseFile);
}
