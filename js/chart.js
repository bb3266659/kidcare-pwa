export function lineChart(canvas, points, { unit = '', color = '#3b82f6' } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (points.length === 0) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ยังไม่มีข้อมูล', w / 2, h / 2);
    return;
  }

  const pad = { l: 44, r: 14, t: 16, b: 26 };
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const px = (v) => pad.l + ((v - minX) / (maxX - minX || 1)) * (w - pad.l - pad.r);
  const py = (v) => h - pad.b - ((v - minY) / (maxY - minY)) * (h - pad.t - pad.b);

  ctx.strokeStyle = '#e2e8f0'; ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = minY + ((maxY - minY) / 4) * i, y = py(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(v.toFixed(1) + unit, pad.l - 6, y + 4);
  }

  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
  points.forEach((p, i) => {
    const x = px(new Date(p.date).getTime()), y = py(p.value);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = color;
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(px(new Date(p.date).getTime()), py(p.value), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}