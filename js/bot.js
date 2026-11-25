/* 영차영차 — bot.js : AI 친구(봇). 대본(제너레이터)대로 키를 누른다.
   혼자 연습의 AI 친구, 노드 시험(tests/harness.js), 브라우저 시험(tests/webbot.js)이 함께 쓴다. */
(function (root) {
'use strict';
function Bot(sim, i) { this.sim = sim; this.i = i; this.T = sim.teams[i]; this.me = this.T.me; this.inp = { l: 0, r: 0, j: 0, jp: 0, en: 0 }; this.pj = 0; this.gen = null; this.done = false; this.err = null; this.off = false; this.noHop = false; }
Bot.prototype.play = function (fn) { this.gen = fn(this); this.done = false; this.err = null; };
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
Bot.prototype.walkTo = function* (x, tol, timeout) {
  tol = tol || 2; let t = 0, k = 0, stuck = 0, lx = this.cx(), hop = -8, crowd = 0;
  for (let pass = 0; pass < 4; pass++) {
    while (Math.abs(this.cx() - x) > tol) {
      const d = x - this.cx(), near = Math.abs(d) < 16 && this.me.mat !== 'I';
      const press = !near || (k++ % 3 === 0);
      this.inp.r = press && d > 0 ? 1 : 0; this.inp.l = press && d < 0 ? 1 : 0;
      if (!near && Math.abs(this.cx() - lx) < 0.3 && this.me.gr) stuck++; else stuck = 0;
      lx = this.cx();
      if (this.me.hRef < 0 && Math.abs(d) < 30) { if ((crowd += 3) > 30) break; } else if (crowd > 0) crowd--;      // 목표 바로 앞에서 친구에게 막혔으면 그만하면 됐다
      if (stuck > 12 && hop <= -8 && !this.noHop) { hop = 16; stuck = 0; }                   // 막히면 뛰어넘는다 (noHop이면 기다린다)
      this.inp.j = hop > 0 ? 1 : 0; hop--;
      yield;
      if ((t += 1 / 60) > (timeout || 12) * (this.sim.tmul || 1)) { this.stop(); this.inp.j = 0; throw new Error('걷다 시간 초과: 목표 ' + x + ', 지금 ' + Math.round(this.cx()) + ' (봇 ' + this.i + ')'); }
    }
    this.stop(); this.inp.j = 0;
    for (let i = 0; i < 40 && (Math.abs(this.me.vx) > 4 || !this.me.gr); i++) yield;
    if (Math.abs(this.cx() - x) <= tol + 1 || this.me.mat === 'I' || crowd > 30) break;
  }
};
/* dir 쪽을 누른 채 조건이 참이 될 때까지 */
Bot.prototype.hold = function* (dir, fn, timeout, what) {
  let t = 0;
  while (!fn()) { this.inp.r = dir > 0 ? 1 : 0; this.inp.l = dir < 0 ? 1 : 0; yield; if ((t += 1 / 60) > (timeout || 20) * (this.sim.tmul || 1)) { this.stop(); throw new Error('누르다 시간 초과: ' + (what || '') + ' (봇 ' + this.i + ', x=' + Math.round(this.cx()) + ')'); } }
  this.stop();
};
/* 점프: x를 주면 그쪽으로 몸을 틀며 뛴다. 땅에 닿으면 끝 */
Bot.prototype.jump = function* (x, tol) {
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
