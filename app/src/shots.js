// Fixed scenes for screenshots: ?shot=editor shows the page with a scene loaded;
// ?shot=cover shows the cover alone, full viewport. Query picks the scene:
// photo / photos (sample names, comma-separated), panels (a sample per panel),
// layout, grade, size, caption (the title), sub (the subtitle), zooms (a zoom
// per panel) and crops (dx,dy pairs per panel, semicolon-separated).
// window.__shotReady is set once painted (see main.js).
export async function runShot(shot, query, applyScene) {
  const photos = (query.get('photos') || query.get('photo') || 'pier,boulevard')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const scene = { photos };
  if (query.get('layout')) scene.layout = query.get('layout');
  if (query.get('grade')) scene.grade = query.get('grade');
  if (query.get('size')) scene.size = query.get('size');
  if (query.get('caption') !== null) scene.title = query.get('caption');
  if (query.get('sub') !== null) scene.subtitle = query.get('sub');
  if (query.get('panels')) scene.panels = query.get('panels').split(',').map((s) => s.trim());
  const crops = [];
  if (query.get('zooms')) {
    query.get('zooms').split(',').forEach((z, i) => { crops[i] = { ...(crops[i] ?? {}), zoom: Number(z) || 1 }; });
  }
  if (query.get('crops')) {
    query.get('crops').split(';').forEach((pair, i) => {
      const [dx, dy] = pair.split(',').map(Number);
      crops[i] = { ...(crops[i] ?? {}), dx: dx || 0, dy: dy || 0 };
    });
  }
  if (crops.length) scene.crops = crops;
  if (query.get('panel') !== null) scene.selectedPanel = Number(query.get('panel')) || 0;
  await applyScene(scene);
}
