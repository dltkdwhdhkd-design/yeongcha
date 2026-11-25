/* 시험용: 한 프로세스 안에서 여러 기기(팀원)를 돌리고, 그 사이 통신에 지연·흔들림·유실을 넣는다. */
'use strict';
const YC = require('../js/core.js');
require('../js/levels.js');
const Bot = require('../js/bot.js');

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function Sim(o) {
  YC.opt.noBlock = !o.block;                                          // 기본: 봇끼리 길 막기 없음 (block:true면 실제 게임과 같게)
  this.n = o.n; this.t = 0; this.q = []; this.delay = o.delay || 0; this.jitter = o.jitter || 0; this.loss = o.loss || 0; this.rand = rng(o.seed || 1);
  this.teams = []; this.bots = []; this.log = [];
  const slots = []; for (let i = 0; i < o.n; i++) slots.push(i);
  for (let i = 0; i < o.n; i++) {
    const tm = new YC.Team({ slot: i, slots: slots, stages: o.stages, build: YC.build, spect: !!o.spect, seed: o.lseed | 0, df: o.df | 0 });
    tm.selfDelay = this.delay; tm.cd0 = o.cd0 === undefined ? 0.3 : o.cd0;
    this.teams.push(tm); this.bots.push(new Bot(this, i));
  }
  this.spectate = [];
  for (const tm of this.teams) tm.start(0, tm.slot === 0);
}
Sim.prototype.step = function () {
  this.t += 1000 / 60;
  const q = this.q;
  // 도착한 것 전달
  let w = 0;
  for (let i = 0; i < q.length; i++) {
    const m = q[i];
    if (m.at <= this.t) { const tm = this.teams[m.to]; if (this.bots[m.to].off) continue; if (m.ch === 'p') tm.onPlayer(m.from, m.d, this.t); else tm.onWorld(m.from, m.d, this.t); }
    else q[w++] = m;
  }
  q.length = w;
  for (let i = 0; i < this.n; i++) {
    const tm = this.teams[i], b = this.bots[i];
    if (b.off) continue;                                            // 꺼진 기기
    b.drive();
    tm.tick(b.inp, 1 / 60, this.t);
    for (const e of tm.ev) this.log.push([Math.round(this.t), i].concat(e));
    tm.ev.length = 0;
    for (const m of tm.out) {
      if (m[0] === 'v') { this.spectate.push(m[1]); continue; }
      const d = JSON.parse(JSON.stringify(m[1]));
      for (let j = 0; j < this.n; j++) {
        if (j === i || this.rand() < this.loss) continue;
        q.push({ at: this.t + this.delay + this.rand() * this.jitter, to: j, from: i, ch: m[0], d: d });
      }
    }
    tm.out.length = 0;
  }
};
/* 모든 봇의 대본이 끝나거나 조건이 참이 될 때까지 */
Sim.prototype.run = function (sec, until) {
  const end = this.t + sec * 1000;
  while (this.t < end) {
    this.step();
    if (until && until()) return true;
    if (!until && this.bots.every(b => !b.gen || b.done)) return true;
  }
  return false;
};
Sim.prototype.anchor = function () { return this.teams.find(t => t.anchor); };
/* 글자로 그린 지도 (디버그) */
Sim.prototype.dump = function (i, x0, x1) {
  const tm = this.teams[i || 0], W = tm.W, T = YC.T; const rows = W.g.map(r => r.split(''));
  const put = (x, y, c) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (rows[ty] && tx >= 0 && tx < W.cols) rows[ty][tx] = c; };
  for (const o of W.objs) {
    if (o.type === 'box' && !o.rs) for (let yy = o.y; yy < o.y + o.h; yy += T) for (let xx = o.x; xx < o.x + o.w; xx += T) put(xx + 1, yy + 1, 'B');
    else if (o.type === 'door') { for (let yy = o.y; yy < o.y + o.h * (1 - o.open) - 1; yy += T) put(o.x + o.w / 2, yy + 1, 'D'); }
    else if (o.type === 'btn') put(o.x + o.w / 2, o.y - 1, o.on ? '_' : '=');
    else if (o.type === 'key') put(o.x + 10, o.y + 10, 'k');
    else if (o.type === 'exit') put(o.x + 10, o.y + 30, o.open ? 'O' : 'X');
    else if (o.type === 'lift' || o.type === 'raft') for (let xx = o.x; xx < o.x + o.w; xx += T) put(xx + 1, o.y + 1, '-');
    else if (o.type === 'pad') for (let xx = o.x; xx < o.x + o.w; xx += T) put(xx + 1, o.y + o.comp + 1, 'P');
    else if (o.type === 'saw') for (let s = -o.L; s <= o.L; s += 16) { const p = YC.sawPoint(o, s); put(p.x, p.y + 2, '/'); }
    else if (o.type === 'water') for (let xx = o.x; xx < o.x + o.w; xx += T) put(xx + 1, o.y + 4, '~');
  }
  for (const p of tm.people()) put(p.x + 12, p.y + 14, String(p.slot));
  const a = x0 === undefined ? 0 : x0, b = x1 === undefined ? W.cols : x1;
  return rows.map(r => r.slice(a, b).join('')).join('\n');
};

module.exports = { YC, Sim, Bot };
