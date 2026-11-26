/* 영차영차 — ai.js : 스테이지별 AI 대본
   AI는 정해진 순번대로 움직이지 않는다. 틈틈이 판을 보고(문이 열렸나, 단추에 누가 섰나, 누가 이미 건너갔나) 지금 비어 있는 일을 맡는다.
   일을 맡기는 차례는 AI 먼저, 번호가 큰 쪽부터. 혼자 연습의 0번 자리(사람)는 대본을 따르지 않을 수 있으므로,
   사람이 이미 하고 있는 일(단추 위에 서 있다, 먼저 건너갔다, 받침 자리에 서 있다…)은 그대로 쳐 주고 남은 일을 AI가 채운다.
   사람에게는 남은 일만 화살표·말풍선으로 알려 준다 (practice.js의 Guide). */
(function (root) {
'use strict';
const YC = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.YC;
const T = 32;
const X = c => c * T + 16;                       // 칸 가운데
const ctr = o => o.x + o.w / 2;
const isH = o => !!o.tell;                       // 사람 자리
const live = o => o.me.dead <= 0 && !o.me.fin;
const isHard = b => !!(b.T.W.def && b.T.W.def.hd);              // 장치가 더 붙은 판 (노말·하드 모두)
const need = (s, n) => (s.minN && n < s.minN) ? 0 : YC.needOf(s.type === 'pad' ? s.eq : s.need, n);   // 이 장치에 서야 하는 사람 수
const pri = (a, b) => ((isH(a) ? 1 : 0) - (isH(b) ? 1 : 0)) || (b.i - a.i);            // 일을 맡길 차례
let curB = null;                                 // 지금 일을 고르는 팀 (머리 위에 선 사람을 아래 사람의 자리로 치기 위해)
const footRef = (o, d) => { if (!o.me.gr) return 0; const r = o.me.gRef; if (r >= 0 || !curB || (d | 0) > 6) return r; const q = curB[-r - 1]; return q ? footRef(q, (d | 0) + 1) : r; };
const onIt = (o, s) => footRef(o) === s.id;      // 그 장치 위에 섰다 (친구 머리 위에 서서 함께 누르는 것도)
const okOf = s => s.type === 'pad' ? !!s.ok : !!s.on;
const tag = (b, t) => b.T.W.objs.filter(o => o.tag === t);
const need1 = (b, t) => tag(b, t).filter(p => need(p, b.sim.n) > 0).sort((p, q) => p.x - q.x);
const rk = (b, L) => { const a = (L || b.sim.bots).slice().sort((p, q) => p.i - q.i); return Math.max(0, a.indexOf(b)); };
const share = (sim, name) => sim.share ? sim.share(name) : {};
const hid = o => -(o.i + 1);                     // 그 사람 머리 위에 섰을 때의 gRef

/* ═══════════ 할 일 고르기 ═══════════
   decide()가 { k: 이름, go: function*(stop) }을 돌려준다 (null이면 끝). 하는 동안에도 틈틈이 다시 골라 보고, 바뀌면 그만두고 새 일을 한다 */
function* jobs(b, decide0) {
  const decide = () => { curB = b.sim.bots; return decide0(); };
  for (let g = 0; g < 400000; g++) {
    const j = decide(); if (!j) { b.stop(); b.inp.j = 0; return; }
    b.job = j.k;
    let c = 0;
    const stop = () => (++c % 6 === 0) && !same(decide(), j);
    try { yield* j.go(stop); } catch (e) { if (e.fatal) throw e; b.lastErr = e.message; b.stop(); b.inp.j = 0; for (let t = 0; t < 12; t++) yield; }
    yield;
  }
}
const same = (a, j) => !!a && a.k === j.k;
/* 더는 깰 수 없게 꼬였다 (예: 한 사람이 혼자 앞서 가 버려 장치를 다시 못 쓴다): 혼자 연습에서는 다 같이 처음부터 다시 한다 */
const fatal = m => { const e = new Error(m); e.fatal = true; return e; };
const stuckFor = (sim, sh, k, bad, ms, msg) => { if (!bad) { sh[k] = 0; return; } sh[k] = sh[k] || sim.t; if (sim.t - sh[k] > ms) throw fatal(msg); };

/* ───── 몸 움직이기 ───── */
function* goto(b, x, stop, tol) { b.me.ride = false; yield* b.walkTo(x, tol || 6, 30, stop); }
function* still(b, stop, hint) { b.stop(); b.inp.j = 0; if (b.tell) b.tell(hint || { k: 'wait' }); for (let t = 0; t < 12; t++) { yield; if (stop && stop()) return; } }
/* x에 맨땅(또는 장치 위)으로 서서 버틴다 */
function* stay(b, x, stop, tol, dev) {                            // dev: 밟고 서야 하는 장치 (사람에게는 가까이 섰어도 장치를 밟을 때까지 '여기로')
  tol = b.tell ? Math.max(tol || 8, 22) : (tol || 8);
  if (b.me.gr && b.me.gRef < 0) { yield* offHead(b, b.cx() < x ? 1 : -1, stop); return; }
  if (b.tell && dev && !onIt(b, dev)) { b.tell({ k: 'go', x: x }); for (let t = 0; t < 12; t++) { yield; if (stop && stop()) return; } return; }
  if (Math.abs(b.cx() - x) > tol || !b.me.gr) { b.me.ride = false; yield* b.walkTo(x, Math.min(tol, 4), 30, stop); return; }
  yield* still(b, stop, { k: 'wait' });
}
/* 길을 막지 않는 자리에서 기다린다 */
function* idle(b, x, stop) {
  if (Math.abs(b.cx() - x) > (b.tell ? 40 : 24) || (b.me.gr && b.me.gRef < 0)) { yield* stay(b, x, stop, 12); return; }
  yield* still(b, stop, { k: 'idle' });
}
const idleJ = (b, k, x) => ({ k: k, go: stop => idle(b, x, stop) });
const gotoJ = (b, k, x, tol) => ({ k: k, go: stop => goto(b, x, stop, tol || 10) });

/* 남의 머리 위에 내려앉았으면 걸어 내려온다 */
function* offHead(b, dir, stop) {
  if (b.tell) { if (b.me.gr && b.me.gRef < 0) yield* b.walkTo(b.cx() + dir * 40, 8, 10, stop); return; }   // 사람: 머리 위에 서 있을 때만 알려 준다
  for (let k = 0; k < 200 && !b.me.gr; k++) yield;
  let t = 0, lx = b.cx(), st = 0;
  while (b.me.gRef < 0 && t++ < 300) {
    if (stop && stop()) break;
    b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; yield;
    if (Math.abs(b.cx() - lx) < 0.3) { if (++st > 20) { dir = -dir; st = 0; } } else st = 0;   // 그쪽이 막혔으면 반대쪽으로 내려온다
    lx = b.cx();
  }
  b.stop();
  for (let k = 0; k < 120 && !b.me.gr; k++) yield;
  b.me.ride = false;
}
/* base의 머리 위로 올라간다 (왼쪽에서). 올라섰으면 true */
function* hopOn(b, base, stop) {
  b.me.ride = true;
  for (let k = 0; k < 6; k++) {
    if (b.me.gr && b.me.gRef === hid(base)) return true;
    if (stop && stop()) return false;
    yield* b.walkTo(base.cx() - 30, 4, 20, stop);
    if (stop && stop()) return false;
    yield* b.jump(base.cx(), 3);
    for (let t = 0; t < 15; t++) { if (b.me.gr && b.me.gRef === hid(base)) return true; yield; }
  }
  return b.me.gr && b.me.gRef === hid(base);
}
/* 얼음 위에서 미끄러지다 멈춘다 */
function* brake(b) { for (let t = 0; t < 60 && b.me.gr && b.me.mat === 'I' && Math.abs(b.me.vx) > 20; t++) { b.inp.l = b.me.vx > 0 ? 1 : 0; b.inp.r = b.me.vx < 0 ? 1 : 0; yield; } b.stop(); }
/* 상자를 밀지 않고 뛰어 넘어간다 (dir: 가려는 쪽) */
function* overBox(b, box, dir, stop) {
  if (b.tell) { yield* b.walkTo(dir > 0 ? box.x + box.w + 26 : box.x - 26, 10, 30, stop); return; }
  for (let k = 0; k < 6; k++) {
    const face = dir > 0 ? box.x : box.x + box.w, far = dir > 0 ? box.x + box.w + 16 : box.x - 16;
    if (dir > 0 ? b.cx() > far : b.cx() < far) break;
    if (stop && stop()) break;
    let t = 0;
    while (Math.abs(face - b.cx()) > 60 && t++ < 300) { b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; yield; }
    b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; b.inp.j = 1; yield;
    for (t = 0; t < 200; t++) { yield; if (b.me.vy >= 0) b.inp.j = 0; if (b.me.gr && t > 3) break; }
    b.inp.j = 0;
    for (t = 0; t < 200 && (dir > 0 ? b.cx() < far : b.cx() > far) && (b.me.gRef === box.id || !b.me.gr); t++) yield;
    b.stop();
    for (t = 0; t < 60 && !b.me.gr; t++) yield;
  }
  yield* brake(b);
}
/* 상자 위로 올라선다 */
function* onTop(b, box, stop) {
  if (b.tell) { yield* b.walkTo(ctr(box), 20, 30, stop); return; }
  for (let k = 0; k < 6 && !(b.me.gr && b.me.gRef === box.id); k++) {
    if (stop && stop()) return;
    const side = b.cx() < ctr(box) ? -1 : 1, from = side < 0 ? box.x - 40 : box.x + box.w + 40;
    if (Math.abs(b.cx() - from) > 30 && Math.abs(b.cx() - ctr(box)) > box.w / 2 + 10) yield* b.walkTo(from, 10, 20, stop);
    yield* b.jump(ctr(box), 6);
    yield* brake(b);
  }
  if (b.me.gr && b.me.gRef === box.id) yield* b.walkTo(ctr(box), 10, 6, stop);
}
/* 상자를 dir 쪽으로 민다: 상자 뒤(반대쪽)에 있지 않으면 먼저 뛰어 넘어간다 */
function pushJ(b, box, dir, done, k) {
  const o = box(), behind = dir > 0 ? b.cx() < o.x + 8 : b.cx() > o.x + o.w - 8;
  if (b.me.gr && b.me.gRef === o.id) return { k: (k || 'p') + 'off', go: stop => goto(b, dir > 0 ? o.x - 30 : o.x + o.w + 30, stop, 10) };
  if (!behind) return { k: (k || 'p') + 'over', go: stop => overBox(b, box(), -dir, stop) };
  return { k: (k || 'p') + 'push', go: stop => b.hold(dir, () => done() || stop(), 30, '상자 밀기') };
}
/* 나가는 문까지 가서 들어간다 */
function* goExit(b) {
  const e = b.obj('exit'), key = b.obj('key'); b.me.ride = false;
  for (let t = 0; t < 60 && key && key.hd < 0 && !key.used && b.me.want; t++) yield;    // 방금 집은 열쇠가 내 것이 될 때까지 잠깐
  if (!e.open && key && key.hd >= 0 && key.hd !== b.i) {             // 잠긴 문 앞은 열쇠 든 친구에게 비켜 준다
    yield* b.walkTo(e.x - 60 - b.i * 28, 8, 40); yield* offHead(b, -1);
    yield* b.until(() => e.open || key.hd < 0, 300, '나가는 문 열림');
    yield* b.wait(b.i * 0.25);
  }
  for (let k = 0; k < 400 && !b.me.fin; k++) {
    if (!e.open && key && key.hd < 0 && !key.used) return false;     // 열쇠를 든 친구가 빠져서 열쇠가 제자리로 돌아갔다
    yield* b.walkTo(e.x + e.w / 2, 9, 30);
    yield* offHead(b, k % 2 ? -1 : 1);
    if (!e.open) { yield* b.wait(0.3); continue; }
    if (b.me.atExit) yield* b.enter(); else yield* b.wait(0.2);
  }
  return true;
}

/* ═══════════ 공통 일감 ═══════════ */
/* 장치마다 설 사람을 정한다: 이미 서 있는 사람(사람이 먼저)을 먼저 치고, 모자라면 AI가(번호 큰 쪽부터) 채운다 */
function fill(cs, ppl, n, late) {                                // late: 될 수 있으면 맡기지 않을 사람 (저쪽 색 단추를 눌러야 할 친구)
  const m = new Map(), used = new Set(), lt = o => late && late.has(o) ? 1 : 0;
  for (const s of cs) {
    const k = need(s, n); if (!k) continue;
    if (s.only !== undefined) { const o = s.own >= 0 ? ppl.find(q => q.i === s.own) : null; if (o && !used.has(o)) { m.set(o, s); used.add(o); } continue; }   // 색 단추는 그 색 친구만
    const dir = o => o.me.gRef === s.id ? 1 : 0;                   // 장치를 직접 밟은 사람이 먼저 (그 머리 위에 선 사람은 아래 사람이 비키면 함께 밀려난다)
    const still0 = o => { for (let q = o, d = 0; q && d < 6; d++) { if (Math.abs(q.me.vx) >= 60) return false; if (!(q.me.gr && q.me.gRef < 0) || !curB) return true; q = curB[-q.me.gRef - 1]; } return true; };   // 머리 위에 선 사람은 아래 사람까지 멈춰 있어야
    const here = ppl.filter(o => onIt(o, s) && still0(o) && !used.has(o) && !lt(o)).sort((a, b) => (dir(b) - dir(a)) || ((isH(b) ? 1 : 0) - (isH(a) ? 1 : 0)) || (b.i - a.i));
    for (const o of here.slice(0, k)) { m.set(o, s); used.add(o); }
  }
  const free = ppl.filter(o => !used.has(o)).sort((a, b) => (lt(a) - lt(b)) || pri(a, b));
  for (const s of cs) {
    if (s.only !== undefined) continue;
    let k = need(s, n); for (const t of m.values()) if (t === s) k--;
    while (k-- > 0 && free.length) { const o = free.shift(); m.set(o, s); used.add(o); }
  }
  return m;
}
/* 한 장치에 여럿이 설 때 나란히 */
function spotOn(b, s, m) {
  const mates = []; for (const [o, t] of m) if (t === s) mates.push(o);
  mates.sort((p, q) => p.i - q.i);
  const r = Math.max(0, mates.indexOf(b)), k = mates.length;
  return ctr(s) + (r - (k - 1) / 2) * Math.min(16, (s.w - 24) / Math.max(1, k - 1));
}
/* 장치 위에 선다 (발판은 뛰어 올라탄다) */
function* standOn(b, s, x, stop) {
  if (s.type === 'pad' && !onIt(b, s)) {
    if (b.tell) { yield* b.walkTo(x, 10, 30, stop); return; }
    if (b.me.gr && b.me.gRef < 0) { yield* offHead(b, -1, stop); return; }
    const from = b.cx() < s.x ? s.x - 24 : s.x + s.w + 24;
    if (Math.abs(b.cx() - from) > 8) { yield* b.walkTo(from, 6, 30, stop); return; }
    yield* b.jump(Math.max(s.x + 14, Math.min(s.x + s.w - 14, x)), 4); return;
  }
  if (s.type === 'pad') { if (Math.abs(b.cx() - x) > 6 && !b.tell) { yield* b.walkTo(x, 4, 10, stop); return; } yield* still(b, stop, { k: 'wait' }); return; }
  yield* stay(b, x, stop, Math.min(12, s.w / 2 - 10), s);
}

/* 릴레이: near(이쪽 장치)를 누르고 있는 동안 길이 열린다 → 나머지가 건너가고, 건너간 사람이 far(저쪽 장치)를 누르면 near를 누르던 사람도 건너온다.
   c: { near(b), far(b): 장치 목록, open(b): 지나갈 수 있음, x0·x1: 길의 이쪽·저쪽 끝, qx(b)·wx(b): 이쪽·저쪽에서 기다릴 곳, cross(b, stop) } */
function relayJob(b, sim, c) {
  const B = sim.bots, n = sim.n;
  const side = o => o.cx() < c.x0 ? -1 : o.cx() > c.x1 ? 1 : 0;
  const left = B.filter(o => !o.me.fin && (o.me.dead > 0 || side(o) <= 0));
  const s0 = side(b);
  const nearC = c.near(b).filter(s => need(s, n) > 0), farC = c.far(b).filter(s => need(s, n) > 0);
  const crossJ = { k: 'cross', go: stop => c.cross ? c.cross(b, stop) : goto(b, c.x1 + 40, stop, 16) };
  if (s0 > 0) {
    if (!left.length) return null;
    const m = fill(farC, B.filter(o => live(o) && side(o) > 0), n), s = m.get(b);
    if (s) return { k: 'f' + s.id, go: stop => standOn(b, s, spotOn(b, s, m), stop) };
    return idleJ(b, 'fw', c.wx(b));
  }
  if (s0 === 0) return crossJ;
  const farOn = farC.length > 0 && farC.every(okOf);
  const late = new Set(farC.filter(q => q.only !== undefined && q.own >= 0).map(q => B[q.own]).filter(Boolean));   // 저쪽 색 단추의 주인은 건너가야 하므로 이쪽 장치를 맡기지 않는다
  const m = fill(nearC, B.filter(o => live(o) && side(o) < 0), n, late), s = m.get(b);
  if (c.open(b)) {
    if (s && onIt(b, s) && !s.lat && farC.length && !farOn) return { k: "n" + s.id, go: stop => still(b, stop, { k: "wait" }) };   // 맡은 장치(한 번 밟아 고정된 것은 빼고): 저쪽이 받아 줄 때까지 그대로
    return crossJ;
  }
  // 열려 있어야 하는데(이쪽 장치가 다 눌렸거나 저쪽이 받아 주는데) 닫혔다 = 누가 '밟으면 안 되는 판'을 밟고 있다:
  // 그 판 위의 사람은 앞쪽으로 내려서고, 나머지는 되돌아가지 않고 그 자리에서 기다린다 (되돌아가다 또 밟으면 끝없이 오간다)
  if (b.avoid && b.avoid.length && (farOn || (nearC.length && nearC.every(okOf)))) {
    const trapOf = o => { const r = footRef(o); return r > 0 ? b.avoid.find(z => z.id === r) : null; };
    const z = trapOf(b);
    if (z) {                                                       // 바로 붙은 다음 판(이쪽 장치)이면 그 위로, 틈이 있으면 틈 가운데로 (사람에게는 넉넉히 앞을 가리킨다)
      let nx = Infinity; for (const q of b.T.W.btns) if (q.id !== z.id && q.x >= z.x1 - 1 && q.x < nx) nx = q.x;
      const gap = nx - z.x1, tx = z.x1 + (b.tell ? 30 : gap >= 8 ? Math.min(16, gap / 2) : 12);
      return gotoJ(b, 'toff' + z.id, tx, 4);
    }
    if (B.some(o => live(o) && side(o) < 0 && trapOf(o))) return { k: 'nh', go: stop => still(b, stop, { k: 'wait' }) };
  }
  if (s) return { k: 'n' + s.id, go: stop => standOn(b, s, spotOn(b, s, m), stop) };
  // 밟으면 안 되는 판을 이미 넘어와 맨바닥에 섰으면 되돌아가지 않고 그 자리에서 기다린다 (되돌아가려면 그 판을 또 넘어야 한다)
  if (b.avoid && b.me.gr && footRef(b) === 0 && b.avoid.some(z => z.x1 <= b.cx() && z.x0 > c.qx(b) - 12)) return { k: 'nh', go: stop => still(b, stop, { k: 'wait' }) };
  return idleJ(b, 'nw', c.qx(b));
}

/* 탑 쌓기 (그때그때 역할): 받침 자리(c.bx)에 맨땅으로 가만히 선 사람이 받침, (c.tall이면) 받침 머리 위에 선 사람이 가운데,
   맨 위에 오른 사람이 c.top으로 뛰어 오른다. c.more(): 더 올라야 할 사람 수 (0이면 끝), c.up(o): o가 높은 곳에 있다, c.solo(stop): 혼자일 때 */
function towerJob(b, sim, c) {
  const B = sim.bots, n = sim.n;
  if (c.more() <= 0) return null;
  if (n === 1) return { k: 'solo', go: stop => c.solo(stop) };
  if (c.up(b)) return { k: 'ttop', go: stop => c.atTop ? goto(b, c.atTop, stop, 6) : still(b, stop, { k: 'wait' }) };   // 위에 올랐다: 할 일을 한다
  const tall = !!c.tall && n >= 3, av = B.filter(o => live(o) && !c.up(o));
  const head = (o, q) => o.me.gr && o.me.gRef === hid(q);
  const wait = k => idleJ(b, 'tw' + k, c.wx - rk(b, av) * 26);
  const base = av.find(o => o.me.gr && o.me.gRef >= 0 && o.feet() > 378 && Math.abs(o.cx() - c.bx) < 10 && Math.abs(o.me.vx) < 30);   // 받침은 땅(또는 d 디딤돌) 위에
  const near = (L, x) => L.slice().sort((p, q) => ((isH(p) ? 1 : 0) - (isH(q) ? 1 : 0)) || (Math.abs(p.cx() - x) - Math.abs(q.cx() - x)) || (q.i - p.i))[0];   // 가장 가까운 AI (사람은 맨 나중)
  if (!base) {
    const cand = near(av.filter(o => !(o.me.gr && o.me.gRef < 0)), c.bx);
    return cand === b ? { k: 'tbase', go: stop => stay(b, c.bx, stop, 4) } : wait('b');
  }
  if (base === b) return { k: 'tbase', go: stop => still(b, stop, { k: 'wait' }) };
  const rest = av.filter(o => o !== base).sort(pri);
  let mid = null;
  if (tall) {
    mid = rest.find(o => head(o, base)) || null;
    if (!mid) return near(rest, base.cx() - 30) === b ? { k: 'tmid', go: stop => hopOn(b, base, stop) } : wait('m');
    if (mid === b) return { k: 'tmid', go: stop => still(b, stop, { k: 'wait' }) };
  }
  const tp = mid || base, rest2 = rest.filter(o => o !== mid);
  const cl = rest2.find(o => head(o, tp)) || near(rest2.filter(o => !(o.me.gr && o.me.gRef < 0)), tp.cx() - 30) || rest2[0];
  if (cl === b) return { k: 'tclimb', go: stop => climbUp(b, tp, c, stop) };
  return wait('c');
}
function* climbUp(b, tp, c, stop) {
  if (!(b.me.gr && b.me.gRef === hid(tp))) { if (!(yield* hopOn(b, tp, stop))) return; }
  if (b.tell) b.tell({ k: 'wait' });
  for (let t = 0; t < 18; t++) { if (stop()) return; yield; }        // 받침이 멈춰 설 때까지 잠깐
  if (c.edge && !b.tell) for (let t = 0; t < 12 && b.cx() + 12 > c.edge - 3 && b.me.gr && b.me.gRef === hid(tp); t++) { b.inp.l = 1; b.inp.r = 0; yield; }   // 선반 바로 밑이면 머리를 찧으니 조금 물러서서
  b.stop();
  yield* b.jump(c.top, 4);
  for (let t = 0; t < 30 && !b.me.gr; t++) yield;
  if (!c.up(b) && b.me.gr && b.me.gRef < 0 && !b.tell) yield* offHead(b, -1);   // 사람은 머리 위에서 다시 뛰면 된다
}
/* 혼자 연습: s 디딤돌을 밟고 선반으로 */
const soloShelf = (b, c0, tall) => function* (stop) {
  yield* b.walkTo(X(c0 - (tall ? 3 : 2)), 4, 30, stop); if (tall) yield* b.jump(X(c0 - 2));
  yield* b.jump(X(c0 - 1)); yield* b.jump(X(c0 + 1)); yield* b.walkTo(X(c0 + 1), 6, 10, stop);
};
const shelfUp = (o, c0, sy) => o.me.gr && o.feet() <= sy + 3 && o.cx() > c0 * T - 4 && o.cx() < (c0 + 3) * T + 4;

/* 높은 선반 위 장치를 누르는 동안만 길이 열린다 + 건너간 사람이 저쪽 장치로 받아 준다 (불·빛의 마지막 방)
   c: { c0: 선반 왼쪽 칸, tall, sw(b): 선반 위 장치, far(b): 저쪽 장치 목록, open(b), x0·x1: 길, goal: 건넌 뒤 갈 곳 } */
function shelfRelayJob(b, sim, c) {
  const B = sim.bots, n = sim.n, sy = (c.tall ? 9 : 10) * T;
  const up = o => shelfUp(o, c.c0, sy), side = o => o.cx() < c.x0 ? -1 : o.cx() > c.x1 ? 1 : 0;
  const left = B.filter(o => !o.me.fin && (o.me.dead > 0 || side(o) <= 0));
  const farC = c.far(b).filter(s => need(s, n) > 0), farOn = farC.length > 0 && farC.every(okOf);
  if (side(b) > 0) {
    if (!left.length) return null;
    const m = fill(farC, B.filter(o => live(o) && side(o) > 0), n), s = m.get(b);
    if (s) return { k: 'f' + s.id, go: stop => standOn(b, s, spotOn(b, s, m), stop) };
    return idleJ(b, 'fw', c.goal + rk(b) * 16);
  }
  if (side(b) === 0) return gotoJ(b, 'cross', c.x1 + 40, 16);
  if (up(b)) {
    if (farOn || n === 1 || c.sw(b).lat) return gotoJ(b, 'down', c.x1 + 40, 16);       // 저쪽이 받아 주면 내려와 건넌다
    return { k: 'sh', go: stop => stay(b, ctr(c.sw(b)), stop, 12, c.sw(b)) };
  }
  if (c.open(b)) return gotoJ(b, 'cross', c.x1 + 40, 16);
  if (B.some(o => live(o) && up(o))) return idleJ(b, 'shw', X(c.c0 - 4) - rk(b) * 20);   // 선반에 오른 친구가 장치를 밟을 때까지
  return towerJob(b, sim, { bx: X(c.c0 - 1) - 4, top: X(c.c0 + 1), edge: c.c0 * T, tall: c.tall, up: up, more: () => B.some(o => live(o) && up(o)) ? 0 : 1, wx: X(c.c0 - 4), solo: soloShelf(b, c.c0, c.tall) })
    || idleJ(b, 'shw', X(c.c0 - 4));
}

const scripts = {};
const start = function* (b) { yield* b.until(() => b.T.TS.ph === 2, 10, '시작'); };
/* 밟으면 안 되는 판: 걸어가다 만나면 뛰어넘는다 */
const avoid = (b, L) => { b.avoid = L.filter(Boolean).map(o => ({ x0: o.x, x1: o.x + o.w, id: o.id })); };

/* ───────── 1. 영차! ───────── */
scripts.push = function (sim) {
  const B = sim.bots, n = sim.n;
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b), sy = (hard ? 9 : 10) * T;
    const b1 = () => b.obj('btn', 0), b2 = () => b.obj('btn', 1), bq = () => b.obj('btn', 2), bp = () => b.obj('btn', 3);
    const d1 = () => b.obj('door', 0), d3 = () => b.obj('door', 1), key = () => b.obj('key');
    const A = () => b.obj('box', 0), Tn = () => b.obj('box', 1), Q = () => b.obj('box', 2), P = () => b.obj('box', 3);
    // A. 선반 위 단추 + 상자 무게
    const upA = o => shelfUp(o, 8, sy), dX = 15 * T + 8;
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > A().x + A().w + 4))) return null;
      const set = b2().on, open = d1().open > 0.9;
      if (upA(b)) return set || b1().lat ? gotoJ(b, 'down', X(18)) : { k: 'hold', go: stop => stay(b, ctr(b1()), stop, 12, b1()) };
      if (b.cx() < dX) {
        if (open) return gotoJ(b, 'thru', X(18));
        if (B.some(o => live(o) && upA(o))) return idleJ(b, 'wsh', X(12) - rk(b) * 18);
        return towerJob(b, sim, { bx: X(7) - 4, top: X(9), tall: hard, up: upA, more: () => B.some(o => live(o) && upA(o)) ? 0 : 1, wx: X(4), solo: soloShelf(b, 8, hard) }) || idleJ(b, 'w', X(12));
      }
      if (!set) return pushJ(b, A, -1, () => b2().on, 'a');                     // 문 너머: 상자를 저쪽 단추로 밀어 올린다
      if (b.cx() < A().x + A().w + 8) return { k: 'aover', go: stop => overBox(b, A(), 1, stop) };
      return idleJ(b, 'aw', X(24) + rk(b) * 22);
    });
    // B. 굴 속 상자: 모두가 밀어 가시 구덩이에
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > X(42) + 10))) return null;
      if (b.cx() > X(42) + 10) return idleJ(b, 'bw', X(44) + rk(b) * 22);
      if (Tn().y < 12 * T && b.cx() < Tn().x) return { k: 'bpush', go: stop => b.hold(1, () => Tn().y >= 12 * T || stop(), 40, '굴 상자') };
      return gotoJ(b, 'bgo', X(44));
    });
    // C. 벽 양쪽 상자 (이쪽 상자를 먼저 밀어 두고, 친구 머리를 밟고 벽을 넘어가 저쪽 상자를 민다)
    const wl = 58 * T, overC = o => o.cx() > wl + 2 || (o.me.gr && o.feet() <= 10 * T + 3 && o.cx() > wl - 12);
    const soloWall = function* (stop) { yield* b.walkTo(X(55), 4, 30, stop); yield* b.jump(X(56)); yield* b.jump(X(57)); yield* b.jump(X(58) + 4); };
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > X(65)))) return null;
      if (!overC(b)) {
        if (d3().open > 0.9) return gotoJ(b, 'cthru', X(60), 8);
        if (!bq().on) return pushJ(b, Q, 1, () => bq().on, 'q');
        const got = () => B.filter(o => live(o) && overC(o)).length;                       // 받침 하나만 남기고 모두 벽을 넘는다 (저쪽 상자는 절반이 밀어야 움직인다)
        return towerJob(b, sim, { bx: wl - 14, top: wl + 18, up: overC, more: () => Math.max(1, n - 1) - got(), wx: X(52) + 10, solo: soloWall }) || idleJ(b, 'cw', X(56) - rk(b) * 14);
      }
      if (b.feet() < 11 * T && b.cx() < wl + 80) return gotoJ(b, 'cdrop', X(60) + 10, 4);
      if (!bp().on) return pushJ(b, P, -1, () => bp().on, 'p');
      if (b.cx() < P().x + P().w + 8) return { k: 'pover', go: stop => overBox(b, P(), 1, stop) };
      return idleJ(b, 'cw2', X(66) + rk(b) * 22);
    });
    // D. 선반 위 열쇠
    const upD = o => shelfUp(o, 76, sy);
    yield* jobs(b, () => {
      if (key().hd >= 0 || key().used) return null;
      return towerJob(b, sim, { bx: X(75) - 4, top: X(77), atTop: X(77) + 10, tall: hard, up: upD, more: () => (key().hd >= 0 || key().used) ? 0 : 1, wx: X(72), solo: soloShelf(b, 76, hard) }) || idleJ(b, 'dw', X(72));
    });
    while (!(yield* goExit(b))) yield* jobs(b, () => (key().hd >= 0 || key().used) ? null : towerJob(b, sim, { bx: X(75) - 4, top: X(77), atTop: X(77) + 10, tall: hard, up: upD, more: () => 1, wx: X(72), solo: soloShelf(b, 76, hard) }));
  }));
};

/* ───────── 2. 미끌미끌 ───────── */
/* 얼음 위에서 살살 x로 (빨리 달리면 미끄러져 지나친다) */
function* slide(b, x, stop, tol) {
  if (b.tell) { yield* b.walkTo(x, 10, 30, stop); return; }
  tol = tol || 8;
  for (let t = 0; t < 900; t++) {
    if (stop && stop()) break;
    const d = x - b.cx(), v = b.me.vx;
    if (Math.abs(d) <= tol && Math.abs(v) < 12) break;
    const want = Math.max(-1, Math.min(1, d / 110)) * 90;
    b.inp.r = v < want - 8 ? 1 : 0; b.inp.l = v > want + 8 ? 1 : 0;
    yield;
  }
  b.stop();
}
/* 쇠 상자를 얼음 위로 톡톡 밀어 받침판 위에 세운다 */
function* tapIron(b, box, btn, lag, stop) {
  yield* b.until(() => Math.abs(box().vx) < 2 || stop(), 25);
  if (stop()) return;
  for (let t = 0; t < (0.25 + lag) * 60; t++) { if (stop()) return; yield; }
  const o = box(), s = btn(), ov = s.ov || 6, lo = s.x + ov - o.w + 6, hi = s.x + s.w - ov - 6;
  if (s.on && Math.abs(o.vx) < 2) return;
  if (o.x >= lo && o.x <= hi) { yield* b.wait(0.5); return; }
  if (o.x < lo) {
    if (b.cx() > o.x - 6) { yield* overBox(b, o, -1, stop); return; }
    yield* b.hold(1, () => b.me.pu > 0 || stop(), 8, '쇠 상자에 닿기'); if (stop()) return;
    b.inp.r = 1; yield* b.wait(o.x < lo - 90 ? 0.42 : 0.14); b.stop();
  } else {
    if (b.cx() < o.x + o.w + 6) { yield* overBox(b, o, 1, stop); return; }
    yield* b.hold(-1, () => b.me.pu < 0 || stop(), 8, '쇠 상자에 닿기(오른쪽)'); if (stop()) return;
    b.inp.l = 1; yield* b.wait(o.x > hi + 90 ? 0.42 : 0.14); b.stop();
  }
}
/* 얼음 위 가시 구덩이를 달려가며 뛰어 넘는다 */
function* runGaps(b, gaps, endX) {
  if (b.tell) { yield* b.walkTo(endX + 20, 12, 60); return; }
  let t = 0, jt = 0;
  while (b.cx() < endX && b.me.dead <= 0 && t++ < 900) {
    b.inp.r = 1;
    for (const g of gaps) if (b.me.gr && b.cx() > g * T - 30 && b.cx() < g * T - 8) jt = 14;
    b.inp.j = jt-- > 0 ? 1 : 0;
    yield;
  }
  b.stop(); b.inp.j = 0;
  yield* brake(b);
}
scripts.ice = function (sim) {
  const B = sim.bots, n = sim.n, sh = share(sim, 'ice');
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b), lag = (sim.delay || 0) * 0.003 + (sim.lag || 0);
    const wood = () => b.obj('box', 0), iron = () => b.obj('box', 1), slab = () => b.obj('box', 2);
    const ib = () => b.obj('btn', 0), bx = () => b.obj('btn', 1), by = () => b.obj('btn', 2), dx = () => b.obj('door', 1);
    const top = o => o.feet() < 300;
    // A. 모래밭 상자를 벼랑까지 밀고 딛고 오른다 → B. 쇠 상자를 받침판에 세우고(상자가 있는 동안만 문이 열린다) 건드리지 않게 넘어간다
    const climb = function* (stop) {
      if (b.tell) { yield* b.walkTo(X(21), 12, 30, stop); return; }
      const w = wood();
      if (b.me.gRef === w.id) yield* b.jump(X(21) + 6, 6);
      else { yield* b.hold(1, () => b.cx() > w.x - 16 || b.me.vx === 0 || stop(), 4); yield* b.jump(w.x + 34, 6); }
      yield* b.wait(0.1);
    };
    const crossIron = function* (stop) { if (b.cx() < iron().x + iron().w + 6) yield* overBox(b, iron(), 1, stop); yield* goto(b, X(46), stop, 12); };
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > X(45)))) return null;
      if (b.cx() > X(45)) return idleJ(b, 'aw', X(46) - rk(b) * 6);
      if (!top(b)) return wood().x < 575 ? pushJ(b, wood, 1, () => wood().x >= 575, 'w') : { k: 'aclimb', go: climb };
      const rest = ib().on && Math.abs(iron().vx) < 2, inB = B.filter(o => live(o) && top(o) && o.cx() < X(43));
      const qx = X(20) + rk(b, inB) * 8;
      if (rest) {                                                       // 한 사람씩 상자를 밟고 넘어간다
        const busy = B.some(o => o !== b && live(o) && top(o) && o.cx() > X(23) + 10 && o.cx() < X(44));
        if (busy && b.cx() < X(23) + 10) return idleJ(b, 'bq', qx);
        return { k: 'bx', go: crossIron };
      }
      const ci = iron().x + 32;
      if (hard && ci >= 892 && ci <= 994 && Math.abs(iron().vx) < 2) {   // 하드: 모래에 멈춘 쇠 상자는 다 같이 밀어야 한다
        if (B.some(o => live(o) && !top(o))) return b.cx() < iron().x - 8 ? idleJ(b, 'sq', iron().x - 14 - rk(b) * 6) : { k: 'sover', go: stop => overBox(b, iron(), -1, stop) };   // 아직 아래에 친구가 있다
        return pushJ(b, iron, 1, () => iron().x + 32 > 998 || ib().on, 's');
      }
      const placer = inB.slice().sort(pri)[0];
      if (placer === b) return { k: 'place', go: stop => tapIron(b, iron, ib, lag, stop) };
      if (b.cx() > X(23) && b.cx() < iron().x + iron().w + 40 && b.cx() > iron().x - 40) return gotoJ(b, 'bback', qx, 10);   // 상자 곁에서 비켜 선다
      return idleJ(b, 'bq', qx);
    });
    // C. 얼음 위 가시 구덩이 (한 사람씩)
    const gaps = []; for (let c = 46; c < 72; c++) if (b.T.W.ch(c, 10) === '^' && b.T.W.ch(c - 1, 10) !== '^') gaps.push(c);
    yield* jobs(b, () => {
      if (b.cx() > X(72)) return null;
      if (b.me.dead > 0) return { k: 'dead', go: stop => still(b, stop, { k: 'idle' }) };
      const running = B.some(o => o !== b && live(o) && o.cx() > X(47) && o.cx() < X(72));
      const q = B.filter(o => live(o) && o.cx() <= X(47)).sort(pri);
      if (running || (q[0] !== b && !isH(b) && !(isH(q[0]) && q.length > 1 && q[1] === b))) return idleJ(b, 'gw', X(46) - rk(b) * 6);
      return { k: 'grun', go: () => runGaps(b, gaps, X(72)) };
    });
    // D. 얼음 위 단추 ↔ 널빤지 상자 릴레이, 그다음 널빤지로 구덩이 메우기
    const dl = 80 * T + 8, dr = 82 * T, near = o => o.cx() < dl, far = o => o.cx() > dr;
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > X(100)))) return null;
      const sl = slab();
      if (sl.y > 260 && n > 1 && B.some(o => !o.me.fin && (o.me.dead > 0 || !far(o)))) { sh.dl = sh.dl || sim.t; if (sim.t - sh.dl > 4000) throw fatal('널빤지가 먼저 구덩이에 빠져 이쪽 친구가 못 건넌다 (처음부터)'); } else sh.dl = 0;
      if (sl.y > 260) return gotoJ(b, 'dgo', X(102), 10);               // 구덩이가 메워졌다
      const L = B.filter(o => !o.me.fin && (o.me.dead > 0 || !far(o)));
      if (far(b)) {
        const onSl = o => o.me.gr && o.me.gRef === sl.id;
        if (L.length && !by().on) return pushJ(b, slab, -1, () => by().on, 's');     // 이쪽에 친구가 남았다: 널빤지를 되밀어 저쪽 단추에 세운다
        if (L.length) {                                                 // 친구들이 건너올 때까지: 널빤지 오른쪽 사람은 위에 올라타 기다리고(밀려도 턱에 막힌다), 왼쪽 사람은 건드리지 않고 기다린다
          if (onSl(b)) return { k: 'dtop', go: stop => still(b, stop, { k: 'idle' }) };
          if (b.cx() > sl.x + sl.w - 4) return { k: 'dtop', go: stop => onTop(b, slab(), stop) };
          if (b.cx() > sl.x - 20 && b.feet() > 280) return gotoJ(b, 'dback', sl.x - 40, 6);
          return { k: 'dleft', go: stop => still(b, stop, { k: 'idle' }) };
        }
        // 모두 건너왔다: 널빤지 왼쪽의 한 명이 오른쪽으로 민다. 널빤지 위 사람은 가만히 타고 간다 (걸으면 앞으로 떨어진다)
        const lefts = B.filter(o => live(o) && far(o) && !onSl(o) && o.cx() < sl.x + 8 && o.feet() > 280).sort(pri);
        if (onSl(b)) {
          if (!lefts.length && B.filter(o => live(o) && onSl(o)).sort(pri)[0] === b) return gotoJ(b, 'doff', sl.x - 50, 6);   // 밀 사람이 없다: 내려가 민다
          return { k: 'dride', go: stop => still(b, stop, { k: 'idle' }) };
        }
        if (b.cx() > sl.x + sl.w) return { k: 'dtop2', go: stop => onTop(b, slab(), stop) };
        if (b.feet() < 280) return gotoJ(b, 'doff', sl.x - 50, 6);        // 턱 위에 올라섰다: 땅으로 내려간다
        if (lefts[0] === b) return pushJ(b, slab, 1, () => slab().y > 260, 'z');
        return { k: 'dbehind', go: stop => still(b, stop, { k: 'idle' }) };
      }
      if (!near(b)) return gotoJ(b, 'dthru', X(83), 6);
      const open = dx().open > 0.9, m = fill([bx()], B.filter(o => live(o) && near(o)), n), s = m.get(b);
      if (open) { if (s && onIt(b, s) && !by().on && n > 1 && !bx().lat) return { k: 'dh', go: stop => still(b, stop, { k: 'wait' }) }; return gotoJ(b, 'dthru', X(83), 6); }
      if (s) return { k: 'dh', go: stop => onIt(b, s) ? still(b, stop, { k: 'wait' }) : slide(b, spotOn(b, s, m), stop, 8) };
      return idleJ(b, 'dq', X(72) - rk(b) * 10);
    });
    yield* goExit(b);
  }));
};

/* ───────── 3. 하나 둘 셋! ───────── */
scripts.saw = function (sim) {
  const B = sim.bots, n = sim.n, sh = share(sim, 'saw');
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b), D = 6 * T;
    const sawA = () => b.obj('saw', 0), sawB = () => b.obj('saw', 1), b1 = () => b.obj('btn', 0), bf = () => b.obj('btn', 1), d1 = () => b.obj('door', 0), key = () => b.obj('key');
    const ledge = o => o.me.gr && o.feet() <= 10 * T + 3 && o.cx() > 22 * T - 14 && o.cx() < 24 * T + 14;
    const dX = 27 * T + 8, past = o => o.cx() > dX + 56;
    const onSaw = (o, s) => o.me.gr && o.me.gRef === s.id;
    const cross = function* (stop) {                                    // 시소를 건너 오른쪽 둑으로
      if (b.tell) { yield* b.walkTo(X(25), 12, 30, stop); return; }
      let t = 0; while (!(b.cx() > 700 && b.me.gr && !b.me.saw && b.me.gRef >= 0 && b.feet() < 418) && b.me.dead <= 0 && t++ < 400) { if (stop()) break; b.inp.r = 1; yield; }
      b.stop();
    };
    const ride = function* (stop) {                                     // 시소 오른쪽 끝 조금 안쪽에 서 있다가, 들리면 턱으로 뛴다
      if (b.tell) { if (!onSaw(b, sawA())) { yield* b.walkTo(662, 20, 30, stop); return; } if (sawA().th < -0.3) { yield* b.jump(X(23)); return; } yield* still(b, stop, { k: 'wait' }); return; }
      if (!onSaw(b, sawA()) || Math.abs(b.cx() - 662) > 6) { yield* b.walkTo(662, 3, 20, stop); return; }
      let up = 0;
      for (let t = 0; t < 60 * 3; t++) { if (stop()) return; up = sawA().th < -0.3 && onSaw(b, sawA()) ? up + 1 : 0; if (up > 30) break; yield; }
      if (up > 30) { yield* b.jump(X(23), 6); for (let t = 0; t < 30 && !b.me.gr; t++) yield; }
    };
    const press = function* (stop) {                                    // 시소 왼쪽 끝에 올라탄다 (받침점에서 멀수록 힘이 세다: 올라갈 사람보다 바깥에)
      const end = () => 560 - 126 * Math.cos(sawA().th);
      if (onSaw(b, sawA()) && b.cx() < 480) { if (b.cx() > end() + 4 && !b.tell) { yield* b.walkTo(end(), 2, 6, stop); return; } yield* still(b, stop, { k: 'wait' }); return; }
      if (b.tell) { yield* b.walkTo(436, 14, 30, stop); return; }
      yield* b.walkTo(402, 3, 20, stop); if (stop()) return;
      // 올라갈 친구가 아직 시소 왼쪽 절반을 지나는 중이면 판이 기울며 흔들린다: 지나간 뒤 판이 멈추면 뛰어오른다 (흔들리는 끝을 놓치면 구덩이)
      for (let t = 0; t < 240 && (B.some(o => o !== b && live(o) && o.cx() > 370 && o.cx() < 600 && o.feet() > 380) || Math.abs(sawA().om || 0) > 0.05); t++) { if (stop()) return; yield; }
      yield* b.jump(437, 3);
    };
    // A. 시소로 턱 위 → 턱 위 단추(누르는 동안만 문) → 건너간 친구가 문 너머 단추로 받아 준다
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && past(o)))) return null;
      const open = d1().open > 0.9;
      if (past(b)) {
        if (!B.some(o => !o.me.fin && (o.me.dead > 0 || !past(o)))) return null;
        const m = fill([bf()], B.filter(o => live(o) && past(o)), n), s = m.get(b);
        return s ? { k: 'af', go: stop => stay(b, ctr(s), stop, 14, s) } : idleJ(b, 'aw', X(32) - rk(b) * 6);
      }
      if (ledge(b)) return bf().on || b1().lat ? gotoJ(b, 'adown', dX + 80, 14) : { k: 'ahold', go: stop => stay(b, ctr(b1()) + (rk(b, B.filter(ledge)) ? 14 : -10), stop, 12, b1()) };
      if (b.cx() > 21 * T && b.cx() < dX) return open ? gotoJ(b, 'athru', dX + 80, 14) : gotoJ(b, 'aback', X(8), 14);   // 오른쪽 둑: 문이 닫혔으면 시소로 돌아간다
      if (b.cx() >= dX) return gotoJ(b, 'athru', dX + 80, 14);
      if (open) return { k: 'across', go: cross };
      // 누르던 사람: 다 쏘아 올렸으면 시소 왼쪽 끝(구덩이 위로 내려가 있다)에서 그대로 기다렸다가 문이 열리면 시소를 건너간다
      // (왼쪽으로 걸어 나가면 구덩이에 빠진다 — 하드는 다 같이 깃발부터)
      if (onSaw(b, sawA()) && b.cx() < 520 && B.filter(o => live(o) && ledge(o)).length >= need(b1(), n)) return { k: 'aon', go: stop => still(b, stop, { k: 'wait' }) };
      if (n === 1) return { k: 'asolo', go: function* (stop) { yield* b.walkTo(640, 6, 20, stop); yield* b.jump(X(21), 5); yield* b.jump(X(23), 6); yield* b.walkTo(ctr(b1()), 6, 10, stop); } };
      const K = need(b1(), n);
      if (B.filter(o => live(o) && ledge(o)).length >= K) return idleJ(b, 'aw2', X(6) - rk(b) * 20);
      const av = B.filter(o => live(o) && !ledge(o) && o.cx() <= 21 * T);
      const riderNow = av.find(o => onSaw(o, sawA()) && o.cx() > 600), pressNow = av.find(o => onSaw(o, sawA()) && o.cx() < 470 && Math.abs(o.me.vx) < 40);   // 시소를 건너가는 중인 사람은 누르는 사람으로 치지 않는다
      const order = av.slice().sort(pri), rider = riderNow || order.find(o => o !== pressNow), presser = pressNow || order.find(o => o !== rider);
      if (b === rider) return { k: 'aride', go: ride };
      if (b === presser) return { k: 'apress', go: press };
      return idleJ(b, 'aw3', X(5) - rk(b) * 22);
    });
    // B. 탑에서 동시에 뛰어내려 열쇠 선반으로 쏘아 올린다 (하드: 문 너머 단추를 한 명이 계속 밟아 유리문을 열어 둔다)
    const sB = 1160 + D, endB = sB + 120, rideX = sB + 97, topY = 7 * T, onTower = o => o.me.gr && o.feet() <= topY + 3 && o.cx() > 35 * T && o.cx() < 38 * T + 12;
    const glass = hard && n >= 3, nd = Math.min(3, Math.max(1, n - 1 - (hard ? 1 : 0)));
    const keyed = () => key().hd >= 0 || key().used;
    yield* jobs(b, () => {
      if (keyed()) return null;
      if (n === 1) return { k: 'bsolo', go: function* (stop) { yield* b.walkTo(X(49 + 6) + 14, 4, 40, stop); yield* b.jump(X(54)); yield* b.jump(X(53)); yield* b.jump(X(52)); yield* b.jump(X(50), 6); yield* b.walkTo(X(48) + 26, 5, 10, stop); } };
      const av = B.filter(o => live(o));
      let holder = null;
      if (glass) { const m = fill([bf()], av.filter(o => o.cx() < 33 * T - 8 && o.feet() > 380), n); for (const [o] of m) holder = o; if (holder === b) return { k: 'bh', go: stop => stay(b, ctr(bf()), stop, 14, bf()) }; }
      const pool = av.filter(o => o !== holder);
      const rightSide = o => o.cx() > 38 * T + 4 && o.feet() > 300;                     // 탑 오른쪽 아래 (여기서는 다시 탑에 못 오른다)
      const riderNow = pool.find(o => o.me.gr && o.cx() > sB + 50 && o.cx() < endB + 20 && o.feet() > 380 && (!isH(o) || !pool.some(q => !isH(q) && rightSide(q))));
      const order = pool.slice().sort(pri), rs = order.filter(rightSide);
      const rider = riderNow || rs[0] || order[0];                                        // 이미 탑 아래로 내려간 사람이 있으면 그 사람이 날아간다 (사람이 앞서 갔어도)
      const drop = order.filter(o => o !== rider && !rightSide(o)).slice(0, nd);
      const spotOK = (o, k) => onTower(o) && Math.abs(o.cx() - (38 * T - 14 - k * 26)) < 26;
      if (b === rider) return { k: 'brider', go: function* (stop) {
        if (!rightSide(b)) {                                                              // 뛰어내릴 친구들이 다 모이면 탑에서 내려가 시소 오른쪽 끝으로
          if (!onTower(b)) { yield* climbTower(b, X(37), stop); return; }
          if (!drop.every(spotOK)) { yield* idle(b, X(37), stop); return; }
        }
        if (!b.tell && onSaw(b, sawB()) && b.cx() < sB && !(b.sawT > 0)) { b.sawT = 1; yield* still(b, stop); yield* b.wait(0.5); return; }   // 시소 위에 내려서면 잠깐 멈춘다 (걸어가며 내 무게로 시소가 튀지 않게)
        if (!onSaw(b, sawB())) b.sawT = 0;
        if (Math.abs(b.cx() - (rideX)) > (b.tell ? 22 : 8)) { yield* b.walkTo(rideX, b.tell ? 20 : 3, 30, stop); return; }
        if (!b.tell && !onSaw(b, sawB()) && b.me.gr) { yield* b.jump(rideX, 3); return; }   // 시소 판 밑(땅)에 서 있다: 판 위로
        if (b.tell) b.tell({ k: 'wait' });
        for (let t = 0; t < 60 * 4; t++) { if (b.me.vy < -400) break; if (stop()) return; yield; }
        if (b.me.vy < -400) { if (b.tell) b.tell({ k: 'go', x: X(48) + 16 }); else yield* airTo(b, X(48) + 16); for (let t = 0; t < 120 && !b.me.gr; t++) yield; }
      } };
      if (pool.filter(o => o !== rider && !rightSide(o)).length < nd) { sh.lost = sh.lost || sim.t; if (sim.t - sh.lost > 4000) throw fatal('탑에서 떨어져 시소를 다시 못 쏜다 (처음부터)'); } else sh.lost = 0;
      const q = drop.indexOf(b);
      if (q < 0) return onTower(b) ? idleJ(b, 'bw', X(36) - rk(b) * 8) : { k: 'bup', go: stop => climbTower(b, X(36), stop) };
      // 뛰어내릴 사람: 탑 꼭대기 끝에 줄 서서, 모두 준비되면 하나 둘 셋!
      const spot = 38 * T - 14 - q * 26;
      return { k: 'bdrop' + q, go: function* (stop) {
        if (!onTower(b)) { yield* climbTower(b, spot, stop); return; }
        if (Math.abs(b.cx() - spot) > (b.tell ? 22 : 4)) { yield* b.walkTo(spot, b.tell ? 20 : 2, 20, stop); return; }
        sh['up' + q] = sim.t;
        const ready = () => drop.every(spotOK) && rider.me.gr && Math.abs(rider.cx() - (rideX)) < 26 && rider.me.gRef === sawB().id;
        if (b.tell) { if (!ready()) { yield* still(b, stop, { k: 'wait' }); return; } yield* b.jump(sB - 58 - q * 26, 3, stop); yield* b.wait(1); return; }   // 사람: 다 모이면 '점프!' — 내가 뛰면 AI가 따라 뛴다
        const hum = drop.find(isH), go = !hum && sh.goT > sim.t - 1500;          // 누가 "하나 둘 셋" 했으면 내 화면이 조금 늦어도 따른다
        if (!go && !ready()) { yield* still(b, stop, { k: 'wait' }); return; }
        if (hum) { for (let t = 0; t < 600 && hum.me.gr; t++) { if (!ready()) return; yield; } if (hum.me.gr) return; }   // 사람이 뛰는 순간 같이 뛴다
        else { if (!go) sh.goT = sim.t + 700; while (sim.t < sh.goT) yield; }
        yield* b.jump(sB - 58 - q * 26, 3);
        yield* b.wait(1.2);
      } };
    });
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};
/* 공중에서 몸을 틀어 x 위에 내려앉는다 (지나치면 되돌린다) */
function* airTo(b, x) {
  for (let t = 0; t < 240 && !b.me.gr; t++) {
    const d = x - b.cx(), v = b.me.vx, want = Math.max(-170, Math.min(170, d * 4));
    b.inp.r = v < want - 20 ? 1 : 0; b.inp.l = v > want + 20 ? 1 : 0;
    yield;
  }
  b.stop();
}
/* 탑(시소 탑)을 계단처럼 올라 x로 */
function* climbTower(b, x, stop) {
  if (b.tell) { yield* b.walkTo(x, 16, 40, stop); return; }
  for (let k = 0; k < 14 && b.feet() > 230; k++) { if (stop && stop()) return; const f = b.feet(); yield* b.jump(f > 400 ? X(33) : f > 340 ? X(34) : X(35) + 10, 4); yield* b.wait(0.05); }
  yield* b.walkTo(x, 3, 20, stop);
}

/* ───────── 4. 딱 맞게 ───────── */
scripts.spring = function (sim) {
  const B = sim.bots, n = sim.n, sh = share(sim, 'spring');
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b);
    const pad = k => b.obj('pad', k), door = k => b.obj('door', k), key = () => b.obj('key');
    // A. 문 앞뒤 저울 릴레이 (딱 맞는 인원). 건널 사람은 저울과 문 사이에서 기다린다 (저울을 다시 밟으면 무게가 틀어진다)
    yield* jobs(b, () => relayJob(b, sim, { near: () => [pad(0)], far: () => [pad(1)], open: () => door(0).open > 0.9, x0: door(0).x - 4, x1: door(0).x + door(0).w + 4,
      qx: b => X(12) + rk(b) * 6, wx: b => X(24) + rk(b) * 8 }));
    // B. 발사대: 먼저 왼쪽 높은 선반 단추로 한 명, 그다음 열쇠로 한 명 (하드: 넷 이상이면 바닥 저울에도 한 명)
    const lp = () => pad(2), gb = () => b.T.W.objs.find(o => o.type === 'btn' && o.y === 6 * T), pk = () => (hard && n >= 4) ? pad(3) : null, gl = () => door(1);
    const shelfL = o => o.me.gr && o.feet() <= 6 * T + 3 && o.cx() > 22 * T - 6 && o.cx() < 26 * T + 6;
    const keyed = () => key().hd >= 0 || key().used;
    yield* jobs(b, () => {
      if (keyed()) return null;
      if (n === 1) return { k: 'solo', go: function* (stop) { yield* b.walkTo(X(41) + 14, 6, 40, stop); yield* b.jump(X(40), 4); yield* b.jump(X(39), 4); yield* b.jump(X(38), 4); yield* b.jump(X(36), 6); yield* b.walkTo(X(35) + 16, 5, 10, stop); } };
      const av = B.filter(live), latched = gb().lat;
      // 왼쪽 선반에 오른 사람은 단추를 밟고 있는다 (둘이라 고정되었으면 내려온다)
      if (shelfL(b)) return latched ? gotoJ(b, 'sdown', X(27), 10) : { k: 'shold', go: stop => stay(b, ctr(gb()), stop, 14, gb()) };
      let ph = null;
      if (pk()) { const m = fill([pk()], av.filter(o => !shelfL(o)), n); for (const [o] of m) ph = o; if (ph === b) return { k: 'pk', go: stop => standOn(b, pk(), ctr(pk()), stop) }; }
      const shelfer = av.find(shelfL);
      const second = gl().open > 0.9 || latched;                     // 유리문이 열려 있으면 열쇠로 쏜다
      if (!second && shelfer) return idleJ(b, 'gw', X(27) + rk(b) * 8);   // 선반 친구가 단추를 밟을 때까지
      const pool = av.filter(o => o !== ph && !shelfL(o)), order = pool.slice().sort(pri), rider = order[0];
      const spot = o => { const r = order.indexOf(o) - 1, m = Math.max(1, order.length - 1); return o === rider ? (second ? 1040 : 910) : Math.round((second ? 900 : 945) + 95 * r / m); };
      if (!onIt(b, lp())) return { k: 'lon', go: stop => standOn(b, lp(), spot(b), stop) };
      const allOn = () => pool.every(o => onIt(o, lp())) && lp().load === pool.length && lp().comp > Math.min(lp().maxc, lp().load * lp().maxc / n) - 2;
      if (b === rider) return { k: 'lride' + second, go: function* (stop) {
        if (Math.abs(b.cx() - spot(b)) > 6 && !b.tell) { yield* b.walkTo(spot(b), 4, 10, stop); return; }
        if (b.tell) b.tell({ k: 'wait' });
        for (let t = 0; t < 60 * 5; t++) { if (b.me.vy < -400) break; if (stop()) return; yield; }
        if (b.me.vy < -400 && !b.tell) { yield* airTo(b, second ? X(35) : X(23) + 16); for (let t = 0; t < 120 && !b.me.gr; t++) yield; }
      } };
      return { k: 'ljump' + second, go: function* (stop) {
        if (Math.abs(b.cx() - spot(b)) > 8 && !b.tell) { yield* b.walkTo(spot(b), 4, 10, stop); return; }
        if (b.tell) { yield* b.jump(b.cx()); yield* b.wait(1); return; }   // 사람: 내가 뛰면 AI가 따라 뛴다
        const kk0 = second ? 'go2' : 'go1', hum0 = pool.find(o => isH(o) && o !== rider), go = !hum0 && sh[kk0] > sim.t - 1500;
        if (!go && !allOn()) { yield* still(b, stop, { k: 'wait' }); return; }
        const hum = hum0;
        if (hum) { for (let t = 0; t < 600 && hum.me.gr && onIt(hum, lp()); t++) { if (!allOn()) return; yield; } if (!(hum.me.vy < -100)) return; }   // 사람이 뛰는 순간 같이 뛴다
        else { if (!go) sh[kk0] = sim.t + 800; while (sim.t < sh[kk0]) yield; }
        b.inp.j = 1; yield* b.wait(0.25); b.inp.j = 0;
        for (let t = 0; t < 90 && !b.me.gr; t++) yield;
        yield* b.wait(0.6);
      } };
    });
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* ───────── 5. 둥둥 ───────── */
scripts.raft = function (sim) {
  const B = sim.bots, n = sim.n, sh = share(sim, 'raft');
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b);
    const raft = () => b.obj('raft'), cube = () => b.obj('box', 0), key = () => b.obj('key'), g1 = () => hard ? b.obj('btn', 0) : null, g2 = () => hard ? b.obj('btn', 1) : null, gate = () => hard ? b.obj('door', 0) : null;
    const crossed = o => o.cx() > X(28), aboard = o => footRef(o) === raft().id;
    const atDock = () => raft().st === 0 && Math.abs(raft().x - raft().x1) < 2;
    const cubeOn = () => cube().sup === raft().id;
    const keyFree = () => key().hd < 0 && !key().used;
    yield* jobs(b, () => {
      const near = B.filter(o => !o.me.fin && (o.me.dead > 0 || !crossed(o)));
      if (!near.length) {
        if (!keyFree()) return null;
        // 열쇠가 이쪽 나루에 남았다 (든 사람이 물에 빠졌다): 한 명이 일부러 물에 뛰어들어 이쪽 나루로 돌아가 열쇠를 가져온다
        return B.filter(o => live(o)).sort(pri)[0] === b ? gotoJ(b, 'kback', X(24), 6) : idleJ(b, 'fw', X(34) + rk(b) * 14);
      }
      if (keyFree() && !crossed(b) && !aboard(b) && live(b) && B.filter(o => live(o) && !crossed(o) && !aboard(o)).sort(pri)[0] === b)
        return { k: 'key', go: function* (stop) { yield* b.walkTo(X(6) - 4, 5, 20, stop); if (stop()) return; yield* b.jump(X(7), 4); } };   // 열쇠는 건너기 전에 줍는다
      if (crossed(b)) {
        if (hard && near.length) { const m = fill([g2()], B.filter(o => live(o) && crossed(o)), n); if (m.get(b)) return { k: 'g2', go: stop => stay(b, ctr(g2()), stop, 14, g2()) }; }
        return idleJ(b, 'fw', X(34) + rk(b) * 14);
      }
      if (aboard(b)) {
        if (raft().st === 2) return { k: 'off', go: stop => leaveRaft(b, raft, stop) };   // 건너편에 닿았다: 내린다
        return { k: 'ride', go: stop => still(b, stop, { k: 'wait' }) };
      }
      if (b.me.dead > 0) return { k: 'dead', go: stop => still(b, stop, { k: 'idle' }) };
      if (b.me.gr && b.me.gRef === cube().id && !cubeOn()) return gotoJ(b, 'coff', X(8), 10);   // 쇠 추 위에 올라섰다: 둑으로 내려온다 (위에 사람이 있으면 쇠 추를 못 민다)
      if (b.cx() > 10 * T) return b.cx() > 18 * T ? gotoJ(b, 'tfwd', X(30), 10) : { k: 'tair', go: stop => still(b, stop, { k: 'idle' }) };   // 물 위(뛰는 중·뗏목에서 내리는 중): 건너편으로 마저 간다
      // 수문 (하드): 건너편 단추가 눌릴 때까지 이쪽 단추를 지킨다
      const eligible = B.filter(o => live(o) && !crossed(o) && !aboard(o));
      let gh = null;
      if (hard && !(g2().on) && !g1().lat) { const m = fill([g1()], eligible, n); for (const [o] of m) gh = o; if (gh === b) return { k: 'g1', go: stop => stay(b, ctr(g1()), stop, 14, g1()) }; }
      const R = raft();
      if (!atDock() || R.st !== 0) return idleJ(b, 'nw', X(3) + rk(b) * 18);
      // 이번에 탈 사람: 이미 탄 사람 + 모자라면 차례대로 (남은 사람이 셋 이상이면 사람 셋, 아니면 한 명 + 쇠 추)
      const ppl = eligible.filter(o => o !== gh), on = B.filter(o => live(o) && aboard(o));
      const left = ppl.length + on.length, useCube = n > 1 && (cubeOn() || left < 3), k = useCube || n === 1 ? 1 : 3;   // 혼자면 한 명이 무게 3
      const order = on.concat(ppl.slice().sort(pri)), grp = order.slice(0, Math.max(k, on.length)).sort(pri);   // 줄 서는 자리는 차례(번호)로 정해 바뀌지 않게
      if (grp.indexOf(b) < 0) return idleJ(b, 'nw', X(3) + rk(b) * 18);
      if (useCube && !cubeOn() && !(cube().rs > 0)) {                    // 쇠 추를 둑 끝까지 밀어 뗏목에 떨어뜨린다 (빈 뗏목일 때)
        if ((R.load | 0) > 0) return idleJ(b, 'cw', X(5));
        if (b.cx() > cube().x - 4) return { k: 'cover', go: stop => overBox(b, cube(), -1, stop) };
        return { k: 'cpush', go: stop => b.hold(1, () => cubeOn() || b.cx() > 316 || stop(), 20, '쇠 추를 뗏목으로') };
      }
      if (cube().rs > 0) return idleJ(b, 'cw', X(5));
      const sp = grp.slice().sort((p, q) => ((isH(q) ? 1 : 0) - (isH(p) ? 1 : 0)) || pri(p, q)), hum = sp.find(isH);   // 사람은 둑 끝 자리(가장 뛰기 쉬운 곳)
      const kk = sp.indexOf(b), spot = [306, 276, 244][kk] || 306;
      const gateOk = () => !hard || g1().on || g2().on || gate().open > 0.9;
      const ready = () => sp.every((o, j) => aboard(o) || (Math.abs(o.cx() - ([306, 276, 244][j] || 306)) < (isH(o) ? 24 : 10) && o.me.gr && live(o))) && gateOk();
      return { k: 'board' + kk, go: function* (stop) {
        if (Math.abs(b.cx() - spot) > (b.tell ? 22 : 5)) { if (b.cx() < X(7) - 16 && !b.tell) { yield* b.walkTo(X(6) - 4, 5, 20, stop); yield* b.jump(X(7), 4); } yield* b.walkTo(spot, b.tell ? 20 : 3, 10, stop); return; }
        if (b.tell) { yield* b.jump(R.x + 48); return; }
        // 사람이 같이 탈 차례면 사람이 먼저 올라타는 걸 보고 곧바로 따라 탄다 (AI가 먼저 탔는데 사람이 머뭇거리면 모자란 인원으로 떠나 벽에 부딪힌다)
        if (hum && !(grp.some(aboard) && gateOk())) { yield* still(b, stop, { k: 'wait' }); return; }
        const now = grp.some(aboard) || sh.go > sim.t - 2500;             // 누가 먼저 탔으면 곧바로 따라 탄다
        if (!now && !ready()) { yield* still(b, stop, { k: 'wait' }); return; }
        if (!now) sh.go = sim.t + 500;
        while (sim.t < sh.go && !grp.some(aboard)) yield;
        let land = R.x1 + [64, 34, 8][kk];
        if (cubeOn()) { const cb = cube(), rr = R.x + R.w - (cb.x + cb.w), ll = cb.x - R.x; land = rr >= 34 ? cb.x + cb.w + rr / 2 : R.x + ll / 2; }   // 쇠 추를 피해 빈 쪽에
        yield* b.jump(land, 3);
        if (aboard(b) && !cubeOn()) { const tx = () => raft().x + [84, 48, 12][kk]; for (let t = 0; t < 45 && aboard(b) && Math.abs(b.cx() - tx()) > 3; t++) { b.inp.r = b.cx() < tx() ? 1 : 0; b.inp.l = b.cx() > tx() ? 1 : 0; yield; } b.stop(); }   // 고르게 벌려 선다
        yield* b.wait(0.3);
      } };
    });
    yield* b.walkTo(X(31) + b.i * 22, 8, 20);
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};
function* leaveRaft(b, raft, stop) {
  if (b.tell) { yield* b.walkTo(X(30), 14, 30, stop); return; }
  yield* b.wait(0.1 + (raft().x + raft().w - b.cx()) / 300);         // 오른쪽에 선 사람부터 차례로
  for (let t = 0, jt = 0; t < 600 && !(b.cx() > X(28) + 6 && b.me.gr && b.me.gRef !== raft().id) && b.me.dead <= 0; t++) {
    b.inp.r = 1;
    if (b.me.gr && b.me.gRef === raft().id && (b.cx() > raft().x + 78 || b.me.pu)) jt = 18;
    b.inp.j = jt-- > 0 ? 1 : 0;
    yield;
  }
  b.stop(); b.inp.j = 0;
}

/* ───────── 6. 찌릿찌릿 ───────── */
scripts.circuit = function (sim) {
  const B = sim.bots, n = sim.n;
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b), door = k => b.obj('door', k);
    avoid(b, tag(b, 'short').concat(tag(b, 'cut')));
    const R = (k, o) => Object.assign({ open: () => door(k).open > 0.9, x0: door(k).x - 4, x1: door(k).x + door(k).w + 4 }, o);
    // A. 병렬 문
    yield* jobs(b, () => relayJob(b, sim, R(0, { near: b => tag(b, 'pA'), far: b => tag(b, 'pB'), qx: b => X(10) + rk(b) * 5, wx: b => X(18) + rk(b) * 12 })));
    // B. 직렬 + 우회 스위치 (하드: 합선 스위치는 밟지 않는다)
    yield* jobs(b, () => relayJob(b, sim, R(1, { near: b => need1(b, 'ser'), far: b => tag(b, 'byp'), qx: b => X(19) - rk(b) * 5, wx: b => X(43) + rk(b) * 12 })));
    // C. 병렬 다리 (하드: 다리 앞 끊는 스위치는 뛰어넘는다)
    const br = door(2), cut = tag(b, 'cut')[0];
    const cross = function* (stop) {
      if (b.tell) { yield* b.walkTo(br.x + br.w + 40, 16, 30, stop); return; }
      if (cut && b.cx() < cut.x + cut.w + 4) { yield* b.walkTo(cut.x - 18, 4, 20, stop); if (stop()) return; yield* b.jump(cut.x + 70, 6); }
      yield* goto(b, br.x + br.w + 40, stop, 16);
    };
    yield* jobs(b, () => relayJob(b, sim, { near: b => tag(b, 'bA'), far: b => tag(b, 'bB'), open: () => door(2).open < 0.1, x0: br.x - 4, x1: br.x + br.w + 4, cross: (b, stop) => cross(stop),
      qx: b => X(44) - rk(b) * 6, wx: b => X(61) + rk(b) * 10 }));
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* ───────── 7. 불을 꺼라 ───────── */
scripts.fire = function (sim) {
  const B = sim.bots, n = sim.n;
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const hard = isHard(b), fire = k => b.obj('fire', k), fuel = () => b.obj('box', 0);
    avoid(b, tag(b, 'bel'));
    // A. 공기 구멍 막기 + 저쪽 공기 밸브 (하드: 풀무는 밟지 않는다)
    const f0 = fire(0);
    yield* jobs(b, () => relayJob(b, sim, { near: b => need1(b, 'vent'), far: b => tag(b, 'damper'), open: () => fire(0).out > 0.99, x0: f0.x - 8, x1: f0.x + f0.w + 8,
      qx: b => X(16) - rk(b) * 3, wx: b => X(25) + rk(b) * 12 }));
    // B. 장작 상자 밀어 내기
    yield* jobs(b, () => {
      if (B.every(o => o.me.fin || (live(o) && o.cx() > fuel().x + fuel().w + 8))) return null;
      if (b.cx() > fuel().x + fuel().w + 8) return idleJ(b, 'bw', X(38) + rk(b) * 10);
      if (fire(1).out < 0.99) return { k: 'fpush', go: stop => b.hold(1, () => fire(1).out > 0.99 || stop(), 40, '장작을 밀어 냄') };
      return { k: 'fover', go: stop => overBox(b, fuel(), 1, stop) };
    });
    // C. 선반 위 물 뿌리개 + 저쪽 수도꼭지
    const f2 = fire(2);
    yield* jobs(b, () => shelfRelayJob(b, sim, { c0: 44, tall: hard, sw: b => tag(b, 'sp')[0], far: b => tag(b, 'sp2'), open: () => fire(2).out > 0.99, x0: f2.x - 8, x1: f2.x + f2.w + 8, goal: X(56) }));
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* ───────── 8. 두둥실 ───────── */
/* 열기구 (그때그때): 아래 버너를 밟는 사람, 탈 사람(두 명까지)을 정해 여러 번 나눠 올라가고, 마지막에는 위에 오른 사람이 위 버너로 끌어올린다 */
function balloonJob(b, sim, c) {
  const B = sim.bots, n = sim.n, L = c.lift(b), h1 = c.h1(b), h2 = c.h2(b), cap = L.cap || 99;
  const onL = o => footRef(o) === L.id, up = o => o.cx() > c.landX - 24 && o.me.gr && !onL(o) && o.feet() < c.topY + 8;
  const past = o => o.cx() > c.landX && o.feet() > c.topY + 40;     // 높은 땅을 지나 아래로 내려가 버렸다 (다시 못 올라와 위 버너를 못 밟는다)
  const low = B.filter(o => !o.me.fin && !up(o) && !past(o));
  if (!low.length) return null;
  if (past(b)) return null;
  if (n === 1) return { k: 'solo', go: function* (stop) { if (!onL(b)) { yield* boardLift(b, L, c, stop); return; } if (L.t > 0.995) { yield* b.hold(1, () => up(b) || stop(), 8); return; } yield* still(b, stop, { k: 'wait' }); } };
  const k1 = need(h1, n), k2 = need(h2, n), ups = B.filter(o => live(o) && up(o));
  const final = low.length <= cap && ups.length >= k2;               // 남은 사람이 다 탈 수 있고, 위에서 끌어올려 줄 사람이 있다
  const wx = L.x1 - 20;                                              // 열기구 바로 옆 (버너를 밟지 않는 자리)
  if (up(b)) {
    if (final && low.every(o => live(o) && onL(o))) { const m = fill([h2], ups, n), s = m.get(b); if (s) return { k: 'h2', go: stop => stay(b, spotOn(b, s, m), stop, 10, s) }; }
    if (final) { const m = fill([h2], ups, n); if (m.get(b)) return idleJ(b, 'h2w', h2.x - 34); }   // 버너 바로 옆 (밟지 않고)
    return idleJ(b, 'uw', Math.max(c.goal, h2.x + h2.w + 24) + rk(b) * 14);          // 위 버너를 밟지 않는 자리에서
  }
  if (b.me.dead > 0) return { k: 'dead', go: stop => still(b, stop, { k: 'idle' }) };
  // 버너 지기(k1명)와 이번에 탈 사람(cap명). 마지막에는 남은 사람이 다 탄다
  const lowL = low.filter(live), riding = lowL.filter(onL);
  stuckFor(sim, c.sh, 'lost', !final && low.length <= k1, 5000, '위에서 버너를 밟아 줄 사람이 없다 (처음부터)');
  const holders = final ? [] : [...fill([h1], lowL.filter(o => !onL(o)), n).keys()];
  const rest = lowL.filter(o => !onL(o) && holders.indexOf(o) < 0).sort(pri), riders = final ? lowL : riding.concat(rest).slice(0, cap);
  if (onL(b)) {
    if (L.t > 0.995) return { k: 'off', go: stop => b.hold(1, () => up(b) || stop(), 8, '내리기') };
    if (riders.indexOf(b) < 0 && L.t < 0.02) return gotoJ(b, 'loff', L.x1 - 24, 6);   // 너무 많이 탔다: 내린다
    return { k: 'ride', go: stop => still(b, stop, { k: 'wait' }) };
  }
  if (holders.indexOf(b) >= 0) {
    const go = riders.length > 0 && riders.every(onL);
    if (go && (L.t < 0.995 || riders.some(o => !up(o) && onL(o)))) return { k: 'h1', go: stop => stay(b, spotOn(b, h1, new Map(holders.map(o => [o, h1]))), stop, 10, h1) };
    return idleJ(b, 'h1w', h1.x - 24 - rk(b, holders) * 10);
  }
  if (riders.indexOf(b) >= 0) {
    if (L.t > 0.02) return idleJ(b, 'rw', wx);
    return { k: 'board', go: stop => boardLift(b, L, c, stop) };
  }
  return idleJ(b, 'lw', h1.x - 40 - rk(b) * 14);
}
function* boardLift(b, L, c, stop) {
  if (b.tell) { yield* b.jump(c.boardX); return; }
  if (L.t > 0.02) { yield* still(b, stop); return; }
  yield* b.walkTo(L.x - 18, 6, 30, stop); if (stop()) return;
  yield* b.jump(c.boardX + (b.i % 3) * 14 - 14, 4); yield* b.wait(0.15);
}
scripts.balloon = function (sim) {
  const B = sim.bots, sh = share(sim, 'balloon');
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const btn = k => b.obj('btn', k), lift = k => b.obj('lift', k);
    yield* jobs(b, () => balloonJob(b, sim, { lift: () => lift(0), h1: () => btn(0), h2: () => btn(1), boardX: 13 * T + 16 + 56, landX: 17 * T + 14, topY: 7 * T, goal: X(23), sh: sh }));
    yield* jobs(b, () => balloonJob(b, sim, { lift: () => lift(1), h1: () => btn(2), h2: () => btn(3), boardX: 29 * T + 8 + 40, landX: 47 * T + 14, topY: 5 * T, goal: X(54), sh: sh }));
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* ───────── 9. 꽁꽁 사르르 ───────── */
scripts.freeze = function (sim) {
  const B = sim.bots;
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const door = k => b.obj('door', k), d0 = door(0), d1 = door(1), d2 = door(2);
    avoid(b, tag(b, 'dec'));
    // A. 얼음 다리 (앞뒤 냉각판)
    yield* jobs(b, () => relayJob(b, sim, { near: b => tag(b, 'cA'), far: b => tag(b, 'cB'), open: () => door(0).open < 0.1, x0: d0.x - 4, x1: d0.x + d0.w + 4,
      qx: b => X(9) - rk(b) * 3, wx: b => 752 - rk(b) * 2 }));
    // B. 얼음벽: 가열판(팀 인원보다 하나 적다) + 저쪽 가열판 (하드: 냉각판은 밟지 않는다)
    yield* jobs(b, () => relayJob(b, sim, { near: b => need1(b, 'ser'), far: b => tag(b, 'hf'), open: () => door(1).open > 0.9, x0: d1.x - 4, x1: d1.x + d1.w + 4,
      qx: b => 752 - rk(b) * 2, wx: b => X(46) + rk(b) * 12 }));
    // C. 넓은 물 (하드: 이쪽 냉각판 둘)
    yield* jobs(b, () => relayJob(b, sim, { near: b => tag(b, 'cC').concat(tag(b, 'cE')), far: b => tag(b, 'cD'), open: () => door(2).open < 0.1, x0: d2.x - 4, x1: d2.x + d2.w + 4,
      qx: b => X(47) - rk(b) * 6, wx: b => X(67) + rk(b) * 4 }));
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* ───────── 10. 빛을 따라 ───────── */
scripts.light = function (sim) {
  const B = sim.bots, n = sim.n;
  B.forEach(b => b.play(function* (b) {
    yield* start(b);
    const door = k => b.obj('door', k), d0 = door(0), d1 = door(1), d2 = door(2);
    // A. 거울 하나 + 벽 위 틈으로 건너가는 빛
    yield* jobs(b, () => relayJob(b, sim, { near: b => tag(b, 'lA'), far: b => tag(b, 'lB'), open: () => door(0).open > 0.9, x0: d0.x - 4, x1: d0.x + d0.w + 4,
      qx: b => X(11) + rk(b) * 4, wx: b => X(24) + rk(b) * 12 }));
    // B. 거울 둘: 처음부터 틀어진 거울의 발판만 밟는다 (헷갈리게 하는 발판·처음부터 맞는 거울의 발판은 밟지 않는다)
    const W = b.T.W, wrong = W.objs.filter(o => o.type === 'mirror' && o.x === 41 * T && o.ok !== undefined && (o.d | 0) !== o.ok && !(o.okN && n <= o.okN) && !(o.soloOk && n <= 1)).map(m => W.byId[m.link[0]]);
    avoid(b, W.objs.filter(o => o.type === 'mirror' && o.x === 41 * T && o.link && wrong.indexOf(W.byId[o.link[0]]) < 0).map(m => W.byId[m.link[0]]));
    yield* jobs(b, () => relayJob(b, sim, { near: () => wrong, far: b => tag(b, 'lD'), open: () => door(1).open > 0.9, x0: d1.x - 4, x1: d1.x + d1.w + 4,
      qx: b => X(27) - rk(b) * 6, wx: b => X(54) + rk(b) * 10 }));
    // C. 높은 선반의 발판 + 저쪽 빛
    avoid(b, []);
    yield* jobs(b, () => shelfRelayJob(b, sim, { c0: 59, tall: isHard(b), sw: b => tag(b, 'lE')[0], far: b => tag(b, 'lF'), open: () => door(2).open > 0.9, x0: d2.x - 4, x1: d2.x + d2.w + 4, goal: X(73) }));
    while (!(yield* goExit(b))) yield* b.wait(0.5);
  }));
};

/* 연대 책임(하드)으로 판이 깃발부터 다시 시작되면 대본도 새로 건다 (시험 도구가 sim.rerun을 부른다. 혼자 연습은 practice.js가 다시 건다) */
for (const id of Object.keys(scripts)) { const f = scripts[id]; scripts[id] = sim => { sim.rerun = () => f(sim); f(sim); }; }
const AI = { scripts, hopOn, offHead, goExit, stay, overBox, X, jobs, relayJob, towerJob };
if (typeof module !== 'undefined' && module.exports) module.exports = AI; else root.YCAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
