/* 혼자 연습 시험: 0번 자리에 '사람 흉내'를 앉히고 AI 친구들이 끝까지 함께 깨는지 본다.
   사람 흉내는 AI 대본이 알려 주는 일(화살표·말풍선)을 조금 늦게 따라 하다가, 가끔은 제멋대로 앞서 달려가거나 한동안 가만히 서 있는다.
   node tests/human.js [normal|hard] [only=스테이지id] [runs=판 수]                                                          */
'use strict';
const { YC, Sim, Bot } = require('./harness.js');
const AI = require('../js/ai.js');
const argv = process.argv.slice(2);
const MODES = argv.includes('hard') ? [1] : argv.includes('normal') ? [0] : [0, 1];
const ONLY = (argv.find(a => a.startsWith('only=')) || '').slice(5);
const RUNS = +((argv.find(a => a.startsWith('runs=')) || '').slice(5) || 3);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* practice.js의 Guide와 같은 일을 한다: 키를 누르지 않고 할 일만 알린다 */
function Guide(sim, i) { Bot.call(this, sim, i); this.hint = null; }
Guide.prototype = Object.create(Bot.prototype);
Guide.prototype.tell = function (h) { this.hint = h; };
Guide.prototype.drive = function () {
  if (this.gen && !this.done) { try { const r = this.gen.next(); if (r.done) { this.done = true; this.hint = null; } } catch (e) { this.done = true; this.err = e; this.hint = null; } }
  this.me.ride = true;
  this.act();
  this.inp.jp = this.inp.j && !this.pj ? 1 : 0; this.pj = this.inp.j;
};
Guide.prototype.until = function* (fn) { const h = this.hint; if (h && h.k !== 'wait' && h.k !== 'idle') this.tell(null); while (!fn()) yield; };
Guide.prototype.walkTo = function* (x, tol, timeout, stop) { const t = Math.max(tol || 2, 22); this.tell({ k: 'go', x: x }); while (!(Math.abs(this.cx() - x) <= t && this.me.gr)) { if (stop && stop()) return; yield; } };
Guide.prototype.hold = function* (dir, fn) { this.tell({ k: 'push', dir: dir }); while (!fn()) yield; };
Guide.prototype.jump = function* (x, tol, stop) { this.tell({ k: 'jump', x: x }); let air = false; for (let t = 0; t < 60 * 20; t++) { if (!this.me.gr) air = true; else if (air) break; if (stop && stop()) return; yield; } };
Guide.prototype.enter = function* () { this.tell({ k: 'door' }); while (!this.me.fin && this.me.atExit) yield; };
/* 사람 흉내: 알림을 늦게 따라 하고, 가끔 딴짓을 한다 */
Guide.prototype.act = function () {
  const R = this.rand, inp = this.inp, me = this.me, W = this.T.W;
  inp.l = inp.r = inp.j = inp.en = 0;
  if (this.rogue > 0) {                                              // 딴짓: 오른쪽(앞)으로 내달리거나, 그 자리에 가만히
    this.rogue--;
    if (this.rogueKind === 0) { inp.r = 1; if (me.gr && Math.abs(me.vx) < 5) inp.j = 1; }
    return;
  }
  if (R() < 1 / (60 * 25)) { this.rogue = 60 + Math.floor(R() * 180); this.rogueKind = R() < 0.6 ? 0 : 1; return; }   // 25초에 한 번쯤
  const h = this.hint;
  if (!h) return;
  const key = h.k + ':' + (h.x | 0) + ':' + (h.dir | 0);
  if (key !== this.hk) { this.hk = key; this.lag = me.gr ? 20 + Math.floor(R() * 50) : 4; }   // 새 알림은 조금 늦게 알아챈다 (공중에서는 바로 몸을 튼다)
  if (this.lag > 0) { this.lag--; return; }
  const d = h.x - this.cx();
  if (this.hj > 0) { this.hj--; inp.j = 1; }                         // 한 번 뛰면 끝까지 누른다
  if (h.k === 'go') {
    if (Math.abs(d) > 10) {
      inp.r = d > 0 ? 1 : 0; inp.l = d < 0 ? 1 : 0;
      const dir = d > 0 ? 1 : -1, ahead = W.boxes.some(o => !(o.rs > 0) && Math.abs(o.y + o.h - (me.y + 28)) < 8 && (dir > 0 ? o.x - (me.x + 24) : me.x - (o.x + o.w)) > -2 && (dir > 0 ? o.x - (me.x + 24) : me.x - (o.x + o.w)) < 34 && (dir > 0 ? h.x > o.x + o.w : h.x < o.x));
      const fx = this.cx() + dir * 22, fy = me.y + 28 + 4, T = 32;
      const hole = !W.solid(Math.floor(fx / T), Math.floor(fy / T)) && !W.solids.some(q => fx > q.x && fx < q.x + q.w && fy > q.y && fy < q.y + q.h + 4) && !W.saws.some(q => Math.abs(fx - q.px) < q.L);
      if (me.gr && (ahead || (hole && Math.abs(d) > 40) || (Math.abs(me.vx) < 3 && this.st++ > 15))) { this.hj = 18; inp.j = 1; this.st = 0; }   // 앞을 막은 상자·구덩이는 뛰어넘는다 (사람이라면 그렇게 한다)
    } else this.st = 0;
  }
  else if (h.k === 'jump') { if (me.gr && this.jt <= 0 && this.jk !== key) { this.hj = 18; inp.j = 1; this.jt = 40; this.jk = key; } else { this.jt--; if (this.jt < -90) this.jk = null; if (!me.gr) { inp.r = d > 4 ? 1 : 0; inp.l = d < -4 ? 1 : 0; } } }   // 같은 알림에는 한 번만 뛴다 (못 하면 1.5초 뒤 다시)
  else if (h.k === 'push') { inp.r = h.dir > 0 ? 1 : 0; inp.l = h.dir < 0 ? 1 : 0; }
  else if (h.k === 'door') inp.en = 1;
};

let pass = 0, fail = 0; const fails = [];
for (const df of MODES) for (const id of YC.order) {
  if (ONLY && ONLY !== id) continue;
  const row = [];
  for (const n of (process.env.N ? [+process.env.N] : [2, 3, 4, 6])) {
    let ok = 0, ts = [];
    for (let r = 0; r < RUNS; r++) {
      const s = new Sim({ n, stages: [id], delay: 0, seed: 11 + r, df: df, lseed: r ? 1000 + r * 77 : 0 });
      YC.opt.noBlock = true;                                         // 혼자 연습처럼: AI와는 서로 통과한다
      const g = new Guide(s, 0); g.rand = rng(99 + r * 13 + n); g.rogue = 0; g.st = 0; g.jt = 0; g.lag = 0; g.hj = 0; s.bots[0] = g;
      AI.scripts[id](s);
      let done, rs = 0;
      const restart = () => {                                         // AI가 '꼬였다'고 하면 혼자 연습처럼 다 같이 처음부터
        if (!s.bots.some(b => b.err && b.err.fatal)) return;
        if (process.env.VERB) console.log('  ↺ ' + (s.t / 1000).toFixed(0) + '초 ' + s.bots.find(b => b.err && b.err.fatal).err.message);
        const run0 = s.anchor().TS.run; rs++;
        for (const t of s.teams) t.me.vote = 1;
        s.run(6, () => s.anchor().TS.run !== run0);
        for (const t of s.teams) t.me.vote = 0;
        for (const b of s.bots) { b.err = null; b.done = false; b.lastErr = null; }
        AI.scripts[id](s);
      };
      if (!process.env.TRACE) { done = false; for (let t = 0; t < 600 && !done; t += 2) { done = s.run(2, () => s.teams.every(t => t.TS.ph === 4)); if (!done) restart(); } }
      else if (process.env.TRACE) { done = false; for (let t = 0; t < 600 && !done; t += 1) { done = s.run(1, () => s.teams.every(t => t.TS.ph === 4)); if (t % (+process.env.TRACE) === 0) console.log(t, s.bots.map(b => b.i + '@' + Math.round(b.cx()) + ',' + Math.round(b.feet()) + ' ' + (b.job || '') + (b.hint ? '<' + b.hint.k + (b.hint.x ? ':' + Math.round(b.hint.x) : '') + '>' : '') + (b.rogue > 0 ? '*' : '')).join('  ')); } }

      if (done) { ok++; ts.push(Math.round(s.anchor().TS.cl[0] / 1000) + (rs ? '↺' + rs : '')); pass++; }
      else { fail++; fails.push(YC.DIFF[df] + ' ' + id + ' ' + n + '명 #' + r + ' → ' + s.bots.map(b => 'x=' + Math.round(b.cx()) + (b.job ? ' ' + b.job : '') + (b.lastErr ? ' [' + b.lastErr.slice(0, 40) + ']' : '')).join(' | ')); }
    }
    row.push(n + '명 ' + ok + '/' + RUNS + (ts.length ? ' (' + ts.join(',') + '초)' : ''));
  }
  console.log(YC.DIFF[df], (YC.build(id).name + '        ').slice(0, 8), row.join('  '));
}
console.log('\n통과 ' + pass + ' / 실패 ' + fail);
for (const f of fails) console.log('  실패: ' + f);
process.exit(fail ? 1 : 0);
