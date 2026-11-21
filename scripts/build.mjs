import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/profile');
const BLOG = process.env.BLOG_URL || 'https://alkove.ai/blog/';
const SITE_CSS = process.env.SITE_CSS || 'https://alkove.ai/style.css';
mkdirSync(OUT, { recursive: true });

const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');
const FONT = b64('scripts/fonts/geist.woff2');
const MONO = b64('scripts/fonts/geist-mono.woff2');
const data = JSON.parse(readFileSync(join(ROOT, 'scripts/profile.json'), 'utf8'));

const T0 = { bg: '#fbfaf7', text: '#13254a', muted: '#56607a', faint: '#8a90a3', line: 'rgba(19,37,74,0.14)', grid: 'rgba(19,37,74,0.06)', accent: '#e0702c', chip: 'rgba(19,37,74,0.05)' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Geist advance widths are close to 0.56em on average; good enough to wrap short lines.
function wrap(text, width, size, k = 0.56) {
  const max = Math.floor(width / (size * k));
  const lines = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

const lines = (arr, x, y, lh, attrs) => `<text x="${x}" y="${y}" ${attrs}>${arr.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;

let BLEED = false;
function arrow(t, x, y, dark) {
  const f = dark ? 'rgba(255,255,255,0.08)' : t.chip, s = dark ? 'rgba(255,255,255,0.28)' : t.line, c = dark ? '#eef1f7' : t.text;
  return `<circle cx="${x}" cy="${y}" r="13" fill="${f}" stroke="${s}"/><path d="M${x - 4} ${y + 4}L${x + 4} ${y - 4}M${x - 2.5} ${y - 4}H${x + 4}V${y + 2.5}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function doc(w, h, t, label, body, { glow = ['rgba(224,112,44,0.22)', '20%', '0%'], grid = true, defs = '', css = '', link = null, linkDark = false, scale = 1 } = {}) {
  if (link) body += arrow(t, w - 30, link === 'tr' ? 31 : h - 29, linkDark);
  const id = createHash('sha1').update(label + w + h).digest('hex').slice(0, 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(BLEED ? w - 10 : w) * scale}" height="${(BLEED ? h - 8 : h) * scale}" viewBox="${BLEED ? `5 4 ${w - 10} ${h - 8}` : `0 0 ${w} ${h}`}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><defs>
<clipPath id="c${id}"><rect x="5" y="4" width="${w - 10}" height="${h - 8}" rx="14"/></clipPath>
<radialGradient id="g${id}" cx="${glow[1]}" cy="${glow[2]}" r="85%"><stop offset="0" stop-color="${glow[0]}"/><stop offset="1" stop-color="${glow[0]}" stop-opacity="0"/></radialGradient>
<pattern id="p${id}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern>
<radialGradient id="m${id}g"><stop offset="0.2" stop-color="#fff"/><stop offset="0.75" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="m${id}"><rect width="${w}" height="${h}" fill="url(#m${id}g)"/></mask>${defs}</defs>
<style>@font-face{font-family:G;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900}@font-face{font-family:M;src:url(data:font/woff2;base64,${MONO}) format('woff2')}
text{font-family:G,ui-sans-serif,system-ui,sans-serif;fill:${t.text}}.m{font-family:M,ui-monospace,monospace}.mu{fill:${t.muted}}.fa{fill:${t.faint}}.ac{fill:${t.accent}}.st{stroke:${t.text}}.sa{stroke:${t.accent}}.sm{stroke:${t.muted}}${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g clip-path="url(#c${id})"><rect width="${w}" height="${h}" fill="${t.bg}"/><rect width="${w}" height="${h}" fill="url(#g${id})"/>${grid ? `<rect width="${w}" height="${h}" fill="url(#p${id})" mask="url(#m${id})"/>` : ''}
${body}</g><rect x="5.5" y="4.5" width="${w - 11}" height="${h - 9}" rx="13.5" fill="none" stroke="${t.line}"/></svg>`;
}

// Deterministic speech-like waveform: bursts of syllables over a quiet floor.
function wave(x0, x1, cy, amp, seed, step = 2) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bursts = [];
  for (let x = x0; x < x1;) { const len = 30 + rnd() * 70; bursts.push([x, x + len, 0.4 + rnd() * 0.6]); x += len + 10 + rnd() * 40; }
  const pts = [];
  for (let x = x0; x <= x1; x += step) {
    let e = 0.04;
    for (const [a, b, g] of bursts) if (x >= a && x <= b) e = Math.max(e, g * Math.sin(Math.PI * (x - a) / (b - a)));
    const y = Math.sin(x * 0.21 + seed) * 0.6 + Math.sin(x * 0.47) * 0.3 + Math.sin(x * 0.083 + 1) * 0.4;
    pts.push(`${x.toFixed(1)} ${(cy - y * e * amp).toFixed(1)}`);
  }
  return 'M' + pts.join(' L');
}

function chips(items, x, y, t, { size = 11, gap = 6, pad = 8, h = 22 } = {}) {
  let cx = x, out = '';
  for (const it of items) {
    const w = it.length * size * 0.6 + pad * 2;
    out += `<rect x="${cx}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${t.chip}" stroke="${t.line}"/><text x="${(cx + w / 2).toFixed(1)}" y="${y + h / 2 + size * 0.36}" text-anchor="middle" class="m mu" font-size="${size}">${esc(it)}</text>`;
    cx += w + gap;
  }
  return out;
}

const tiles = {};

tiles.hero = (t) => {
  const W = 846, H = 230, period = 846;
  const w1 = wave(0, period * 2, 186, 26, 7);
  const body = `
<text x="43" y="78" font-size="32" font-weight="600" letter-spacing="-0.8">${esc(data.hero.title)}</text>
${lines(wrap(data.hero.lede, 700, 17), 44, 112, 25, 'class="mu" font-size="17"')}
<g style="animation:sc 14s linear infinite"><path d="${w1}" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/></g>
<line x1="0" y1="186" x2="${W}" y2="186" stroke="${t.line}"/>`;
  return doc(W, H, t, `${data.hero.title} ${data.hero.lede}`, body, { glow: ['rgba(224,112,44,0.20)', '85%', '10%'], css: `@keyframes sc{from{transform:translateX(0)}to{transform:translateX(-${period}px)}}` });
};

tiles.pipeline = (t) => {
  const W = 846, H = 184, steps = data.pipeline, n = steps.length, gx = 14, x0 = 24, cw = (W - x0 * 2 - gx * (n - 1)) / n;
  let body = `<text x="28" y="34" class="m fa" font-size="11" letter-spacing="1">${esc(data.pipelineTitle)}</text>`;
  steps.forEach((s, i) => {
    const x = x0 + i * (cw + gx);
    body += `<rect x="${x}" y="48" width="${cw}" height="112" rx="10" fill="${t.chip}" stroke="${t.line}"/>
<text x="${x + 14}" y="72" class="m ac" font-size="11">0${i + 1}</text>
<text x="${x + 14}" y="94" font-size="16" font-weight="600">${esc(s.title)}</text>
${lines(wrap(s.text, cw - 22, 11.5, 0.52), x + 14, 114, 15, 'class="mu" font-size="11.5"')}`;
  });
  return doc(W, H, t, 'What I do: ' + steps.map((s) => `${s.title}: ${s.text}`).join('. '), body, { glow: ['rgba(19,37,74,0.0)', '50%', '0%'] });
};

function bigTile(t, d, art, glow, link = null, wide = false) {
  const W = wide ? 846 : 423, H = wide ? 220 : 300;
  let body = `<text x="28" y="40" class="m ac" font-size="11" letter-spacing="1">${esc(d.kicker)}</text>
<text x="27" y="74" font-size="28" font-weight="600" letter-spacing="-0.6">${esc(d.title)}</text>
${lines(wrap(d.text, wide ? 390 : 360, 13), 28, 98, 18, 'class="mu" font-size="13"')}
${wide ? `<g transform="translate(423 0)">${art}</g>` : art}`;
  d.stats.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = (wide ? 470 : 28) + col * (wide ? 170 : 186), y = (wide ? 104 : 170) + row * (wide ? 60 : 56);
    body += `<text x="${x}" y="${y}" font-size="22" font-weight="600" letter-spacing="-0.4">${esc(s.value)}</text><text x="${x}" y="${y + 18}" class="mu" font-size="11.5">${esc(s.label)}</text>`;
  });
  body += `<text x="28" y="${H - 22}" class="m fa" font-size="10.5">${esc(d.foot)}</text>`;
  return doc(W, H, t, `${d.title}: ${d.text} ` + d.stats.map((s) => `${s.value} ${s.label}`).join(', '), body, { glow, link });
}

const alkoveTile = (t, wide) => bigTile(t, data.alkove, `<path d="${wave(250, 400, 46, 16, 3)}" fill="none" class="sa" stroke-width="1.3" opacity="0.8"/>`, ['rgba(224,112,44,0.24)', '90%', '0%'], 'br', wide);
const assistantTile = (t, wide) => bigTile(t, data.assistant, `<g transform="translate(330 34)" fill="none" class="sa" stroke-width="1.4" stroke-linecap="round"><path d="M8 0H48A8 8 0 0 1 56 8V26A8 8 0 0 1 48 34H21L7 43L11 34H8A8 8 0 0 1 0 26V8A8 8 0 0 1 8 0Z" stroke-linejoin="round"/><circle cx="16" cy="17" r="2.2" fill="${t.accent}"/><circle cx="28" cy="17" r="2.2" fill="${t.accent}"/><circle cx="40" cy="17" r="2.2" fill="${t.accent}"/></g>`, ['rgba(28,138,208,0.20)', '90%', '0%'], null, wide);

tiles.alkove = (t) => alkoveTile(t, true);
tiles.assistant = (t) => assistantTile(t, true);

function smallTile(t, d, art, glow, extra = '') {
  const W = 423, H = 150;
  const body = `${art}<text x="20" y="${H - 44}" font-size="17" font-weight="600" letter-spacing="-0.3">${esc(d.title)}</text><text x="20" y="${H - 24}" class="mu" font-size="11.5">${esc(d.text)}</text>${extra}`;
  return doc(W, H, t, `${d.title}: ${d.text}`, body, { glow, link: 'br' });
}

tiles.brindille = (t) => {
  const H = 150, G = '#2f6b52', x0 = 218, w = 182;
  const tl = wrap(data.brindille.text, 180, 12, 0.52);
  let bars = '';
  for (let k = 0; k < 27; k++) {
    const e = Math.max(0.15, Math.abs(Math.sin(k * 0.55) * 0.8 + Math.sin(k * 1.9) * 0.3)) * (k % 9 === 8 ? 0.2 : 1);
    const h = 4 + e * 26;
    bars += `<rect x="${(x0 + 4 + k * 5.2).toFixed(1)}" y="${(119 - h / 2).toFixed(1)}" width="3" height="${h.toFixed(1)}" rx="1.5" fill="${G}"/>`;
  }
  const art = `<rect x="${x0}" y="22" width="${w}" height="44" rx="8" fill="#fff" stroke="${t.line}"/><text x="${x0 + 12}" y="40" font-size="11.5">Bonjour, je suis Brindille,</text><text x="${x0 + 12}" y="56" font-size="11.5">une voix dans votre navigateur.</text>
<rect x="${x0}" y="74" width="40" height="16" rx="5" fill="${G}"/><text x="${x0 + 20}" y="85.5" text-anchor="middle" font-size="9.5" font-weight="600" style="fill:#fff">Play</text><text x="${x0 + 48}" y="85.5" class="m fa" font-size="9">~75× real time, one thread</text>${bars}`;
  return doc(423, H, t, `${data.brindille.title}: ${data.brindille.text}`, `${art}<text x="22" y="40" font-size="17" font-weight="600" letter-spacing="-0.3">${esc(data.brindille.title)}</text>${lines(tl, 22, 64, 16, 'class="mu" font-size="12"')}`, { link: 'br', glow: ['rgba(47,107,82,0.16)', '100%', '0%'] });
};
tiles.spascii = (t) => {
  const img = b64('scripts/src/spascii-tile.webp'), H = 150, iw = 170 * 1104 / 664;
  const tl = wrap(data.spascii.text, 215, 12, 0.52);
  return doc(423, H, t, `${data.spascii.title}: ${data.spascii.text}`, `<rect width="423" height="${H}" fill="#0b0d12"/><image href="data:image/webp;base64,${img}" x="${423 - iw + 40}" y="-10" width="${iw}" height="170"/><rect width="423" height="${H}" fill="url(#fade)"/><text x="22" y="40" font-size="17" font-weight="600" style="fill:#eef1f7">${esc(data.spascii.title)}</text>${lines(tl, 22, 64, 16, 'font-size="12" style="fill:#aab6d6"')}`, { grid: false, link: 'br', linkDark: true, glow: ['rgba(0,0,0,0)', '0%', '0%'], defs: '<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.3" stop-color="#0b0d12" stop-opacity="0.95"/><stop offset="0.62" stop-color="#0b0d12" stop-opacity="0"/></linearGradient>' });
};

function wideTile(t, d, art, glow) {
  const W = 423, H = 190;
  const body = `<text x="28" y="38" class="m ac" font-size="11" letter-spacing="1">${esc(d.kicker)}</text>
<text x="27" y="68" font-size="20" font-weight="600" letter-spacing="-0.4">${esc(d.title)}</text>
${lines(wrap(d.text, 250, 12.5), 28, 92, 17, 'class="mu" font-size="12.5"')}${art}
<text x="28" y="${H - 22}" class="m fa" font-size="10.5">${esc(d.foot)}</text>`;
  return doc(W, H, t, `${d.title}: ${d.text}`, body, { glow, link: 'br' });
}

tiles.redteam = (t) => wideTile(t, data.redteam, `<g transform="translate(300 40)" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="70" height="26" rx="6" class="st"/><text x="35" y="17" text-anchor="middle" class="m" font-size="10" stroke="none">agent</text><path d="M35 26v18" class="st"/><rect x="0" y="44" width="70" height="26" rx="6" class="st"/><text x="35" y="61" text-anchor="middle" class="m" font-size="10" stroke="none">tool</text><path d="M35 70v18" class="sa" stroke-dasharray="3 4"/><rect x="0" y="88" width="70" height="26" rx="6" class="sa"/><text x="35" y="105" text-anchor="middle" class="m ac" font-size="10" stroke="none">{ field }</text></g>`, ['rgba(214,64,106,0.20)', '95%', '100%']);
tiles.article = (t) => {
  const d = data.article;
  let table = '';
  for (let r = 0; r < 3; r++) table += `<rect x="300" y="${86 + r * 18}" width="92" height="18" fill="${r === 1 ? t.chip : 'none'}" stroke="${r === 1 ? t.accent : t.line}"/><line x1="340" y1="${86 + r * 18}" x2="340" y2="${104 + r * 18}" stroke="${t.line}"/>`;
  return wideTile(t, d, table, ['rgba(28,138,208,0.18)', '95%', '0%']);
};

function modelCard(t, m, x, y, w, h, k) {
  const hex = m.color, rgba = `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},0.24)`;
  const stable = m.tag === 'stable', tw = m.tag.length * 6.6 + 12;
  return `<defs><radialGradient id="mg${k}" cx="0%" cy="0%" r="90%"><stop offset="0" stop-color="${rgba}"/><stop offset="1" stop-color="${rgba}" stop-opacity="0"/></radialGradient></defs>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${t.bg}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#mg${k})" stroke="${t.line}"/>
<rect x="${x + 14}" y="${y + 14}" width="24" height="24" rx="6" fill="${hex}"/><text x="${x + 26}" y="${y + 31}" text-anchor="middle" font-size="13" font-weight="600" style="fill:#fff">${m.glyph}</text>
<rect x="${x + w - 14 - tw}" y="${y + 17}" width="${tw}" height="18" rx="9" fill="${stable ? hex : 'none'}" fill-opacity="${stable ? 0.14 : 0}" stroke="${stable ? hex : t.line}"/><text x="${x + w - 14 - tw / 2}" y="${y + 30}" text-anchor="middle" class="m" font-size="10" style="fill:${stable ? hex : t.muted}">${m.tag}</text>
<text x="${x + 14}" y="${y + 62}" font-size="15" font-weight="600" letter-spacing="-0.2">${esc(m.name)}</text><text x="${x + 14}" y="${y + 80}" class="mu" font-size="11">${esc(m.job)}</text><text x="${x + w - 14}" y="${y + 62}" text-anchor="end" class="m fa" font-size="10">${esc(m.size)}</text>`;
}
const modelsLabel = 'Alkove models: ' + data.models.map((m) => `${m.name} (${m.tag}), ${m.job}, ${m.size}`).join('; ');
const modelsHead = `<text x="22" y="36" class="m fa" font-size="10.5" letter-spacing="1">ALKOVE MODELS ON HUGGING FACE · 2 STABLE, 3 PREVIEW</text>`;
tiles.models = (t) => {
  const W = 846, H = 162, g = 10, x0 = 14, cw = (W - x0 * 2 - g * 4) / 5;
  return doc(W, H, t, modelsLabel, modelsHead + data.models.map((m, i) => modelCard(t, m, x0 + i * (cw + g), 52, cw, 96, i)).join(''), { grid: false, link: 'tr', glow: ['rgba(0,0,0,0)', '0%', '0%'] });
};

async function getText(url, local) {
  if (local && existsSync(local)) return readFileSync(local, 'utf8');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

async function blogTiles() {
  const html = await getText(BLOG, process.env.BLOG_FILE);
  const css = await getText(SITE_CSS, process.env.SITE_CSS_FILE);
  const cards = [...html.matchAll(/<a class="post-card" href="([^"]+)">\s*<span class="cover ([^"]+)">([\s\S]*?)<\/span>\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].slice(0, 3);
  return cards.map(([, href, cls, svg, title, desc], i) => {
    const c = cls.split(/\s+/).find((x) => x.startsWith('c-')) || '';
    const rule = (css.match(new RegExp(`\\.cover\\.${c}\\s*\\{([^}]*)\\}`)) || [, ''])[1];
    const g = (rule.match(/--g:\s*([^;]+)/) || [, 'rgba(224, 112, 44, 0.26)'])[1].trim();
    const cx = (rule.match(/--cx:\s*([^;]+)/) || [, '20%'])[1].trim();
    const cy = (rule.match(/--cy:\s*([^;]+)/) || [, '10%'])[1].trim();
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").trim();
    const T = plain(title), D = plain(desc);
    const inner2 = inner;
    return { href: new URL(href, BLOG).href, title: T, desc: D, inner: inner2, g, cx, cy };

  });
}

function stepsMobile(t, title, steps, label, glow) {
  const W = 423, rh = 64, H = 56 + steps.length * (rh + 8) + 10;
  let body = `<text x="26" y="36" class="m fa" font-size="10.5" letter-spacing="1">${esc(title)}</text>`;
  steps.forEach((s, i) => {
    const y = 52 + i * (rh + 8);
    body += `<rect x="20" y="${y}" width="${W - 40}" height="${rh}" rx="10" fill="${t.chip}" stroke="${s.hot ? t.accent : t.line}"/>
<text x="36" y="${y + 26}" class="m ac" font-size="11">0${i + 1}</text><text x="64" y="${y + 26}" font-size="16" font-weight="600">${esc(s.title)}</text>
${lines(wrap(s.text, W - 104, 12, 0.53).slice(0, 2), 64, y + 45, 15, 'class="mu" font-size="12"')}`;
  });
  return doc(W, H, t, label, body, { glow });
}
const mobile = {
  alkove: (t) => alkoveTile(t, false),
  assistant: (t) => assistantTile(t, false),
  models: (t) => {
    const W = 423, g = 10, x0 = 14, cw = (W - x0 * 2 - g) / 2, ch = 96, H = 52 + x0 + 3 * ch + 2 * g;
    const body = data.models.map((m, i) => { const r = Math.floor(i / 2), c = i % 2, last = i === data.models.length - 1 && i % 2 === 0; return modelCard(t, m, x0 + c * (cw + g), 52 + r * (ch + g), last ? W - x0 * 2 : cw, ch, i); }).join('');
    return doc(W, H, t, modelsLabel, `<text x="22" y="36" class="m fa" font-size="10.5" letter-spacing="1">ALKOVE MODELS ON HUGGING FACE</text>` + body, { grid: false, link: 'tr', glow: ['rgba(0,0,0,0)', '0%', '0%'] });
  },
  hero: (t) => {
    const tt = wrap(data.hero.title, 370, 24, 0.55), lede = wrap(data.hero.lede, 360, 15);
    const ly = 56 + tt.length * 30 + 10, wy = ly + lede.length * 22 + 36, W = 423, H = wy + 42, w1 = wave(0, 846, wy, 20, 7);
    const body = `${lines(tt, 27, 56, 30, 'font-size="24" font-weight="600" letter-spacing="-0.6"')}
${lines(lede, 28, ly, 22, 'class="mu" font-size="15"')}
<g style="animation:sc 10s linear infinite"><path d="${w1}" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/></g><line x1="0" y1="${wy}" x2="${W}" y2="${wy}" stroke="${t.line}"/>`;
    return doc(W, H, t, `${data.hero.title} ${data.hero.lede}`, body, { glow: ['rgba(224,112,44,0.20)', '85%', '10%'], css: '@keyframes sc{from{transform:translateX(0)}to{transform:translateX(-423px)}}' });
  },
  pipeline: (t) => stepsMobile(t, data.pipelineTitle, data.pipeline, 'What I do', ['rgba(19,37,74,0)', '50%', '0%']),
};
BLEED = true;
for (const [name, fn] of Object.entries(mobile)) writeFileSync(join(OUT, `${name}-m.svg`), fn(T0));
BLEED = false;

for (const [name, fn] of Object.entries(tiles)) writeFileSync(join(OUT, `${name}.svg`), fn(T0));
const posts = await blogTiles();
writeFileSync(join(ROOT, 'scripts/posts.json'), JSON.stringify(posts.map(({ href, title, desc }) => ({ href, title, desc })), null, 2) + '\n');
function postCard(t, p, i, x, y, w, k, big) {
  const cw = w - 34, chh = cw * 10 / 16, id = `pc${i}${k}`, ts = big ? 19 : 15.5, ds = big ? 13 : 11.5, tl = wrap(p.title, cw, ts, 0.55), dl = wrap(p.desc, cw, ds, 0.54).slice(0, 4);
  const h = 17 + chh + 30 + tl.length * (ts + 5) + 6 + dl.length * (ds + 5) + 16;
  const svg = `<defs><radialGradient id="g${id}" cx="${p.cx}" cy="${p.cy}" r="90%"><stop offset="0" stop-color="${p.g}"/><stop offset="0.75" stop-color="${p.g}" stop-opacity="0"/></radialGradient><clipPath id="${id}"><rect width="${cw}" height="${chh}" rx="10"/></clipPath></defs>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${t.bg}" stroke="${t.line}"/>
<g transform="translate(${x + 17} ${y + 17})"><g clip-path="url(#${id})"><rect width="${cw}" height="${chh}" fill="${t.bg}"/><rect width="${cw}" height="${chh}" fill="url(#g${id})"/></g><rect x="0.5" y="0.5" width="${cw - 1}" height="${chh - 1}" rx="9.5" fill="none" stroke="${t.line}"/>
<svg x="0" y="0" width="${cw}" height="${chh}" viewBox="0 0 320 200" fill="none" stroke="${t.text}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMid meet">${p.inner}</svg></g>
${lines(tl, x + 17, y + 17 + chh + 30, ts + 5, `font-size="${ts}" font-weight="600" letter-spacing="-0.2"`)}
${lines(dl, x + 17, y + 17 + chh + 30 + tl.length * (ts + 5) + 6, ds + 5, `class="mu" font-size="${ds}"`)}`;
  return { svg, h };
}
const blogLabel = 'Latest on the Alkove blog: ' + posts.map((p) => `${p.title}: ${p.desc}`).join(' ');
{
  const hs = posts.map((p, i) => postCard(T0, p, i, 5, 4, 272, 'd', false).h), hmax = Math.max(...hs);
  posts.forEach((p, i) => {
    const c = postCard(T0, p, i, 5, 4, 272, 'd', false);
    writeFileSync(join(OUT, `blog-${i + 1}.svg`), doc(282, hmax + 36, T0, `${p.title}: ${p.desc}`, c.svg.replace(/<rect x="5" y="4" width="272" height="[\d.]+" rx="12"[^>]*\/>/, ''), { link: 'br', grid: false, glow: ['rgba(0,0,0,0)', '0%', '0%'] }));
    const m = postCard(T0, p, i, 5, 4, 413, 'm', true);
    BLEED = true;
    writeFileSync(join(OUT, `blog-${i + 1}-m.svg`), doc(423, m.h + 36, T0, `${p.title}: ${p.desc}`, m.svg.replace(/<rect x="5" y="4" width="413" height="[\d.]+" rx="12"[^>]*\/>/, ''), { link: 'br', grid: false, glow: ['rgba(0,0,0,0)', '0%', '0%'], scale: 2 }));
    BLEED = false;
  });
}

console.log(`tiles: ${Object.keys(tiles).length}, posts: ${posts.length}`);

let MODE = null;
const HASM = new Set([...Object.keys(mobile), ...posts.map((_, i) => `blog-${i + 1}`)]);
const FLUID = new Set(posts.map((_, i) => `blog-${i + 1}`));
const src = (name, m) => {
  const base = `${name}${m && HASM.has(name) ? '-m' : ''}`, f = join(OUT, `${base}.svg`);
  const h = createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8), out = `${base}.${h}.svg`;
  if (!existsSync(join(OUT, out))) copyFileSync(f, join(OUT, out));
  return `assets/profile/${out}`;
};
const pic = (name, w, alt) => MODE
  ? `<img src="${src(name, MODE.mobile)}"${FLUID.has(name) ? '' : ` width="${MODE.mobile && HASM.has(name) ? 423 : w}"`} alt="${esc(alt)}">`
  : `<picture>${HASM.has(name) ? `<source media="(max-width: 600px)" srcset="${src(name, true)}">` : ''}<img src="${src(name)}"${FLUID.has(name) ? '' : ` width="${w}"`} alt="${esc(alt)}"></picture>`;
const a = (href, inner) => `<a href="${href}">${inner}</a>`;
const row = (...items) => `<p align="center">${items.join('')}</p>`;
const videos = existsSync(join(ROOT, 'scripts/videos.json')) ? JSON.parse(readFileSync(join(ROOT, 'scripts/videos.json'), 'utf8')) : {};
const video = (key, caption) => `<!--video:${key}-->\n\n${videos[key] || `assets/video/${key}.mp4`}\n\n<p align="center"><sub>${caption}</sub></p>`;
const L = data.links;
const render = () => [
  row(a('#-', pic('hero', 846, data.hero.lede))),
  row(a('#-', pic('pipeline', 846, 'What I do: train, optimize, ship, integrate, run'))),
  row(a('#-', pic('assistant', 846, data.assistant.text))),
  video('podcast', data.videos.podcast),
  row(a(L.alkove, pic('alkove', 846, data.alkove.text))),
  row(a(L.models, pic('models', 846, modelsLabel))),
  video('alkove-demo', data.videos['alkove-demo']),
  row(a(L.brindille, pic('brindille', 423, data.brindille.text)), a(L.spascii, pic('spascii', 423, data.spascii.text))),
  row(a(L.redteam, pic('redteam', 423, data.redteam.text)), a(L.article, pic('article', 423, data.article.title))),
  `<p align="center"><sub>${esc(data.blogTitle)}</sub></p>`,
  row(...posts.map((p, i) => a(p.href, pic(`blog-${i + 1}`, 282, `${p.title}: ${p.desc}`)))),
].join('\n\n') + '\n';
const readme = render();
writeFileSync(join(ROOT, 'README.md'), readme);
const used = new Set([...readme.matchAll(/assets\/profile\/([\w.-]+\.svg)/g)].map((m) => m[1]));
for (const f of readdirSync(OUT)) if (/\.[0-9a-f]{8}\.svg$/.test(f) && !used.has(f)) unlinkSync(join(OUT, f));

const gh = { light: { bg: '#ffffff', fg: '#1f2328', mu: '#59636e', bd: '#d1d9e0' }, dark: { bg: '#0d1117', fg: '#f0f6fc', mu: '#9198a1', bd: '#3d444d' } };
const pane = (th, m) => {
  MODE = { th, mobile: m };
  const html = render().replace(/<!--video:([\w-]+)-->\n\n\S+/g, (_, k) => `<video src="assets/video/${k}.mp4" controls width="846" style="border-radius:6px;display:block;margin:0 auto;max-width:100%"></video>`);
  MODE = null;
  return `<div class="pane ${th}${m ? ' mob' : ''}"><div class="box"><div class="hd">edbrdi / README.md · ${th}${m ? ' · mobile' : ''}</div><div class="md">${html}</div></div></div>`;
};
writeFileSync(join(ROOT, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>edbrdi profile preview</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#e9eaec}.bar{position:sticky;top:0;z-index:2;display:flex;gap:16px;justify-content:center;padding:10px;background:#1f2328}.bar div{display:flex;border:1px solid #444c56;border-radius:8px;overflow:hidden}.bar button{border:0;background:none;color:#adbac7;padding:7px 16px;font:inherit;cursor:pointer}.bar button.on{background:#e0702c;color:#fff}
.pane{display:none;padding:24px;min-height:100vh;box-sizing:border-box}.pane.show{display:block}
${Object.entries(gh).map(([k, c]) => `.${k}{background:${c.bg};color:${c.fg}}.${k} .box{border:1px solid ${c.bd}}.${k} .hd{border-bottom:1px solid ${c.bd};color:${c.mu}}.${k} sub{color:${c.mu}}`).join('')}
.box{max-width:880px;margin:0 auto;border-radius:6px}.mob .box{max-width:390px}.hd{padding:10px 16px;font-size:12px}.md{padding:16px}.md p{margin:0 0 16px;line-height:0}.md p sub{line-height:1.5}.md img{max-width:100%;vertical-align:top}.md a{color:inherit}.md a[href="#-"]{cursor:default}</style>
<div class="bar"><div><button data-k="m" data-v="0" class="on">Desktop</button><button data-k="m" data-v="1">Mobile</button></div><div><button data-k="t" data-v="light" class="on">Light</button><button data-k="t" data-v="dark">Dark</button></div></div>
${pane('light')}${pane('dark')}${pane('light', true)}${pane('dark', true)}
<script>
const st = { m: '0', t: 'light' };
try { Object.assign(st, JSON.parse(localStorage.getItem('pv') || '{}')); } catch {}
const show = () => {
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('show', p.classList.contains(st.t) && p.classList.contains('mob') === (st.m === '1')));
  document.querySelectorAll('.bar button').forEach((b) => b.classList.toggle('on', st[b.dataset.k] === b.dataset.v));
  try { localStorage.setItem('pv', JSON.stringify(st)); } catch {}
};
document.querySelectorAll('.bar button').forEach((b) => b.onclick = () => { st[b.dataset.k] = b.dataset.v; show(); });
show();
</script>`);
console.log('README.md + preview.html');
