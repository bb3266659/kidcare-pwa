/* export.js — สรุป Episode สำหรับส่งให้คุณหมอ: ข้อความ / PDF (print) / แชร์ / .txt */

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const thDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const thTime = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const medText = (m) => `${m.name} ${m.dose} ${m.unit || 'ml'}`.trim();

export function summarize(ep, logs) {
  const sorted = [...logs].sort((a, b) => a.at.localeCompare(b.at));
  const temps = sorted.filter((l) => l.temp).map((l) => l.temp);
  const start = ep.startDate;
  const end = ep.endDate || new Date().toISOString().slice(0, 10);
  const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 864e5) + 1);

  const totals = {};
  sorted.forEach((l) => (l.meds || []).forEach((m) => {
    if (!m.name) return;
    const key = `${m.name}|${m.unit || 'ml'}`;
    totals[key] ||= { name: m.name, unit: m.unit || 'ml', times: 0, sum: 0 };
    totals[key].times++;
    totals[key].sum += parseFloat(m.dose) || 0;
  }));

  return {
    sorted, days, start, end,
    maxTemp: temps.length ? Math.max(...temps) : null,
    avgTemp: temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length) : null,
    doseCount: sorted.filter((l) => (l.meds || []).length).length,
    meds: Object.values(totals)
  };
}

export function buildText(profile, ep, logs) {
  const s = summarize(ep, logs);
  const L = [];
  L.push(`สรุปอาการป่วย: ${ep.title}`);
  L.push('='.repeat(34));
  if (profile?.name) L.push(`ชื่อ: ${profile.name}${profile.birthdate ? ` (เกิด ${thDate(profile.birthdate)})` : ''}`);
  if (profile?.allergy) L.push(`ประวัติแพ้ยา: ${profile.allergy}`);
  if (profile?.congenital) L.push(`โรคประจำตัว: ${profile.congenital}`);
  L.push(`ช่วงเวลา: ${thDate(s.start)} – ${ep.endDate ? thDate(s.end) : 'ปัจจุบัน'} (${s.days} วัน)`);
  if (s.maxTemp) L.push(`ไข้สูงสุด: ${s.maxTemp}°C · เฉลี่ย ${s.avgTemp.toFixed(1)}°C`);
  L.push(`จำนวนมื้อยาทั้งหมด: ${s.doseCount} มื้อ`);
  if (ep.note) L.push(`หมายเหตุ: ${ep.note}`);

  if (s.meds.length) {
    L.push('', 'รวมยาที่ได้รับ');
    L.push('-'.repeat(34));
    s.meds.forEach((m) => L.push(`• ${m.name} — ${m.times} ครั้ง (รวม ${+m.sum.toFixed(2)} ${m.unit})`));
  }

  L.push('', 'บันทึกรายช่วงเวลา');
  L.push('-'.repeat(34));
  let day = '';
  s.sorted.forEach((l) => {
    const d = l.at.slice(0, 10);
    if (d !== day) { day = d; L.push(`[${thDate(d)}]`); }
    const meds = (l.meds || []).map(medText).join(' | ');
    const sym = [l.temp ? `ไข้ ${l.temp}°C` : '', l.symptoms].filter(Boolean).join(', ');
    L.push(`${thTime(l.at)} น.${meds ? ' | ' + meds : ''}${sym ? `\n   อาการ: ${sym}` : ''}${l.note ? `\n   หมายเหตุ: ${l.note}` : ''}`);
  });
  if (!s.sorted.length) L.push('(ไม่มีบันทึก)');

  L.push('', `สร้างเมื่อ ${thDate(Date.now())} ${thTime(Date.now())} น. · KidCare`);
  return L.join('\n');
}

export function buildPrintHTML(profile, ep, logs) {
  const s = summarize(ep, logs);
  const rows = s.sorted.map((l) => `
    <tr>
      <td class="nowrap">${thDate(l.at)}</td>
      <td class="nowrap">${thTime(l.at)}</td>
      <td>${(l.meds || []).map(medText).map(esc).join('<br>') || '—'}</td>
      <td>${l.temp ? l.temp + '°C' : '—'}</td>
      <td>${esc(l.symptoms || '—')}${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="center">ไม่มีบันทึก</td></tr>';

  return `
    <div class="p-head">
      <h1>สรุปอาการป่วย: ${esc(ep.title)}</h1>
      <div class="p-sub">${thDate(s.start)} – ${ep.endDate ? thDate(s.end) : 'ปัจจุบัน'} (${s.days} วัน)</div>
    </div>

    <table class="p-info">
      <tr><th>ชื่อเด็ก</th><td>${esc(profile?.name || '—')}</td>
          <th>วันเกิด</th><td>${profile?.birthdate ? thDate(profile.birthdate) : '—'}</td></tr>
      <tr><th>ประวัติแพ้ยา</th><td colspan="3">${esc(profile?.allergy || '—')}</td></tr>
      <tr><th>โรคประจำตัว</th><td colspan="3">${esc(profile?.congenital || '—')}</td></tr>
      <tr><th>ไข้สูงสุด</th><td>${s.maxTemp ? s.maxTemp + '°C' : '—'}</td>
          <th>จำนวนมื้อยา</th><td>${s.doseCount} มื้อ</td></tr>
    </table>

    ${s.meds.length ? `
    <h2>รวมยาที่ได้รับ</h2>
    <table class="p-table">
      <thead><tr><th>ชื่อยา</th><th>จำนวนครั้ง</th><th>ปริมาณรวม</th></tr></thead>
      <tbody>${s.meds.map((m) => `<tr><td>${esc(m.name)}</td><td>${m.times}</td><td>${+m.sum.toFixed(2)} ${esc(m.unit)}</td></tr>`).join('')}</tbody>
    </table>` : ''}

    <h2>บันทึกรายช่วงเวลา</h2>
    <table class="p-table">
      <thead><tr><th>วันที่</th><th>เวลา</th><th>ยาที่ได้รับ</th><th>อุณหภูมิ</th><th>อาการ / หมายเหตุ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="p-foot">สร้างโดยแอป KidCare · ${thDate(Date.now())} ${thTime(Date.now())} น.</div>`;
}

export function printEpisode(profile, ep, logs) {
  let area = document.getElementById('printArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'printArea';
    document.body.appendChild(area);
  }
  area.innerHTML = buildPrintHTML(profile, ep, logs);
  setTimeout(() => window.print(), 60);
}

export async function shareEpisode(profile, ep, logs) {
  const text = buildText(profile, ep, logs);
  const title = `สรุปอาการป่วย: ${ep.title}`;
  if (navigator.share) {
    try { await navigator.share({ title, text }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  return copyEpisode(profile, ep, logs);
}

export async function copyEpisode(profile, ep, logs) {
  const text = buildText(profile, ep, logs);
  try { await navigator.clipboard.writeText(text); return 'copied'; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    return 'copied';
  }
}

export function downloadText(profile, ep, logs) {
  const blob = new Blob(['\uFEFF' + buildText(profile, ep, logs)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `สรุปป่วย-${ep.title}-${ep.startDate}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}