/* 영차영차 — render.js : 그리기 (학생 화면과 선생님 중계 화면이 같이 쓴다) */
(function (root) {
'use strict';
const YC = root.YC, T = YC.T, PW = YC.PW, PH = YC.PH, VW = YC.VIEW_W, VH = YC.VIEW_H;
const COL = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b'];
const COLD = ['#c92a2a', '#1864ab', '#d08700', '#2b8a3e', '#862e9c', '#c2410c'];
const INK = '#2b2118', FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","Nanum Gothic",sans-serif';
const TAU = Math.PI * 2;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
function box(c, x, y, w, h, r, fill, line, lw) { rr(c, x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (line) { c.strokeStyle = line; c.lineWidth = lw || 2; c.stroke(); } }
function label(c, s, x, y, size, fill, line, align) { c.font = '800 ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (line) { c.strokeStyle = line; c.lineWidth = Math.max(3, size / 4); c.strokeText(s, x, y); } c.fillStyle = fill; c.fillText(s, x, y); }
function arrow(c, x, y, len, dir, col, w) { w = w || 5; c.strokeStyle = INK; c.fillStyle = col; c.lineWidth = 1.5; c.beginPath(); const h = w + 3, x2 = x + dir * len; c.moveTo(x, y - w / 2); c.lineTo(x2 - dir * h, y - w / 2); c.lineTo(x2 - dir * h, y - h); c.lineTo(x2, y); c.lineTo(x2 - dir * h, y + h); c.lineTo(x2 - dir * h, y + w / 2); c.lineTo(x, y + w / 2); c.closePath(); c.fill(); c.stroke(); }

/* 작은 사람 모양(표지판·힘 표시용) */
function pip(c, x, y, s, fill, line) { c.fillStyle = fill; c.strokeStyle = line || INK; c.lineWidth = 1.2; rr(c, x - s / 2, y - s, s, s, s * 0.38); c.fill(); c.stroke(); }

/* ───────── 캐릭터 ───────── */
function topping(c, slot, col, dark) {
  c.lineWidth = 2; c.strokeStyle = INK; c.lineJoin = 'round';
  switch (slot % 6) {
    case 0: c.fillStyle = '#69db7c'; c.beginPath(); c.moveTo(0, -27); c.quadraticCurveTo(-9, -37, -2, -39); c.quadraticCurveTo(2, -34, 0, -27); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -27); c.quadraticCurveTo(9, -35, 4, -39); c.quadraticCurveTo(-1, -34, 0, -27); c.fill(); c.stroke(); break;      // 새싹
    case 1: c.beginPath(); c.moveTo(0, -27); c.lineTo(0, -35); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -37, 3.4, 0, TAU); c.fill(); c.stroke(); break;                                                                                                                              // 더듬이
    case 2: c.fillStyle = '#ff8fab'; c.beginPath(); c.moveTo(0, -30); c.lineTo(-8, -35); c.lineTo(-8, -26); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -30); c.lineTo(8, -35); c.lineTo(8, -26); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -30, 2.4, 0, TAU); c.fill(); c.stroke(); break;   // 리본
    case 3: c.fillStyle = '#fff3bf'; c.beginPath(); c.moveTo(-6, -27); c.lineTo(0, -40); c.lineTo(6, -27); c.closePath(); c.fill(); c.stroke(); break;                                                                                                                                                  // 고깔
    case 4: c.beginPath(); c.moveTo(0, -27); c.lineTo(0, -33); c.stroke(); c.fillStyle = '#ffe066'; c.beginPath(); c.ellipse(-5, -34, 5, 2.2, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.ellipse(5, -34, 5, 2.2, 0, 0, TAU); c.fill(); c.stroke(); break;                                       // 프로펠러
    default: c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.6 : 6; c.lineTo(Math.cos(a) * r, -34 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();                                                               // 별
  }
}
function guy(c, p, ci, t, o) {
  const col = COL[ci % 6], dark = COLD[ci % 6];
  const cx = p.x + PW / 2, by = p.y + PH;
  let sx = 1, sy = 1, lean = 0;
  if (p.land > 0) { const k = p.land / 0.16; sx = 1 + 0.2 * k; sy = 1 - 0.22 * k; }
  else if (!p.gr) { if (p.vy < -80) { sx = 0.92; sy = 1.1; } else if (p.vy > 200) { sx = 0.95; sy = 1.06; } }
  if (p.riders > 0) { sy *= 0.9; sx *= 1.06; }
  if (p.push && p.gr) lean = p.face * 0.16;
  const walk = p.gr && Math.abs(p.vx) > 20, ph = t * 16 + p.slot;
  c.save(); c.translate(cx, by); c.rotate(lean); c.scale(sx, sy);
  // 발
  c.fillStyle = dark; c.strokeStyle = INK; c.lineWidth = 2;
  const l1 = walk ? Math.max(0, Math.sin(ph)) * 3 : 0, l2 = walk ? Math.max(0, -Math.sin(ph)) * 3 : 0;
  rr(c, -9, -5 - l1, 7, 5, 2); c.fill(); c.stroke(); rr(c, 2, -5 - l2, 7, 5, 2); c.fill(); c.stroke();
  // 몸
  rr(c, -12, -28, 24, 25, 9); c.fillStyle = col; c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, -8, -25, 9, 5, 2.5); c.fill();
  // 눈
  const f = p.face || 1, ex = f * 2.5;
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex - 4.5, -17, 3.6, 4.4, 0, 0, TAU); c.ellipse(ex + 4.5, -17, 3.6, 4.4, 0, 0, TAU); c.fill();
  c.fillStyle = INK; const blink = ((t * 0.7 + p.slot * 0.37) % 3) < 0.09;
  if (blink) { c.fillRect(ex - 7, -17.5, 5, 1.6); c.fillRect(ex + 2, -17.5, 5, 1.6); }
  else { c.beginPath(); c.arc(ex - 4.5 + f * 1.3, -16.5, 1.9, 0, TAU); c.arc(ex + 4.5 + f * 1.3, -16.5, 1.9, 0, TAU); c.fill(); }
  // 입
  c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath();
  if (p.push && p.gr) { c.moveTo(ex - 3, -9.5); c.lineTo(ex + 3, -9.5); }
  else if (!p.gr) { c.arc(ex, -9.5, 1.8, 0, TAU); }
  else c.arc(ex, -11, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  c.fillStyle = 'rgba(255,120,120,.45)'; c.beginPath(); c.arc(ex - 8, -12, 2, 0, TAU); c.arc(ex + 8, -12, 2, 0, TAU); c.fill();
  topping(c, p.slot, col, dark);
  c.restore();
  // 땀
  if ((p.push && p.gr && o && o.strain) || p.riders > 0) { const k = (t * 2 + p.slot * 0.3) % 1; c.fillStyle = '#74c0fc'; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(cx - (p.face || 1) * 10, p.y - 2 - k * 10, 2.2 * (1 - k * 0.5), 0, TAU); c.fill(); c.stroke(); }
}

/* ───────── 장치 ───────── */
function drawBox(c, o, n) {
  if (o.rs) return;
  const iron = o.mat === 'iron', w = o.w, h = o.h;
  c.save(); c.translate(o.x, o.y);
  const stuck = (o.fr || o.fl) && Math.abs(o.fr - o.fl) < o.nd;
  if (stuck) c.translate(Math.sin(performance.now() / 22) * 1.2, 0);
  box(c, 1, 1, w - 2, h - 2, 6, iron ? '#a9b4c2' : '#e0a660', INK, 2.5);
  c.strokeStyle = iron ? '#7d8997' : '#bb8141'; c.lineWidth = 2;
  if (iron) { c.fillStyle = '#6c7885'; for (const [ax, ay] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) { c.beginPath(); c.arc(ax, ay, 2.6, 0, TAU); c.fill(); } rr(c, 7, 7, w - 14, h - 14, 4); c.stroke(); }
  else { c.beginPath(); c.moveTo(4, h / 3); c.lineTo(w - 4, h / 3); c.moveTo(4, h * 2 / 3); c.lineTo(w - 4, h * 2 / 3); c.stroke(); rr(c, 6, 6, w - 12, h - 12, 3); c.stroke(); }
  // 필요한 힘: 사람 모양 칸. 지금 알짜힘만큼 채워진다
  const need = o.nd, net = Math.abs(o.fr - o.fl), s = need > 4 ? 9 : 11, gap = s + 3, x0 = w / 2 - (need - 1) * gap / 2;
  box(c, x0 - s / 2 - 5, h / 2 - s / 2 - 6, (need - 1) * gap + s + 10, s + 11, 6, 'rgba(255,255,255,.88)', INK, 1.5);
  for (let i = 0; i < need; i++) pip(c, x0 + i * gap, h / 2 + s / 2, s, i < net ? '#37b24d' : '#dee2e6', INK);
  c.restore();
  // 힘 화살표
  if (o.fr || o.fl) {
    const y = o.y - 12, cx = o.x + w / 2;
    if (o.fr) { arrow(c, o.x - 6 - 10 * o.fr, y, 10 * o.fr + 4, 1, '#ff6b6b', 6); label(c, String(o.fr), o.x - 12 - 10 * o.fr, y, 12, '#fff', INK); }
    if (o.fl) { arrow(c, o.x + w + 6 + 10 * o.fl, y, 10 * o.fl + 4, -1, '#4dabf7', 6); label(c, String(o.fl), o.x + w + 12 + 10 * o.fl, y, 12, '#fff', INK); }
    const nt = o.fr - o.fl;
    if (nt) { arrow(c, cx - Math.sign(nt) * 9, o.y - 30, 12 + Math.abs(nt) * 6, Math.sign(nt), Math.abs(nt) >= need ? '#37b24d' : '#ffd43b', 8); }
    else label(c, '0', cx, o.y - 30, 15, '#ffd43b', INK);
  }
}
const BTN_COL = { sw: ['#ffd43b', '#fab005'], vent: ['#ced4da', '#868e96'], heat: ['#ff8787', '#f03e3e'], cool: ['#a5d8ff', '#339af0'], water: ['#a5d8ff', '#1c7ed6'] };
function drawBtn(c, o, n, t) {
  if (o.style === 'hide') return;
  if (o.minN && n < o.minN) { box(c, o.x + 2, o.y - 4, o.w - 4, 4, 2, '#dee2e6', '#adb5bd', 1.2); return; }    // 이 인원에서는 필요 없는 단추
  const need = YC.needOf(o.need, n), up = o.on ? 2 : 6, st = BTN_COL[o.style];
  box(c, o.x - 3, o.y - 3, o.w + 6, 5, 2, '#5c636b', INK, 1.5);
  box(c, o.x + 2, o.y - 3 - up, o.w - 4, up + 1, 2, st ? (o.on ? st[1] : st[0]) : (o.on ? '#40c057' : '#fa5252'), INK, 1.5);
  if (st) {
    const cx = o.x + o.w / 2, cy = o.y - 18 - (o.on ? 0 : 2);
    if (o.style === 'heat') { c.fillStyle = o.on ? '#ff922b' : '#ffc9c9'; c.beginPath(); c.moveTo(cx, cy - 9 - (o.on ? Math.sin(t * 20) * 2 : 0)); c.quadraticCurveTo(cx + 8, cy, cx, cy + 6); c.quadraticCurveTo(cx - 8, cy, cx, cy - 9); c.fill(); }
    else if (o.style === 'cool') { c.strokeStyle = o.on ? '#1c7ed6' : '#74c0fc'; c.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(cx - Math.cos(a) * 7, cy - Math.sin(a) * 7); c.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7); c.stroke(); } }
    else if (o.style === 'vent') { c.strokeStyle = '#495057'; c.lineWidth = 1.5; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(o.x + 10 + k * (o.w - 20) / 3, o.y - 6); c.lineTo(o.x + 10 + k * (o.w - 20) / 3, o.y - 2); c.stroke(); } if (!o.on) for (let k = 0; k < 3; k++) { const yy = cy - ((t * 30 + k * 9) % 26); c.strokeStyle = 'rgba(134,142,150,.6)'; c.beginPath(); c.arc(cx - 8 + k * 8, yy, 3, 0, TAU); c.stroke(); } }
    else if (o.style === 'water') { c.fillStyle = '#1c7ed6'; c.fillRect(cx - 3, cy - 10, 6, 10); c.fillRect(cx - 3, cy - 10, 12, 5); }
  }
  if (o.boxOnly) { const cx = o.x + o.w / 2; box(c, cx - 8, o.y - 30, 16, 14, 3, '#e0a660', INK, 1.5); c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 8, o.y - 23); c.lineTo(cx + 8, o.y - 23); c.stroke(); }   // 상자만 눌리는 단추
  if (need > 1 || o.load) { const s = 9, gap = 12, x0 = o.x + o.w / 2 - (need - 1) * gap / 2; for (let i = 0; i < need; i++) pip(c, x0 + i * gap, o.y - 14, s, i < o.load ? '#37b24d' : '#f1f3f5', INK); }
}
function drawDoor(c, o, t) {
  const h = o.h * (1 - o.open);
  if (o.style === 'ice' || o.style === 'bridge') {                    // 얼음 다리 · 빛다리: 녹을수록 옅어진다
    if (h < 1) return; const a = 1 - o.open;
    if (o.style === 'ice') { c.fillStyle = 'rgba(208,235,255,' + (0.55 + 0.4 * a) + ')'; c.fillRect(o.x, o.y, o.w, h); c.strokeStyle = 'rgba(116,192,252,' + a + ')'; c.lineWidth = 2; c.strokeRect(o.x, o.y, o.w, h); c.strokeStyle = 'rgba(255,255,255,.9)'; for (let x = o.x + 14; x < o.x + o.w; x += 46) { c.beginPath(); c.moveTo(x, o.y + 3); c.lineTo(x + 16, o.y + 3); c.stroke(); } }
    else { c.fillStyle = 'rgba(102,217,232,' + (0.35 + 0.5 * a) + ')'; c.fillRect(o.x, o.y, o.w, h); c.strokeStyle = 'rgba(21,170,191,' + a + ')'; c.lineWidth = 2; c.strokeRect(o.x, o.y, o.w, h); c.fillStyle = 'rgba(255,255,255,.8)'; for (let x = o.x + ((t * 60) % 24); x < o.x + o.w - 4; x += 24) c.fillRect(x, o.y + 5, 8, 3); }
    return;
  }
  if (o.style === 'glass') {                                             // 유리문: 위로 걷히며 열린다
    if (h < 1) return;
    c.fillStyle = 'rgba(165,216,255,.5)'; c.fillRect(o.x, o.y, o.w, h); c.strokeStyle = '#4dabf7'; c.lineWidth = 2; c.strokeRect(o.x, o.y, o.w, h);
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2.5; c.beginPath(); for (let yy = o.y + 14; yy < o.y + h - 10; yy += 34) { c.moveTo(o.x + 4, yy + 10); c.lineTo(o.x + o.w - 4, yy); } c.stroke();
    return;
  }
  if (o.style === 'icewall') {
    if (h < 1) return;
    box(c, o.x, o.y + o.h - h, o.w, h, 6, '#d0ebff', '#74c0fc', 2.5);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(o.x + 12, o.y + o.h - h + 12); c.lineTo(o.x + 20, o.y + o.h - h + 40); c.moveTo(o.x + 40, o.y + o.h - h + 20); c.lineTo(o.x + 46, o.y + o.h - h + 36); c.stroke();
    if (o.open > 0.02) { c.fillStyle = '#74c0fc'; for (let k = 0; k < 4; k++) { const yy = o.y + o.h - h + ((t * 70 + k * 23) % Math.max(10, h)); c.beginPath(); c.arc(o.x + 8 + k * 16, yy, 2.5, 0, TAU); c.fill(); } }
    return;
  }
  box(c, o.x - 4, o.y - 6, o.w + 8, 8, 2, '#495057', INK, 2);
  if (h < 1) return;
  c.save(); rr(c, o.x, o.y, o.w, h, 3); c.clip();
  c.fillStyle = '#ffd43b'; c.fillRect(o.x, o.y, o.w, h);
  c.fillStyle = '#343a40'; for (let i = -6; i < 12; i++) { c.beginPath(); const yy = o.y + h - i * 16; c.moveTo(o.x, yy); c.lineTo(o.x + o.w, yy - 14); c.lineTo(o.x + o.w, yy - 22); c.lineTo(o.x, yy - 8); c.closePath(); c.fill(); }
  c.restore(); rr(c, o.x, o.y, o.w, h, 3); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
}
/* 혼자 연습: 내가 할 일 표시 */
function drawHint(c, h, me, t, cx, vw) {
  if (!me) return;
  const bob = Math.sin(t * 6) * 4, hx = me.x + PW / 2, hy = me.y - 34 + bob;
  const say = s => label(c, s, hx, hy - 8, 15, '#fff', '#2b8a3e');
  if (h.k === 'go' || h.k === 'jump') {
    const x = Math.max(cx + 30, Math.min(cx + vw - 30, h.x)), y = me.y - 6 + bob;
    c.fillStyle = '#51cf66'; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y + 18); c.lineTo(x - 12, y); c.lineTo(x - 5, y); c.lineTo(x - 5, y - 16); c.lineTo(x + 5, y - 16); c.lineTo(x + 5, y); c.lineTo(x + 12, y); c.closePath(); c.fill(); c.stroke();
    if (h.k === 'jump') say('점프!'); else if (Math.abs(h.x - hx) > 40) say(h.x > hx ? '여기로 →' : '← 여기로');
  } else if (h.k === 'push') say(h.dir > 0 ? '→ 밀어요!' : '← 밀어요!');
  else if (h.k === 'door') say('↓ 문으로!');
  else if (h.k === 'wait') say('그대로 서 있어요!');
  else if (h.k === 'idle') say('잠깐 기다려요');
}
function drawWire(c, o, W, t) {
  const on = YC.linkOn(W, o), P = o.pts;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  c.strokeStyle = on ? '#ffd43b' : '#868e96'; c.lineWidth = 3; c.stroke();
  if (on) { c.setLineDash([4, 10]); c.lineDashOffset = -t * 40; c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
}
function drawCell(c, o) {
  box(c, o.x - 18, o.y - 12, 36, 24, 4, '#495057', INK, 2); box(c, o.x + 18, o.y - 5, 5, 10, 1, '#adb5bd', INK, 1.5);
  label(c, '+', o.x + 9, o.y, 12, '#ff8787', null); label(c, '−', o.x - 9, o.y, 12, '#74c0fc', null);
}
function drawBulb(c, o, W, t) {
  const on = YC.linkOn(W, o);
  if (on) { c.fillStyle = 'rgba(255,236,153,.45)'; c.beginPath(); c.arc(o.x, o.y, 30 + Math.sin(t * 6) * 2, 0, TAU); c.fill(); }
  c.fillStyle = on ? '#ffe066' : '#e9ecef'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(o.x, o.y, 13, 0, TAU); c.fill(); c.stroke();
  box(c, o.x - 7, o.y + 11, 14, 8, 2, '#adb5bd', INK, 1.5);
}
function drawFire(c, o, t) {
  const k = 1 - o.out;
  if (k <= 0.02) { c.fillStyle = 'rgba(73,80,87,.5)'; for (let i = 0; i < 4; i++) { const yy = o.y + o.h - ((t * 25 + i * 17) % (o.h * 0.8)); c.beginPath(); c.arc(o.x + o.w * (0.2 + i * 0.2), yy, 5, 0, TAU); c.fill(); } return; }
  for (let i = 0; i < Math.ceil(o.w / 16); i++) {
    const fx = o.x + 8 + i * 16, hgt = o.h * k * (0.6 + 0.4 * Math.abs(Math.sin(t * 7 + i * 1.7)));
    c.fillStyle = 'rgba(255,107,107,.9)'; c.beginPath(); c.moveTo(fx - 10, o.y + o.h); c.quadraticCurveTo(fx - 12, o.y + o.h - hgt * 0.6, fx, o.y + o.h - hgt); c.quadraticCurveTo(fx + 12, o.y + o.h - hgt * 0.6, fx + 10, o.y + o.h); c.fill();
    c.fillStyle = 'rgba(255,212,59,.95)'; c.beginPath(); c.moveTo(fx - 6, o.y + o.h); c.quadraticCurveTo(fx - 6, o.y + o.h - hgt * 0.4, fx, o.y + o.h - hgt * 0.65); c.quadraticCurveTo(fx + 6, o.y + o.h - hgt * 0.4, fx + 6, o.y + o.h); c.fill();
  }
  if (o.spray && o.out > 0.02) { c.fillStyle = 'rgba(77,171,247,.8)'; for (let i = 0; i < 12; i++) { const px = o.x + ((i * 37 + t * 90) % o.w), py = o.y + ((i * 53 + t * 260) % o.h); c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill(); } }
}
function drawMirror(c, o, W) {
  if (o.opt && !YC.mirrorOn(W, o)) { c.strokeStyle = 'rgba(134,142,150,.5)'; c.setLineDash([4, 4]); c.lineWidth = 2; c.strokeRect(o.x + 4, o.y + 4, 24, 24); c.setLineDash([]); return; }
  const f = YC.mirrorFlip(W, o), cx = o.x + 16, cy = o.y + 16;
  c.save(); c.translate(cx, cy); c.rotate(f === 0 ? -Math.PI / 4 : Math.PI / 4);
  box(c, -20, -4, 40, 8, 3, '#e7f5ff', INK, 2); c.fillStyle = '#a5d8ff'; c.fillRect(-16, -2, 32, 3);
  c.restore();
  c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
}
function drawSensor(c, o, t) {
  const cx = o.x + 16, cy = o.y + 16;
  if (o.on || o.lit) { c.fillStyle = o.on ? 'rgba(105,219,124,.45)' : 'rgba(255,236,153,.5)'; c.beginPath(); c.arc(cx, cy, 22 + Math.sin(t * 8) * 2, 0, TAU); c.fill(); }
  box(c, o.x + 4, o.y + 4, 24, 24, 6, o.on ? '#69db7c' : o.lit ? '#ffe066' : '#868e96', INK, 2);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 2.4, 0, TAU); c.fill();
}
function drawSource(c, o) {
  box(c, o.x + 2, o.y + 4, 28, 24, 5, '#495057', INK, 2);
  c.fillStyle = '#ffe066'; const d = o.dir | 0; c.beginPath(); c.arc(o.x + 16 + [12, 0, -12, 0][d], o.y + 16 + [0, 10, 0, -10][d], 6, 0, TAU); c.fill(); c.stroke();
}
function drawLift(c, o, W, t) {
  if (o.style === 'balloon') {
    const cx = o.x + o.w / 2, top = o.y - 150, hot = YC.linkOn(W, o) || (o.solo && W.n <= 1 && o.t > 0 && o.t < 1);
    c.strokeStyle = '#8d6e63'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.x + 8, o.y); c.lineTo(cx - 34, top + 112); c.moveTo(o.x + o.w - 8, o.y); c.lineTo(cx + 34, top + 112); c.stroke();
    c.fillStyle = '#ff6b6b'; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 34, top + 112); c.bezierCurveTo(cx - 80, top + 70, cx - 70, top, cx, top); c.bezierCurveTo(cx + 70, top, cx + 80, top + 70, cx + 34, top + 112); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd43b'; c.beginPath(); c.moveTo(cx - 14, top + 4); c.bezierCurveTo(cx - 30, top + 50, cx - 24, top + 90, cx - 12, top + 112); c.lineTo(cx + 12, top + 112); c.bezierCurveTo(cx + 24, top + 90, cx + 30, top + 50, cx + 14, top + 4); c.closePath(); c.fill(); c.stroke();
    if (hot) { const f = 10 + Math.sin(t * 25) * 3; c.fillStyle = '#ff922b'; c.beginPath(); c.moveTo(cx, top + 112 - f * 2.2); c.quadraticCurveTo(cx + 9, top + 116, cx, top + 124); c.quadraticCurveTo(cx - 9, top + 116, cx, top + 112 - f * 2.2); c.fill(); }
    box(c, o.x, o.y, o.w, o.h, 4, '#c08552', INK, 2.5);
    return;
  }
  box(c, o.x, o.y, o.w, o.h, 4, '#adb5bd', INK, 2.5);
  c.fillStyle = '#868e96'; for (let x = o.x + 8; x < o.x + o.w - 8; x += 14) { c.beginPath(); c.moveTo(x, o.y + o.h - 4); c.lineTo(x + 4, o.y + 4); c.lineTo(x + 8, o.y + o.h - 4); c.closePath(); c.fill(); }
}
function drawSaw(c, o) {
  const base = o.base || (o.py + 40);
  c.fillStyle = '#868e96'; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(o.px, o.py - 2); c.lineTo(o.px - 20, base); c.lineTo(o.px + 20, base); c.closePath(); c.fill(); c.stroke();
  c.save(); c.translate(o.px, o.py); c.rotate(o.th);
  box(c, -o.L, -YC.SAW_TH / 2, o.L * 2, YC.SAW_TH, 4, '#f0b55f', INK, 2.5);
  c.fillStyle = '#c98f3e'; for (let x = -o.L + 14; x < o.L - 6; x += 28) c.fillRect(x, -2, 12, 2.5);
  c.fillStyle = '#e03131'; c.fillRect(-o.L + 3, -YC.SAW_TH / 2 + 2, 10, YC.SAW_TH - 4); c.fillRect(o.L - 13, -YC.SAW_TH / 2 + 2, 10, YC.SAW_TH - 4);
  c.restore();
  c.fillStyle = '#495057'; c.beginPath(); c.arc(o.px, o.py, 4, 0, TAU); c.fill(); c.stroke();
}
function drawPad(c, o, n) {
  const top = o.y + o.comp, shake = o.relT > 0 ? Math.sin(performance.now() / 14) * 1.5 : 0;
  // 용수철
  c.strokeStyle = '#495057'; c.lineWidth = 3; c.lineJoin = 'round';
  for (const sx of [o.x + o.w * 0.28, o.x + o.w * 0.72]) { c.beginPath(); const y0 = top + 10, y1 = o.fy - 3, k = 7; for (let i = 0; i <= k; i++) c.lineTo(sx + (i === 0 || i === k ? 0 : (i % 2 ? 9 : -9)) + shake, y0 + (y1 - y0) * i / k); c.stroke(); }
  box(c, o.x - 2, o.fy - 5, o.w + 4, 5, 2, '#5c636b', INK, 1.5);
  box(c, o.x + shake, top, o.w, 11, 4, o.mode === 'scale' ? (o.ok ? '#40c057' : '#74c0fc') : '#ff922b', INK, 2.5);
  if (o.mode === 'scale') {                                                                // 저울: 필요한 무게만큼 사람 칸
    const want = o.want || YC.needOf(o.eq, n), s = 10, gap = 13, x0 = o.x + o.w / 2 - (want - 1) * gap / 2, y = o.y - 46;
    box(c, x0 - s / 2 - 6, y - s - 6, (want - 1) * gap + s + 12, s + 12, 6, o.load > want ? '#ffc9c9' : 'rgba(255,255,255,.9)', INK, 1.5);
    for (let i = 0; i < want; i++) pip(c, x0 + i * gap, y, s, o.load > want ? '#fa5252' : i < o.load ? '#37b24d' : '#dee2e6', INK);
    if (o.load > want) label(c, '+' + (o.load - want), x0 + (want - 1) * gap + 22, y - 5, 13, '#fa5252', '#fff');
  } else if (o.load) {                                                                     // 발사대: 얼마나 눌렸나
    const k = Math.min(1, o.comp / o.maxc), x = o.x + o.w + 7;
    box(c, x, o.y - 2, 7, o.maxc + 4, 3, '#fff', INK, 1.5); c.fillStyle = k > 0.95 ? '#37b24d' : '#ffa94d'; c.fillRect(x + 1.5, o.y + o.maxc - k * o.maxc, 4, k * o.maxc);
  }
}
function drawRaft(c, o) {
  const x = o.x, y = o.y, w = o.w;
  c.strokeStyle = INK; c.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) { rr(c, x, y + i * 8, w, 9, 4.5); c.fillStyle = i ? '#b9772f' : '#d9944a'; c.fill(); c.stroke(); }
  c.fillStyle = '#8d5a22'; for (let lx = x + 14; lx < x + w - 8; lx += 26) c.fillRect(lx, y + 1, 4, 15);
  c.fillStyle = '#fff3bf'; c.beginPath(); c.arc(x + 5, y + 4.5, 2.5, 0, TAU); c.arc(x + w - 5, y + 4.5, 2.5, 0, TAU); c.fill();
  // 실은 무게 표시
  const cap = YC.raftCap(o, o._n || 2);
  if (o.load) { const s = 9, gap = 12, x0 = x + w / 2 - (cap - 1) * gap / 2; for (let i = 0; i < Math.max(cap, o.load); i++) pip(c, x0 + i * gap, y + 32, s, i >= cap ? '#fa5252' : i < o.load ? '#37b24d' : '#dee2e6', INK); }
}
function drawKey(c, o, t) {
  if (o.used) return;
  const bob = o.hd < 0 ? Math.sin(t * 3) * 3 : 0;
  c.save(); c.translate(o.x + 11, o.y + 14 + bob); c.rotate(o.hd < 0 ? Math.sin(t * 2) * 0.15 : -0.5);
  c.strokeStyle = INK; c.lineWidth = 2; c.fillStyle = '#ffd43b';
  c.beginPath(); c.arc(-6, 0, 6, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff9db'; c.beginPath(); c.arc(-6, 0, 2.2, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#ffd43b'; c.beginPath(); c.moveTo(0, -2.2); c.lineTo(13, -2.2); c.lineTo(13, 6); c.lineTo(10, 6); c.lineTo(10, 2.2); c.lineTo(7, 2.2); c.lineTo(7, 5); c.lineTo(4, 5); c.lineTo(4, 2.2); c.lineTo(0, 2.2); c.closePath(); c.fill(); c.stroke();
  c.restore();
  if (o.hd < 0) { c.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1, r = 15 + Math.sin(t * 3 + i) * 3; c.beginPath(); c.arc(o.x + 11 + Math.cos(a) * r, o.y + 14 + Math.sin(a) * r * 0.7, 1.6, 0, TAU); c.fill(); } }
}
function drawExit(c, o, t, fin) {
  const x = o.x, y = o.y, w = o.w, h = o.h;
  c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round';
  c.fillStyle = '#7b4f2c'; c.beginPath(); c.moveTo(x - 5, y + h); c.lineTo(x - 5, y + 16); c.quadraticCurveTo(x - 5, y - 6, x + w / 2, y - 6); c.quadraticCurveTo(x + w + 5, y - 6, x + w + 5, y + 16); c.lineTo(x + w + 5, y + h); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x + 2, y + h); c.lineTo(x + 2, y + 18); c.quadraticCurveTo(x + 2, y + 2, x + w / 2, y + 2); c.quadraticCurveTo(x + w - 2, y + 2, x + w - 2, y + 18); c.lineTo(x + w - 2, y + h); c.closePath();
  if (o.open) { c.fillStyle = '#2b1d10'; c.fill(); c.stroke(); c.fillStyle = '#ffe066'; for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.7; c.beginPath(); c.arc(x + w / 2 + Math.cos(a) * 10, y + h / 2 + 4 + Math.sin(a * 1.3) * 14, 1.8, 0, TAU); c.fill(); } }
  else { c.fillStyle = '#a8703d'; c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x + w / 2, y + h / 2, 4.5, 0, TAU); c.fill(); c.fillRect(x + w / 2 - 2, y + h / 2, 4, 10); }
}
function drawFlag(c, o, on) {
  c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(o.x + 10, o.y); c.lineTo(o.x + 10, o.y - 46); c.stroke();
  c.fillStyle = on ? '#40c057' : '#ced4da'; c.beginPath(); c.moveTo(o.x + 10, o.y - 46); c.lineTo(o.x + 32, o.y - 38); c.lineTo(o.x + 10, o.y - 30); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#868e96'; c.beginPath(); c.arc(o.x + 10, o.y - 47, 3, 0, TAU); c.fill(); c.stroke();
}
function drawSign(c, o, n) {
  const w = o.w || (o.icon === 'drop' ? 92 : 64), x = o.x - (w - 64) / 2, y = o.y, h = 40;
  c.strokeStyle = INK; c.lineWidth = 2.5; c.fillStyle = '#a8703d'; c.fillRect(x + w / 2 - 3, y - 20, 6, 20); c.strokeRect(x + w / 2 - 3, y - 20, 6, 20);
  box(c, x, y - 20 - h, w, h, 6, '#fff4d6', INK, 2.5);
  const cx = x + w / 2, cy = y - 20 - h / 2;
  switch (o.icon) {
    case 'stack3': if (n >= 3) { pip(c, cx - 10, cy + 17, 10, '#74c0fc'); pip(c, cx - 10, cy + 7, 10, '#ffd43b'); pip(c, cx - 10, cy - 3, 10, '#ff8787'); arrow(c, cx + 8, cy + 10, 20, 1, '#40c057', 4); c.save(); c.translate(cx + 14, cy + 2); c.rotate(-Math.PI / 2); arrow(c, 0, 0, 14, 1, '#40c057', 4); c.restore(); break; }   // 셋이 탑 쌓기 (둘 이하면 아래 그림)
    // falls through
    case 'stack': pip(c, cx - 10, cy + 14, 12, '#74c0fc'); pip(c, cx - 10, cy + 2, 12, '#ff8787'); arrow(c, cx + 8, cy + 10, 20, 1, '#40c057', 4); c.save(); c.translate(cx + 14, cy + 2); c.rotate(-Math.PI / 2); arrow(c, 0, 0, 14, 1, '#40c057', 4); c.restore(); break;
    case 'push': { const k = YC.needOf(o.need || 'most', n); for (let i = 0; i < Math.min(k, 3); i++) pip(c, cx - 22 + i * 9, cy + 9, 9, '#ff8787'); arrow(c, cx - 2, cy + 3, 13, 1, '#fa5252', 4); box(c, cx + 13, cy - 7, 15, 15, 3, '#e0a660', INK, 1.5); break; }
    case 'drop': { const k = Math.max(1, n - 1); for (let i = 0; i < Math.min(k, 3); i++) { pip(c, cx - 34 + i * 11, cy - 2, 10, '#ff8787'); } c.save(); c.translate(cx - 23, cy + 1); c.rotate(Math.PI / 2); arrow(c, 0, 0, 13, 1, '#fa5252', 4); c.restore(); label(c, '동시에!', cx + 20, cy, 12, INK, null); break; }
    case 'ice': label(c, '미끌!', cx, cy, 15, '#1c7ed6', null); break;
    default: label(c, o.txt || '', cx, cy, o.size || 13, INK, null);
  }
}

/* ───────── 그리는 사람 ───────── */
function Renderer(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.sc = 1; this.vw = VW; this.vh = VH; this.cache = null; this.ckey = ''; this.cam = { x: 0, y: 0, set: false }; this.fx = []; this.lastT = 0; }
/* 캔버스를 CSS 크기에 맞춘다. 화면 비율이 달라도 세로 544를 기준으로 하고 가로는 더 넓게 보여 준다 */
Renderer.prototype.fit = function (cssW, cssH, dpr) {
  dpr = Math.min(dpr || 1, 2);
  const w = Math.max(64, Math.round(cssW * dpr)), h = Math.max(36, Math.round(cssH * dpr));
  if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.cache = null; }
  this.sc = h / VH; this.vw = w / this.sc; this.vh = VH;
  if (this.vw > VW * 1.35) { this.vw = VW * 1.35; this.sc = w / this.vw; this.vh = h / this.sc; }      // 너무 넓으면 가로 기준
};
Renderer.prototype.buildCache = function (W) {
  const sc = this.sc, cv = this.cache = document.createElement('canvas');
  cv.width = Math.ceil(W.w * sc); cv.height = Math.ceil((W.h + T * 2) * sc);
  const c = cv.getContext('2d'); c.scale(sc, sc);
  const S = (x, y) => W.solid(x, y) || W.ch(x, y) === 's';
  for (let ty = 0; ty < W.rows + 2; ty++) for (let tx = 0; tx < W.cols; tx++) {
    const ch = ty < W.rows ? W.ch(tx, ty) : W.ch(tx, W.rows - 1), x = tx * T, y = ty * T, r = hash(tx, ty);
    if (ch === '#' || ch === 'I' || ch === 'S') {
      c.fillStyle = ch === 'I' ? '#c5ebff' : ch === 'S' ? '#f3d98d' : '#c4915c'; c.fillRect(x, y, T + 0.5, T + 0.5);
      if (ch === '#') { c.fillStyle = '#b07f4b'; if (r < 0.5) c.fillRect(x + 6 + r * 30, y + 8 + r * 20, 5, 3); if (r > 0.3) c.fillRect(x + 18 - r * 10, y + 20 - r * 6, 4, 3); }
      else if (ch === 'S') { c.fillStyle = '#dcb960'; for (let i = 0; i < 4; i++) c.fillRect(x + hash(tx + i, ty) * 28, y + hash(tx, ty + i * 3) * 28, 2, 2); }
      else { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6 + r * 8, y + 9); c.lineTo(x + 15 + r * 8, y + 4); c.moveTo(x + 14, y + 24); c.lineTo(x + 22, y + 19); c.stroke(); }
    } else if (ch === '^') {
      c.fillStyle = '#ced4da'; c.strokeStyle = INK; c.lineWidth = 2; c.lineJoin = 'round';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 1 + i * 10.3, y + T); c.lineTo(x + 6 + i * 10.3, y + 12); c.lineTo(x + 11 + i * 10.3, y + T); c.closePath(); c.fill(); c.stroke(); }
    }
  }
  // 윗면과 테두리
  for (let ty = 0; ty < W.rows; ty++) for (let tx = 0; tx < W.cols; tx++) {
    const ch = W.ch(tx, ty); if (!(ch === '#' || ch === 'I' || ch === 'S')) continue;
    const x = tx * T, y = ty * T, sol = (a, b) => { const q = W.ch(a, b); return q === '#' || q === 'I' || q === 'S'; };
    if (!sol(tx, ty - 1)) {
      if (ch === '#') { c.fillStyle = '#69c66f'; c.fillRect(x, y, T + 0.5, 8); c.fillStyle = '#4fb05a'; c.fillRect(x, y + 7, T + 0.5, 2.5); const r = hash(tx * 3, ty); if (r < 0.35) { c.fillStyle = '#8fdb8c'; c.fillRect(x + 4 + r * 40, y + 2, 6, 2.5); } }
      else if (ch === 'I') { c.fillStyle = '#eefaff'; c.fillRect(x, y, T + 0.5, 6); }
      else { c.fillStyle = '#fbe9ae'; c.fillRect(x, y, T + 0.5, 5); }
    }
    c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath();
    if (!sol(tx, ty - 1)) { c.moveTo(x, y); c.lineTo(x + T, y); }
    if (!sol(tx, ty + 1) && ty < W.rows - 1) { c.moveTo(x, y + T); c.lineTo(x + T, y + T); }
    if (!sol(tx - 1, ty) && tx > 0) { c.moveTo(x, y); c.lineTo(x, y + T); }
    if (!sol(tx + 1, ty) && tx < W.cols - 1) { c.moveTo(x + T, y); c.lineTo(x + T, y + T); }
    c.stroke();
  }
  this.cdef = W.def; this.csc = sc;
};
Renderer.prototype.spark = function (kind, x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = kind === 'dust' ? 30 + Math.random() * 50 : 80 + Math.random() * 160;
    this.fx.push({ k: kind, x: x, y: y, vx: Math.cos(a) * sp * (kind === 'dust' ? 1 : 0.8), vy: kind === 'dust' ? -Math.random() * 40 : Math.sin(a) * sp - 120, life: kind === 'dust' ? 0.35 : 0.6 + Math.random() * 0.3, t: 0, col: col, r: kind === 'dust' ? 4 + Math.random() * 3 : 2 + Math.random() * 2.5 });
  }
  if (this.fx.length > 220) this.fx.splice(0, this.fx.length - 220);
};
Renderer.prototype.ring = function (x, y, col) { this.fx.push({ k: 'ring', x: x, y: y, vx: 0, vy: 0, life: 0.4, t: 0, col: col, r: 6 }); };
Renderer.prototype.text = function (x, y, s, col) { this.fx.push({ k: 'txt', x: x, y: y, vx: 0, vy: -40, life: 1, t: 0, col: col || '#fff', s: s }); };

/* v: { W, people, me(자리 번호, 없으면 -1), names, cols, ck, t(초), focus:{x,y} 또는 null(모두 보이게), plain(중계용 간단히) } */
Renderer.prototype.draw = function (v) {
  const c = this.ctx, W = v.W, sc = this.sc, vw = this.vw, vh = this.vh, t = v.t, dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
  // 카메라
  let tx, ty;
  if (v.focus) { tx = v.focus.x - vw / 2; ty = v.focus.y - vh * 0.6; }
  else { let a = 1e9, b = -1e9, m = 0, k = 0; for (const p of v.people) { a = Math.min(a, p.x); b = Math.max(b, p.x); m += p.y; k++; } if (!k) { tx = this.cam.x; ty = this.cam.y; } else { tx = (a + b) / 2 + PW / 2 - vw / 2; ty = m / k - vh * 0.6; } }
  tx = W.w <= vw ? (W.w - vw) / 2 : YC.clamp(tx, 0, W.w - vw);
  ty = W.h <= vh ? W.h - vh : YC.clamp(ty, 0, W.h - vh);
  if (!this.cam.set || Math.abs(tx - this.cam.x) > 600) { this.cam.x = tx; this.cam.y = ty; this.cam.set = true; }
  else { const k = 1 - Math.pow(0.0015, dt); this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k; }
  const cx = this.cam.x, cy = this.cam.y;
  // 하늘
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, this.cv.height); g.addColorStop(0, '#aee3ff'); g.addColorStop(1, '#eafaf1'); c.fillStyle = g; c.fillRect(0, 0, this.cv.width, this.cv.height);
  c.setTransform(sc, 0, 0, sc, 0, 0);
  if (!v.plain) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 6; i++) { const x = ((i * 310 + 80 - cx * 0.12 - t * 4) % (vw + 300) + vw + 300) % (vw + 300) - 150, y = 50 + (i * 53) % 130; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.arc(x + 26, y - 9, 28, 0, TAU); c.arc(x + 56, y, 20, 0, TAU); c.fill(); }
    for (let L = 0; L < 2; L++) { c.fillStyle = L ? '#b5e3bf' : '#cfeeda'; const par = L ? 0.3 : 0.18, base = vh - (L ? 120 : 170), per = L ? 260 : 380; c.beginPath(); c.moveTo(0, vh); for (let x = -per; x <= vw + per; x += 20) { const wx = x + cx * par; c.lineTo(x, base - Math.sin(wx / per * TAU) * (L ? 36 : 50) - Math.sin(wx / per * TAU * 2.3) * 12); } c.lineTo(vw, vh); c.closePath(); c.fill(); }
  }
  c.translate(-cx, -cy);
  // 땅
  if (!this.cache || this.cdef !== W.def || this.csc !== sc) this.buildCache(W);   // 판(씨앗·난이도)마다 땅 모양이 다르므로 판 자체로 맞춘다
  c.drawImage(this.cache, 0, 0, this.cache.width / sc, this.cache.height / sc);
  if (W.n <= 2) for (let yy = 0; yy < W.rows; yy++) for (let xx = 0; xx < W.cols; xx++) { const q = W.ch(xx, yy); if ((q === 's' && W.n <= 1) || q === 'd') { box(c, xx * T + 1, yy * T + 1, T - 2, T - 2, 6, '#d0ebff', '#4dabf7', 2.5); label(c, q === 's' ? '혼자' : '둘이', xx * T + 16, yy * T + 16, 10, '#1c7ed6', null); } }
  const n = W.n, O = W.objs;
  for (const o of O) if (o.type === 'exit') drawExit(c, o, t); else if (o.type === 'flag') drawFlag(c, o, v.ck >= o.idx); else if (o.type === 'sign') drawSign(c, o, n);
    else if (o.type === 'wire') drawWire(c, o, W, t); else if (o.type === 'cell') drawCell(c, o); else if (o.type === 'bulb') drawBulb(c, o, W, t);
    else if (o.type === 'mirror') drawMirror(c, o, W); else if (o.type === 'sensor') drawSensor(c, o, t); else if (o.type === 'beam') drawSource(c, o);
  for (const o of O) if (o.type === 'lift') drawLift(c, o, W, t); else if (o.type === 'door') drawDoor(c, o, t); else if (o.type === 'btn') drawBtn(c, o, n, t); else if (o.type === 'pad') drawPad(c, o, n); else if (o.type === 'saw') drawSaw(c, o); else if (o.type === 'raft') { o._n = n; drawRaft(c, o); }
  for (const o of O) if (o.type === 'box') drawBox(c, o, n);
  for (const o of W.fires) drawFire(c, o, t);
  for (const src of W.beams) { const r = YC.traceBeam(W, src); c.lineCap = 'round'; c.lineJoin = 'round'; for (const [lw, col] of [[10, 'rgba(255,236,153,.35)'], [4, 'rgba(255,212,59,.95)'], [1.5, '#fff']]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); r.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); } }
  // 사람
  const P = v.people;
  for (let pass = 0; pass < 2; pass++) for (const p of P) {
    if ((p.slot === v.me) !== (pass === 1)) continue;
    let strain = false; if (p.push) for (const o of W.boxes) if ((o.fr || o.fl) && Math.abs(o.fr - o.fl) < o.nd) strain = true;
    guy(c, p, v.cols ? v.cols[p.slot] : p.slot, t, { strain: strain });
  }
  for (const o of O) if (o.type === 'key') drawKey(c, o, t);
  if (v.hint) drawHint(c, v.hint, P.find(p => p.slot === v.me), t, cx, vw);
  // 물 (사람 위에 덮어 그려 잠긴 것처럼)
  for (const o of W.waters) {
    c.fillStyle = 'rgba(64,160,255,.5)'; c.fillRect(o.x, o.y + 3, o.w, o.h - 3);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(o.x, o.y + 6);
    for (let x = o.x; x <= o.x + o.w; x += 8) c.lineTo(x, o.y + 3 + Math.sin(x / 19 + t * 2.4) * 2.2);
    c.lineTo(o.x + o.w, o.y + 7); for (let x = o.x + o.w; x >= o.x; x -= 8) c.lineTo(x, o.y + 6.5 + Math.sin(x / 19 + t * 2.4) * 2.2); c.closePath(); c.fill();
  }
  // 이름표
  if (!v.plain || v.names) for (const p of P) {
    if (p.slot === v.me) { c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); const yy = p.y - 16 + Math.sin(t * 5) * 1.5; c.moveTo(p.x + 6, yy - 7); c.lineTo(p.x + 18, yy - 7); c.lineTo(p.x + 12, yy); c.closePath(); c.fill(); c.stroke(); }
    else if (v.names && v.names[p.slot]) label(c, v.names[p.slot], p.x + PW / 2, p.y - 19, 11, '#fff', INK);
  }
  // 효과
  const F = this.fx; let w = 0;
  for (let i = 0; i < F.length; i++) {
    const f = F[i]; f.t += dt; if (f.t >= f.life) continue; F[w++] = f;
    const k = f.t / f.life; f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.k === 'dust') { c.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)) + ')'; c.beginPath(); c.arc(f.x, f.y, f.r * (1 + k), 0, TAU); c.fill(); }
    else if (f.k === 'ring') { c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, 6 + k * 26, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    else if (f.k === 'txt') { c.globalAlpha = 1 - k * k; label(c, f.s, f.x, f.y, 16, f.col, INK); c.globalAlpha = 1; }
    else { f.vy += 700 * dt; c.fillStyle = f.col; c.globalAlpha = 1 - k; c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill(); c.globalAlpha = 1; }
  }
  F.length = w;
  // 화면 밖 친구 표시
  if (v.me >= 0 && !v.plain) {
    c.setTransform(sc, 0, 0, sc, 0, 0);
    for (const p of P) {
      if (p.slot === v.me) continue;
      const sx = p.x + PW / 2 - cx, sy = p.y + PH / 2 - cy; if (sx > -6 && sx < vw + 6) continue;
      const left = sx < 0, ax = left ? 18 : vw - 18, ay = YC.clamp(sy, 60, vh - 60), ci = v.cols ? v.cols[p.slot] : p.slot;
      c.fillStyle = COL[ci % 6]; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(ax, ay, 11, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(ax + (left ? -6 : 6), ay); c.lineTo(ax + (left ? 3 : -3), ay - 6); c.lineTo(ax + (left ? 3 : -3), ay + 6); c.closePath(); c.fill(); c.stroke();
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
};
/* 대기실·결과 화면의 캐릭터 얼굴 */
Renderer.face = function (canvas, slot, ci) {
  const c = canvas.getContext('2d'), s = canvas.width / 44; c.setTransform(s, 0, 0, s, 0, 0); c.clearRect(0, 0, 44, 48);
  guy(c, { x: 10, y: 16, slot: slot, face: 1, gr: true, vx: 0, vy: 0, land: 0, riders: 0, push: false }, ci, 1.3, null);
  c.setTransform(1, 0, 0, 1, 0, 0);
};
/* 첫 화면 그림: 셋이 미는데 하나가 반대로 민다 */
Renderer.logo = function (canvas, t) {
  const c = canvas.getContext('2d'), s = canvas.height / 150;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); c.setTransform(s, 0, 0, s, 0, 0);
  const gy = 126, k = (t % 4) / 4, bx = 236 + (k < 0.75 ? k / 0.75 * 46 : (1 - (k - 0.75) / 0.25) * 46);      // 조금씩 밀리다가 되돌아온다
  box(c, 24, gy, 512, 16, 8, '#7ac86b', INK, 2.5);
  c.fillStyle = '#5fb04f'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(60 + i * 56, gy + 9, 2.2, 0, TAU); c.fill(); }
  box(c, bx, gy - 62, 62, 62, 8, '#e0a868', INK, 2.5);
  c.strokeStyle = '#b07840'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx + 8, gy - 42); c.lineTo(bx + 54, gy - 42); c.moveTo(bx + 8, gy - 21); c.lineTo(bx + 54, gy - 21); c.stroke();
  const mv = k < 0.75 ? 100 : -100;
  for (let i = 2; i >= 0; i--) guy(c, { x: bx - 25 - i * 25, y: gy - PH, slot: i, face: 1, gr: true, vx: mv, vy: 0, land: 0, riders: 0, push: true }, i, t, { strain: true });
  guy(c, { x: bx + 63, y: gy - PH, slot: 3, face: -1, gr: true, vx: mv, vy: 0, land: 0, riders: 0, push: true }, 3, t, { strain: true });
  for (let i = 0; i < 3; i++) arrow(c, bx - 2 + i * 21, gy - 78, 17, 1, COL[i], 6);
  arrow(c, bx + 86, gy - 78, 17, -1, COL[3], 6);
};
Renderer.COL = COL; Renderer.COLD = COLD;
root.YCRender = Renderer;
})(window);
