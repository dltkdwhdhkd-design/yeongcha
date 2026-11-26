/* 영차영차 — core.js
   화면·소리·통신과 무관한 게임 규칙. 브라우저(게임)와 Node(시험)가 같은 파일을 쓴다.

   큰 그림
   - 내 캐릭터는 내 기기가 직접 움직인다(지연 없음). 다른 사람은 받은 위치로 그리는 "허깨비"인데,
     딛고 설 수도 있고 길을 막기도 한다.
   - 상자·시소·뗏목처럼 함께 쓰는 장치는 팀에서 한 기기("기준 기기")만 계산해서 나눠 준다.
   - 누가 무엇을 딛고 섰는지, 무엇을 미는지는 각자 자기 화면에서 판단해 알린다.
     기준 기기는 그 보고를 모아 무게와 힘을 센다.
*/
(function (root) {
'use strict';

const T = 32, PW = 24, PH = 28, SAW_TH = 10;
const G = 1800, JUMP_V = 536, MOVE = 170, MAX_FALL = 1000;
const VIEW_W = 960, VIEW_H = 544;
const PH_WAIT = 0, PH_READY = 1, PH_PLAY = 2, PH_CLEAR = 3, PH_DONE = 4;
const SKIP_PEN = 90000;                       // 스테이지 넘기기 벌칙(ms)
const opt = { noBlock: false, slim: false };               // noBlock: 시험용. 사람끼리 서로 통과한다. 일부러 올라탈 때만(P.ride) 머리 위에 설 수 있다

const abs = Math.abs, min = Math.min, max = Math.max, sign = Math.sign, floor = Math.floor;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, t, d) => v < t ? min(v + d, t) : max(v - d, t);
const lerp = (a, b, k) => a + (b - a) * k;
const r0 = Math.round, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* 필요한 인원: 팀 인원 n에 맞춰 정한다 */
function needOf(spec, n) {
  n = max(1, n | 0);
  if (typeof spec === 'number') return clamp(spec, 1, n);
  if (Array.isArray(spec)) return clamp(spec[min(n, spec.length - 1)] | 0 || 1, 1, n);   // 팀 인원마다 정한 수 (spec[n])
  if (spec === 'w2') return 2;                  // 인원과 상관없이 무게 2 (쇠 상자 하나)
  switch (spec) {
    case 'all': return n;
    case 'most': return max(1, n - 1);
    case 'half': return max(1, Math.ceil(n / 2));
    case 'rest': return max(1, n - Math.ceil(n / 2));
    case 'two': return min(2, n);
    default: return 1;
  }
}

/* ───────────────────────── 스테이지 짓기 ───────────────────────── */
function LB(w, h) {
  this.w = w; this.h = h; this.g = [];
  for (let y = 0; y < h; y++) this.g.push(new Array(w).fill(' '));
  this.objs = []; this.spawn = { x: 2 * T, y: 13 * T };
}
LB.prototype.fill = function (x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y][x] = ch === undefined ? '#' : ch;
  return this;
};
LB.prototype.add = function (o) { this.objs.push(o); return o; };
LB.prototype.done = function (meta) {
  this.objs.forEach((o, i) => { o.id = i + 1; });
  for (const o of this.objs) { if (o.link) o.link = o.link.map(x => typeof x === 'number' ? x : x.id); if (o.nlink) o.nlink = o.nlink.map(x => typeof x === 'number' ? x : x.id); }
  return Object.assign({ w: this.w, h: this.h, g: this.g.map(r => r.join('')), objs: this.objs, spawn: this.spawn }, meta);
};

/* ───────────────────────── 세계 ───────────────────────── */
const SOLID = { box: 1, door: 1, lift: 1, pad: 1, raft: 1 };

function initObj(o) {
  switch (o.type) {
    case 'box': o.hx = o.x; o.hy = o.y; o.vx = 0; o.vy = 0; o.gr = 1; o.sup = 0; o.rs = 0; o.fr = 0; o.fl = 0; o.nd = 1; o.ice = 0; o.wt = o.wt || 1; break;
    case 'btn': o.on = 0; o.lat = 0; o.load = 0; o.hold = 0; if (o.only !== undefined) o.own = -1; break;   // only: 색 단추 — 팀에서 (only % 인원)번째 친구만 누를 수 있다. own: 그 친구의 자리 번호
    case 'door': o.open = o.inv ? 1 : 0; break;                  // 거꾸로 이은 문(다리)은 처음에 없는 상태
    case 'lift':
      o.x1 = o.x; o.y1 = o.y; if (o.x2 === undefined) o.x2 = o.x; if (o.y2 === undefined) o.y2 = o.y;
      o.len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1; o.t = 0; o.dirn = 1; o.wait = o.pause || 0; o.speed = o.speed || 70; o.mdx = 0; o.mdy = 0; break;
    case 'saw': if (o.lo === undefined) o.lo = -o.max; if (o.hi === undefined) o.hi = o.max; o.th = o.rest !== undefined ? o.rest : 0; o.om = 0; o.kq = 0; o.ks = 0; o.kp = 0; o.win = 0; o.winTh = 0; o.pend = []; o.seen = {}; o.I0 = o.L * o.L * 0.35; break;
    case 'pad': o.comp = 0; o.load = 0; o.kq = 0; o.kp = 0; o.ok = 0; o.lat = 0; o.want = 0; o.relT = 0; o.relSum = 0; o.lastLd = 0; o.stab = 0; o.mdx = 0; o.mdy = 0; o.rel = []; o.jseen = {}; o.rOpen = 0; break;
    case 'raft': o.x1 = o.x; o.st = 0; o.tmr = 0; o.load = 0; o.sink = 0; o.lw = 0; o.h = o.h || 16; o.y = o.wy - o.rise; o.speed = o.speed || 64; o.mdx = 0; o.mdy = 0; break;
    case 'key': o.hx = o.x; o.hy = o.y; o.hd = -1; o.used = 0; break;
    case 'exit': o.open = o.locked ? 0 : 1; break;
    case 'fire': o.out = 0; break;
    case 'sensor': o.on = 0; o.lit = 0; o.hold = 0; break;
    case 'relay': o.on = 0; o.hold = 0; break;
  }
}

function rectOf(o) {
  switch (o.type) {
    case 'box': return o.rs > 0 ? null : o;
    case 'door': { const h = o.h * (1 - o.open); return h < 1 ? null : { x: o.x, y: o.y, w: o.w, h: h }; }
    case 'lift': case 'raft': return o;
    case 'pad': return { x: o.x, y: o.y + o.comp, w: o.w, h: o.fy - o.y - o.comp };
  }
  return null;
}
const topOf = o => o.type === 'pad' ? o.y + o.comp : o.y;

function World(def) {
  this.def = def; this.cols = def.w; this.rows = def.h; this.w = def.w * T; this.h = def.h * T; this.g = def.g; this.n = 1;
  this.objs = []; this.byId = {}; this.solids = []; this.ev = [];
  this.btns = []; this.saws = []; this.waters = []; this.flags = []; this.boxes = []; this.doors = []; this.kickers = []; this.key = null; this.exit = null;
  this.fires = []; this.sensors = []; this.beams = []; this.relays = []; this.mirrorAt = {}; this.sensorAt = {};
  for (let i = 0; i < def.objs.length; i++) {
    const o = Object.assign({}, def.objs[i]); o.id = i + 1; initObj(o);
    this.objs.push(o); this.byId[o.id] = o;
    if (o.type === 'btn') this.btns.push(o); else if (o.type === 'saw') { this.saws.push(o); this.kickers.push(o); }
    else if (o.type === 'pad') this.kickers.push(o); else if (o.type === 'water') this.waters.push(o); else if (o.type === 'flag') this.flags.push(o);
    else if (o.type === 'box') this.boxes.push(o); else if (o.type === 'door') this.doors.push(o); else if (o.type === 'key') this.key = o; else if (o.type === 'exit') this.exit = o;
    else if (o.type === 'fire') this.fires.push(o); else if (o.type === 'beam') this.beams.push(o); else if (o.type === 'relay') this.relays.push(o);
    else if (o.type === 'sensor') { this.sensors.push(o); this.sensorAt[floor(o.y / T) * def.w + floor(o.x / T)] = o; }
    else if (o.type === 'mirror') this.mirrorAt[floor(o.y / T) * def.w + floor(o.x / T)] = o;
  }
  this.snap = null;                             // 소리·효과용: 지난 틱의 모습
}
World.prototype.ch = function (tx, ty) {
  if (tx < 0 || tx >= this.cols) return '#';
  if (ty < 0 || ty >= this.rows) return ' ';
  return this.g[ty][tx];
};
World.prototype.solid = function (tx, ty) {
  const c = this.ch(tx, ty);
  return c === '#' || c === 'I' || c === 'S' || (c === 's' && this.n <= 1) || (c === 'd' && this.n <= 2);   // d: 둘 이하일 때만 생기는 디딤돌
};
World.prototype.hit = function (x, y, w, h) {
  const x0 = floor(x / T), x1 = floor((x + w - 0.01) / T), y0 = floor(y / T), y1 = floor((y + h - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
  return false;
};
/* 이번 틱의 단단한 물체 목록. 한 틱에 한 번만 부른다(움직인 거리 dx,dy를 같이 구하므로). */
World.prototype.buildSolids = function () {
  const S = this.solids; S.length = 0;
  for (const o of this.objs) {
    if (!SOLID[o.type]) continue;
    const r = rectOf(o); let s = o._s;
    if (!r) { if (s) s.gone = true; continue; }
    if (!s) s = o._s = { ref: o.id, x: r.x, y: r.y, w: r.w, h: r.h, dx: 0, dy: 0, obj: o, gone: false, ctr: o.type === 'raft' };
    else if (s.gone || abs(r.x - s.x) > 90 || abs(r.y - s.y) > 90) { s.dx = 0; s.dy = 0; s.gone = false; }   // 순간이동은 밀지 않는다
    else { s.dx = r.x - s.x; s.dy = o.type === 'door' ? r.h - s.h : r.y - s.y; }
    s.x = r.x; s.y = r.y; s.w = r.w; s.h = r.h; S.push(s);
  }
};
/* 주고받는 모양 */
function packObj(o) {
  switch (o.type) {
    case 'box': return [r1(o.x), r1(o.y), r0(o.vx), o.fr | (o.fl << 3) | (o.nd << 6) | ((o.rs > 0 ? 1 : 0) << 10) | ((o.gr ? 1 : 0) << 11) | ((o.ice ? 1 : 0) << 12), o.sup];
    case 'btn': return o.only !== undefined ? [o.on | (o.lat << 1), o.load, r1(o.hold), o.own] : [o.on | (o.lat << 1), o.load, r1(o.hold)];
    case 'door': return [r2(o.open)];
    case 'lift': return [r3(o.t), o.dirn, r2(o.wait)];
    case 'saw': return [r3(o.th), r2(o.om), o.kq, o.ks, r2(o.kp)];
    case 'pad': return [r1(o.comp), o.load, o.kq, r2(o.kp), o.ok, o.relT > 0 ? 1 : 0];
    case 'raft': return [r1(o.x), r1(o.y), o.st, o.load, r2(o.tmr), r1(o.sink)];
    case 'key': return [o.hd, r1(o.x), r1(o.y), o.used];
    case 'exit': return [o.open];
    case 'fire': return [r2(o.out)];
    case 'sensor': return [o.on | (o.lit << 1)];
    case 'relay': return [o.on, r1(o.hold)];
  }
  return 0;
}
function applyObj(o, a, b, k) {
  if (!a) return;
  if (!b) b = a;
  switch (o.type) {
    case 'box': {
      const f = a[3]; o.fr = f & 7; o.fl = (f >> 3) & 7; o.nd = (f >> 6) & 15; o.rs = (f >> 10) & 1 ? 1 : 0; o.gr = (f >> 11) & 1; o.ice = (f >> 12) & 1; o.vx = a[2]; o.sup = a[4];
      if (abs(b[0] - a[0]) > 90 || abs(b[1] - a[1]) > 90) { o.x = a[0]; o.y = a[1]; } else { o.x = lerp(a[0], b[0], k); o.y = lerp(a[1], b[1], k); }
      break; }
    case 'btn': o.on = a[0] & 1; o.lat = (a[0] >> 1) & 1; o.load = a[1]; o.hold = a[2] || 0; if (a.length > 3) o.own = a[3]; break;
    case 'door': o.open = lerp(a[0], b[0], k); break;
    case 'lift': o.t = lerp(a[0], b[0], k); o.dirn = a[1]; o.wait = a[2]; o.x = lerp(o.x1, o.x2, o.t); o.y = lerp(o.y1, o.y2, o.t); break;
    case 'saw': o.th = lerp(a[0], b[0], k); o.om = a[1]; o.kq = a[2]; o.ks = a[3]; o.kp = a[4]; break;
    case 'pad': o.comp = lerp(a[0], b[0], k); o.load = a[1]; o.kq = a[2]; o.kp = a[3]; o.ok = a[4]; o.relT = a[5] ? 0.1 : 0; o.lastLd = a[1]; break;
    case 'raft':
      if (abs(b[0] - a[0]) > 90) { o.x = a[0]; o.y = a[1]; } else { o.x = lerp(a[0], b[0], k); o.y = lerp(a[1], b[1], k); }
      o.st = a[2]; o.load = a[3]; o.tmr = a[4]; o.sink = a[5]; break;
    case 'key': o.hd = a[0]; o.x = lerp(a[1], b[1], k); o.y = lerp(a[2], b[2], k); o.used = a[3]; break;
    case 'exit': o.open = a[0]; break;
    case 'fire': o.out = lerp(a[0], b[0], k); break;
    case 'sensor': o.on = a[0] & 1; o.lit = (a[0] >> 1) & 1; break;
    case 'relay': o.on = a[0]; o.hold = a[1]; break;
  }
}
World.prototype.pack = function () { const out = []; for (const o of this.objs) out.push(packObj(o)); return out; };
World.prototype.apply = function (a, b, k) { const O = this.objs; for (let i = 0; i < O.length; i++) applyObj(O[i], a[i], b ? b[i] : null, k || 0); };
/* 달라진 점을 보고 소리·효과 신호를 만든다 (기준 기기든 아니든 같은 방식) */
World.prototype.observe = function () {
  const ev = this.ev; const first = !this.snap; const S = this.snap || (this.snap = {});
  for (const o of this.objs) {
    let p = S[o.id]; if (!p) p = S[o.id] = {};
    switch (o.type) {
      case 'btn': if (!first && p.on !== o.on) ev.push(['btn', o.id, o.on]); p.on = o.on; break;
      case 'door': if (!first && ((p.open < 0.02 && o.open >= 0.02) || (p.open > 0.98 && o.open <= 0.98))) ev.push(['door', o.id]); p.open = o.open; break;
      case 'saw': if (!first && p.kq !== o.kq) ev.push(['kick', o.id]); p.kq = o.kq; break;
      case 'pad': if (!first && p.kq !== o.kq) ev.push(['boing', o.id]); p.kq = o.kq; break;
      case 'box': {
        const vy = o.y - (p.y === undefined ? o.y : p.y);
        if (!first) { if (p.rs !== o.rs) ev.push([o.rs ? 'lost' : 'pop', o.id]); else if (p.vy > 3 && vy < 0.5 && !o.rs) ev.push(['thud', o.id]); }
        p.vy = vy; p.y = o.y; p.rs = o.rs; break; }
      case 'raft': if (!first && p.st !== o.st) { if (o.st === 4) ev.push(['sink', o.id]); else if (o.st === 1) ev.push(['sail', o.id]); } p.st = o.st; break;
      case 'key': if (!first && p.hd !== o.hd) ev.push(['key', o.hd]); p.hd = o.hd; break;
      case 'exit': if (!first && p.open !== o.open) ev.push(['unlock', o.id]); p.open = o.open; break;
      case 'fire': if (!first && (p.out < 0.5) !== (o.out < 0.5)) ev.push([o.out >= 0.5 ? 'fout' : 'fon', o.id]); p.out = o.out; break;
      case 'sensor': if (!first && p.on !== o.on && o.on) ev.push(['lit', o.id]); p.on = o.on; break;
    }
  }
};

/* ───────────────────────── 몸 움직이기 (타일·물체와 부딪힘) ───────────────────────── */
function bodyMoveX(W, B, S, dx) {
  const c0 = B.x + B.w / 2; B.x += dx; let hit = 0;
  const y0 = floor(B.y / T), y1 = floor((B.y + B.h - 0.01) / T);
  if (dx > 0) { const tx = floor((B.x + B.w - 0.01) / T); for (let ty = y0; ty <= y1; ty++) if (W.solid(tx, ty)) { B.x = tx * T - B.w; hit = 1; break; } }
  else if (dx < 0) { const tx = floor(B.x / T); for (let ty = y0; ty <= y1; ty++) if (W.solid(tx, ty)) { B.x = (tx + 1) * T; hit = 1; break; } }
  // 겹친 것에서는 '오던 쪽'으로 물러난다. (움직인 방향만 보고 반대편 면으로 보내면, 살짝 겹친 채 뒤로 가려던 몸이 물체를 뚫고 건너편으로 튄다)
  // 사람(허깨비)에게 밀려 물체 속에 들어가지 않도록, 두 번째에는 물체만 다시 본다.
  for (let pass = 0; pass < 2; pass++) {
    let any = false;
    for (let i = 0; i < S.length; i++) {
      const s = S[i]; if (pass && s.ref < 0) continue;
      if (B.x < s.x + s.w && B.x + B.w > s.x && B.y < s.y + s.h && B.y + B.h > s.y) { B.x = c0 <= s.x + s.w / 2 ? s.x - B.w : s.x + s.w; hit = s.ref || 1; any = true; }
    }
    if (!any) break;
  }
  return hit;
}
function bodyMoveY(W, B, S, dy) {
  B.y += dy; let land = null, bump = false;
  const x0 = floor(B.x / T), x1 = floor((B.x + B.w - 0.01) / T);
  if (dy > 0) { const ty = floor((B.y + B.h - 0.01) / T); for (let tx = x0; tx <= x1; tx++) if (W.solid(tx, ty)) { B.y = ty * T - B.h; land = { ref: 0, ty: ty, s: null }; break; } }
  else if (dy < 0) { const ty = floor(B.y / T); for (let tx = x0; tx <= x1; tx++) if (W.solid(tx, ty)) { B.y = (ty + 1) * T; bump = true; break; } }
  // 물체·사람: 위에서 내려앉거나 아래에서 머리를 받을 때만 막는다. 옆에서 겹쳐 들어온 것은 여기서 건드리지 않는다
  // (공중에서는 사람을 통과하므로, 겹친 채로 내려오다 머리 위로 튀어 오르면 안 된다)
  const y0 = B.y - dy;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (!(B.x < s.x + s.w && B.x + B.w > s.x && B.y < s.y + s.h && B.y + B.h > s.y)) continue;
    if (dy > 0) {
      if (s.ctr && B.cp) { const cx = B.x + B.w / 2; if (cx < s.x || cx > s.x + s.w) continue; }       // 뗏목: 몸 가운데가 위에 있어야 올라선 것
      if (y0 + B.h <= s.y + 6) { B.y = s.y - B.h; land = { ref: s.ref, ty: 0, s: s }; }
    }
    else if (dy < 0) { if (y0 >= s.y + s.h - 6) { B.y = s.y + s.h; bump = true; } }
  }
  return { land: land, bump: bump };
}

/* ───────────────────────── 캐릭터 ───────────────────────── */
function Player(slot) {
  this.slot = slot; this.w = PW; this.h = PH; this.cp = true;
  this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1; this.dir = 0;
  this.gr = false; this.gRef = 0; this.gOff = 0; this.hRef = 0; this.hOff = 0; this.pu = 0; this.mat = '#';
  this.saw = 0; this.sawS = 0;
  this.coy = 0; this.jbuf = 0; this.jumping = false; this.dead = 0; this.fin = false; this.free = 0;
  this.ck = 0; this.want = false; this.ul = false; this.vote = 0; this.atExit = false; this.em = 0;
  this.ldSeq = 0; this.ldObj = 0; this.ldV = 0; this.ldS = 0; this.ldT = 0; this.jSeq = 0; this.jObj = 0; this.jT = 0;   // ldT·jT: 내려앉은·뛰어오른 때(내 시계)
  this.riders = 0; this.kseen = {}; this.puT = 0; this.puKeep = 0; this.ride = false;
  this.stat = [0, 0, 0, 0, 0];                  // 민 시간, 반대로 민 시간, 빠진 횟수, 받쳐 준 시간, 올라탄 시간
  this.land = 0; this.ev = [];
}

function sawPoint(o, s) { return { x: o.px + s * Math.cos(o.th), y: o.py + s * Math.sin(o.th) - SAW_TH / 2 }; }

function spawnAt(P, W, idx, ck) {
  let x = W.def.spawn.x, y = W.def.spawn.y;
  if (ck > 0) for (const f of W.flags) if (f.idx === ck) { x = f.x; y = f.y; }
  P.x = x + idx * 27; P.y = y - PH;
  for (let i = 0; i < 12 && W.hit(P.x, P.y, PW, PH); i++) P.y -= 8;
  P.vx = P.vy = 0; P.gr = false; P.gRef = 0; P.saw = 0; P.hRef = 0; P.pu = 0; P.dead = 0; P.free = 0.8; P.jumping = false; P.coy = 0; P.jbuf = 0;
}

function die(P, why) {
  if (P.dead > 0 || P.fin) return;
  P.dead = 0.9; P.vx = P.vy = 0; P.gr = false; P.gRef = 0; P.saw = 0; P.hRef = 0; P.pu = 0; P.stat[2]++; P.ev.push(['die', why, P.x + PW / 2, P.y + PH / 2]);
}

/* 그 자리에 설 수 없는가 (땅이나 다른 물체에 겹침) */
function stuckAt(P, W, objs, skip) {
  if (W.hit(P.x, P.y, PW, PH)) return true;
  for (let i = 0; i < objs.length; i++) if (objs[i] !== skip && ov(P, objs[i])) return true;
  return false;
}
/* 움직이는 물체가 나를 밀어낼 때 */
function pushOut(P, W, s, objs) {
  const oL = P.x + PW - s.x, oR = s.x + s.w - P.x, oU = P.y + PH - s.y;
  const tryX = d => { const ox = P.x; P.x += d; if (stuckAt(P, W, objs, s)) { P.x = ox; return false; } return true; };
  const tryUp = () => { const oy = P.y; P.y = s.y - PH; if (stuckAt(P, W, objs, s)) { P.y = oy; return false; } if (P.vy > 0) P.vy = 0; P.gr = true; P.gRef = s.ref; P.gOff = P.x - s.x; P.saw = 0; return true; };
  const side = () => oL < oR ? (tryX(-oL) || tryX(oR)) : (tryX(oR) || tryX(-oL));
  const cxp = P.x + PW / 2, top = !s.ctr || (cxp >= s.x && cxp <= s.x + s.w);                // 뗏목은 가운데가 걸쳐야 위로 올라간다
  if (!top) { side(); return; }
  if (oU <= max(12, abs(s.dy) + 6) && tryUp()) return;
  // 다가오는 물체의 앞쪽에 있으면 밀려가고, 뒤쪽에 걸쳐 있으면 그 자리에서 떨어져 나온다 (뒤에서 밀다가 물체를 뚫고 앞으로 튀어나가지 않게)
  const mid = s.x + s.w / 2;
  if (s.dx > 0.01) { if ((cxp >= mid ? tryX(oR) : tryX(-oL)) || tryUp()) return; }
  else if (s.dx < -0.01) { if ((cxp <= mid ? tryX(-oL) : tryX(oR)) || tryUp()) return; }
  else if (s.dy > 0.01) { if (side()) return; }
  else { if (min(oL, oR) >= oU && tryUp()) return; if (side()) return; tryUp(); }
}
/* 다른 사람(허깨비)과 겹쳤을 때: 살살 떼어 놓는다. 벽이나 물체 속으로는 밀리지 않는다 */
function pushOutGhost(P, W, s, dt, objs, ghosts) {
  const oU = P.y + PH - s.y, oD = s.y + s.h - P.y;
  if (oU <= 13) { const oy = P.y; P.y = s.y - PH; if (stuckAt(P, W, objs, null)) P.y = oy; else { if (P.vy > 0) P.vy = 0; P.gr = true; P.gRef = s.ref; P.gOff = P.x - s.x; P.saw = 0; } return; }
  if (oD <= 13) return;                         // 상대가 내 머리 위에 서 있는 것
  if (P.slot < -s.ref - 1 || opt.noBlock) return;   // 번호가 뒤인 쪽만 비킨다 (둘 다 비키면 지연 때문에 서로 밀려 떠내려간다)
  const right = P.x + PW / 2 >= s.x + s.w / 2;
  // 그쪽이 벽·물체·다른 사람으로 막혀 있으면 반대쪽으로 비킨다 (줄 서서 밀다가 둘이 한자리에 포개져 굳지 않게)
  const go = sgn => {
    const ox = P.x; P.x += sgn * min(280 * dt, sgn > 0 ? s.x + s.w - P.x : P.x + PW - s.x);
    let bad = stuckAt(P, W, objs, null);
    if (!bad && ghosts) for (let i = 0; i < ghosts.length; i++) { const g = ghosts[i]; if (g !== s && ov(P, g) && !ov({ x: ox, y: P.y, w: PW, h: PH }, g)) { bad = true; break; } }
    if (bad) P.x = ox;
    return !bad;
  };
  if (!go(right ? 1 : -1)) go(right ? -1 : 1);
}

/* 시소 판 위의 자리 s에 나를 놓는다. 벽에 걸리면 받침점 쪽으로 물러난다 */
function sawSeat(P, W, o, objs) {
  for (let k = 0; k < 40; k++) {
    const pt = sawPoint(o, P.sawS); P.x = pt.x - PW / 2; P.y = pt.y - PH;
    if (!stuckAt(P, W, objs, null)) return true;
    if (abs(P.sawS) < 3) break;
    P.sawS -= sign(P.sawS) * 3;
  }
  return false;
}
function findRef(objs, ghosts, ref) {
  const L = ref > 0 ? objs : ghosts;
  for (let i = 0; i < L.length; i++) if (L[i].ref === ref) return L[i];
  return null;
}

/* 한 틱. inp: {l,r,j(누르고 있음),jp(이번에 누름),en(문 들어가기)}  env: {riders, frozen, ck, idx} */
function stepPlayer(P, inp, W, GS, dt, env) {
  const ev = P.ev;
  if (P.fin) return;
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { spawnAt(P, W, env.idx, P.ck); ev.push(['respawn']); } return; }
  if (P.free > 0) P.free -= dt;
  if (P.land > 0) P.land -= dt;
  const ghosts = P.free > 0 || (opt.noBlock && !P.ride) ? [] : GS, objs = W.solids;
  const frozen = !!env.frozen;

  // 1. 딛고 선 것에 실려 간다
  let supVx = 0, supVy = 0;
  if (P.saw) {
    const o = W.byId[P.saw];
    if (!o) P.saw = 0;
    else { if (!sawSeat(P, W, o, objs)) { P.saw = 0; P.gRef = 0; P.gr = false; } supVy = o.om * P.sawS; }
  } else if (P.gRef && P.gr) {
    const s = findRef(objs, ghosts, P.gRef);
    if (s) {
      const cx0 = P.x + PW / 2;
      if (s.ctr ? (cx0 >= s.x - s.dx && cx0 <= s.x - s.dx + s.w) : (P.x + PW > s.x - s.dx && P.x < s.x - s.dx + s.w)) {
        const ox = P.x; P.x += s.dx; if (stuckAt(P, W, objs, s)) P.x = ox;              // 벽에 걸리면 받침만 지나간다
        const oy = P.y; P.y = s.y - PH; if (stuckAt(P, W, objs, s)) P.y = oy;
        supVx = s.dx / dt; supVy = s.dy / dt;
      }
    }
  }

  // 2. 나에게 밀고 들어온 물체에서 빠져나온다
  let pre = null;
  for (let i = 0; i < objs.length; i++) { const s = objs[i]; if (s.ref === P.gRef && !P.saw) continue; if (ov(P, s)) { pushOut(P, W, s, objs); if (ov(P, s)) (pre || (pre = [])).push(s.ref); } }
  const dir = frozen ? 0 : (inp.r ? 1 : 0) - (inp.l ? 1 : 0), mvDir = dir || sign(P.vx);
  for (let i = 0; i < ghosts.length; i++) {
    const s = ghosts[i]; if (s.ref === P.gRef && !P.saw) continue;
    if (!ov(P, s)) continue;
    pushOutGhost(P, W, s, dt, objs, ghosts);
    if (!ov(P, s)) continue;
    // 살짝 겹친 사람 쪽으로 가려 할 때는 그대로 막힌다. (지연 때문에 1~2픽셀 겹쳤다고 앞사람을 뚫고 지나가면 줄이 뒤섞인다)
    const pen = min(P.x + PW - s.x, s.x + s.w - P.x), ahead = s.x + s.w / 2 > P.x + PW / 2 ? 1 : -1;
    if (!(pen <= 8 && ahead === mvDir)) (pre || (pre = [])).push(s.ref);
  }
  let block;
  if (pre) { block = []; for (const s of objs) if (pre.indexOf(s.ref) < 0) block.push(s); for (const s of ghosts) if (pre.indexOf(s.ref) < 0) block.push(s); }
  else block = ghosts.length ? objs.concat(ghosts) : objs;

  // 3. 좌우
  P.dir = dir; if (dir) P.face = dir;
  const riders = env.riders | 0; P.riders = riders;
  const ice = P.gr && P.mat === 'I';
  const vmax = MOVE * (riders ? max(0.5, 1 - 0.17 * riders) : 1);
  const acc = P.gr ? (ice ? 380 : 2200) : 1400, dec = P.gr ? (ice ? 150 : 2600) : 300;
  P.vx = dir ? approach(P.vx, dir * vmax, acc * dt) : approach(P.vx, 0, dec * dt);

  // 4. 점프
  if (inp.jp && !frozen) P.jbuf = 0.12; else if (P.jbuf > 0) P.jbuf -= dt;
  if (P.jbuf > 0 && (P.gr || P.coy > 0)) {
    P.jbuf = 0;
    if (riders > 0) ev.push(['heavy']);                                                    // 머리 위에 누가 있으면 못 뛴다
    else { P.jSeq++; P.jObj = P.gRef > 0 ? P.gRef : 0; P.vy = -JUMP_V + min(0, supVy) * 0.5; P.vx += supVx; P.gr = false; P.gRef = 0; P.saw = 0; P.coy = 0; P.jumping = true; ev.push(['jump']); }
  }
  if (P.jumping && !inp.j && P.vy < -230) P.vy = -230;
  if (P.vy >= 0) P.jumping = false;

  // 5. 움직인다 (둘로 나눠서)
  //    공중에서는 다른 사람과 옆으로 부딪히지 않는다: 지연 때문에 나란히 뛰면 앞사람의 늦은 모습에 걸리기 때문.
  //    머리 위로 내려앉는 것, 땅에서 서로 막히는 것은 그대로다.
  const wasGr = P.gr, h = dt / 2; let land = null, fallV = 0;
  let blockAir = block;
  if (ghosts.length) { blockAir = []; for (let i = 0; i < block.length; i++) if (block[i].ref > 0) blockAir.push(block[i]); }
  for (let k = 0; k < 2; k++) {
    if (P.saw) {
      const o = W.byId[P.saw], c = Math.cos(o.th);
      if (bodyMoveX(W, P, block, P.vx * h)) P.vx = 0;
      const s = (P.x + PW / 2 - o.px) / c;
      if (abs(s) > o.L + 2) { P.saw = 0; P.gRef = 0; P.vy = 0; land = null; continue; }      // 끝에서 내려옴
      P.sawS = s; P.vy = 0;
      if (!sawSeat(P, W, o, objs)) { P.saw = 0; P.gRef = 0; land = null; continue; }
      land = { ref: o.id, saw: true }; continue;
    }
    P.vy = min(P.vy + G * h, MAX_FALL);
    if (bodyMoveX(W, P, wasGr && !P.jumping && !opt.noBlock ? block : blockAir, P.vx * h)) P.vx = 0;
    const vy0 = P.vy, dy = P.vy * h, r = bodyMoveY(W, P, block, dy);
    land = null;
    if (r.land) { land = r.land; if (vy0 > fallV) fallV = vy0; P.vy = 0; }
    else if (r.bump) { if (P.vy < 0) P.vy = 0; }
    else if (dy >= 0) {                                                                  // 시소 판 위로 내려앉는지
      const cx = P.x + PW / 2, by = P.y + PH;
      for (const o of W.saws) {
        const s = (cx - o.px) / Math.cos(o.th); if (abs(s) > o.L) continue;
        const sy = o.py + s * Math.sin(o.th) - SAW_TH / 2;
        if (by >= sy - 0.5 && by - dy <= sy + 8) {
          P.saw = o.id; P.sawS = s; P.y = sy - PH; land = { ref: o.id, saw: true };
          if (!wasGr && vy0 > 200) { P.ldSeq++; P.ldObj = o.id; P.ldV = vy0; P.ldS = s; }
          if (vy0 > fallV) fallV = vy0; P.vy = 0; break;
        }
      }
    }
  }

  // 6. 바닥 상태
  if (land) {
    if (!wasGr && fallV > 260) { ev.push(['land', fallV]); P.land = 0.16; }
    P.gr = true; P.coy = 0.09;
    if (land.saw) { P.gRef = land.ref; P.gOff = P.sawS; P.mat = '#'; }
    else if (land.ref) {
      P.gRef = land.ref; P.gOff = P.x - land.s.x; P.mat = '#';
      if (land.ref < 0 && !wasGr && fallV > 200) {                                          // 시소 위에 선 친구 머리로 뛰어내렸으면 그 자리에 '꽝'
        const q = land.s, qx = q.x + PW / 2, qy = q.y + PH;
        for (const o of W.saws) { const sv = (qx - o.px) / Math.cos(o.th); if (abs(sv) <= o.L && abs(qy - (o.py + sv * Math.sin(o.th) - SAW_TH / 2)) < 10) { P.ldSeq++; P.ldObj = o.id; P.ldV = fallV; P.ldS = sv; break; } }
      }
    }
    else {
      P.gRef = 0; P.gOff = 0; P.mat = W.ch(floor((P.x + PW / 2) / T), land.ty);
      const cx = P.x + PW / 2, by = P.y + PH;
      for (const b of W.btns) if (!b.boxOnly && cx >= b.x && cx <= b.x + b.w && abs(by - b.y) < 3) { P.gRef = b.id; P.gOff = P.x - b.x; break; }
    }
  } else {
    if (wasGr && !P.jumping) P.vx += supVx;
    P.gr = false; P.gRef = 0; if (P.coy > 0) P.coy -= dt;
  }

  // 7. 닿으면 일어나는 일
  if (P.y > W.h + 80) { die(P, 'fall'); return; }
  {
    const x0 = floor(P.x / T), x1 = floor((P.x + PW - 0.01) / T), y0 = floor(P.y / T), y1 = floor((P.y + PH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (W.ch(tx, ty) === '^' && P.y + PH > ty * T + 14 && P.x + PW > tx * T + 5 && P.x < tx * T + 27) { die(P, 'spike'); return; }
    for (const z of W.waters) if (P.x + PW > z.x && P.x < z.x + z.w && P.y + PH > z.y + 15 && P.y < z.y + z.h) { die(P, 'water'); return; }
    for (const f of W.fires) if (f.out < 0.55 && P.x + PW > f.x + 6 && P.x < f.x + f.w - 6 && P.y + PH > f.y + 8 && P.y < f.y + f.h) { die(P, 'fire'); return; }
    for (const f of W.flags) if (f.idx > P.ck && P.x + PW > f.x - 6 && P.x < f.x + 26 && P.y + PH > f.y - 70 && P.y < f.y + 2) { P.ck = f.idx; ev.push(['flag', f.idx]); }
    const k = W.key; P.want = false; P.ul = false;
    if (k && !k.used && k.hd < 0 && P.x + PW > k.x - 4 && P.x < k.x + 26 && P.y + PH > k.y - 4 && P.y < k.y + 30) P.want = true;
    const e = W.exit;
    if (e) {
      const at = P.x + PW / 2 > e.x && P.x + PW / 2 < e.x + e.w && P.y + PH > e.y + 8 && P.y < e.y + e.h;
      P.atExit = at && !!e.open;
      // 열쇠로 문 열기는 문 바로 옆에만 닿아도 된다 (친구들이 문 앞을 막고 서 있어도 열 수 있게)
      if (!e.open && k && k.hd === P.slot && P.x + PW > e.x - 26 && P.x < e.x + e.w + 26 && P.y + PH > e.y + 8 && P.y < e.y + e.h) P.ul = true;
      if (at && e.open && inp.en && !frozen) { P.fin = true; P.gRef = 0; P.hRef = 0; P.pu = 0; P.saw = 0; ev.push(['enter']); return; }
    }
  }

  // 8. 무엇을 밀고 있나 (알릴 내용)
  let hRef = 0, pu = 0;
  if (P.gr && dir) {
    const probe = { x: P.x + dir * 1.5, y: P.y + 2, w: PW, h: PH - 4 };
    let cur = null;
    for (let i = 0; i < block.length; i++) if (ov(probe, block[i]) && !ov(P, block[i])) { cur = block[i]; break; }
    if (cur) {
      hRef = cur.ref; P.hOff = P.x - cur.x;
      let depth = 0;
      while (cur && cur.ref < 0 && depth++ < 6) {                                         // 앞사람을 거쳐 상자까지 이어지는지
        const g = cur, q = { x: g.x + dir * 7, y: g.y + 2, w: g.w, h: g.h - 4 }; let nx = null;
        for (let i = 0; i < block.length; i++) {                                           // 가장 앞에 있는 것을 고른다 (둘이 포개져 있어도 서로 오가지 않게)
          const s = block[i]; if (s === g || !ov(q, s)) continue;
          if (s.ref > 0) { nx = s; break; }
          if ((dir > 0 ? s.x > g.x + 2 : s.x < g.x - 2) && (!nx || (dir > 0 ? s.x > nx.x : s.x < nx.x))) nx = s;
        }
        cur = nx;
      }
      if (cur && cur.ref > 0 && cur.obj && cur.obj.type === 'box') pu = cur.ref * dir;
    }
  }
  if (pu) { P.puKeep = pu; P.puT = 0.2; }
  else if (P.puT > 0 && P.gr && dir && sign(P.puKeep) === dir) { P.puT -= dt; pu = P.puKeep; }
  else P.puT = 0;
  P.hRef = hRef; P.pu = pu;

  // 9. 기록
  if (pu) { const b = W.byId[abs(pu)]; P.stat[0] += dt; if (b && ((pu > 0 && b.fl > b.fr) || (pu < 0 && b.fr > b.fl))) P.stat[1] += dt; }
  if (riders) P.stat[3] += dt * riders;
  if (P.gRef > 0) { const b = W.byId[P.gRef]; if (b && b.type === 'box' && (b.fr || b.fl)) P.stat[4] += dt; }
}

/* 발사(시소·용수철): 내가 타고 있었다면 튀어 오른다 */
function applyKicks(P, W, now) {
  for (const o of W.kickers) {
    const seen = P.kseen[o.id];
    if (seen === o.kq) continue;
    P.kseen[o.id] = o.kq;
    if (seen === undefined || P.dead > 0 || P.fin) continue;
    let v = 0;
    if (o.type === 'saw') { if (P.saw === o.id && sign(P.sawS) === o.ks) v = o.launchV * o.kp * clamp(0.55 + 0.45 * abs(P.sawS) / o.L, 0, 1); }
    else if (P.gr && P.gRef === o.id && !(P.jObj === o.id && now - P.jT < 1500)) v = o.launchV * o.kp;   // 방금 이 발사대에서 뛰어내린 사람은 (늦은 통신을 기다리는 사이 다시 내려앉았어도) 같이 튀지 않는다
    if (v > 120) { P.saw = 0; P.gRef = 0; P.gr = false; P.vy = -v; P.jumping = false; P.coy = 0; P.ev.push(['launch', v]); }
  }
}

/* ───────────────────────── 함께 쓰는 장치 계산 (기준 기기만) ───────────────────────── */
function makeTotals(R) {                       // 머리 위에 올라탄 사람까지 합친 무게
  const memo = [];
  const tw = (i, d) => {
    if (memo[i] !== undefined) return memo[i];
    if ((d | 0) > 8) return 1;
    let s = 1;
    for (let j = 0; j < R.length; j++) { const q = R[j]; if (j !== i && q && q.on && q.gRef === -(i + 1)) s += tw(j, (d | 0) + 1); }
    return memo[i] = s;
  };
  return tw;
}
function ridersOn(R, slot) { let c = 0; const tw = makeTotals(R); for (let j = 0; j < R.length; j++) { const q = R[j]; if (j !== slot && q && q.on && q.gRef === -(slot + 1)) c += tw(j); } return c; }

/* 빛: 광원에서 칸 단위로 나아가다 거울에서 꺾이고, 벽·닫힌 문에서 멈춘다. 감지기에 닿으면 hit */
const BDX = [1, 0, -1, 0], BDY = [0, 1, 0, -1];
function mirrorFlip(W, m) { if ((m.soloOk && W.n <= 1) || (m.okN && W.n <= m.okN)) return m.ok | 0; return m.opt ? (m.d || 0) : ((m.d || 0) ^ (linkOn(W, m) ? 1 : 0)) & 1; }   // 0: '/'  1: '\'  (opt: 연결이 켜질 때만 나타나는 거울)   // okN: 팀이 이 인원 이하면 처음부터 맞는 쪽
function mirrorOn(W, m) { return !m.opt || linkOn(W, m); }
function traceBeam(W, src) {
  let cx = floor(src.x / T), cy = floor(src.y / T), dir = src.dir | 0; const pts = [[cx * T + 16, cy * T + 16]]; let hit = null;
  for (let step = 0; step < 400; step++) {
    const nx = cx + BDX[dir], ny = cy + BDY[dir];
    let block = nx < 0 || ny < 0 || nx >= W.cols || ny >= W.rows || W.solid(nx, ny);
    if (!block) for (const d of W.doors) { const r = rectOf(d); if (r && nx * T + 16 > r.x && nx * T + 16 < r.x + r.w && ny * T + 16 > r.y && ny * T + 16 < r.y + r.h) { block = true; break; } }
    if (block) { pts.push([cx * T + 16 + BDX[dir] * 16, cy * T + 16 + BDY[dir] * 16]); break; }
    cx = nx; cy = ny;
    const key = cy * W.cols + cx, m = W.mirrorAt[key], z = W.sensorAt[key];
    if (m && mirrorOn(W, m)) { pts.push([cx * T + 16, cy * T + 16]); dir = mirrorFlip(W, m) === 0 ? [3, 2, 1, 0][dir] : [1, 0, 3, 2][dir]; continue; }
    if (z) { pts.push([cx * T + 16, cy * T + 16]); hit = z; break; }
  }
  return { pts: pts, hit: hit };
}
function linkOn(W, o) {
  const L = o.link; if (!L || !L.length) return false;
  let any = false, all = true;
  for (let i = 0; i < L.length; i++) { const s = W.byId[L[i]]; let v = false; if (s) { if (s.type === 'btn') v = !!s.on; else if (s.type === 'pad') v = !!s.ok; else if (s.type === 'exit') v = !!s.open; else if (s.type === 'sensor' || s.type === 'relay') v = !!s.on; } any = any || v; all = all && v; }
  let r = o.mode === 'all' ? all : any;
  if (r && o.nlink) for (const id of o.nlink) { const s = W.byId[id]; if (s && s.on) { r = false; break; } }   // nlink: 이 단추가 눌리면 꺼진다 (합선 · 거꾸로 식히는 판)
  return o.inv ? !r : r;
}

function raftCap(o, n) { return n <= 1 ? 1 : (o.cap || 3); }
const subOf = (s, n) => Array.isArray(s) ? (s[min(n, s.length - 1)] | 0) : (s | 0);
function launchNeed(n, m, sub) { return min(m || 3, max(1, n - 1 - subOf(sub, n))); }   // sub: 다른 일을 맡아 빠지는 사람 수                                 // 시소 발사: 동시에 뛰어내려야 하는 사람 수

/* '동시에' 판정: 실제로 SYNC_WIN(ms) 안에 뛰었으면 동시. 통신이 느릴수록 늦게 오는 것을 조금 더 기다린다 */
const SYNC_WIN = 380;
function syncWait(W) { return SYNC_WIN + 60 + min(250, (W.lag || 0) * 0.6); }
function simWorld(W, R, dt) {
  const n = W.n, ev = W.ev, tw = makeTotals(R), ld = {}, push = {};
  for (let i = 0; i < R.length; i++) {
    const r = R[i]; if (!r || !r.on) continue;
    if (r.gRef > 0) ld[r.gRef] = (ld[r.gRef] || 0) + tw(i);
    if (r.pu) { const a = push[abs(r.pu)] || (push[abs(r.pu)] = [0, 0]); a[r.pu > 0 ? 0 : 1]++; }
  }
  const pl = Object.assign({}, ld);            // 사람 무게만
  for (const b of W.boxes) if (!(b.rs > 0) && b.sup) ld[b.sup] = (ld[b.sup] || 0) + b.wt + (pl[b.id] || 0);

  for (const o of W.objs) {
    if (o.type === 'lift') {
      const ox = o.x, oy = o.y;
      if (o.link) { const tg = (o.solo && n <= 1 ? (ld[o.id] || 0) > 0 : linkOn(W, o)) && !(o.cap && (ld[o.id] || 0) > o.cap) ? 1 : 0;   // cap: 이보다 무거우면 뜨지 못한다
        o.t = approach(o.t, tg, (tg < o.t ? o.down || 1 : 1) * o.speed * dt / o.len); }   // down: 식으면 이만큼 빨리 내려온다
      else if (o.wait > 0) o.wait -= dt;
      else { o.t += o.dirn * o.speed * dt / o.len; if (o.t >= 1) { o.t = 1; o.dirn = -1; o.wait = o.pause || 1; } else if (o.t <= 0) { o.t = 0; o.dirn = 1; o.wait = o.pause || 1; } }
      o.x = lerp(o.x1, o.x2, o.t); o.y = lerp(o.y1, o.y2, o.t); o.mdx = o.x - ox; o.mdy = o.y - oy;
    } else if (o.type === 'raft') {
      const ox = o.x, oy = o.y, w = ld[o.id] || 0, who = pl[o.id] || 0, cap = raftCap(o, n), per = o.per * (n <= 1 ? o.soloPer || 2 : 1);
      o.load = w;
      if (o.st !== 4 && w > cap) { o.st = 4; o.tmr = 0; }
      switch (o.st) {
        case 0: if (who >= 1 && w === o.lw) { o.tmr += dt; if (o.tmr > (o.go || 1)) { o.st = 1; o.tmr = 0; } } else o.tmr = 0; break;   // 나루: 타는 사람이 더 없으면 1초(go) 뒤 출발
        case 1: o.x = min(o.x2, o.x + o.speed * dt); if (o.x >= o.x2) { o.st = 2; o.tmr = 0; } else if (who === 0) { o.tmr += dt; if (o.tmr > 0.9) { o.st = 3; o.tmr = 0; } } else o.tmr = 0; break;
        case 2: if (who === 0) { o.tmr += dt; if (o.tmr > 1.2) { o.st = 3; o.tmr = 0; } } else o.tmr = 0; break;               // 건너편
        case 3: o.x = max(o.x1, o.x - o.speed * 1.7 * dt); if (o.x <= o.x1) { o.st = 0; o.tmr = 0; } break;                    // 돌아옴
        case 4: o.sink = min(90, o.sink + 70 * dt); if (o.sink >= 60 && who === 0) { o.tmr += dt; if (o.tmr > 1) { o.x = o.x1; o.sink = 0; o.st = 0; o.tmr = 0; o.y = o.wy - o.rise; } } break;   // 가라앉음
      }
      o.lw = w;
      const ty = o.wy - (o.rise - per * min(w, cap)) + o.sink;
      o.y = o.st === 4 ? ty : approach(o.y, ty, 60 * dt);
      o.mdx = abs(o.x - ox) > 90 ? 0 : o.x - ox; o.mdy = abs(o.x - ox) > 90 ? 0 : o.y - oy;
    } else if (o.type === 'pad') {
      const w = ld[o.id] || 0, per = o.maxc / n, tgt = min(o.maxc, w * per), oc = o.comp;
      o.load = w;
      if (o.mode === 'launch') {
        for (let i = 0; i < R.length; i++) { const r = R[i]; if (r && r.jObj === o.id && r.jSeq !== (o.jseen[i] || 0)) { o.jseen[i] = r.jSeq; o.rel.push(r.jTc); } }
        if (o.rel.length && !(o.relT > 0)) { o.relT = 1; o.rOpen = W.now || 0; }
        if (o.relT > 0 && (W.now || 0) - o.rOpen >= syncWait(W)) {                       // 늦게 도착한 것까지 기다렸다가, 실제로 거의 같은 때 뛴 사람 수만큼 튕긴다
          const t0 = Math.min.apply(null, o.rel); let c = 0; for (const t of o.rel) if (t - t0 <= SYNC_WIN) c++;
          const rem = max(1, (o.full || w) - c);                                       // 남은 무게는 '뛰기 직전 무게 - 함께 뛴 사람'으로 센다 (통신이 늦어 뛴 사람이 벌써 다시 내려앉은 것으로 보여도 손해 보지 않게)
          if (w >= 1 && c >= 1) { o.kq++; o.kp = r2(min(1, c / max(1, n - 1 - subOf(o.nsub, n))) / Math.sqrt(rem)); o.comp = max(0, tgt - 8); }   // nsub: 다른 일을 맡아 빠지는 사람 수만큼 덜 뛰어도 된다
          o.rel.length = 0; o.relT = 0;
        }
        if (!(o.relT > 0)) o.full = w;                                                   // 뛰기 전까지의 무게
      } else if (o.minN && n < o.minN) { o.ok = 1; o.want = 0; } else {                   // 저울: 딱 맞는 무게가 잠깐 유지되면 켜진다 (minN: 인원이 적으면 필요 없는 저울)
        const want = needOf(o.eq, n), st = o.stabT || 0.25;                                // st: 딱 맞은 채로 버텨야 하는 시간 (하드는 더 길다)
        if (w === want) o.stab = min(st + 1, o.stab + dt); else o.stab = 0;
        if (n <= 1 && o.stab > st) o.lat = 1;
        o.ok = o.stab > st || (o.lat && n <= 1) ? 1 : 0; o.want = want;
      }
      o.lastLd = w;
      if (!(o.relT > 0)) o.comp = approach(o.comp, tgt, 240 * dt);
      o.mdx = 0; o.mdy = o.comp - oc;
    }
  }

  for (const b of W.boxes) simBox(W, b, dt, push[b.id], pl[b.id] || 0);

  for (const b of W.btns) {
    if (b.minN && n < b.minN) { b.on = 1; b.load = 0; continue; }                     // 팀 인원이 적으면 이 단추는 필요 없다 (늘 켜진 것으로)
    let w = b.boxOnly ? 0 : (pl[b.id] || 0);
    const ovm = b.ov || 6;                                                                // ov: 상자가 단추와 이만큼은 겹쳐야 눌린다
    if (b.only !== undefined) {                                                           // 색 단추: 그 색 친구가 직접 올라서야만 눌린다 (다른 친구·상자는 안 된다)
      const L = W.who || []; b.own = L.length ? L[b.only % L.length] : -1;
      const r = b.own >= 0 ? R[b.own] : null; w = r && r.on && r.gRef === b.id ? 1 : 0;
    }
    else for (const x of W.boxes) if (!(x.rs > 0) && x.gr && abs(x.y + x.h - b.y) < 3 && x.x < b.x + b.w - ovm && x.x + x.w > b.x + ovm) w += x.wt + (b.boxOnly ? 0 : (pl[x.id] || 0));
    const on = w >= needOf(b.need, n);
    if (b.latchT) { b.hold = on ? b.hold + dt : 0; if (b.hold >= b.latchT) b.lat = 1; }   // 한동안 눌린 채로 있으면 딸깍 고정
    else if ((b.latch || (b.soloLatch && n <= 1) || (b.latchN && n <= b.latchN)) && on) b.lat = 1;   // latchN: 팀이 이 인원 이하면 한 번 밟으면 고정
    b.on = on || b.lat ? 1 : 0; b.load = min(15, w);
  }
  for (const z of W.relays) { if (z.mom) { z.on = linkOn(W, z) ? 1 : 0; continue; } z.hold = linkOn(W, z) ? z.hold + dt : 0; if (z.hold >= (z.latchT || 1)) z.on = 1; }   // mom: 고정되지 않는 이음 (조건이 맞는 동안만)
  for (const z of W.sensors) z.lit = 0;
  for (const src of W.beams) { const r = traceBeam(W, src); if (r.hit) r.hit.lit = 1; }
  for (const z of W.sensors) { z.hold = z.lit ? z.hold + dt : 0; if (z.mom) z.on = z.hold >= (z.latchT || 0.1) ? 1 : 0; else if (z.hold >= (z.latchT || 0.6)) z.on = 1; }   // mom: 빛이 닿아 있는 동안만 (아니면 잠깐 머물면 딸깍 켜진 채로)
  for (const d of W.doors) { const tg = linkOn(W, d) ? 1 : 0; d.open = approach(d.open, tg, dt * (tg < d.open && d.rc ? d.rc : (d.rate || (d.fast ? 4 : 2.2)))); }   // rc: 닫히는(다시 어는) 빠르기
  for (const f of W.fires) { const tg = linkOn(W, f) || (f.stay && f.out >= 1) ? 1 : 0; f.out = approach(f.out, tg, dt * (tg < f.out && f.rc ? f.rc : (f.rate || 1.6))); }   // 불: 연결된 조건이 맞는 동안 꺼져 있다 (stay: 한 번 꺼지면 그대로, rc: 다시 붙는 빠르기)

  for (const o of W.saws) {
    if (o.solo && n <= 1) { o.th = approach(o.th, 0, dt * 2); o.om = 0; o.pend.length = 0; continue; }   // 혼자 연습: 판을 수평으로 묶어 둔다
    let tq = 0, I = o.I0, lw = 0, rw = 0;
    for (let i = 0; i < R.length; i++) {
      const r = R[i]; if (!r || !r.on) continue;
      if (r.gRef === o.id) { const w = tw(i), s = clamp(r.gOff, -o.L, o.L); tq += w * s; I += w * s * s; if (s < 0) lw += w; else rw += w; }
      if (r.ldObj === o.id && r.ldSeq !== (o.seen[i] || 0)) { o.seen[i] = r.ldSeq; if (r.ldV >= 200) o.pend.push({ s: r.ldS, v: r.ldV, i: i }); }
    }
    if (o.pend.length && o.win <= 0) { o.win = 0.32; o.winTh = o.th; }
    if (o.win > 0) {
      o.win -= dt;
      if (o.win <= 0) {                                                                  // 뛰어내린 힘을 모아 반대쪽을 튕겨 올린다
        let pr = 0, pL = 0;
        for (const p of o.pend) { const v = clamp(p.v / o.vref, 0, 1), c = v * v * clamp(abs(p.s) / (0.4 * o.L), 0, 1); if (p.s > 0) pr += c; else pL += c; }
        const who = o.pend.map(p => p.i); o.pend.length = 0; o.win = 0;
        const side = pr >= pL ? 1 : -1, pw = max(pr, pL), wasUp = side > 0 ? o.winTh < 0.3 * o.lo : o.winTh > 0.3 * o.hi;
        let riders = 0;                                                                // 반대쪽에 탄 사람 (방금 뛰어내린 사람 자신은 빼고: 제 힘으로 저를 쏘아 올릴 수는 없다)
        for (let i = 0; i < R.length; i++) { const r = R[i]; if (r && r.on && r.gRef === o.id && sign(r.gOff) === -side && who.indexOf(i) < 0) riders += tw(i); }
        if (wasUp && riders > 0 && pw > 0.15) { o.kq++; o.ks = -side; o.kp = r2(min(1, pw / launchNeed(n, o.nmax, o.nsub))); o.om = side * 11; }
      }
    }
    let al = G * tq * Math.cos(o.th) / I;
    if (lw + rw === 0 && o.rest !== undefined) al += -22 * (o.th - o.rest);
    o.om += al * dt; o.om *= max(0, 1 - 3 * dt); o.th += o.om * dt;
    if (o.th > o.hi) { o.th = o.hi; if (o.om > 0) o.om = 0; } else if (o.th < o.lo) { o.th = o.lo; if (o.om < 0) o.om = 0; }
  }

  // 열쇠와 나가는 문
  const k = W.key, e = W.exit;
  if (k && !k.used) {
    if (k.hd >= 0) { const r = R[k.hd]; if (!r || !r.on) { k.hd = -1; k.x = k.hx; k.y = k.hy; } }
    if (k.hd < 0) for (let i = 0; i < R.length; i++) if (R[i] && R[i].on && R[i].want) { k.hd = i; break; }
    if (e && !e.open && k.hd >= 0 && R[k.hd] && R[k.hd].ul) { e.open = 1; k.used = 1; k.hd = -1; }
  }
}

function simBox(W, b, dt, pu, riders) {
  const n = W.n;
  if (b.rs > 0) { b.rs -= dt; b.fr = b.fl = 0; if (b.rs <= 0) { b.rs = 0; b.x = b.hx; b.y = b.hy; b.vx = b.vy = 0; b.sup = 0; b.gr = 1; } return; }
  const pr = pu ? pu[0] : 0, pL = pu ? pu[1] : 0, net = pr - pL;
  b.fr = min(7, pr); b.fl = min(7, pL);
  if (b.sup) { const s = W.byId[b.sup]; if (s) { b.x += s.mdx || 0; b.y += s.mdy || 0; } }
  let mat = '#';
  if (b.gr && !b.sup) {
    const ty = floor((b.y + b.h + 1) / T); let c = W.ch(floor((b.x + b.w / 2) / T), ty);
    if (c !== 'I' && c !== 'S' && c !== '#') { const l = W.ch(floor((b.x + 1) / T), ty), r = W.ch(floor((b.x + b.w - 1) / T), ty); c = l === 'I' || r === 'I' ? 'I' : l === 'S' || r === 'S' ? 'S' : c; }   // 가운데가 구덩이 위면 받치고 있는 쪽 바닥으로
    if (c === 'I' || c === 'S') mat = c;
  }
  b.ice = mat === 'I' ? 1 : 0;
  let need = mat === 'I' ? 1 : mat === 'S' ? max(needOf(b.need, n), needOf(b.needS || 'all', n)) : needOf(b.need, n);
  if (mat !== 'I') need += riders;                                                       // 위에 올라타면 그만큼 무거워진다
  b.nd = min(15, need);
  if (b.gr) {
    if (mat === 'I') { b.vx = clamp(approach(b.vx + net * 150 * dt, 0, 24 * dt), -170, 170); }
    else { const tgt = abs(net) >= need ? sign(net) * (52 + 22 * min(3, abs(net) - need)) : 0; b.vx = approach(b.vx, tgt, (tgt ? 260 : 700) * dt); }
  }
  b.vy = min(b.vy + G * dt, 900);
  const S = [];
  for (const o of W.objs) { if (o === b || !SOLID[o.type]) continue; const r = rectOf(o); if (r) S.push({ x: r.x, y: r.y, w: r.w, h: r.h, ref: o.id }); }
  if (b.vx && bodyMoveX(W, b, S, b.vx * dt)) b.vx = 0;
  const r = bodyMoveY(W, b, S, b.vy * dt);
  if (r.land) { b.vy = 0; b.gr = 1; b.sup = r.land.ref || 0; } else { b.gr = 0; b.sup = 0; if (r.bump) b.vy = 0; }
  if (b.y > W.h + 60) b.rs = 1.2;
  else for (const z of W.waters) if (b.x + b.w / 2 > z.x && b.x + b.w / 2 < z.x + z.w && b.y + b.h > z.y + 22) { b.rs = 1.2; break; }
}

/* ───────────────────────── 받은 상태를 부드럽게 잇기 ───────────────────────── */
function Stream(fixed) { this.buf = []; this.off = Infinity; this.delay = fixed || 70; this.fixed = fixed || 0; this.ivl = 66; this.jit = 0; this.lastRecv = 0; this.lastT = -1; }
Stream.prototype.push = function (t, d, now) {
  const raw = now - t;
  if (this.lastT >= 0 && t < this.lastT - 2000) { this.buf.length = 0; this.off = Infinity; this.lastT = -1; }   // 보낸 기기가 새로 고침함(시계가 되돌아감)
  if (this.off === Infinity) this.off = raw;
  else { this.off += (now - this.lastRecv) * 0.0003; if (raw < this.off) this.off = raw; }
  this.jit += (raw - this.off - this.jit) * 0.1;
  if (this.lastT >= 0 && t > this.lastT && t - this.lastT < 150) this.ivl += (t - this.lastT - this.ivl) * 0.15;
  this.lastRecv = now; if (t > this.lastT) this.lastT = t;
  const b = this.buf; let i = b.length;
  while (i > 0 && b[i - 1].t > t) i--;
  if (i > 0 && b[i - 1].t === t) return;
  b.splice(i, 0, { t: t, d: d });
  while (b.length > 40) b.shift();
};
Stream.prototype.sample = function (now) {
  const b = this.buf; if (!b.length) return null;
  if (!this.fixed) { const want = clamp(1.3 * this.ivl + 2 * this.jit + 6, opt.slim ? 14 : 30, 420); this.delay += clamp(want - this.delay, -0.8, 0.8); }   // 받은 간격·흔들림에 맞춰 가장 짧게 (slim: 한 기기 안의 혼자 연습)
  const tr = now - this.off - this.delay;
  while (b.length > 2 && b[1].t <= tr) b.shift();
  if (b.length === 1 || tr <= b[0].t) return { a: b[0].d, b: b[0].d, k: 0 };
  const a = b[0], c = b[1];
  if (tr >= c.t) return { a: c.d, b: c.d, k: 0 };
  const gap = this.fixed ? 400 : 160, t0 = c.t - a.t > gap ? c.t - 70 : a.t;         // 한참 가만히 있다 움직이면 그 순간부터 잇는다
  return { a: a.d, b: c.d, k: clamp((tr - t0) / (c.t - t0), 0, 1) };
};

function Ghost(slot) {
  this.slot = slot; this.st = new Stream(); this.rep = null; this.cur = null; this.last = -1e9; this.seq = -1;
  this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.dx = 0; this.dy = 0; this.vis = false; this.present = false; this.fresh = true; this.stat = null;
  this.sol = { ref: -(slot + 1), x: 0, y: 0, w: PW, h: PH, dx: 0, dy: 0, obj: null };
}

/* ───────────────────────── 한 팀(한 기기)의 게임 ─────────────────────────
   o: { slot, slots:[팀의 자리 번호들], stages:[스테이지 id], build(id)->def, seq0 }                    */
const lseed = (seed, stage) => seed ? (((seed | 0) * 7919) ^ (stage * 104729)) >>> 0 || 1 : 0;
function Team(o) {
  this.slot = o.slot; this.slots = o.slots.slice().sort((a, b) => a - b); this.idx = this.slots.indexOf(o.slot);
  this.stages = o.stages; this.build = o.build;
  this.me = new Player(o.slot); this.ghosts = {}; this.gs = [];
  for (const s of this.slots) if (s !== o.slot) this.ghosts[s] = new Ghost(s);
  this.TS = { stage: 0, run: 0, ph: PH_WAIT, tm: 0, ck: 0, n: this.slots.length, cd: 0, cl: [], sk: [] };
  this.W = null; this.anchor = false; this.epoch = 0; this.seenEp = 0; this.aSlot = -1; this.lastW = -1e9; this.t0 = -1; this.ws = new Stream(); this.wq = -1;
  this.out = []; this.ev = []; this.seq = o.seq0 || 0; this.wseq = o.seq0 || 0; this.lastPT = -1e9; this.lastWT = -1e9; this.lastVT = -1e9; this.lastP = null; this.lastO = ''; this.statT = 0;
  this.hist = []; this.selfDelay = 0; this.R = []; this.live = null; this.tmAt = 0; this.cd0 = 3; this.skipReq = -1; this.lastRestart = -1e9; this.now = 0;
  this.pIvl = 66; this.wIvl = 83; this.vIvl = 200; this.burst = 0; this.team = o.team | 0; this.spect = !!o.spect;
  this.late = !!o.late; this.heard = false; this.seed = o.seed | 0; this.df = o.df | 0;                    // seed: 같은 팀은 같은 값(방의 게임 번호) → 같은 배치                                              // late: 게임 중간에 (다시) 들어옴. heard: 팀 상태를 한 번이라도 받음
  this.load();
}
Team.prototype.sr = function () { return this.TS.stage * 64 + (this.TS.run % 64); };
/* 팀 구성이 바뀜 (늦게 들어온 사람, 내보낸 사람) */
Team.prototype.setSlots = function (slots) {
  const set = slots.slice().sort((a, b) => a - b);
  for (const s of set) if (s !== this.slot && !this.ghosts[s]) this.ghosts[s] = new Ghost(s);
  for (const k of Object.keys(this.ghosts)) if (set.indexOf(+k) < 0) delete this.ghosts[k];
  this.slots = set; this.idx = max(0, set.indexOf(this.slot));
};
/* 다시 시작 투표: [찬성 수, 지금 인원] */
Team.prototype.votes = function () { let v = this.me.vote ? 1 : 0, n = 1; for (const s of this.slots) if (s !== this.slot) { const g = this.ghosts[s]; if (g.present) { n++; if (g.rep && g.rep.vote && g.rep.sr === this.sr()) v++; } } return [v, n]; };
Team.prototype.load = function (wipe) {                                                  // wipe: 연대 책임으로 판을 처음 모습으로 되돌리고 TS.ck 깃발에서 다시
  const TS = this.TS, me = this.me;
  const ls = lseed(this.seed, TS.stage); this.W = new World(this.build(this.stages[TS.stage], ls, this.df));
  this.lkey = this.stages[TS.stage] + ':' + ls + ':' + this.df + ':' + this.W.objs.length + ':' + VERSION;
  this.W.n = TS.n; this.ws = new Stream(); this.hist.length = 0;
  me.fin = false; me.ck = TS.ck | 0; me.vote = 0; me.ldSeq = 0; me.ldObj = 0; me.kseen = {}; me.want = false; me.ul = false; me.atExit = false;
  for (const o of this.W.kickers) me.kseen[o.id] = 0;
  spawnAt(me, this.W, this.idx, me.ck);
  this.ev.push(['stage', TS.stage, wipe ? 1 : 0]);
};
/* 선생님이 시작을 누름. first: 내가 첫 기준 기기로 지정됨 */
Team.prototype.start = function (now, first) { this.t0 = now; if (first && !this.anchor && this.seenEp === 0) this.becomeAnchor(); };
Team.prototype.becomeAnchor = function () {
  this.anchor = true; this.epoch = this.seenEp + 1; this.seenEp = this.epoch; this.aSlot = this.slot;
  if (this.TS.ph === PH_WAIT) { this.TS.ph = PH_READY; this.TS.cd = this.cd0; }
  for (const o of this.W.saws) for (const s of this.slots) { const g = this.ghosts[s]; if (g && g.rep) o.seen[s] = g.rep.ldSeq; }
  for (const o of this.W.objs) if (o.type === 'pad') { o.relT = 0; o.relSum = 0; o.rel = []; for (const s of this.slots) { const g = this.ghosts[s]; if (g && g.rep) o.jseen[s] = g.rep.jSeq; } }
};
Team.prototype.role = function (now) {
  if (this.anchor || this.t0 < 0) return;
  const quiet = now - max(this.lastW, this.t0);
  let rank = 0, here = 0; for (const s of this.slots) if (s !== this.slot && this.ghosts[s] && now - this.ghosts[s].last < 3000) { here++; if (s < this.slot) rank++; }
  // 중간에 (다시) 들어온 기기는 팀이 어디까지 왔는지 모른다. 팀원이 있으면 그쪽이 이어받을 때까지 기다린다
  // (새로 고침한 기준 기기가 빈 상태로 먼저 나서면 팀 전체가 첫 스테이지로 돌아가 버린다)
  const wait = this.late && !this.heard && here ? 7000 : this.seenEp === 0 ? 1200 : 1800;
  if (quiet > wait + 500 * rank) this.becomeAnchor();
};
Team.prototype.onPlayer = function (from, p, now) {
  const g = this.ghosts[from]; if (!g || !p) return;
  if (p[0] <= g.seq && g.seq - p[0] < 2000) return;                                       // 늦게 왔거나 겹친 것
  g.seq = p[0]; g.last = now;
  const fl = p[7];
  const rep = { t: p[1], sr: p[2], x: p[3], y: p[4], vx: p[5], vy: p[6], gr: fl & 1, face: fl & 2 ? -1 : 1, dead: !!(fl & 4), fin: !!(fl & 8), want: !!(fl & 16), ul: !!(fl & 32), vote: !!(fl & 64),
    dir: fl & 128 ? 1 : fl & 256 ? -1 : 0, atExit: !!(fl & 512), gRef: p[8], gOff: p[9], hRef: p[10], hOff: p[11], pu: p[12], ck: p[13], ldSeq: p[14], ldObj: p[15], ldV: p[16], ldS: p[17], em: p[18] || 0, on: false };
  if (p[19]) g.stat = p[19];
  g.rep = rep; g.st.push(rep.t, rep, now);
  // 뛰고 내려앉은 때를 내 시계로 옮긴다 (오는 데 걸린 시간을 빼서, 동시에 뛰었는지를 도착 순서가 아니라 실제 때로 가린다)
  const fix = g.st.off - this.selfDelay; rep.jSeq = p[21] | 0; rep.jObj = p[22] | 0; rep.ldTc = p[20] ? p[20] + fix : now; rep.jTc = p[23] ? p[23] + fix : now;
};
Team.prototype.onWorld = function (from, d, now) {
  if (from === this.slot || !d || !d.ts) return;
  const e = d.e | 0;
  if (this.anchor) { if (e > this.epoch || (e === this.epoch && from < this.slot)) { this.anchor = false; this.aSlot = -1; } else return; }   // 기준이 둘이면 정리
  if (e < this.seenEp) return;
  if (e === this.seenEp && from !== this.aSlot && this.aSlot >= 0 && from > this.aSlot && now - this.lastW < 1500) return;
  if (e > this.seenEp || from !== this.aSlot) { this.seenEp = e; this.aSlot = from; this.ws = new Stream(); this.wq = -1; }
  if (d.q <= this.wq && this.wq - d.q < 2000) return;
  this.wq = d.q; this.lastW = now;
  const ts = d.ts, TS = this.TS, ph0 = TS.ph, first = !this.heard; this.heard = true;
  if (ts[0] !== TS.stage || ts[1] !== TS.run) { const wipe = ts[0] === TS.stage && (ts[7] | 0) !== (TS.wp | 0); TS.stage = ts[0]; TS.run = ts[1]; TS.n = ts[5]; TS.ck = ts[4] | 0; TS.wp = ts[7] | 0; this.load(wipe); }   // 깃발에서 다시(연대 책임)면 그 깃발에서 나타난다
  TS.wp = ts[7] | 0;
  if (d.lk && d.lk !== this.lkey) { this.mism = (this.mism || 0) + 1; return; }       // 다른 판(옛 캐시·다른 배치)의 상태는 받지 않는다: 상자가 엉뚱하게 사라지는 일을 막는다
  this.mism = 0;
  TS.ph = ts[2]; TS.tm = ts[3]; TS.ck = ts[4]; TS.n = ts[5]; TS.cd = ts[6] / 100; if (d.cl) TS.cl = d.cl; if (d.sk) TS.sk = d.sk; this.tmAt = now;
  if (first && this.late && TS.ck > this.me.ck && !this.me.fin) { this.me.ck = TS.ck; spawnAt(this.me, this.W, this.idx, TS.ck); }   // 늦게 온 사람은 팀이 지난 마지막 깃발에서 시작
  if (ph0 !== TS.ph) { if (TS.ph === PH_CLEAR) this.ev.push(['clear']); else if (TS.ph === PH_DONE) this.ev.push(['done']); else if (TS.ph === PH_PLAY && ph0 === PH_READY) this.ev.push(['go']); }
  this.ws.push(d.t, d.o, now);
};
/* 화면에 보이는 경과 시간(ms) */
Team.prototype.time = function (now) { const TS = this.TS; return TS.ph === PH_PLAY && !this.anchor ? TS.tm + (now - this.tmAt) : TS.tm; };
Team.prototype.total = function (now) { let s = 0; const TS = this.TS; for (let i = 0; i < TS.cl.length; i++) s += TS.cl[i] || 0; if (TS.ph === PH_READY || TS.ph === PH_PLAY) s += this.time(now); return s; };
/* 새로 고침 대비: 지금 팀 상태를 적어 둔다 / 적어 둔 것으로 되살린다.
   팀원이 남아 있으면 그쪽 상태가 이기고(기다리다 받는다), 팀에 나 혼자였거나 모두 새로 고침했을 때만 이것으로 이어 간다 */
Team.prototype.snap = function (now) { const TS = this.TS; return { st: TS.stage, run: TS.run, ph: TS.ph, tm: r0(this.time(now)), ck: TS.ck, cl: TS.cl.slice(), sk: TS.sk.slice(), ep: this.seenEp, o: this.W.pack() }; };
Team.prototype.restore = function (s, now) {
  const TS = this.TS; if (!s || !(s.st >= 0) || s.st >= this.stages.length || this.heard) return false;
  TS.stage = s.st; TS.run = s.run | 0; TS.cl = s.cl || []; TS.sk = s.sk || []; TS.ck = s.ck | 0;
  this.load();
  if (Array.isArray(s.o) && s.o.length === this.W.objs.length) this.W.apply(s.o, s.o, 0);
  TS.tm = s.tm || 0; this.tmAt = now; this.seenEp = s.ep | 0;
  if (s.ph === PH_DONE) TS.ph = PH_DONE; else if (s.ph === PH_CLEAR) { TS.ph = PH_CLEAR; TS.cd = 1; } else { TS.ph = PH_PLAY; TS.cd = 0; }
  if (TS.ck > 0) { this.me.ck = TS.ck; spawnAt(this.me, this.W, this.idx, TS.ck); }
  return true;
};

Team.prototype.myRep = function () {
  const m = this.me;
  return { on: !(m.dead > 0) && !m.fin, sr: this.sr(), gRef: m.gRef, gOff: m.saw ? m.sawS : m.gOff, pu: m.pu, ck: m.ck, want: m.want, ul: m.ul, fin: m.fin, dead: m.dead > 0, vote: !!m.vote, ldSeq: m.ldSeq, ldObj: m.ldObj, ldV: m.ldV, ldS: m.ldS, ldTc: m.ldT, jSeq: m.jSeq, jObj: m.jObj, jTc: m.jT };
};

Team.prototype.flow = function (dt, now) {
  const TS = this.TS, sr = this.sr();
  let n = 0, fin = 0, here = 0, votes = 0, ck = TS.ck;
  for (const s of this.slots) {
    const r = s === this.slot ? this.live : (this.ghosts[s].present ? this.ghosts[s].rep : null);
    if (!r) continue; n++;
    if (r.sr !== sr) continue;
    here++; if (r.fin) fin++; if (r.vote) votes++; if (r.ck > ck) ck = r.ck;
  }
  TS.n = max(1, n); TS.ck = ck;
  if (TS.ph === PH_READY) { TS.cd -= dt; if (TS.cd <= 0) { TS.ph = PH_PLAY; TS.cd = 0; this.ev.push(['go']); } }
  else if (TS.ph === PH_PLAY) {
    TS.tm += dt * 1000;
    if (this.skipReq === TS.stage) { TS.sk[TS.stage] = 1; TS.cl[TS.stage] = r0(TS.tm) + SKIP_PEN; this.next(); }
    else if (here > 0 && here === n && fin === here) { TS.cl[TS.stage] = r0(TS.tm); TS.ph = PH_CLEAR; TS.cd = 2.4; this.ev.push(['clear']); }
    else if (votes > n / 2 && now - this.lastRestart > 3000) { this.lastRestart = now; TS.run++; TS.ck = 0; this.wipeAt = 0; this.load(); this.ev.push(['restart']); }
    else if (this.W.def.wipe && n > 1) this.wipe(now, sr);
  } else if (TS.ph === PH_CLEAR) { TS.cd -= dt; if (TS.cd <= 0) this.next(); }
};
/* 하드의 연대 책임: 누가 한 명이라도 빠지면(가시·물·불·낭떠러지) 잠깐 뒤 다 같이 그 방의 깃발로 돌아가고, 방의 장치도 처음 모습으로.
   돌아갈 깃발은 가장 뒤처진 사람의 깃발이다 (먼저 건너간 사람의 깃발로 모두 옮기면 남은 사람이 방을 건너뛰게 되므로) */
Team.prototype.wipe = function (now, sr) {
  const TS = this.TS; let dead = false, lo = 1e9;
  for (const s of this.slots) {
    const r = s === this.slot ? this.live : (this.ghosts[s].present ? this.ghosts[s].rep : null);
    if (!r || r.sr !== sr) continue;
    if (r.dead) dead = true;
    lo = min(lo, r.ck | 0);
  }
  if (dead && !(this.wipeAt > 0)) this.wipeAt = now + 650;                                 // 빠지는 모습을 잠깐 보여 주고
  if (this.wipeAt > 0 && now >= this.wipeAt) {
    this.wipeAt = 0; TS.run++; TS.ck = lo < 1e9 ? lo : 0; TS.wp = (TS.wp | 0) + 1; this.lastRestart = now;
    this.load(true); this.ev.push(['wipe']);
  }
};
Team.prototype.next = function () {
  const TS = this.TS;
  this.wipeAt = 0;
  if (TS.stage + 1 < this.stages.length) { TS.stage++; TS.run++; TS.tm = 0; TS.ck = 0; TS.ph = PH_READY; TS.cd = 1.8; this.load(); }
  else { TS.ph = PH_DONE; TS.cd = 0; this.ev.push(['done']); }
};

/* 누가 지금 같은 스테이지에서 뛰고 있는지 보고, 보고서 목록 R을 만든다 */
Team.prototype.see = function (now) {
  const sr = this.sr(), R = this.R; R.length = 0;
  for (const s of this.slots) {
    if (s === this.slot) continue;
    const g = this.ghosts[s], rep = g.rep;
    g.present = now - g.last < 5000;
    const vis = !!(g.present && rep && rep.sr === sr && !rep.dead && !rep.fin);
    if (vis && !g.vis) g.fresh = true;
    g.vis = vis; if (rep) rep.on = vis;
    R[s] = vis ? rep : null;
  }
  R[this.slot] = this.live = this.myRep();
};
Team.prototype.placeGhosts = function (now) {
  const self = this, me = this.me, W = this.W, gs = this.gs; gs.length = 0;
  const state = {};
  function who(ref) {
    const s = -ref - 1; if (s === me.slot) return me.dead > 0 || me.fin ? null : me;
    const g = self.ghosts[s]; if (!g || !g.vis) return null;
    if (!state[s]) place(g);
    return g;
  }
  function posOf(e) {
    if (e.gRef > 0) {
      const o = W.byId[e.gRef];
      if (o) { if (o.type === 'saw') { const pt = sawPoint(o, e.gOff); return [pt.x - PW / 2, pt.y - PH]; } if (o.type === 'btn') return [o.x + e.gOff, o.y - PH]; if (SOLID[o.type]) return [o.x + e.gOff, topOf(o) - PH]; }
    } else if (e.gRef < 0) { const q = who(e.gRef); if (q) return [q.x + e.gOff, q.y - PH]; }
    if (e.hRef > 0) { const o = W.byId[e.hRef]; if (o && SOLID[o.type]) return [o.x + e.hOff, e.y]; }
    else if (e.hRef < 0) { const q = who(e.hRef); if (q) return [q.x + e.hOff, e.y]; }
    return [e.x, e.y];
  }
  function place(g) {
    state[g.slot] = 1; g.px = g.x; g.py = g.y;
    const s = g.st.sample(now);
    if (s) {
      const a = posOf(s.a), b = s.k > 0 ? posOf(s.b) : a;
      if (abs(b[0] - a[0]) > 150 || abs(b[1] - a[1]) > 150) { g.x = s.k > 0.5 ? b[0] : a[0]; g.y = s.k > 0.5 ? b[1] : a[1]; }
      else { g.x = lerp(a[0], b[0], s.k); g.y = lerp(a[1], b[1], s.k); }
      g.cur = s.k > 0.5 ? s.b : s.a;
    }
    state[g.slot] = 2;
  }
  for (const s of this.slots) {
    if (s === this.slot) continue;
    const g = this.ghosts[s]; if (!g.vis) continue;
    if (!state[s]) place(g);
    if (g.fresh || abs(g.x - g.px) > 90 || abs(g.y - g.py) > 90) { g.dx = 0; g.dy = 0; g.fresh = false; } else { g.dx = g.x - g.px; g.dy = g.y - g.py; }
    const so = g.sol; so.x = g.x; so.y = g.y; so.dx = g.dx; so.dy = g.dy;
    if (!g.cur || g.cur.gr) gs.push(so);                                                   // 공중에 뜬 사람은 딛거나 막히지 않는다 (늦게 보이는 모습에 공중에서 걸리지 않게)
  }
};

/* 한 틱 (60분의 1초) */
Team.prototype.tick = function (inp, dt, now) {
  const me = this.me; this.now = now;
  this.role(now);
  this.see(now);
  const R = this.R;
  // 함께 쓰는 장치
  if (this.anchor) {
    const key = this.sr();
    this.flow(dt, now);
    if (this.sr() !== key) this.see(now);                                                // 스테이지가 바뀌었으면 다시 본다
    const W = this.W; W.n = this.TS.n;
    let mine = this.live;
    if (this.selfDelay > 20 && this.hist.length) {                                       // 내 보고도 남들만큼 늦춰서 센다(동시에 뛰기 판정을 공평하게)
      const lim = now - this.selfDelay; let h = null;
      for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= lim) { h = this.hist[i].r; break; }
      if (h) mine = Object.assign({}, this.live, { on: h.on && this.live.on, gRef: h.gRef, gOff: h.gOff, pu: h.pu, want: h.want, ul: h.ul, ldSeq: h.ldSeq, ldObj: h.ldObj, ldV: h.ldV, ldS: h.ldS });   // 내 보고도 남들만큼 늦춰 센다 (동시에 뛰기 판정을 공평하게)
    }
    const RA = R.slice(); RA[this.slot] = mine;
    W.now = now; W.lag = this.selfDelay;
    W.who = this.slots.filter(s => s === this.slot || (this.ghosts[s] && this.ghosts[s].present));   // 색 단추의 주인을 정할 때 쓰는 지금 팀원 (자리 번호 순)
    if (this.TS.ph >= PH_READY && this.TS.ph <= PH_CLEAR) simWorld(W, RA, dt);
  } else {
    const s = this.ws.sample(now);
    if (s) this.W.apply(s.a, s.b, s.k);
  }
  const W = this.W, TS = this.TS; W.n = TS.n;
  W.buildSolids();
  this.placeGhosts(now);
  W.observe();
  // 내 캐릭터
  applyKicks(me, W, now);
  const ld0 = me.ldSeq, j0 = me.jSeq;
  stepPlayer(me, inp, W, this.gs, dt, { riders: ridersOn(R, this.slot), frozen: TS.ph !== PH_PLAY, ck: TS.ck, idx: this.idx });
  if (me.ldSeq !== ld0) me.ldT = now; if (me.jSeq !== j0) me.jT = now;
  const rep = this.myRep(); this.hist.push({ t: now, r: rep }); while (this.hist.length > 80) this.hist.shift();
  // 열쇠는 든 사람 머리 위에
  const k = W.key;
  if (k && k.hd >= 0 && !k.used) { const q = k.hd === this.slot ? me : (this.ghosts[k.hd] && this.ghosts[k.hd].vis ? this.ghosts[k.hd] : null); if (q) { k.x = q.x + 1; k.y = q.y - 30; } }
  for (const e of me.ev) this.ev.push(e); me.ev.length = 0;
  for (const e of W.ev) this.ev.push(e); W.ev.length = 0;
  this.send(now);
};

Team.prototype.packMe = function (now) {
  const m = this.me;
  const fl = (m.gr ? 1 : 0) | (m.face < 0 ? 2 : 0) | (m.dead > 0 ? 4 : 0) | (m.fin ? 8 : 0) | (m.want ? 16 : 0) | (m.ul ? 32 : 0) | (m.vote ? 64 : 0) | (m.dir > 0 ? 128 : m.dir < 0 ? 256 : 0) | (m.atExit ? 512 : 0);
  return [0, r0(now), this.sr(), r1(m.x), r1(m.y), r0(m.vx), r0(m.vy), fl, m.gRef, r1(m.saw ? m.sawS : m.gOff), m.hRef, r1(m.hOff), m.pu, m.ck, m.ldSeq, m.ldObj, r0(m.ldV), r1(m.ldS), m.em, 0, r0(m.ldT), m.jSeq, m.jObj, r0(m.jT)];
};
Team.prototype.send = function (now) {
  const p = this.packMe(now); let same = !!this.lastP;
  if (same) for (let i = 2; i < p.length; i++) if (p[i] !== this.lastP[i]) { same = false; break; }
  const quick = !!this.lastP && (p[14] !== this.lastP[14] || p[8] !== this.lastP[8]);            // 착지·점프는 바로 (동시에 뛰기 판정이 늦지 않게)
  if (quick) this.burst = 2;
  const again = same && this.burst > 0 && now - this.lastPT >= 45;                           // 소식 하나가 사라져도 늦지 않게 두 번 더
  if (quick || again || now - this.lastPT >= (same ? 330 : this.pIvl)) {
    if (again) this.burst--;
    p[0] = ++this.seq;
    if (now - this.statT > 1500) { this.statT = now; p[19] = this.me.stat.map(r1); }
    this.lastP = p; this.lastPT = now; this.out.push(['p', p]);
  }
  if (!this.anchor) return;
  const TS = this.TS, o = this.W.pack(), key = JSON.stringify(o) + TS.ph + TS.stage + ':' + TS.run + ':' + TS.ck + ':' + TS.n;
  if (now - this.lastWT >= (key === this.lastO ? 250 : this.wIvl)) {
    this.lastO = key; this.lastWT = now;
    this.out.push(['w', { lk: this.lkey, e: this.epoch, q: ++this.wseq, t: r0(now), ts: [TS.stage, TS.run, TS.ph, r0(TS.tm), TS.ck, TS.n, r0(TS.cd * 100), TS.wp | 0], cl: TS.cl, sk: TS.sk, o: o }]);
  }
  if (this.spect && now - this.lastVT >= this.vIvl) {
    this.lastVT = now;
    const pl = [], st = {}; const m = this.me;
    const fo = q => (q.gr ? 1 : 0) | (q.face < 0 ? 2 : 0) | (q.dir ? 4 : 0);
    if (!(m.dead > 0) && !m.fin) pl.push([this.slot, r0(m.x), r0(m.y), fo(m)]);
    st[this.slot] = m.stat.map(r1);
    for (const s of this.slots) if (s !== this.slot) { const g = this.ghosts[s]; if (g.vis) pl.push([s, r0(g.x), r0(g.y), fo(g.cur || g.rep)]); if (g.stat) st[s] = g.stat; }
    let present = 0; for (const s of this.slots) if (s === this.slot || this.ghosts[s].present) present |= 1 << s;
    this.out.push(['v', { lk: this.lkey, k: this.team, a: this.slot, t: r0(now), ts: [TS.stage, TS.run, TS.ph, r0(TS.tm), TS.ck, TS.n, r0(TS.cd * 100), TS.wp | 0], cl: TS.cl, sk: TS.sk, o: o, pl: pl, st: st, pr: present }]);
  }
};
/* 그릴 사람들 */
Team.prototype.people = function () {
  const out = [], m = this.me, W = this.W, k = W.key;
  for (const s of this.slots) {
    if (s === this.slot) { if (!m.fin) out.push({ slot: s, me: true, x: m.x, y: m.y, face: m.face, gr: m.gr, vx: m.vx, vy: m.vy, dir: m.dir, push: !!m.hRef, dead: m.dead > 0, riders: m.riders, land: m.land, key: !!(k && k.hd === s), em: m.em }); }
    else { const g = this.ghosts[s]; if (!g.vis) continue; const c = g.cur || g.rep; out.push({ slot: s, me: false, x: g.x, y: g.y, face: c.face, gr: !!c.gr, vx: c.vx, vy: c.vy, dir: c.dir, push: !!c.hRef, dead: false, riders: 0, land: 0, key: !!(k && k.hd === s), em: c.em }); }
  }
  return out;
};

/* ───────────────────────── 선생님 화면용: 한 팀을 받아서 보여 주기 ───────────────────────── */
function Viewer(o) { this.stages = o.stages; this.build = o.build; this.seed = o.seed | 0; this.df = o.df | 0; this.W = null; this.key = -1; this.st = new Stream(260); this.TS = { stage: 0, run: 0, ph: PH_WAIT, tm: 0, ck: 0, n: 1, cd: 0, cl: [], sk: [] }; this.pl = []; this.last = -1e9; this.tmAt = 0; this.stat = {}; this.pr = 0; this.ev = []; this.q = -1; this.a = -1; }
Viewer.prototype.onPacket = function (d, now) {
  if (!d || !d.ts || !d.o) return;
  if (d.a === this.a && d.t <= this.q && this.q - d.t < 5000) return;
  const ts = d.ts, key = ts[0] * 64 + (ts[1] % 64), TS = this.TS;
  if (key !== this.key || !this.W) { if (ts[0] >= this.stages.length) return; this.key = key; const ls = lseed(this.seed, ts[0]); this.W = new World(this.build(this.stages[ts[0]], ls, this.df)); this.lkey = this.stages[ts[0]] + ':' + ls + ':' + this.df + ':' + this.W.objs.length + ':' + VERSION; this.st = new Stream(260); }
  if (d.lk && d.lk !== this.lkey) { this.mism = (this.mism || 0) + 1; return; }
  if (d.a !== this.a) { this.a = d.a; this.st = new Stream(260); }
  this.q = d.t;
  TS.stage = ts[0]; TS.run = ts[1]; TS.ph = ts[2]; TS.tm = ts[3]; TS.ck = ts[4]; TS.n = ts[5]; TS.cd = ts[6] / 100; TS.cl = d.cl || []; TS.sk = d.sk || [];
  this.tmAt = now; this.last = now; if (d.st) this.stat = d.st; this.pr = d.pr | 0;
  this.st.push(d.t, { o: d.o, pl: d.pl || [] }, now);
};
Viewer.prototype.update = function (now) {
  const s = this.st.sample(now); if (!s || !this.W) return;
  this.W.n = this.TS.n; this.W.apply(s.a.o, s.b.o, s.k); this.W.observe();
  for (const e of this.W.ev) this.ev.push(e); this.W.ev.length = 0;
  const out = this.pl; out.length = 0; const k = this.W.key;
  for (const a of s.a.pl) {
    let b = a; for (const q of s.b.pl) if (q[0] === a[0]) { b = q; break; }
    const far = abs(b[1] - a[1]) > 150 || abs(b[2] - a[2]) > 150, kk = far ? 0 : s.k;
    out.push({ slot: a[0], me: false, x: lerp(a[1], b[1], kk), y: lerp(a[2], b[2], kk), face: a[3] & 2 ? -1 : 1, gr: !!(a[3] & 1), vx: a[3] & 4 ? 100 : 0, vy: 0, dir: a[3] & 4 ? 1 : 0, push: false, dead: false, riders: 0, land: 0, key: !!(k && k.hd === a[0]), em: 0 });
  }
  if (k && k.hd >= 0 && !k.used) for (const q of out) if (q.slot === k.hd) { k.x = q.x + 1; k.y = q.y - 30; }
};
Viewer.prototype.time = function (now) { const TS = this.TS; return TS.ph === PH_PLAY && now - this.last < 3000 ? TS.tm + (now - this.tmAt) : TS.tm; };
Viewer.prototype.total = function (now) { let s = 0; const TS = this.TS; for (let i = 0; i < TS.cl.length; i++) s += TS.cl[i] || 0; if (TS.ph === PH_READY || TS.ph === PH_PLAY) s += this.time(now); return s; };

const VERSION = 10;                              // 기기끼리 같은 판인지 맞춰 보는 번호 (올릴 때마다 하나씩)
const YC = { VERSION, T, PW, PH, SAW_TH, G, JUMP_V, MOVE, VIEW_W, VIEW_H, PH_WAIT, PH_READY, PH_PLAY, PH_CLEAR, PH_DONE, SKIP_PEN,
  opt, lseed, clamp, lerp, approach, needOf, launchNeed, linkOn, traceBeam, mirrorFlip, mirrorOn, LB, World, Player, Team, Viewer, Stream, Ghost, stepPlayer, simWorld, sawPoint, rectOf, topOf, spawnAt, raftCap, ridersOn, stages: {}, order: [] };
if (typeof module !== 'undefined' && module.exports) module.exports = YC; else root.YC = YC;
})(typeof window !== 'undefined' ? window : globalThis);
