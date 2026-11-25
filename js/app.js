/* 영차영차 — app.js : 화면 흐름 (학생 · 혼자 연습 · 선생님) */
(function () {
'use strict';
const YC = window.YC, Net = window.YCNet, A = window.YCAudio, RD = window.YCRender;
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const fmt = ms => { ms = Math.max(0, ms || 0); const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const qs = new URLSearchParams(location.search);
const teamName = k => (k + 1) + '팀';
const MEDAL = ['🥇', '🥈', '🥉'];
function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); }
function face(slot, size) { const c = el('canvas'); c.width = (size || 22) * 2; c.height = Math.round((size || 22) * 2 * 48 / 44); RD.face(c, slot, slot); return c; }
document.addEventListener('pointerdown', () => A.unlock(), { passive: true });
document.addEventListener('keydown', () => A.unlock());
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { A.play('ui'); show(b.dataset.go); }));

/* ═══════════════════ 게임 화면 (학생 · 혼자 연습 공통) ═══════════════════ */
const G = { team: null, R: new RD($('cv')), on: false, solo: false, names: {}, keys: {}, touch: {}, inp: { l: 0, r: 0, j: 0, jp: 0, en: 0 }, pj: 0, acc: 0, last: 0, hudT: 0, voteUntil: 0, pushT: 0, okey: '', send: null, rank: null, myTeam: 0, q: 1, slow: 0, rtt: 0, rttT: 0, toastT: 0, matesKey: '', onQuit: null, heavyT: 0 };
const CODE = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'j', KeyW: 'j', Space: 'j', KeyZ: 'j', ArrowDown: 'en', KeyS: 'en', KeyE: 'en', Enter: 'en', NumpadEnter: 'en' };

function fitCanvas() { G.R.fit(window.innerWidth, window.innerHeight, (window.devicePixelRatio || 1) * G.q); }
window.addEventListener('resize', () => { if (G.on) fitCanvas(); });
window.addEventListener('keydown', e => {
  if (!G.on || e.target.tagName === 'INPUT') return;
  const k = CODE[e.code];
  if (k) { G.keys[k] = 1; e.preventDefault(); $('touch').hidden = true; }
  else if (e.code === 'KeyR' && !e.repeat) vote();
  else if (e.code === 'KeyM' && !e.repeat) mute();
});
window.addEventListener('keyup', e => { const k = CODE[e.code]; if (k) G.keys[k] = 0; });
window.addEventListener('blur', () => { G.keys = {}; G.touch = {}; document.querySelectorAll('.tb.down').forEach(b => b.classList.remove('down')); });
document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && G.on) $('touch').hidden = false; }, { passive: true });
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  const down = e => { e.preventDefault(); G.touch[k] = 1; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (x) {} };
  const up = e => { e.preventDefault(); G.touch[k] = 0; b.classList.remove('down'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
function vote() { if (!G.team || G.team.TS.ph !== YC.PH_PLAY) return; const now = performance.now(); G.voteUntil = now < G.voteUntil ? 0 : now + 7000; A.play('ui'); }
function mute() { const on = A.toggle(); $('b-mute').textContent = on ? '🔊' : '🔇'; }
$('b-vote').onclick = vote; $('b-mute').onclick = mute; $('b-mute').textContent = A.on ? '🔊' : '🔇';
$('b-full').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
$('b-quit').onclick = () => { if (G.onQuit) G.onQuit(); };
function toast(s) { const t = $('h-toast'); t.textContent = s; t.hidden = false; G.toastT = performance.now() + 2200; }

/* o: { slot, slots, stages, team, names, solo, first, send(type, payload), onQuit } */
function startGame(o) {
  stopGame();
  G.solo = !!o.solo; G.names = o.names || {}; G.send = o.send || null; G.myTeam = o.team | 0; G.onQuit = o.onQuit || null;
  G.team = new YC.Team({ slot: o.slot, slots: o.slots, stages: o.stages, build: YC.build, team: o.team | 0, spect: !o.solo, late: !!o.late, seq0: Math.floor(Date.now() / 50) % 100000000 });
  if (o.solo) G.team.cd0 = 1.4;
  if (o.restore) G.team.restore(o.restore, performance.now());
  G.snapKey = o.snapKey || null; G.snapT = 0;
  G.team.start(performance.now(), !!o.first);
  show('s-play'); fitCanvas();
  G.on = true; G.last = performance.now(); G.acc = 0; G.pj = 0; G.okey = ''; G.voteUntil = 0; G.stageSeen = -1; G.rttT = 0; G.keys = {}; G.touch = {}; G.matesKey = ''; G.R.cam.set = false; G.R.fx.length = 0;
  $('b-quit').hidden = !o.solo; $('h-rank').hidden = true; $('b-vote').hidden = false; $('h-mates').hidden = !!o.solo;
  $('touch').hidden = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  requestAnimationFrame(frame);
}
function stopGame() { G.on = false; G.team = null; $('h-over').hidden = true; $('h-hint').hidden = true; $('h-vote').hidden = true; $('h-toast').hidden = true; }

function frame() {
  if (!G.on) return;
  requestAnimationFrame(frame);
  const now = performance.now(); const dt = Math.min(0.12, (now - G.last) / 1000); G.last = now; G.acc += dt;
  // 느린 기기: 그림 해상도를 낮춘다
  if (dt > 0.03) { if (++G.slow > 90 && G.q > 0.55) { G.q = Math.max(0.55, G.q - 0.2); G.slow = 0; fitCanvas(); } } else if (G.slow > 0) G.slow--;
  let n = 0;
  while (G.acc >= 1 / 60 && n < 5) { G.acc -= 1 / 60; n++; tick(now - G.acc * 1000); if (!G.on) return; }
  if (n === 5) G.acc = 0;
  draw(now);
}
function tick(now) {
  const T = G.team, k = G.keys, t = G.touch, inp = G.inp, j = k.j || t.j ? 1 : 0;
  inp.l = k.l || t.l ? 1 : 0; inp.r = k.r || t.r ? 1 : 0; inp.j = j; inp.jp = j && !G.pj ? 1 : 0; inp.en = k.en || t.en ? 1 : 0; G.pj = j;
  if (G.bot) G.bot(inp);                                                                    // 시험용: 봇이 대신 누른다
  T.me.vote = now < G.voteUntil ? 1 : 0;
  if (!G.solo && now - G.rttT > 1000) {                                                     // 통신 길에 맞춰 보내는 빠르기를 정한다
    G.rttT = now; const st = Net.status(), dir = st.want > 0 && st.direct >= st.want;
    G.rtt = st.rtt || 0; T.selfDelay = dir ? 20 : Math.min(400, G.rtt); T.pIvl = dir ? 50 : 80; T.wIvl = dir ? 66 : 100; T.vIvl = 250;
  }
  T.tick(inp, 1 / 60, now);
  if (G.snapKey && now - G.snapT > 1000 && (T.heard || T.anchor)) { G.snapT = now; SNAP.set(Object.assign({ at: Date.now(), s: T.snap(now) }, G.snapKey)); }   // 새로 고침 대비
  for (const e of T.ev) onEvent(e, now, T);
  T.ev.length = 0;
  if (G.send) for (const m of T.out) G.send(m[0], m[1]);
  T.out.length = 0;
  // 미는 소리
  const me = T.me;
  if (me.pu && now - G.pushT > 280) { const b = T.W.byId[Math.abs(me.pu)]; G.pushT = now; if (b) { if (Math.abs(b.vx) > 8) { A.play('push'); G.R.spark('dust', me.x + 12, me.y + 27, 1); } else A.play('stuck', 500); } }
}
function onEvent(e, now, T) {
  const me = T.me, R = G.R, W = T.W;
  switch (e[0]) {
    case 'jump': A.play('jump'); R.spark('dust', me.x + 12, me.y + 28, 3); break;
    case 'land': A.play('land'); R.spark('dust', me.x + 12, me.y + 28, 5); break;
    case 'heavy': A.play('heavy', 300); if (now - G.heavyT > 900) { G.heavyT = now; R.text(me.x + 12, me.y - 24, '무거워서 못 뛰어!', '#ffd43b'); } break;
    case 'die': if (e[1] === 'water') { A.play('water'); R.spark('drop', e[2], e[3] + 6, 16, '#74c0fc'); } else { A.play('die'); R.spark('drop', e[2], Math.min(e[3], W.h - 20), 10, '#ffa8a8'); } R.ring(e[2], Math.min(e[3], W.h - 30), '#fff'); break;
    case 'respawn': A.play('respawn'); R.ring(me.x + 12, me.y + 14, '#fff'); break;
    case 'flag': A.play('flag'); R.spark('drop', me.x + 12, me.y, 8, '#69db7c'); break;
    case 'enter': A.play('enter'); R.ring(me.x + 12, me.y + 14, '#ffd43b'); break;
    case 'launch': A.play('launch'); R.spark('dust', me.x + 12, me.y + 28, 8); break;
    case 'go': A.play('go'); break;
    case 'clear': A.play('clear'); break;
    case 'done': A.play('done'); break;
    case 'stage':
      R.cam.set = false; R.fx.length = 0; G.voteUntil = 0;
      if (e[1] === G.stageSeen) toast('처음부터 다시!');
      else if (e[1] > 0 && G.stageSeen === e[1] - 1 && T.TS.sk[e[1] - 1]) toast('선생님이 다음 스테이지로 넘겼어요 (+1분 30초)');
      G.stageSeen = e[1]; break;
    case 'btn': A.play('btn'); break;
    case 'door': A.play('door'); break;
    case 'kick': { A.play('kick'); const o = W.byId[e[1]]; if (o) { R.spark('dust', o.px - o.ks * o.L * 0.8, o.py + 20, 8); if (o.launchV && o.kp < 0.85) R.text(o.px, o.py - 60, '힘이 모자라요! 다 같이 동시에!', '#ffd43b'); } break; }
    case 'boing': { A.play('boing'); const o = W.byId[e[1]]; if (o && o.kp < 0.85) R.text(o.x + o.w / 2, o.y - 60, '힘이 모자라요! 한 번에 뛰어요!', '#ffd43b'); break; }
    case 'thud': { A.play('thud'); const o = W.byId[e[1]]; if (o) R.spark('dust', o.x + o.w / 2, o.y + o.h, 8); break; }
    case 'lost': A.play('die'); break;
    case 'pop': { A.play('respawn'); const o = W.byId[e[1]]; if (o) R.ring(o.x + o.w / 2, o.y + o.h / 2, '#fff'); break; }
    case 'sink': A.play('sink'); { const o = W.byId[e[1]]; if (o) R.text(o.x + o.w / 2, o.y - 40, '너무 무거워요!', '#ff8787'); } break;
    case 'sail': A.play('sail'); break;
    case 'key': if (e[1] >= 0) A.play('key'); break;
    case 'unlock': A.play('unlock'); break;
  }
}
function draw(now) {
  const T = G.team, me = T.me;
  G.R.draw({ W: T.W, people: T.people(), me: T.slot, names: G.names, ck: me.ck, t: now / 1000, focus: me.fin ? null : { x: me.x + 12 + (me.dead > 0 ? 0 : me.face * 26), y: me.y + 14 } });
  if (now - G.hudT > 90) { G.hudT = now; hud(now); }
}
function hud(now) {
  const T = G.team, TS = T.TS, me = T.me, def = T.W.def;
  $('h-stage').textContent = 'STAGE ' + (TS.stage + 1) + '/' + T.stages.length + ' · ' + def.name;
  $('h-time').textContent = fmt(TS.ph === YC.PH_DONE ? T.total(now) : T.time(now));
  $('h-total').textContent = T.stages.length > 1 && TS.ph !== YC.PH_DONE ? '합계 ' + fmt(T.total(now)) : '';
  if (G.toastT && now > G.toastT) { $('h-toast').hidden = true; G.toastT = 0; }
  // 팀원
  const key = T.slots.join(',') + '|' + T.slots.map(s => s === T.slot ? 1 : (T.ghosts[s].present ? (T.ghosts[s].rep && T.ghosts[s].rep.fin && T.ghosts[s].rep.sr === T.sr() ? 2 : 1) : 0)).join('') + (me.fin ? 'f' : '');
  if (key !== G.matesKey) {
    G.matesKey = key; const box = $('h-mates'); box.textContent = '';
    for (const s of T.slots) { const g = T.ghosts[s], d = el('div', 'mate' + (s !== T.slot && !g.present ? ' off' : '') + ((s === T.slot ? me.fin : g.rep && g.rep.fin && g.rep.sr === T.sr()) ? ' fin' : '')); const i = el('i'); i.style.background = RD.COL[s % 6]; d.append(i, document.createTextNode(s === T.slot ? (G.names[s] || '나') + ' (나)' : (G.names[s] || '?'))); box.append(d); }
  }
  // 투표
  const v = T.votes(), hv = $('h-vote');
  if (v[0] > 0 && TS.ph === YC.PH_PLAY) { hv.hidden = false; hv.textContent = '↺ 처음부터 다시 ' + v[0] + '/' + v[1] + '명 (절반 넘으면 다시 시작)'; } else hv.hidden = true;
  $('b-vote').classList.toggle('on', now < G.voteUntil);
  // 문 앞 안내
  const hint = $('h-hint');
  if (TS.ph === YC.PH_PLAY && me.atExit && !me.fin) { hint.hidden = false; hint.textContent = $('touch').hidden ? '↓ 키로 들어가기' : '문 버튼으로 들어가기'; $('t-door').hidden = false; }
  else if (TS.ph === YC.PH_PLAY && me.fin) { hint.hidden = false; hint.textContent = '들어왔어요! 친구들을 기다리는 중…'; $('t-door').hidden = true; }
  else { hint.hidden = true; $('t-door').hidden = true; }
  // 순위
  if (G.rank && !G.solo) { const i = G.rank.findIndex(r => r[0] === G.myTeam); const p = $('h-rank'); if (i >= 0 && G.rank.length > 1) { p.hidden = false; p.textContent = (i + 1) + '위 / ' + G.rank.length + '팀'; } else p.hidden = true; }
  // 연결
  if (!G.solo) { const st = Net.status(), nd = $('h-net'); nd.classList.toggle('bad', !st.up); nd.textContent = !st.up ? '연결이 끊겼어요. 다시 연결하는 중…' : (T.anchor ? '● ' : '') + (st.want && st.direct >= st.want ? '친구들과 직접 연결' : (st.direct ? '직접 ' + st.direct + '/' + st.want + ' · ' : '') + '중계 ' + (st.rtt ? st.rtt + 'ms' : '연결됨')); } else $('h-net').textContent = '';
  // 가운데 안내
  let okey = '', html = null;
  if (TS.ph === YC.PH_WAIT) { okey = 'w'; html = '<div class="t2">곧 시작해요…</div>'; }
  else if (TS.ph === YC.PH_READY) {
    const n = TS.stage === 0 && !G.solo ? Math.ceil(TS.cd) : 0; okey = 'r' + TS.stage + ':' + TS.run + ':' + n;
    html = '<div class="t1">STAGE ' + (TS.stage + 1) + ' · ' + def.name + '</div>' + (n ? '<div class="n">' + n + '</div>' : '') + '<div class="t2">' + def.sub + '</div>';
  } else if (TS.ph === YC.PH_CLEAR) { okey = 'c' + TS.stage; html = '<div class="t1">클리어!</div><div class="t2">' + fmt(TS.cl[TS.stage]) + (TS.sk[TS.stage] ? ' (넘김)' : '') + '</div>'; }
  else if (TS.ph === YC.PH_DONE) {
    okey = 'd' + (G.rank ? G.rank.map(r => r.join('.')).join('|') : '');
    html = '<div class="t1">완주!</div><div class="panel"><div class="big">합계 ' + fmt(T.total(now)) + '</div>' + rankHtml(G.rank, G.myTeam, T.stages.length) + (G.solo ? '' : '<p class="msg">다른 팀이 끝날 때까지 응원해 주세요!</p>') + '</div>';
  }
  if (okey !== G.okey) {
    if (TS.ph === YC.PH_READY && okey.split(':')[2] !== '0' && G.okey.charAt(0) === 'r') A.play('tick');
    G.okey = okey; const ov = $('h-over');
    if (html === null) ov.hidden = true; else { ov.hidden = false; $('h-obox').innerHTML = html; if (TS.ph === YC.PH_DONE && G.solo) { const b = el('button', 'btn green', '처음으로'); b.onclick = () => { if (G.onQuit) G.onQuit(); }; $('h-obox').querySelector('.panel').append(b); } }
  }
}
/* 순위표 (rk: [[팀, 깬 수, 합계ms, 완주, 지금 스테이지, 팀원 이름들], ...]) */
function rankHtml(rk, mine, total) {
  if (!rk || !rk.length) return '';
  let h = '<div class="rank">';
  rk.forEach((r, i) => {
    let dots = ''; for (let s = 0; s < total; s++) dots += '<i class="' + (s < r[1] ? 'ok' : (s === r[4] && !r[3] ? 'now' : '')) + '"></i>';
    h += '<div class="rk' + (r[0] === mine ? ' mine' : '') + (r[3] ? ' done' : '') + '"><div class="no">' + (r[3] && i < 3 ? MEDAL[i] : i + 1) + '</div><div class="nm">' + teamName(r[0]) + '<span class="dots">' + dots + '</span><small>' + esc(r[5] || '') + '</small></div><div class="tm">' + fmt(r[2]) + '</div></div>';
  });
  return h + '</div>';
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ═══════════════════ 혼자 연습 ═══════════════════ */
function soloStart(stages) { A.play('ui'); startGame({ slot: 0, slots: [0], stages: stages, solo: true, first: true, names: { 0: '나' }, onQuit: () => { stopGame(); show('s-solo'); } }); }
(function () {
  const box = $('solo-list');
  YC.order.forEach((id, i) => { const d = YC.build(id), b = el('button', 'stg'); b.append(el('b', null, (i + 1) + '. ' + d.name), el('small', null, d.sci)); b.onclick = () => soloStart([id]); box.append(b); });
  $('b-solo').onclick = () => { A.play('ui'); show('s-solo'); };
  $('b-solo-all').onclick = () => soloStart(YC.order.slice());
})();

/* ═══════════════════ 학생 ═══════════════════ */
const S = { on: false, id: '', name: '', code: '', room: null, joined: false, run: -1, playTeam: -1, playSlot: -1, hello: 0, subs: [], slotKey: '', hiAt: 0, meshWant: '', meshNow: '', meshAt: 0 };
const TAB = Net.newId(), BC = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('yeongcha') : null;
const JS = { get() { try { return JSON.parse(sessionStorage.getItem('yc-join') || 'null'); } catch (e) { return null; } }, set(v) { try { if (v) sessionStorage.setItem('yc-join', JSON.stringify(v)); else sessionStorage.removeItem('yc-join'); } catch (e) {} } };
const SNAP = { get() { try { return JSON.parse(sessionStorage.getItem('yc-snap') || 'null'); } catch (e) { return null; } }, set(v) { try { if (v) sessionStorage.setItem('yc-snap', JSON.stringify(v)); else sessionStorage.removeItem('yc-snap'); } catch (e) {} } };
if (BC) BC.onmessage = e => {                                                               // 같은 기기의 다른 탭에서 같은 방에 또 들어오면 이 탭은 물러난다
  const m = e.data; if (!m || m.t !== 'join' || !S.on || m.code !== S.code || m.id !== S.id || m.tab === TAB) return;
  S.on = false; clearInterval(S.hello); stopGame(); Net.close(); JS.set(null); show('s-title'); setTimeout(() => alert('다른 탭에서 같은 방에 들어와서 이 탭은 나갔어요.'), 50);
};
$('b-join').onclick = () => { A.play('ui'); $('in-name').value = store.get('yc-name', ''); $('join-msg').textContent = ''; show('s-join'); ($('in-name').value ? $('in-code') : $('in-name')).focus(); };
$('in-code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('in-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('b-enter').click(); });
$('in-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('in-code').focus(); });
$('b-enter').onclick = () => {
  const name = $('in-name').value.trim().slice(0, 8), code = $('in-code').value.trim();
  if (!name) { $('join-msg').textContent = '별명을 적어 주세요.'; return; }
  if (!/^\d{4}$/.test(code)) { $('join-msg').textContent = '방 코드는 숫자 4자리예요.'; return; }
  A.play('ui'); joinRoom(name, code);
};
$('b-leave').onclick = () => leaveRoom();
$('b-end-back').onclick = () => leaveRoom();
function joinRoom(name, code) {
  S.name = name; S.code = code; S.id = store.get('yc-id-' + code, '') || Net.newId(); store.set('yc-id-' + code, S.id); store.set('yc-name', name);
  S.room = null; S.joined = false; S.run = -1; S.playTeam = -1; S.on = true; S.subs = []; S.meshWant = S.meshNow = '';
  JS.set({ code: code, name: name, at: Date.now() }); if (BC) BC.postMessage({ t: 'join', code: code, id: S.id, tab: TAB });
  Net.open(code, S.id, studentMsg, () => { if (!S.on) return; if (!G.on) updateWait(); if (Date.now() - S.hiAt > 400) sayHi(); });
  Net.sub('h');
  clearInterval(S.hello); S.hello = setInterval(studentBeat, 2000);
  show('s-wait'); updateWait();
}
function sayHi() { if (!S.on) return; S.hiAt = Date.now(); Net.say('c', { t: 'hi', n: S.name, br: Net.status().br }); }
function studentBeat() {
  sayHi(); if (S.on && !G.on) updateWait();
  // 대기실에서 팀이 정해지고 잠잠해지면 팀원끼리 미리 직접 연결해 둔다
  if (S.on && S.room && S.room.ph === 'lobby' && S.meshWant !== S.meshNow && Date.now() - S.meshAt > 1500) { S.meshNow = S.meshWant; Net.mesh(S.meshWant ? S.meshWant.split(',') : []); }
}
function leaveRoom(msg) {
  if (S.on) Net.say('c', { t: 'bye' });
  JS.set(null); SNAP.set(null);
  S.on = false; clearInterval(S.hello); stopGame(); setTimeout(() => { if (!S.on && !H.on) Net.close(); }, 300);
  show('s-title'); if (msg) setTimeout(() => alert(msg), 50);
}
function studentMsg(ch, d) {
  if (!S.on) return;
  if (ch === 'h') { if (d && d.t === 'room') onRoom(d); return; }
  if (!G.on || !G.team || ch.charCodeAt(0) !== 116) return;
  const a = ch.split('/'); if (a.length !== 3 || +a[0].slice(1) !== S.playTeam) return;
  if (a[2] === 'p') G.team.onPlayer(+a[1], d, performance.now()); else if (a[2] === 'w') G.team.onWorld(+a[1], d, performance.now());
}
function onRoom(d) {
  if (!Array.isArray(d.pl)) return;
  S.room = d; S.roomAt = Date.now(); if (typeof d.db === 'string') Net.db = d.db;
  if (d.closed) { leaveRoom('선생님이 방을 닫았어요.'); return; }
  if (Array.isArray(d.kick) && d.kick.indexOf(S.id) >= 0) { leaveRoom('선생님이 방에서 내보냈어요.'); return; }
  const me = d.pl.find(p => p[0] === S.id);
  if (!me) { S.joined = false; if (G.on) { stopGame(); show('s-wait'); } updateWait(); return; }
  S.joined = true;
  const mates = d.pl.filter(p => p[2] === me[2]);
  G.rank = d.rk || null; G.myTeam = me[2];
  if (d.ph !== 'play' && G.snapKey) { G.snapKey = null; SNAP.set(null); }
  if (d.ph === 'lobby') {
    S.run = -1; if (G.on) stopGame(); show('s-wait'); updateWait();
    const want = mates.filter(p => p[0] !== S.id).map(p => p[0]).sort().join(','); if (want !== S.meshWant) { S.meshWant = want; S.meshAt = Date.now(); }
  }
  else if (d.ph === 'play') {
    if (S.run !== d.run || S.playTeam !== me[2] || S.playSlot !== me[3] || !G.on) beginPlay(d, me, mates);
    else {
      const key = mates.map(p => p[3] + p[1]).join(',');
      if (key !== S.slotKey) { S.slotKey = key; subMates(me, mates); G.team.setSlots(mates.map(p => p[3])); G.names = {}; mates.forEach(p => { G.names[p[3]] = p[1]; }); G.matesKey = ''; }
      if (d.skip && d.skip[me[2]] !== undefined) G.team.skipReq = d.skip[me[2]];
    }
  } else if (d.ph === 'end') { if (G.on) stopGame(); showEnd(d, me); }
}
function subMates(me, mates) {
  const want = mates.filter(p => p[3] !== me[3]).map(p => 't' + me[2] + '/' + p[3] + '/#');
  for (const t of S.subs) if (want.indexOf(t) < 0) Net.unsub(t);
  for (const t of want) if (S.subs.indexOf(t) < 0) Net.sub(t);
  S.subs = want;
  S.meshWant = S.meshNow = mates.filter(p => p[0] !== S.id).map(p => p[0]).sort().join(','); Net.mesh(S.meshWant ? S.meshWant.split(',') : []);
}
function beginPlay(d, me, mates) {
  S.run = d.run; S.playTeam = me[2]; S.playSlot = me[3]; S.slotKey = mates.map(p => p[3] + p[1]).join(',');
  for (const t of S.subs) Net.unsub(t); S.subs = [];
  subMates(me, mates);
  const slots = mates.map(p => p[3]), names = {}; mates.forEach(p => { names[p[3]] = p[1]; });
  const team = me[2], slot = me[3], sn = SNAP.get();
  const restore = sn && sn.code === S.code && sn.run === d.run && sn.team === team && sn.slot === slot && Date.now() - sn.at < 180000 ? sn.s : null;
  startGame({ slot: slot, slots: slots, stages: d.st, team: team, names: names, first: (d.age | 0) < 6000 && slot === Math.min.apply(null, slots),
    late: !!restore || (d.age | 0) >= 6000, restore: restore, snapKey: { code: S.code, run: d.run, team: team, slot: slot },
    send: (type, pay) => { if (type === 'v') Net.send('v', pay); else Net.team('t' + team + '/' + slot + '/' + type, pay); } });
  if (d.skip && d.skip[team] !== undefined) G.team.skipReq = d.skip[team];
}
function updateWait() {
  const d = S.room, st = Net.status();
  $('w-code').textContent = S.code; $('w-name').textContent = S.name;
  $('w-net').textContent = st.up ? '연결됨 ' + st.up + '/' + st.total : (st.slow ? '⚠ 연결이 안 돼요' : '연결하는 중…');
  const me = d && d.pl.find(p => p[0] === S.id), box = $('w-teams'); box.textContent = '';
  if (!st.up && st.slow) $('w-msg').textContent = '중계 서버에 연결되지 않아요. 학교 와이파이가 막고 있을 수 있어요. 선생님께 알려 주세요.';
  else if (!d) $('w-msg').textContent = '방 ' + S.code + '을(를) 찾는 중… 코드가 맞는지 확인해요.';
  else if (Date.now() - S.roomAt > 8000) $('w-msg').textContent = '선생님 화면과 연결이 끊겼어요. 잠시 기다려 보세요.';
  else if (!me) $('w-msg').textContent = '들어가는 중…';
  else $('w-msg').textContent = '들어왔어요! 선생님이 시작하면 바로 시작해요. (지금 ' + d.pl.length + '명)';
  if (me) { RD.face($('w-face'), me[3], me[3]); $('w-team').textContent = teamName(me[2]); } else { $('w-team').textContent = ''; const c = $('w-face'); c.getContext('2d').clearRect(0, 0, c.width, c.height); }
  if (d) {
    const teams = {}; d.pl.forEach(p => { (teams[p[2]] || (teams[p[2]] = [])).push(p); });
    Object.keys(teams).sort((a, b) => a - b).forEach(k => {
      const t = el('div', 'team' + (me && +k === me[2] ? ' mine' : '')); t.append(el('h3', null, teamName(+k)));
      teams[k].sort((a, b) => a[3] - b[3]).forEach(p => { const c = el('span', 'chip'); c.append(face(p[3], 11), document.createTextNode(p[1])); t.append(c); });
      box.append(t);
    });
  }
}
function showEnd(d, me) {
  show('s-end');
  const i = (d.rk || []).findIndex(r => r[0] === me[2]);
  $('e-mine').textContent = i >= 0 ? teamName(me[2]) + ' · ' + (i + 1) + '위 · ' + fmt(d.rk[i][2]) : '';
  $('e-rank').innerHTML = rankHtml(d.rk, me[2], (d.st || []).length);
}

/* ═══════════════════ 선생님 ═══════════════════ */
const H = { on: false, code: '', id: '', ph: 'lobby', run: 0, t0: 0, players: new Map(), seq: 0, nTeams: 0, stages: YC.order.slice(), skip: {}, kick: [], viewers: {}, vr: {}, sel: null, timer: 0, db: '', manual: false, dirty: true, lastBeat: 0, lastUi: 0, final: null, frame: 0 };
const SS = { get() { try { return JSON.parse(sessionStorage.getItem('yc-host') || 'null'); } catch (e) { return null; } }, set(v) { try { if (v) sessionStorage.setItem('yc-host', JSON.stringify(v)); else sessionStorage.removeItem('yc-host'); } catch (e) {} } };
$('b-host').onclick = () => { A.play('ui'); hostOpen(null); };
(function () { const s = SS.get(); if (s && s.code && Date.now() - s.at < 3 * 3600 * 1000) { const b = $('b-resume'); b.hidden = false; b.textContent = '열어 둔 방 ' + s.code + ' 다시 열기'; b.onclick = () => hostOpen(s); } })();
function hostOpen(saved) {
  stopGame(); S.on = false; clearInterval(S.hello);
  Object.assign(H, { on: true, ph: 'lobby', run: 0, t0: 0, seq: 0, nTeams: 0, stages: YC.order.slice(), skip: {}, kick: [], viewers: {}, vr: {}, sel: null, manual: false, dirty: true, final: null, finalStat: null, finalSplits: null, closed: false, db: '', lastUi: -1e9 });
  H.players = new Map();
  if (saved) {
    H.code = saved.code; H.id = saved.id; H.ph = saved.ph; H.run = saved.run; H.t0 = saved.t0; H.nTeams = saved.nTeams; H.stages = saved.stages; H.manual = saved.manual; H.skip = saved.skip || {}; H.kick = saved.kick || []; H.seq = saved.seq || 0; H.final = saved.final || null; H.finalStat = saved.fstat || null; H.finalSplits = saved.fsplit || null;
    (saved.players || []).forEach(p => H.players.set(p.id, Object.assign(p, { last: performance.now() })));
  } else { H.code = String(1000 + Math.floor(Math.random() * 9000)); H.id = 'H' + Net.newId(); }
  Net.open(H.code, H.id, hostMsg, () => { H.dirty = true; });
  Net.sub('c'); Net.sub('v');
  clearInterval(H.timer); H.timer = setInterval(hostBeat, 250);
  show('s-host'); hostView(); requestAnimationFrame(hostFrame);
}
function hostClose() { if (!confirm('방을 닫을까요? 학생들은 처음 화면으로 돌아갑니다.')) return; H.ph = 'lobby'; H.closed = true; hostSay(); H.on = false; clearInterval(H.timer); SS.set(null); setTimeout(() => { if (!H.on && !S.on) Net.close(); }, 400); $('b-resume').hidden = true; show('s-title'); }
$('hc-close').onclick = hostClose; $('he-close').onclick = hostClose;
function hostMsg(ch, d, from) {
  if (!H.on || !d) return;
  const now = performance.now();
  if (ch === 'v') { const k = d.k | 0; if (H.ph !== 'play' || k < 0 || k > 40) return; (H.viewers[k] || (H.viewers[k] = new YC.Viewer({ stages: H.stages, build: YC.build }))).onPacket(d, now); return; }
  if (ch !== 'c' || !from) return;
  if (d.t === 'bye') { const p = H.players.get(from); if (p) { if (H.ph === 'lobby') { H.players.delete(from); if (!H.manual) assignAll(); } else p.last = -1e9; H.dirty = true; } return; }
  if (d.t !== 'hi' || H.kick.indexOf(from) >= 0) return;
  let p = H.players.get(from);
  if (!p) {
    if (H.players.size >= 60) return;
    p = { id: from, name: '', order: ++H.seq, team: -1, slot: -1, last: now, br: null }; H.players.set(from, p);
    if (H.ph === 'lobby' && !H.manual) assignAll(); else placeLate(p);
    A.play('join'); H.dirty = true;
  }
  const name = String(d.n || '?').slice(0, 8); if (name !== p.name) { p.name = name; H.dirty = true; }
  p.last = now; p.br = d.br || null;
}
function teamCount() { const n = H.players.size; return Math.max(1, Math.ceil(n / 6), H.nTeams || Math.ceil(n / 4)); }
function assignAll() { const T = teamCount(), cnt = []; [...H.players.values()].sort((a, b) => a.order - b.order).forEach((p, i) => { p.team = i % T; p.slot = cnt[p.team] = (cnt[p.team] === undefined ? 0 : cnt[p.team] + 1); }); H.dirty = true; }
function freeSlot(team, except) { const used = {}; H.players.forEach(p => { if (p.team === team && p !== except) used[p.slot] = 1; }); for (let s = 0; s < 6; s++) if (!used[s]) return s; return -1; }
function placeLate(p) {
  const size = {}; let T = 0; H.players.forEach(q => { if (q !== p && q.team >= 0) { size[q.team] = (size[q.team] || 0) + 1; T = Math.max(T, q.team + 1); } });
  let best = -1; for (let k = 0; k < Math.max(T, 1); k++) if ((size[k] || 0) < 6 && (best < 0 || (size[k] || 0) < (size[best] || 0))) best = k;
  if (best < 0) best = T;
  p.team = best; p.slot = freeSlot(best, p); H.dirty = true;
}
function movePlayer(p, team) { if (p.team === team) return; const s = freeSlot(team, p); if (s < 0) return; p.team = team; p.slot = s; H.manual = true; H.dirty = true; }
function rankNow() {
  const now = performance.now(), teams = {}; H.players.forEach(p => { (teams[p.team] || (teams[p.team] = [])).push(p); });
  const rk = Object.keys(teams).map(k => {
    const v = H.viewers[k], cl = v ? v.TS.cl : []; let c = 0; for (let i = 0; i < H.stages.length; i++) if (cl[i] > 0) c++;
    return [+k, c, v ? Math.round(v.total(now)) : 0, v && v.TS.ph === YC.PH_DONE ? 1 : 0, v ? v.TS.stage : 0, teams[k].sort((a, b) => a.slot - b.slot).map(p => p.name).join(' · ')];
  });
  rk.sort((a, b) => b[3] - a[3] || b[1] - a[1] || a[2] - b[2] || a[0] - b[0]);
  return rk;
}
function hostSay() {
  const pl = [...H.players.values()].sort((a, b) => a.order - b.order).map(p => [p.id, p.name, p.team, p.slot]);
  Net.say('h', { t: 'room', ph: H.ph, run: H.run, age: H.ph === 'play' ? Date.now() - H.t0 : 0, st: H.stages, db: H.db, pl: pl, skip: H.skip, kick: H.kick.slice(-30), closed: H.closed ? 1 : 0, rk: H.ph === 'end' && H.final ? H.final : rankNow() });
  SS.set({ at: Date.now(), code: H.code, id: H.id, ph: H.ph, run: H.run, t0: H.t0, nTeams: H.nTeams, stages: H.stages, manual: H.manual, skip: H.skip, kick: H.kick.slice(-30), seq: H.seq, final: H.final, fstat: H.finalStat || null, fsplit: H.finalSplits || null, players: [...H.players.values()].map(p => ({ id: p.id, name: p.name, order: p.order, team: p.team, slot: p.slot })) });
}
function hostBeat() {
  if (!H.on) return;
  const now = performance.now();
  if (H.dirty || now - H.lastBeat > 1000) {
    if (now - H.lastBeat > 900) { const brs = []; H.players.forEach(p => { if (p.br && now - p.last < 6000) brs.push(p.br); }); H.db = Net.pickDb(brs, H.db); Net.db = H.db; }
    H.lastBeat = now; hostSay();
    if (H.dirty) { H.dirty = false; hostView(); }
  }
}
function hostView() {
  $('h-lobby').hidden = H.ph !== 'lobby'; $('h-play').hidden = H.ph !== 'play'; $('h-end').hidden = H.ph !== 'end';
  if (H.ph === 'lobby') hostLobby(); else if (H.ph === 'play') hostPlayUi(); else hostEndUi();
}
function hostNetText() { const st = Net.status(); return st.up ? '중계 서버 연결됨 ' + st.up + '/' + st.total + (st.via ? ' · ' + st.via + (st.rtt ? ' ' + st.rtt + 'ms' : '') : '') + (st.sigOnly ? ' (느린 통로만 연결됨: 움직임이 끊겨 보일 수 있어요)' : '') : (st.slow ? '⚠ 중계 서버에 연결되지 않습니다. 학교 방화벽이 막고 있을 수 있어요. 다른 통신망(핫스팟 등)에서 다시 해 보세요.' : '중계 서버에 연결하는 중…'); }
function hostLobby() {
  $('hc-code').textContent = H.code;
  $('hc-url').textContent = location.host + location.pathname.replace(/index\.html$/, '');
  $('hc-net').textContent = hostNetText() + ' · 들어온 학생 ' + H.players.size + '명';
  const T = H.players.size ? Math.max(...[...H.players.values()].map(p => p.team)) + 1 : teamCount();
  $('hc-tn').textContent = String(T);
  $('hc-start').disabled = !H.players.size;
  const cs = $('hc-stages'); cs.textContent = '';
  YC.order.forEach((id, i) => { const b = el('button', 'chk' + (H.stages.indexOf(id) >= 0 ? ' on' : ''), (i + 1) + ' ' + YC.build(id).name); b.onclick = () => { const at = H.stages.indexOf(id); if (at >= 0) { if (H.stages.length > 1) H.stages.splice(at, 1); } else H.stages = YC.order.filter(x => x === id || H.stages.indexOf(x) >= 0); H.dirty = true; hostBeat(); }; cs.append(b); });
  const box = $('hc-teams'); box.textContent = '';
  const now = performance.now();
  for (let k = 0; k < Math.max(T, 1); k++) {
    const mem = [...H.players.values()].filter(p => p.team === k).sort((a, b) => a.slot - b.slot);
    const t = el('div', 'team' + (H.sel && H.sel.team !== k ? ' pick' : '')), h = el('h3'); h.append(document.createTextNode(teamName(k)), el('small', null, mem.length + '명' + (mem.length === 1 ? ' (혼자!)' : ''))); t.append(h);
    t.onclick = () => { if (H.sel && H.sel.team !== k) { movePlayer(H.sel, k); H.sel = null; hostBeat(); hostView(); } };
    mem.forEach(p => {
      const c = el('span', 'chip' + (now - p.last > 7000 ? ' off' : '') + (H.sel === p ? ' sel' : '')); c.append(face(p.slot, 13), document.createTextNode(p.name || '…'));
      c.onclick = e => { e.stopPropagation(); if (H.sel === p) { if (confirm(p.name + ' 님을 방에서 내보낼까요?')) { H.players.delete(p.id); H.kick.push(p.id); if (!H.manual) assignAll(); H.dirty = true; hostBeat(); } H.sel = null; } else H.sel = p; hostView(); };
      t.append(c);
    });
    box.append(t);
  }
}
$('hc-tm').onclick = () => { const cur = +$('hc-tn').textContent; H.nTeams = Math.max(1, cur - 1); H.manual = false; assignAll(); hostBeat(); };
$('hc-tp').onclick = () => { const cur = +$('hc-tn').textContent; H.nTeams = Math.min(Math.max(1, H.players.size), cur + 1); H.manual = false; assignAll(); hostBeat(); };
$('hc-auto').onclick = () => { H.manual = false; assignAll(); hostBeat(); };
$('hc-shuffle').onclick = () => { const a = [...H.players.values()]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i].order; a[i].order = a[j].order; a[j].order = t; } H.manual = false; assignAll(); hostBeat(); };
$('hc-start').onclick = () => {
  if (!H.players.size) return;
  A.play('go'); H.ph = 'play'; H.run = Date.now() % 1000000; H.t0 = Date.now(); H.skip = {}; H.viewers = {}; H.vr = {}; H.final = null; H.sel = null; H.dirty = true; hostBeat(); setTimeout(hostSay, 300); setTimeout(hostSay, 700);
};
$('hp-end').onclick = () => { if (!confirm('지금 끝내고 결과를 볼까요?')) return; H.ph = 'end'; H.final = rankNow(); H.finalStat = collectStats(); H.finalSplits = collectSplits(); H.dirty = true; hostBeat(); A.play('done'); };
$('he-again').onclick = () => { H.ph = 'lobby'; H.viewers = {}; H.vr = {}; H.final = null; H.dirty = true; hostBeat(); };
function hostPlayUi() {
  $('hp-code').textContent = '방 ' + H.code;
  const box = $('hp-views'); box.textContent = ''; H.vr = {};
  const teams = {}; H.players.forEach(p => { (teams[p.team] || (teams[p.team] = [])).push(p); });
  Object.keys(teams).sort((a, b) => a - b).forEach(k => {
    const v = el('div', 'view'), c = el('canvas'), cap = el('div', 'cap'), nm = el('b', null, teamName(+k) + ' · ' + teams[k].sort((a, b) => a.slot - b.slot).map(p => p.name).join(' ')), tm = el('span', null, ''), wait = el('div', 'wait', '연결을 기다리는 중…');
    const sk = el('button', 'btn slim skip', '넘기기'); sk.onclick = () => { const vw = H.viewers[k]; if (!vw) return; if (!confirm(teamName(+k) + '을 다음 스테이지로 넘길까요? (벌칙 1분 30초)')) return; H.skip[k] = vw.TS.stage; H.dirty = true; hostBeat(); };
    cap.append(nm, tm); v.append(c, cap, wait, sk); box.append(v);
    const names = {}; teams[k].forEach(p => { names[p.slot] = p.name; });
    H.vr[k] = { R: new RD(c), cv: c, tm: tm, wait: wait, box: v, names: names, sk: sk };
  });
}
function hostFrame() {
  if (!H.on) return;
  requestAnimationFrame(hostFrame);
  const now = performance.now(); H.frame++;
  if (H.ph === 'play') {
    const keys = Object.keys(H.vr);
    keys.forEach((k, i) => {
      const r = H.vr[k], v = H.viewers[k];
      if (!v || !v.W) { r.wait.hidden = false; return; }
      r.wait.hidden = now - v.last < 6000; if (!r.wait.hidden) r.wait.textContent = '이 팀의 연결이 끊겼어요…';
      if ((H.frame + i) % 2) return;                                                        // 팀 화면은 번갈아 가며 그린다
      v.update(now); v.ev.length = 0;
      const w = r.cv.clientWidth, h = r.cv.clientHeight; if (w < 10) return;
      r.R.fit(w, h, 1);
      r.R.draw({ W: v.W, people: v.pl, me: -1, names: r.names, ck: v.TS.ck, t: now / 1000, focus: null, plain: true });
      const done = v.TS.ph === YC.PH_DONE; r.box.classList.toggle('done', done); r.sk.hidden = done;
      r.tm.textContent = done ? '완주 ' + fmt(v.total(now)) : (v.TS.stage + 1) + '/' + H.stages.length + ' ' + v.W.def.name + ' · ' + fmt(v.time(now));
    });
    if (now - H.lastUi > 500) {
      H.lastUi = now; const rk = rankNow(); $('hp-rank').innerHTML = rankHtml(rk, -1, H.stages.length); $('hp-net').textContent = hostNetText();
      if (rk.length && rk.every(r => r[3]) && !H.autoEnd) { H.autoEnd = true; setTimeout(() => { if (H.ph === 'play') { H.ph = 'end'; H.final = rankNow(); H.finalStat = collectStats(); H.finalSplits = collectSplits(); H.dirty = true; hostBeat(); A.play('done'); } H.autoEnd = false; }, 2500); }
    }
  } else if (H.ph === 'lobby' && now - H.lastUi > 1500) { H.lastUi = now; $('hc-net').textContent = hostNetText() + ' · 들어온 학생 ' + H.players.size + '명'; }
}
function collectStats() { const out = []; H.players.forEach(p => { const v = H.viewers[p.team], s = v && v.stat && v.stat[p.slot]; if (s) out.push({ name: p.name, team: p.team, s: s }); }); return out; }
function collectSplits() { const out = {}; Object.keys(H.viewers).forEach(k => { const v = H.viewers[k]; out[k] = { cl: v.TS.cl.slice(), sk: v.TS.sk.slice() }; }); return out; }
function hostEndUi() {
  const rk = H.final || [], pod = $('he-podium'); pod.textContent = '';
  [1, 0, 2].forEach(i => { const r = rk[i]; if (!r) return; const d = el('div', 'pod p' + (i + 1)); d.append(el('div', 'md', MEDAL[i]), el('div', 'nm', teamName(r[0])), el('div', 'tm', r[3] ? fmt(r[2]) : r[1] + '/' + H.stages.length + ' 스테이지'), el('small', null, r[5])); pod.append(d); });
  // 스테이지별 기록
  const tb = $('he-table'); tb.textContent = ''; const sp = H.finalSplits || {};
  rk.forEach((r, i) => {
    const row = el('div', 'rk' + (r[3] ? ' done' : '')), nm = el('div', 'nm'), s = sp[r[0]] || { cl: [], sk: [] };
    nm.append(document.createTextNode(teamName(r[0])), el('small', null, H.stages.map((id, j) => YC.build(id).name + ' ' + (s.cl[j] > 0 ? fmt(s.cl[j]) + (s.sk[j] ? '(넘김)' : '') : '–')).join('  ·  ')));
    row.append(el('div', 'no', i < 3 && r[3] ? MEDAL[i] : String(i + 1)), nm, el('div', 'tm', fmt(r[2]))); tb.append(row);
  });
  // 재미로 보는 상
  const aw = $('he-awards'); aw.textContent = ''; const st = H.finalStat || [];
  const top = (idx, min) => { let b = null; for (const x of st) if (x.s[idx] >= min && (!b || x.s[idx] > b.s[idx])) b = x; return b; };
  [[0, 3, '💪 영차왕', x => '상자를 ' + x.s[0].toFixed(0) + '초 동안 밀었어요'], [3, 3, '🪜 든든한 받침', x => '친구를 ' + x.s[3].toFixed(0) + '초 동안 머리에 이고 있었어요'], [2, 2, '💦 풍덩왕', x => x.s[2] + '번 빠졌어요'], [1, 1.5, '🐸 청개구리', x => x.s[1].toFixed(0) + '초 동안 반대로 밀었어요'], [4, 1.5, '🛋 무임승차', x => '친구들이 미는 상자 위에 ' + x.s[4].toFixed(0) + '초 동안 타고 있었어요']]
    .forEach(a => { const x = top(a[0], a[1]); if (!x) return; const d = el('div', 'aw'); d.append(el('b', null, a[2] + '  '), document.createTextNode(x.name + ' (' + teamName(x.team) + ') — ' + a[3](x))); aw.append(d); });
  $('he-sci').innerHTML = '<b>오늘 몸으로 해 본 것</b><br>' +
    '· <b>알짜힘</b>: 같은 방향으로 민 힘은 더해지고, 반대로 민 힘은 그만큼 빠진다. 합쳐서 0이면 꿈쩍도 안 한다.<br>' +
    '· <b>마찰력</b>: 거친 모래 위나 무거울수록(위에 올라타면) 크고, 얼음 위에서는 작아서 계속 미끄러진다.<br>' +
    '· <b>무게(중력)</b>: 시소는 무거운 쪽이 내려가고, 받침점에서 멀리 설수록 더 크게 작용한다.<br>' +
    '· <b>탄성력</b>: 용수철은 많이 눌릴수록 되돌아가려는 힘이 크다. 그래서 다 같이 눌렀다 한 번에 놓아야 높이 튄다.<br>' +
    '· <b>부력</b>: 뗏목은 실은 무게만큼 더 잠긴다. 가벼우면 높이 뜨고, 너무 무거우면 가라앉는다.';
}

/* ═══════════════════ 시작 ═══════════════════ */
(function logo() { const c = $('logo-cv'); let t0 = performance.now(); (function loop() { if ($('s-title').classList.contains('on')) RD.logo(c, (performance.now() - t0) / 1000); requestAnimationFrame(loop); })(); })();
(function () {
  const j = JS.get();
  if (j && /^\d{4}$/.test(j.code || '') && j.name && Date.now() - j.at < 3 * 3600 * 1000) { joinRoom(j.name, j.code); return; }
  if (/^\d{4}$/.test(qs.get('room') || '')) { $('in-code').value = qs.get('room'); $('in-name').value = store.get('yc-name', ''); show('s-join'); }
})();
window.addEventListener('beforeunload', e => { if (H.on && H.ph === 'play') { e.preventDefault(); e.returnValue = ''; } });
window.YCApp = { G: G, S: S, H: H, joinRoom: joinRoom, hostOpen: hostOpen, soloStart: soloStart, startGame: startGame };      // 시험용
})();
