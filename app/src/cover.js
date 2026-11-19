// Vice Cover Studio — the cover renderer.
//
// Draws multi-panel GTA-style poster art onto a canvas: photo panels with their own
// crop and zoom, Vice City colour grades, a synthwave sun, halftone dots and bold
// outlined lettering. Everything is drawn with the 2D canvas API, no library.
//
// A cover is described by a state object:
//   { size, layout, grade, title, subtitle, photos, panels, }
// where photos is an array of loaded images and panels[i] is
// { photo, zoom, dx, dy, auto } — the photo index, the crop transform of panel
// i, and whether the renderer may pick a smart default crop (auto).
// Panel geometry comes from layoutPanels(); the editor uses panelAt() to hit-test.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const LAYOUTS = {
  'vice-grid': { name: 'Vice Grid', panels: 3, blurb: 'Hero panel plus two stacked scenes, title band below.' },
  'sunset-hero': { name: 'Sunset Hero', panels: 1, blurb: 'One full-bleed photo, synthwave sun, huge title.' },
  'neon-split': { name: 'Neon Split', panels: 3, blurb: 'Three vertical strips under a neon title bar.' },
  'coast-strip': { name: 'Coast Strip', panels: 3, blurb: 'Three horizontal bands, title riding the middle.' },
};

export const GRADES = {
  'vice-sunset': { name: 'Vice Sunset', accent: '#ff2e88' },
  'neon-nights': { name: 'Neon Nights', accent: '#ff2ea6' },
  'palm-noir': { name: 'Palm Noir', accent: '#ff8c32' },
  'golden-hour': { name: 'Golden Hour', accent: '#ffb020' },
  chrome: { name: 'Chrome', accent: '#e8ecf4' },
  original: { name: 'Original', accent: '#ff5e3a' },
};

// Canvas filter plus clipped gradient overlays, per grade. The filter runs on the
// photo draw; the overlays are painted over each panel with a blend mode.
const GRADE_RECIPES = {
  'vice-sunset': {
    filter: 'saturate(1.45) contrast(1.07) brightness(1.03)',
    overlays: [
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,122,26,0)'], [1, 'rgba(255,46,136,0.38)']], blend: 'soft-light' },
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,190,80,0.20)'], [0.5, 'rgba(255,190,80,0)']], blend: 'screen' },
    ],
  },
  'neon-nights': {
    filter: 'saturate(1.6) contrast(1.18) brightness(0.96) hue-rotate(-12deg)',
    overlays: [
      { from: [0, 0], to: [1, 1], stops: [[0, 'rgba(255,0,128,0.38)'], [1, 'rgba(255,0,128,0)']], blend: 'soft-light' },
      { from: [1, 0], to: [0, 1], stops: [[0, 'rgba(0,229,255,0.30)'], [1, 'rgba(0,229,255,0)']], blend: 'soft-light' },
    ],
  },
  'palm-noir': {
    filter: 'saturate(1.12) contrast(1.14) sepia(0.18)',
    overlays: [
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(0,90,110,0)'], [1, 'rgba(0,90,110,0.32)']], blend: 'multiply' },
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,140,50,0.24)'], [0.6, 'rgba(255,140,50,0)']], blend: 'screen' },
    ],
  },
  'golden-hour': {
    filter: 'sepia(0.28) saturate(1.35) contrast(1.05) brightness(1.05)',
    overlays: [
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,170,60,0.26)'], [1, 'rgba(255,120,40,0.10)']], blend: 'soft-light' },
    ],
  },
  chrome: {
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    overlays: [
      { from: [0, 0], to: [0, 1], stops: [[0, 'rgba(120,160,255,0.14)'], [1, 'rgba(120,160,255,0)']], blend: 'screen' },
    ],
  },
  original: {
    filter: 'saturate(1.08) contrast(1.02)',
    overlays: [],
  },
};

const PAPER = '#f6f1e7';
const INK = '#14082b';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Panel geometry for a layout at a canvas size. Returns panel rects in pixels,
 * the title zone, and optional decorations (sun disc, halftone corner).
 */
export function layoutPanels(layout, w, h) {
  const g = Math.round(Math.min(w, h) * 0.014); // gutter between panels
  const aspect = w / h;
  if (layout === 'sunset-hero') {
    return {
      panels: [{ x: 0, y: 0, w, h }],
      title: { x: w * 0.055, y: h * 0.66, w: w * 0.89, h: h * 0.28, align: 'left', band: 'fade' },
      sun: { cx: w * 0.20, cy: h * 0.17, r: Math.min(w, h) * 0.15 },
      dots: { x: w * 0.80, y: h * 0.055, w: w * 0.15, h: h * 0.10 },
    };
  }
  if (layout === 'neon-split') {
    const pw = (w - g * 4) / 3;
    return {
      panels: [0, 1, 2].map((i) => ({ x: g + i * (pw + g), y: g, w: pw, h: h - g * 2 })),
      title: { x: g, y: h * 0.60, w: w - g * 2, h: h * 0.19, align: 'center', band: 'bar' },
      sun: null,
      dots: { x: w * 0.06, y: h * 0.06, w: w * 0.14, h: h * 0.09 },
    };
  }
  if (layout === 'coast-strip') {
    const ph = (h - g * 4) / 3;
    return {
      panels: [0, 1, 2].map((i) => ({ x: g, y: g + i * (ph + g), w: w - g * 2, h: ph })),
      title: { x: g, y: g + ph + g + ph * 0.22, w: w - g * 2, h: ph * 0.56, align: 'center', band: 'bar' },
      sun: null,
      dots: { x: w * 0.06, y: h * 0.045, w: w * 0.14, h: h * 0.07 },
    };
  }
  // vice-grid: hero panel plus two smaller scenes, title band along the foot.
  const bandH = Math.round(h * 0.21);
  const topH = h - bandH - g;
  if (aspect >= 1.4) {
    const heroW = Math.round(w * 0.60);
    const sideW = w - heroW - g * 2;
    const sideH = (topH - g) / 2;
    return {
      panels: [
        { x: g, y: g, w: heroW - g, h: topH - g },
        { x: heroW + g, y: g, w: sideW, h: sideH },
        { x: heroW + g, y: g + sideH + g, w: sideW, h: sideH },
      ],
      title: { x: 0, y: h - bandH, w, h: bandH, align: 'center', band: 'solid' },
      sun: null,
      dots: { x: w * 0.03, y: h - bandH + bandH * 0.18, w: w * 0.09, h: bandH * 0.6 },
    };
  }
  if (aspect < 0.95) {
    const heroH = Math.round(topH * 0.58);
    const rowH = topH - heroH - g;
    const rowW = (w - g * 3) / 2;
    return {
      panels: [
        { x: g, y: g, w: w - g * 2, h: heroH - g },
        { x: g, y: heroH + g, w: rowW, h: rowH },
        { x: g * 2 + rowW, y: heroH + g, w: rowW, h: rowH },
      ],
      title: { x: 0, y: h - bandH, w, h: bandH, align: 'center', band: 'solid' },
      sun: null,
      dots: { x: w * 0.04, y: h - bandH + bandH * 0.18, w: w * 0.12, h: bandH * 0.6 },
    };
  }
  const heroW = Math.round(w * 0.63);
  const sideW = w - heroW - g * 2;
  const sideH = (topH - g) / 2;
  return {
    panels: [
      { x: g, y: g, w: heroW - g, h: topH - g },
      { x: heroW + g, y: g, w: sideW, h: sideH },
      { x: heroW + g, y: g + sideH + g, w: sideW, h: sideH },
    ],
    title: { x: 0, y: h - bandH, w, h: bandH, align: 'center', band: 'solid' },
    sun: null,
    dots: { x: w * 0.03, y: h - bandH + bandH * 0.18, w: w * 0.09, h: bandH * 0.6 },
  };
}

/** Which panel, if any, contains the point (x, y) in canvas pixels. */
export function panelAt(layout, w, h, x, y) {
  const { panels } = layoutPanels(layout, w, h);
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

/** Draws one photo into one panel, cover-fit, with the panel's crop transform.
 *  A panel the user has never panned uses a smart default instead: when the
 *  photo is much taller than its panel, the window opens near the top of the
 *  photo, where faces and sky usually are, instead of the middle. */
function drawPanelPhoto(ctx, img, rect, transform, grade) {
  const recipe = GRADE_RECIPES[grade] ?? GRADE_RECIPES.original;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    fill.addColorStop(0, '#2a1445');
    fill.addColorStop(1, '#7a1e5c');
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.round(rect.h * 0.16)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (transform.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const photoAspect = img.naturalWidth / img.naturalHeight;
  const panelAspect = rect.w / rect.h;
  let dx = rect.x + (rect.w - dw) / 2 + (transform.dx || 0) * rect.w;
  let dy;
  if (transform.auto && photoAspect < panelAspect) {
    dy = rect.y - dh * 0.10; // open near the top of a tall photo in a wide panel
  } else {
    dy = rect.y + (rect.h - dh) / 2 + (transform.dy || 0) * rect.h;
  }
  dx = clamp(dx, rect.x + rect.w - dw, rect.x);
  dy = clamp(dy, rect.y + rect.h - dh, rect.y);
  ctx.filter = recipe.filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  for (const overlay of recipe.overlays) {
    const grad = ctx.createLinearGradient(
      rect.x + overlay.from[0] * rect.w, rect.y + overlay.from[1] * rect.h,
      rect.x + overlay.to[0] * rect.w, rect.y + overlay.to[1] * rect.h,
    );
    for (const [stop, color] of overlay.stops) grad.addColorStop(stop, color);
    ctx.globalCompositeOperation = overlay.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** A synthwave sun: warm disc cut by horizontal slits. */
function drawSynthwaveSun(ctx, sun, accent) {
  const { cx, cy, r } = sun;
  const disc = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#ffe9a3');
  disc.addColorStop(0.55, '#ffb347');
  disc.addColorStop(1, '#ff5e7a');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = disc;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(20,8,43,0.55)';
  let slitY = cy + r * 0.08;
  let slitH = r * 0.05;
  while (slitY < cy + r) {
    ctx.fillRect(cx - r, slitY, r * 2, slitH);
    slitY += slitH + r * 0.13;
    slitH += r * 0.02;
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, r * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r + ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A corner of halftone dots, fading toward the panel. */
function drawHalftoneDots(ctx, box, color) {
  const step = Math.max(10, box.w / 9);
  ctx.save();
  ctx.fillStyle = color;
  for (let y = box.y, row = 0; y < box.y + box.h; y += step, row += 1) {
    for (let x = box.x + (row % 2 ? step / 2 : 0); x < box.x + box.w; x += step) {
      const fade = 1 - (x - box.x) / box.w;
      ctx.globalAlpha = 0.10 + 0.28 * fade;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Splits a title into at most two lines that fit maxWidth at the given font. */
function fitTitleLines(ctx, text, maxWidth, fontFor) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = 0;
  const measure = (line, px) => {
    ctx.font = fontFor(px);
    return ctx.measureText(line).width;
  };
  // Find the largest size where the whole title fits on one line, else two.
  for (let px = 400; px >= 24; px -= 2) {
    if (measure(text, px) <= maxWidth) {
      size = px;
      return { lines: [text], size };
    }
  }
  // Two lines: greedily balance the words.
  let best = null;
  for (let px = 400; px >= 24; px -= 2) {
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, px) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2) {
      best = { lines, size: px };
      break;
    }
  }
  return best ?? { lines: [text], size: 24 };
}

/** The title block: outlined gradient capitals plus a letter-spaced subtitle. */
function drawTitleBlock(ctx, zone, title, subtitle, accent) {
  const text = (title || '').trim().toUpperCase();
  const sub = (subtitle || '').trim().toUpperCase();
  const padX = zone.w * 0.04;
  const maxW = zone.w - padX * 2;
  const fontFor = (px) => `${px}px Anton, 'Arial Black', sans-serif`;
  const fitted = fitTitleLines(ctx, text || 'VICE COVER', maxW, fontFor);
  const lines = fitted.lines;
  let size = fitted.size;
  // Shrink the title until the title plus the subtitle bar fits the zone's height.
  const availH = zone.h * 0.94;
  while (size > 24) {
    const lh = size * 1.04;
    const ss = Math.max(16, Math.round(size * 0.24));
    if (lh * lines.length + (sub ? ss * 1.9 : 0) <= availH) break;
    size -= 2;
  }
  const lineH = size * 1.04;
  const subSize = Math.max(16, Math.round(size * 0.24));
  const blockH = lineH * lines.length + (sub ? subSize * 1.9 : 0);
  let top = zone.y + (zone.h - blockH) / 2;
  if (zone.band === 'fade') top = zone.y + zone.h - blockH - zone.h * 0.06;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.015)}px`;
  ctx.textAlign = zone.align === 'left' ? 'left' : 'center';
  const tx = zone.align === 'left' ? zone.x + padX : zone.x + zone.w / 2;
  const fill = ctx.createLinearGradient(0, top, 0, top + lineH * lines.length);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffd9a0');
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.10;
  ctx.shadowOffsetY = size * 0.035;
  lines.forEach((line, i) => {
    const y = top + size + i * lineH;
    ctx.font = fontFor(size);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.13);
    ctx.strokeStyle = INK;
    ctx.strokeText(line, tx, y);
    ctx.fillStyle = fill;
    ctx.fillText(line, tx, y);
  });
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (sub) {
    const subY = top + lineH * lines.length + subSize * 1.35;
    ctx.font = `${subSize}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`;
    const subW = ctx.measureText(sub).width; // measureText already includes the letter spacing
    const barH = subSize * 1.7;
    const barW = subW + subSize * 1.6;
    const barX = zone.align === 'left' ? zone.x + padX : zone.x + (zone.w - barW) / 2;
    const barY = subY - subSize * 1.15;
    const bar = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    bar.addColorStop(0, accent);
    bar.addColorStop(1, '#ff8a3d');
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = zone.align === 'left' ? 'left' : 'center';
    const subX = zone.align === 'left' ? barX + subSize * 0.8 : barX + barW / 2;
    ctx.fillText(sub, subX, subY);
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto the canvas at its own size.
 * `state` holds size, layout, grade, title, subtitle, photos and panels.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ? state.grade : 'vice-sunset';
  const accent = GRADES[grade].accent;
  const geo = layoutPanels(state.layout, w, h);

  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  geo.panels.forEach((rect, i) => {
    const t = state.panels?.[i] ?? { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const img = state.photos?.[t.photo] ?? null;
    drawPanelPhoto(ctx, img, rect, t, grade);
    ctx.strokeStyle = 'rgba(20,8,43,0.18)';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  if (geo.sun) drawSynthwaveSun(ctx, geo.sun, accent);

  // A soft vignette over the photos, before the lettering.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(10,4,24,0)');
  vig.addColorStop(1, 'rgba(10,4,24,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const zone = geo.title;
  if (zone.band === 'solid') {
    const band = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
    band.addColorStop(0, '#1c0b33');
    band.addColorStop(1, '#3d0f4f');
    ctx.fillStyle = band;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    const rule = ctx.createLinearGradient(zone.x, 0, zone.x + zone.w, 0);
    rule.addColorStop(0, accent);
    rule.addColorStop(0.5, '#ffb347');
    rule.addColorStop(1, accent);
    ctx.fillStyle = rule;
    ctx.fillRect(zone.x, zone.y, zone.w, Math.max(3, h * 0.004));
  } else if (zone.band === 'bar') {
    ctx.fillStyle = 'rgba(16,6,32,0.78)';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.fillStyle = accent;
    ctx.fillRect(zone.x, zone.y, zone.w, Math.max(3, h * 0.004));
    ctx.fillRect(zone.x, zone.y + zone.h - Math.max(3, h * 0.004), zone.w, Math.max(3, h * 0.004));
  } else {
    const fadeTop = zone.y - zone.h * 0.35;
    const fade = ctx.createLinearGradient(0, fadeTop, 0, h);
    fade.addColorStop(0, 'rgba(12,5,28,0)');
    fade.addColorStop(0.45, 'rgba(12,5,28,0.55)');
    fade.addColorStop(1, 'rgba(12,5,28,0.88)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, fadeTop, w, h - fadeTop);
  }
  // Halftone dots go over the band background, under the lettering.
  if (geo.dots) drawHalftoneDots(ctx, geo.dots, '#ffffff');
  drawTitleBlock(ctx, zone, state.title, state.subtitle, accent);

  // Outer frame.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.008);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}
