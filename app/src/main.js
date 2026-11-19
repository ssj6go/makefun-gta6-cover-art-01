// Vice Cover Studio — the editor.
//
// Wires the page: a photo library (uploads plus the two samples), layout and grade
// pickers, caption fields, per-panel crop controls, and the live preview canvas.
// Drag on the preview to pan the selected panel's photo, scroll to zoom it, click
// a panel to select it. Export renders the same cover at full size and saves a PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, layoutPanels, panelAt, SIZES, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const tray = document.getElementById('photoTray');
const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');
const panelLabel = document.getElementById('panelLabel');

const state = {
  size: 'square',
  layout: 'vice-grid',
  grade: 'vice-sunset',
  title: 'SUNSET HEIST',
  subtitle: 'NEON COAST',
  photos: [], // loaded Image objects
  photoNames: [],
  panels: [
    // auto: the renderer picks a sensible default crop until the user pans/zooms.
    { photo: 1, zoom: 1, dx: 0, dy: 0.12, auto: true },
    { photo: 0, zoom: 1, dx: 0, dy: 0.10, auto: true },
    { photo: 1, zoom: 1, dx: 0, dy: 0.10, auto: true },
  ],
  selectedPanel: 0,
};

let shotMode = null;
let fontsReady = false;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function resizeCanvas() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function drawSelectionOverlay() {
  if (shotMode === 'cover') return;
  const ctx = canvas.getContext('2d');
  const geo = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = geo.panels[state.selectedPanel];
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, canvas.width * 0.004);
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
  ctx.setLineDash([]);
  const badge = `PANEL ${state.selectedPanel + 1}`;
  ctx.font = `700 ${Math.round(canvas.height * 0.016)}px system-ui, sans-serif`;
  const bw = ctx.measureText(badge).width + 24;
  const bh = canvas.height * 0.032;
  ctx.fillStyle = 'rgba(20,8,43,0.85)';
  ctx.fillRect(rect.x + 10, rect.y + 10, bw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, rect.x + 22, rect.y + 10 + bh / 2);
  ctx.restore();
}

function redraw() {
  resizeCanvas();
  drawCover(canvas, state);
  drawSelectionOverlay();
}

function refreshTray() {
  tray.innerHTML = '';
  state.photos.forEach((img, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = state.photoNames[i] || `Photo ${i + 1}`;
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = button.title;
    button.appendChild(thumb);
    button.addEventListener('click', () => {
      Object.assign(state.panels[state.selectedPanel], { photo: i, auto: true });
      statusEl.textContent = `${button.title} is now in panel ${state.selectedPanel + 1}.`;
      redraw();
    });
    tray.appendChild(button);
  });
}

function refreshPanelControls() {
  const panel = state.panels[state.selectedPanel];
  panelLabel.textContent = `Panel ${state.selectedPanel + 1} of ${layoutPanels(state.layout, 100, 100).panels.length}`;
  zoomInput.value = Math.round(panel.zoom * 100);
  zoomVal.textContent = `${Math.round(panel.zoom * 100)}%`;
}

function selectPanel(i) {
  state.selectedPanel = i;
  refreshPanelControls();
  redraw();
}

function setLayout(layout) {
  state.layout = layout;
  state.selectedPanel = 0;
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === layout));
  refreshPanelControls();
  redraw();
}

function setGrade(grade) {
  state.grade = grade;
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === grade));
  redraw();
}

function setSize(size) {
  state.size = size;
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === size));
  document.getElementById('export').textContent = `Export PNG ${SIZES[size].label}`;
  redraw();
}

// Photo library: uploads and the built-in samples.
document.getElementById('photoFile').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push(img);
      state.photoNames.push(file.name.replace(/\.[^.]+$/, ''));
    } catch {
      statusEl.textContent = `Could not read ${file.name}.`;
    }
  }
  if (files.length) {
    Object.assign(state.panels[state.selectedPanel], { photo: state.photos.length - 1, auto: true });
    refreshTray();
    redraw();
  }
  e.target.value = '';
});

document.querySelectorAll('[data-sample]').forEach((button) => {
  button.addEventListener('click', async () => {
    const name = button.dataset.sample;
    const idx = state.photoNames.indexOf(name);
    if (idx >= 0) {
      Object.assign(state.panels[state.selectedPanel], { photo: idx, auto: true });
      redraw();
      return;
    }
    const img = await loadImage(`samples/${name}.jpg`);
    state.photos.push(img);
    state.photoNames.push(name);
    Object.assign(state.panels[state.selectedPanel], { photo: state.photos.length - 1, auto: true });
    refreshTray();
    redraw();
  });
});

document.getElementById('fillAll').addEventListener('click', () => {
  const photo = state.panels[state.selectedPanel].photo;
  state.panels.forEach((p) => { p.photo = photo; p.auto = true; });
  statusEl.textContent = 'One photo now fills every panel.';
  redraw();
});

document.getElementById('resetCrop').addEventListener('click', () => {
  Object.assign(state.panels[state.selectedPanel], { zoom: 1, dx: 0, dy: 0, auto: true });
  refreshPanelControls();
  redraw();
});

zoomInput.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = zoomInput.value / 100;
  state.panels[state.selectedPanel].auto = false;
  zoomVal.textContent = `${zoomInput.value}%`;
  redraw();
});

document.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => setLayout(b.dataset.layout)));
document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => setGrade(b.dataset.grade)));
document.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

// Drag to pan the selected panel's photo, scroll to zoom it.
let dragging = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (hit < 0) return;
  if (hit !== state.selectedPanel) selectPanel(hit);
  dragging = { x: p.x, y: p.y, panel: hit };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const geo = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = geo.panels[dragging.panel];
  const panel = state.panels[dragging.panel];
  panel.dx += (p.x - dragging.x) / rect.w;
  panel.dy += (p.y - dragging.y) / rect.h;
  panel.auto = false; // the first drag takes the crop off its smart default
  dragging = { x: p.x, y: p.y, panel: dragging.panel };
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selectedPanel];
  panel.zoom = Math.min(3.5, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  panel.auto = false;
  refreshPanelControls();
  redraw();
}, { passive: false });

document.getElementById('export').addEventListener('click', () => {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed in this browser.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    statusEl.textContent = `Saved vice-cover-${w}x${h}.png — share it anywhere.`;
  }, 'image/png');
});

/** Applies a whole scene at once (used by the screenshot driver). */
export async function applyScene(scene) {
  if (scene.size) setSize(scene.size);
  if (scene.layout) setLayout(scene.layout);
  if (scene.grade) setGrade(scene.grade);
  if (scene.title !== undefined) {
    state.title = scene.title;
    titleInput.value = scene.title;
  }
  if (scene.subtitle !== undefined) {
    state.subtitle = scene.subtitle;
    subtitleInput.value = scene.subtitle;
  }
  if (scene.photos) {
    for (const name of scene.photos) {
      if (!state.photoNames.includes(name)) {
        const img = await loadImage(`samples/${name}.jpg`);
        state.photos.push(img);
        state.photoNames.push(name);
      }
    }
    refreshTray();
  }
  if (scene.panels) {
    scene.panels.forEach((photoName, i) => {
      const idx = state.photoNames.indexOf(photoName);
      if (idx >= 0 && state.panels[i]) Object.assign(state.panels[i], { photo: idx, auto: true });
    });
  }
  if (scene.crops) {
    scene.crops.forEach((crop, i) => {
      // An explicit crop turns the smart default off for that panel.
      if (state.panels[i]) Object.assign(state.panels[i], crop, { auto: false });
    });
  }
  if (scene.selectedPanel !== undefined) selectPanel(scene.selectedPanel);
  redraw();
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.ready,
    ]);
  } catch {
    // Fallback fonts still draw; the cover never blocks on a font.
  }
  fontsReady = true;
}

async function boot() {
  await ensureFonts();
  const query = new URLSearchParams(location.search);
  shotMode = query.get('shot');
  if (shotMode) {
    document.body.classList.add(`shot-${shotMode}`);
    await runShot(shotMode, query, applyScene);
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
    return;
  }
  // Default scene: both samples loaded, hero on the boulevard shot.
  await applyScene({ photos: ['pier', 'boulevard'] });
  redraw();
}

boot();
