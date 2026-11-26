/* 영차영차 — bot.js : AI 친구(봇). 대본(제너레이터)대로 키를 누른다.
   혼자 연습의 AI 친구, 노드 시험(tests/harness.js), 브라우저 시험(tests/webbot.js)이 함께 쓴다. */
(function (root) {
'use strict';
function Bot(sim, i) { this.sim = sim; this.i = i; this.T = sim.teams[i]; this.me = this.T.me; this.inp = { l: 0, r: 0, j: 0, jp: 0, en: 0 }; this.pj = 0; this.gen = null; this.done = false; this.err = null; this.off = false; this.noHop = false; }
Bot.prototype.play = function (fn) { this.gen = fn(this); this.done = false; this.err = null; this.avoid = null; this.aim = null; };   // 스테이지마다 새로 (앞 스테이지의 '밟으면 안 되는 판'이 남지 않게)
Bot.prototype.drive = function () {
  if (this.gen && !this.done) {
    try { const r = this.gen.next(); if (r.done) { this.done = true; this.inp.l = this.inp.r = this.inp.j = this.inp.en = 0; } }
    catch (e) { this.done = true; this.err = e; this.inp.l = this.inp.r = this.inp.j = this.inp.en = 0; }
  }
  this.inp.jp = this.inp.j && !this.pj ? 1 : 0; this.pj = this.inp.j;
};
Bot.prototype.cx = function () { return this.me.x + 12; };
Bot.prototype.feet = function () { return this.me.y + 28; };
Bot.prototype.W = function () { return this.T.W; };
Bot.prototype.obj = function (type, k) { let c = 0; for (const o of this.T.W.objs) if (o.type === type && c++ === (k || 0)) return o; return null; };
Bot.prototype.stop = function () { this.inp.l = this.inp.r = 0; };
Bot.prototype.wait = function* (sec) { for (let i = 0; i < sec * 60; i++) yield; };
Bot.prototype.until = function* (fn, timeout, what) { let t = 0; while (!fn()) { yield; if ((t += 1 / 60) > (timeout || 20) * (this.sim.tmul || 1)) throw new Error('기다리다 시간 초과: ' + (what || fn.toString().slice(0, 80)) + ' (봇 ' + this.i + ', x=' + Math.round(this.cx()) + ')'); } };
/* 걸어서 x(몸 가운데)까지. 가까워지면 톡톡 끊어 누르고, 막히면 뛰어넘는다. 멈춰 선 뒤에도 벗어나 있으면 다시 맞춘다 */
Bot.prototype.walkTo = function* (x, tol, timeout, stop) {                   // stop(): 참이 되면 그만둔다 (할 일이 바뀜)
  tol = tol || 2; let t = 0, k = 0, stuck = 0, lx = this.cx(), hop = -8, crowd = 0, aim = null, gy = 0;
  if (!this.me.gr && this.aim && this.sim.t - this.aim.t < 1000) { aim = this.aim.x; gy = this.aim.gy; }   // 판을 넘어 뛰는 중에 할 일이 바뀌었다: 하던 대로 내려앉는다 (공중에서 몸을 돌리면 판 위에 떨어진다)
  for (let pass = 0; pass < 4; pass++) {
    while (Math.abs(this.cx() - x) > tol) {
      if (stop && stop()) { this.stop(); this.inp.j = 0; return; }
      const d = x - this.cx(), near = Math.abs(d) < 16 && this.me.mat !== 'I';
      const press = !near || (k++ % 3 === 0);
      this.inp.r = press && d > 0 ? 1 : 0; this.inp.l = press && d < 0 ? 1 : 0;
      if (!near && Math.abs(this.cx() - lx) < 0.3 && this.me.gr) stuck++; else stuck = 0;
      lx = this.cx();
      if (this.me.hRef < 0 && Math.abs(d) < 30) { if ((crowd += 3) > 30) break; } else if (crowd > 0) crowd--;      // 목표 바로 앞에서 친구에게 막혔으면 그만하면 됐다
      if (stuck > 12 && hop <= -8 && !this.noHop) { hop = 16; stuck = 0; }                   // 막히면 뛰어넘는다 (noHop이면 기다린다)
      if (this.avoid && this.me.gr && hop <= -8) { const lt = this.hopPlan(x, d); if (lt !== null) { hop = 16; aim = lt; gy = this.feet(); this.aim = { x: lt, gy: gy, t: this.sim.t }; } }   // 밟으면 안 되는 판(합선·냉각판·풀무…)은 뛰어넘는다
      if (aim !== null) { if (this.me.gr && hop < 15) aim = null; else if (!this.me.gr) this.steer(aim, gy); }       // 판 너머 빈 바닥에 내려앉게 공중에서 맞춘다
      this.inp.j = hop > 0 ? 1 : 0; hop--;
      yield;
      if ((t += 1 / 60) > (timeout || 12) * (this.sim.tmul || 1)) { this.stop(); this.inp.j = 0; throw new Error('걷다 시간 초과: 목표 ' + x + ', 지금 ' + Math.round(this.cx()) + ' (봇 ' + this.i + ')'); }
    }
    this.stop(); this.inp.j = 0;
    for (let i = 0; i < 40 && (Math.abs(this.me.vx) > 4 || !this.me.gr); i++) { if (stop && stop()) return; if (aim !== null && !this.me.gr) this.steer(aim, gy); else this.stop(); yield; }
    aim = null;
    if (Math.abs(this.cx() - x) <= tol + 1 || this.me.mat === 'I' || crowd > 30) break;
  }
};
const GRAV = 1800, RUN = 170;                                                     // core.js의 G·MOVE와 같다
/* 밟으면 안 되는 판(this.avoid) 넘기: 판은 몸 가운데가 그 위에 서야 눌린다.
   가운데가 판 앞에 있을 때 뛰어, 판 너머 빈 바닥(다음 판과의 틈이면 그 틈 가운데)에 내려앉는다.
   뛸 때면 내려앉을 자리를, 아직이면 null을 돌려준다 (판이 줄지어 있어도 한 번에 하나씩 정확히 넘는다) */
Bot.prototype.hopPlan = function (x, d) {
  const s = d > 0 ? 1 : -1, p = s * this.cx(), tx = s * x, m = [];
  const zs = this.avoid.map(z => s > 0 ? [z.x0, z.x1] : [-z.x1, -z.x0]).sort((a, b) => a[0] - b[0]);
  for (const z of zs) { const l = m[m.length - 1]; if (l && z[0] - l[1] < 12) l[1] = Math.max(l[1], z[1]); else m.push([z[0], z[1]]); }   // 틈이 좁으면 한 판으로
  for (let i = 0; i < m.length; i++) {
    const z = m[i];
    if (z[1] <= p) continue;                                                        // 지나왔다
    if (z[0] <= p || tx <= z[1]) return null;                                       // 이미 판 위이거나, 판 너머로 갈 일이 없다
    const gap = z[0] - p; if (gap > 40) return null;
    const nx = i + 1 < m.length ? m[i + 1][0] : Infinity;
    let lt = nx - z[1] >= 40 ? z[1] + 20 : (z[1] + nx) / 2;
    if (tx < nx) lt = Math.min(lt, Math.max(tx, z[1] + 6));                         // 가려는 곳이 바로 그 틈이면 거기로
    if (gap > 4 && (lt - p > 94 || Math.abs(this.me.vx) < 150)) return null;        // 더 다가가서 (제 속도로) 뛴다
    return s * lt;
  }
  return null;
};
/* 공중에서 x에 내려앉도록 좌우를 맞춘다 (gy: 내려앉을 바닥의 발 높이) */
Bot.prototype.steer = function (x, gy) {
  const vy = this.me.vy, h = gy - this.feet();
  const tl = Math.max(1 / 60, (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * GRAV * h))) / GRAV);
  const want = Math.max(-RUN, Math.min(RUN, (x - this.cx()) / tl)), v = this.me.vx;
  this.inp.r = v < want - 12 ? 1 : 0; this.inp.l = v > want + 12 ? 1 : 0;
};
/* dir 쪽을 누른 채 조건이 참이 될 때까지 */
Bot.prototype.hold = function* (dir, fn, timeout, what) {
  let t = 0;
  while (!fn()) { this.inp.r = dir > 0 ? 1 : 0; this.inp.l = dir < 0 ? 1 : 0; yield; if ((t += 1 / 60) > (timeout || 20) * (this.sim.tmul || 1)) { this.stop(); throw new Error('누르다 시간 초과: ' + (what || '') + ' (봇 ' + this.i + ', x=' + Math.round(this.cx()) + ')'); } }
  this.stop();
};
/* 점프: x를 주면 그쪽으로 몸을 틀며 뛴다. 땅에 닿으면 끝 */
Bot.prototype.jump = function* (x, tol, stop) {
  for (let i = 0; i < 60 && !this.me.gr; i++) yield;
  this.inp.j = 1; yield;
  let t = 0;
  while (true) {
    if (x !== undefined) { const d = x - this.cx(); this.inp.r = d > (tol || 2) ? 1 : 0; this.inp.l = d < -(tol || 2) ? 1 : 0; }
    yield;
    if (this.me.vy >= 0) this.inp.j = 0;
    if (this.me.gr && t > 3) break;
    if (++t > 240) break;
  }
  this.inp.j = 0; this.stop();
};
Bot.prototype.enter = function* () { this.inp.en = 1; yield; yield; yield; this.inp.en = 0; };

if (typeof module !== 'undefined' && module.exports) module.exports = Bot; else root.YCBot = Bot;
})(typeof window !== 'undefined' ? window : globalThis);
