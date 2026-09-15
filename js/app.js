import * as db from './db.js';
import { lineChart } from './chart.js';
import { printEpisode, shareEpisode, copyEpisode, downloadText } from './export.js';

const view = document.getElementById('view');
const title = document.getElementById('pageTitle');
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
let currentTab = 'episodes';
let openEpisodeId = null;

/* ---------- utils ---------- */
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const thDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const thTime = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const nowLocalISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const todayISO = () => nowLocalISO().slice(0, 10);

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function dialog(html, onSubmit) {
  modalForm.innerHTML = html + `
    <div class="modal-actions">
      <button value="cancel" class="btn ghost" type="submit">ยกเลิก</button>
      <button value="ok" class="btn primary" type="submit">บันทึก</button>
    </div>`;
  modal.showModal();
  modalForm.onsubmit = (e) => {
    if (e.submitter?.value !== 'ok') return;
    const fd = Object.fromEntries(new FormData(modalForm).entries());
    setTimeout(() => onSubmit(fd, modalForm), 0);
  };
}

/* ---------- TAB 1: Episodes ---------- */
async function renderEpisodes() {
  title.textContent = 'เหตุการณ์ป่วย';
  const eps = (await db.all('episodes')).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const open = eps.filter((e) => e.status === 'open');
  const closed = eps.filter((e) => e.status === 'closed');

  view.innerHTML = `
    <button class="btn primary block" id="newEp">+ สร้างเหตุการณ์ใหม่ (เริ่มป่วยวันนี้)</button>
    ${open.length ? `<h2 class="sec">กำลังป่วย</h2>` : ''}
    ${open.map(epCard).join('')}
    ${closed.length ? `<h2 class="sec">ประวัติย้อนหลัง</h2>` : ''}
    ${closed.map(epCard).join('')}
    ${eps.length ? '' : '<p class="empty">ยังไม่มีบันทึกการป่วย 🎉</p>'}`;

  document.getElementById('newEp').onclick = () => dialog(`
    <h3>สร้างเหตุการณ์ป่วยใหม่</h3>
    <label>ชื่อเหตุการณ์<input name="title" placeholder="เช่น ไข้หวัดใหญ่" required /></label>
    <label>วันที่เริ่มป่วย<input type="date" name="startDate" value="${todayISO()}" required /></label>
    <label>หมายเหตุ<textarea name="note" rows="2"></textarea></label>`,
    async (f) => { await db.put('episodes', { ...f, status: 'open', endDate: null }); renderEpisodes(); });

  view.querySelectorAll('[data-ep]').forEach((el) => el.onclick = () => renderEpisodeDetail(+el.dataset.ep));
}

const epCard = (e) => `
  <div class="card row" data-ep="${e.id}">
    <div>
      <div class="card-title">${esc(e.title)}</div>
      <div class="muted">${thDate(e.startDate)}${e.endDate ? ' – ' + thDate(e.endDate) : ''}</div>
    </div>
    <span class="pill ${e.status}">${e.status === 'open' ? 'กำลังป่วย' : 'หายแล้ว'}</span>
  </div>`;

async function renderEpisodeDetail(id) {
  openEpisodeId = id;
  const ep = await db.get('episodes', id);
  const logs = (await db.byIndex('logs', 'episodeId', id)).sort((a, b) => b.at.localeCompare(a.at));
  const profile = (await db.get('profile', 'me')) || {};
  const ordered = [...logs].sort((a, b) => a.at.localeCompare(b.at));
  title.textContent = ep.title;

  const groups = {};
  logs.forEach((l) => { const d = l.at.slice(0, 10); (groups[d] ||= []).push(l); });

  view.innerHTML = `
    <button class="btn ghost small" id="back">‹ กลับ</button>
    <div class="card">
      <div class="card-title">${esc(ep.title)}</div>
      <div class="muted">เริ่ม ${thDate(ep.startDate)}${ep.endDate ? ' · หายเมื่อ ' + thDate(ep.endDate) : ''}</div>
      ${ep.note ? `<p class="muted">${esc(ep.note)}</p>` : ''}
      <div class="btn-row">
        ${ep.status === 'open' ? '<button class="btn warn small" id="closeEp">ปิดเหตุการณ์ (หายแล้ว)</button>'
                               : '<button class="btn ghost small" id="reopenEp">เปิดใหม่</button>'}
        <button class="btn danger small" id="delEp">ลบ</button>
      </div>
    </div>

    <button class="btn primary block" id="newLog">+ บันทึกมื้อยา / อาการ</button>

    <div class="card export-card">
      <div class="card-title">ส่งให้คุณหมอ</div>
      <div class="btn-row">
        <button class="btn primary small" id="expPdf">📄 บันทึก PDF</button>
        <button class="btn ghost small" id="expShare">📤 แชร์</button>
        <button class="btn ghost small" id="expCopy">📋 คัดลอก</button>
        <button class="btn ghost small" id="expTxt">⬇️ .txt</button>
      </div>
    </div>

    ${Object.keys(groups).sort().reverse().map((d) => `
      <h2 class="sec">${thDate(d)}</h2>
      ${groups[d].map(logRow).join('')}`).join('')}
    ${logs.length ? '' : '<p class="empty">ยังไม่มีบันทึกในเหตุการณ์นี้</p>'}`;

  document.getElementById('back').onclick = renderEpisodes;
  document.getElementById('newLog').onclick = () => logDialog();

  document.getElementById('closeEp')?.addEventListener('click', async () => {
    await db.put('episodes', { ...ep, status: 'closed', endDate: todayISO() }); renderEpisodeDetail(id);
  });
  document.getElementById('reopenEp')?.addEventListener('click', async () => {
    await db.put('episodes', { ...ep, status: 'open', endDate: null }); renderEpisodeDetail(id);
  });
  document.getElementById('delEp').onclick = async () => {
    if (!confirm('ลบเหตุการณ์นี้พร้อมบันทึกทั้งหมด?')) return;
    for (const l of logs) await db.remove('logs', l.id);
    await db.remove('episodes', id); renderEpisodes();
  };

  document.getElementById('expPdf').onclick = () => printEpisode(profile, ep, ordered);
  document.getElementById('expTxt').onclick = () => downloadText(profile, ep, ordered);
  document.getElementById('expShare').onclick = async () => {
    const r = await shareEpisode(profile, ep, ordered);
    if (r === 'copied') toast('คัดลอกสรุปแล้ว — วางในแชตได้เลย');
  };
  document.getElementById('expCopy').onclick = async () => {
    await copyEpisode(profile, ep, ordered);
    toast('คัดลอกสรุปเรียบร้อย');
  };

  view.querySelectorAll('[data-log]').forEach((el) => el.onclick = async () => {
    const log = await db.get('logs', +el.dataset.log); logDialog(log);
  });
}

const logRow = (l) => {
  const meds = (l.meds || []).map((m) => `${esc(m.name)} ${m.dose} ${esc(m.unit || 'ml')}`).join(' | ');
  const sym = [l.temp ? `ไข้ ${l.temp}°C` : '', l.symptoms].filter(Boolean).join(', ');
  return `<div class="log" data-log="${l.id}">
      <b>${thTime(l.at)} น.</b>${meds ? ' | ' + meds : ''}
      ${sym ? `<div class="sym">${esc(sym)}</div>` : ''}
      ${l.note ? `<div class="muted small">${esc(l.note)}</div>` : ''}
    </div>`;
};

function medFieldsHTML(meds = [{ name: '', dose: '', unit: 'ml' }]) {
  return meds.map((m, i) => `
    <div class="med-row">
      <input name="med_name_${i}" placeholder="ชื่อยา" value="${esc(m.name)}" list="medList" />
      <input name="med_dose_${i}" placeholder="ปริมาณ" inputmode="decimal" value="${m.dose ?? ''}" />
      <select name="med_unit_${i}">
        ${['ml', 'เม็ด', 'ช้อนชา', 'หยด'].map((u) => `<option ${m.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
    </div>`).join('');
}

async function logDialog(log = null) {
  const prev = await db.all('logs');
  const names = [...new Set(prev.flatMap((l) => (l.meds || []).map((m) => m.name)).filter(Boolean))];

  dialog(`
    <h3>${log ? 'แก้ไขบันทึก' : 'บันทึกมื้อยา / อาการ'}</h3>
    <datalist id="medList">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>วันที่และเวลา<input type="datetime-local" name="at" value="${log ? log.at : nowLocalISO()}" required /></label>
    <div class="label">รายการยาในมื้อนี้</div>
    <div id="medBox">${medFieldsHTML(log?.meds?.length ? log.meds : undefined)}</div>
    <button type="button" class="btn ghost small" id="addMed">+ เพิ่มยา</button>
    <label>อุณหภูมิ (°C)<input name="temp" inputmode="decimal" value="${log?.temp ?? ''}" placeholder="เช่น 38.5" /></label>
    <label>อาการ ณ เวลานั้น<input name="symptoms" value="${esc(log?.symptoms || '')}" placeholder="ไอเยอะ, ผื่นขึ้นที่แขน" /></label>
    <label>หมายเหตุ<textarea name="note" rows="2">${esc(log?.note || '')}</textarea></label>
    ${log ? '<button type="button" class="btn danger small" id="delLog">ลบบันทึกนี้</button>' : ''}`,
    async (f) => {
      const meds = [];
      Object.keys(f).filter((k) => k.startsWith('med_name_')).forEach((k) => {
        const i = k.split('_').pop();
        if (f[`med_name_${i}`]?.trim())
          meds.push({ name: f[`med_name_${i}`].trim(), dose: f[`med_dose_${i}`] || '', unit: f[`med_unit_${i}`] });
      });
      const rec = {
        episodeId: openEpisodeId, at: f.at, meds,
        temp: f.temp ? parseFloat(f.temp) : null,
        symptoms: f.symptoms || '', note: f.note || ''
      };
      if (log) rec.id = log.id;
      await db.put('logs', rec);
      renderEpisodeDetail(openEpisodeId);
    });

  let idx = modalForm.querySelectorAll('.med-row').length;
  document.getElementById('addMed').onclick = () => {
    modalForm.querySelector('#medBox').insertAdjacentHTML('beforeend',
      medFieldsHTML([{ name: '', dose: '', unit: 'ml' }]).replace(/_0/g, '_' + idx++));
  };
  document.getElementById('delLog')?.addEventListener('click', async () => {
    if (!confirm('ลบบันทึกนี้?')) return;
    await db.remove('logs', log.id); modal.close(); renderEpisodeDetail(openEpisodeId);
  });
}

/* ---------- TAB 2-3: Growth ---------- */
async function renderGrowth(type) {
  const isW = type === 'weight';
  const unit = isW ? 'kg' : 'cm';
  title.textContent = isW ? 'น้ำหนัก' : 'ส่วนสูง';
  const rows = (await db.byIndex('growth', 'type', type)).sort((a, b) => b.date.localeCompare(a.date));

  view.innerHTML = `
    <button class="btn primary block" id="add">+ บันทึก${isW ? 'น้ำหนัก' : 'ส่วนสูง'}</button>
    <div class="card"><canvas id="chart" class="chart"></canvas></div>
    ${rows.map((r) => `
      <div class="card row" data-g="${r.id}">
        <div><b>${r.value} ${unit}</b><div class="muted">${thDate(r.date)}</div></div>
        <button class="btn danger small" data-del="${r.id}">ลบ</button>
      </div>`).join('') || '<p class="empty">ยังไม่มีข้อมูล</p>'}`;

  lineChart(document.getElementById('chart'), [...rows].reverse(), { unit: ' ' + unit, color: isW ? '#3b82f6' : '#10b981' });

  document.getElementById('add').onclick = () => dialog(`
    <h3>บันทึก${isW ? 'น้ำหนัก' : 'ส่วนสูง'}</h3>
    <label>วันที่<input type="date" name="date" value="${todayISO()}" required /></label>
    <label>ค่า (${unit})<input name="value" inputmode="decimal" required /></label>`,
    async (f) => { await db.put('growth', { type, date: f.date, value: parseFloat(f.value) }); renderGrowth(type); });

  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (confirm('ลบรายการนี้?')) { await db.remove('growth', +b.dataset.del); renderGrowth(type); }
  });
}

/* ---------- TAB 4: Profile + Backup ---------- */
async function renderProfile() {
  title.textContent = 'ข้อมูลลูก';
  const p = (await db.get('profile', 'me')) || { id: 'me' };
  const eps = await db.all('episodes');

  view.innerHTML = `
    <div class="card center">
      <img id="avatar" class="avatar" src="${p.photo || './icons/icon.svg'}" alt="รูปน้อง" />
      <input type="file" id="photo" accept="image/*" hidden />
      <button class="btn ghost small" id="pickPhoto">อัปโหลด/เปลี่ยนรูปน้อง</button>
    </div>
    <div class="card">
      <label>ชื่อเล่น<input id="name" value="${esc(p.name || '')}" /></label>
      <label>วันเกิด<input type="date" id="birthdate" value="${p.birthdate || ''}" /></label>
      <label>กรุ๊ปเลือด<input id="blood" value="${esc(p.blood || '')}" /></label>
      <label>ประวัติแพ้ยา / แพ้อาหาร<textarea id="allergy" rows="3">${esc(p.allergy || '')}</textarea></label>
      <label>โรคประจำตัว<textarea id="congenital" rows="2">${esc(p.congenital || '')}</textarea></label>
      <button class="btn primary block" id="saveProfile">บันทึกข้อมูล</button>
      <p class="muted small" id="ageInfo"></p>
    </div>
    <div class="card">
      <div class="card-title">สำรอง & กู้คืนข้อมูล</div>
      <p class="muted small">ข้อมูลเก็บในเครื่องนี้เท่านั้น ควร Backup ก่อนเปลี่ยนเครื่องหรือล้างแคช</p>
      <button class="btn primary block" id="backup">⬇️ ดาวน์โหลดไฟล์สำรอง (.json)</button>
      <input type="file" id="restoreFile" accept="application/json" hidden />
      <button class="btn warn block" id="restore">⬆️ กู้คืนจากไฟล์สำรอง</button>
      <p class="muted small">สถิติ: ป่วยทั้งหมด ${eps.length} ครั้ง</p>
    </div>
    <div class="card">
      <button class="btn danger block" id="wipe">ล้างข้อมูลทั้งหมด</button>
    </div>`;

  if (p.birthdate) {
    const b = new Date(p.birthdate), n = new Date();
    let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    document.getElementById('ageInfo').textContent = `อายุ ${Math.floor(m / 12)} ปี ${m % 12} เดือน`;
  }

  document.getElementById('pickPhoto').onclick = () => document.getElementById('photo').click();
  document.getElementById('photo').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const dataUrl = await compressImage(file, 512, 0.8);
    document.getElementById('avatar').src = dataUrl;
    await db.put('profile', { ...p, id: 'me', photo: dataUrl });
    toast('อัปโหลดรูปเรียบร้อย');
  };

  document.getElementById('saveProfile').onclick = async () => {
    await db.put('profile', {
      ...p, id: 'me',
      name: document.getElementById('name').value,
      birthdate: document.getElementById('birthdate').value,
      blood: document.getElementById('blood').value,
      allergy: document.getElementById('allergy').value,
      congenital: document.getElementById('congenital').value
    });
    toast('บันทึกข้อมูลเรียบร้อย');
    renderProfile();
  };

  document.getElementById('backup').onclick = async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kidcare-backup-${todayISO()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  document.getElementById('restore').onclick = () => document.getElementById('restoreFile').click();
  document.getElementById('restoreFile').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm('ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด ยืนยันหรือไม่?')) return;
    try {
      await db.importAll(JSON.parse(await file.text()));
      toast('กู้คืนข้อมูลสำเร็จ'); renderProfile();
    } catch (err) { alert('กู้คืนไม่สำเร็จ: ' + err.message); }
  };

  document.getElementById('wipe').onclick = async () => {
    if (!confirm('ลบข้อมูลทั้งหมดถาวร?')) return;
    for (const s of db.STORES) await db.clear(s);
    renderProfile();
  };
}

function compressImage(file, maxSize, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- Router & init ---------- */
const routes = {
  episodes: renderEpisodes,
  weight: () => renderGrowth('weight'),
  height: () => renderGrowth('height'),
  profile: renderProfile
};

document.querySelectorAll('.tab').forEach((btn) => btn.onclick = () => {
  document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentTab = btn.dataset.tab;
  routes[currentTab]();
});

modal.addEventListener('close', () => { modalForm.innerHTML = ''; });
window.addEventListener('resize', () => { if (currentTab === 'weight' || currentTab === 'height') routes[currentTab](); });

(async () => { await db.openDB(); renderEpisodes(); })();

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));