/* 영차영차 — practice.js : 혼자 연습 — 나와 AI 친구들이 한 팀이 된다.
   한 기기 안에서 팀원 여러 명의 게임을 함께 돌리고, 서로 주고받는 내용은 메모리로 바로 넘긴다.
   AI 친구는 ai.js의 대본대로 움직이고, 0번 자리(나)에는 대본이 할 일을 화면에 알려 준다. */
(function () {
'use strict';
const YC = window.YC, Bot = window.YCBot, AI = window.YCAI;
const NAMES = ['나', '콩이', '별이', '달이', '솔이', '해리'];

/* 0번 자리(사람): 키를 대신 누르지 않고, 할 일을 알려 준 뒤 사람이 해낼 때까지 기다린다 */
function Guide(sim, i) { Bot.call(this, sim, i); this.hint = null; }
Guide.prototype = Object.create(Bot.prototype);
Guide.prototype.tell = function (h) { if (h && (!this.hint || this.hint.k !== h.k || this.hint.x !== h.x)) this.hintAt = performance.now(); this.hint = h; };
Guide.prototype.drive = function () {
  if (!this.gen || this.done) return;
  try { const r = this.gen.next(); if (r.done) { this.done = true; this.hint = null; } }
  catch (e) { this.done = true; this.err = e; this.hint = null; }
};
Guide.prototype.until = function* (fn) { const h = this.hint; if (h && h.k !== 'wait') this.tell(null); while (!fn()) yield; };
Guide.prototype.walkTo = function* (x, tol) { const t = Math.max(tol || 2, 22); this.tell({ k: 'go', x: x }); while (!(Math.abs(this.cx() - x) <= t && this.me.gr)) yield; this.tell(null); };
Guide.prototype.hold = function* (dir, fn) { this.tell({ k: 'push', dir: dir }); while (!fn()) yield; this.tell(null); };
Guide.prototype.jump = function* (x) {
  this.tell({ k: 'jump', x: x }); let air = false;
  for (let t = 0; t < 60 * 20; t++) { if (!this.me.gr) air = true; else if (air) break; yield; }
  this.tell(null);
};
Guide.prototype.enter = function* () { this.tell({ k: 'door' }); while (!this.me.fin) yield; this.tell(null); };

const P = { on: false, teams: [], bots: [], q: [], key: '', sim: null, err: '', names: {}, errT: 0 };
/* G: app.js의 게임 상태. opt: { stages, nAI, startGame } */
P.start = function (opt) {
  const n = 1 + opt.nAI, slots = []; for (let i = 0; i < n; i++) slots.push(i);
  P.on = true; P.q.length = 0; P.key = ''; P.err = ''; P.errT = 0; YC.opt.noBlock = true; YC.opt.slim = true;              // AI 친구와는 서로 통과한다 (올라타기로 마음먹을 때만 밟힌다)
  P.names = {}; slots.forEach(s => { P.names[s] = NAMES[s]; });
  const seed = 1 + Math.floor(Math.random() * 999999);                                   // 판마다 배치가 조금씩 다르다
  const G = opt.startGame({ slot: 0, slots: slots, stages: opt.stages, team: 0, names: P.names, first: true, practice: P, seed: seed,
    send: (type, pay) => P.deliver(0, type, pay), onQuit: opt.onQuit });
  P.G = G;
  const now = performance.now();
  P.teams = [G.team]; G.team.pIvl = 16; G.team.wIvl = 16;                                // 한 기기 안이므로 매 틱 주고받는다 (지연 없음)
  for (let s = 1; s < n; s++) { const tm = new YC.Team({ slot: s, slots: slots, stages: opt.stages, build: YC.build, team: 0, seq0: s * 1000000, seed: seed }); tm.pIvl = 16; tm.wIvl = 16; tm.start(now, false); P.teams.push(tm); }
  P.sim = { n: n, teams: P.teams, bots: [], tmul: 8, get t() { return performance.now(); } };
  P.bots = P.sim.bots;
  for (let s = 0; s < n; s++) P.bots.push(s === 0 && !P.auto ? new Guide(P.sim, 0) : new Bot(P.sim, s));   // P.auto: 시험용 — 사람 자리도 봇이 맡는다
};
P.stop = function () { P.on = false; P.teams = []; P.bots = []; P.q.length = 0; YC.opt.noBlock = false; YC.opt.slim = false; };
P.deliver = function (from, ch, d) {
  const at = performance.now(), s = JSON.stringify(d);
  for (let j = 0; j < P.teams.length; j++) if (j !== from) P.q.push({ at: at, to: j, from: from, ch: ch, d: s });
};
/* app.js가 매 틱, 사람의 팀을 계산하기 전에 부른다 */
P.step = function (now) {
  if (!P.on) return;
  const q = P.q; let w = 0;
  for (let i = 0; i < q.length; i++) {
    const m = q[i]; if (m.at > now) { q[w++] = m; continue; }
    const tm = P.teams[m.to]; if (!tm) continue;
    if (m.ch === 'p') tm.onPlayer(m.from, JSON.parse(m.d), now); else if (m.ch === 'w') tm.onWorld(m.from, JSON.parse(m.d), now);
  }
  q.length = w;
  // 스테이지가 바뀌거나 처음부터 다시 하면 대본을 새로 건다
  const H = P.teams[0], key = H.TS.stage + ':' + H.TS.run;
  if (key !== P.key && H.W) { P.key = key; P.err = ''; const sc = AI.scripts[H.stages[H.TS.stage]]; if (sc) sc(P.sim); for (let s = 1; s < P.teams.length; s++) P.teams[s].me.vote = 0; }
  P.bots[0].drive();
  for (let s = 1; s < P.teams.length; s++) {
    const tm = P.teams[s], b = P.bots[s];
    b.drive();
    if (b.err && !P.err) { P.err = b.err.message; P.errT = now; }
    tm.me.vote = P.err || H.me.vote ? 1 : 0;                                               // 내가 ↺를 누르거나 AI가 길을 잃으면 다 같이 처음부터
    tm.tick(b.inp, 1 / 60, now);
    tm.ev.length = 0;
    for (const m of tm.out) if (m[0] !== 'v') P.deliver(s, m[0], m[1]);
    tm.out.length = 0;
  }
};
P.hint = function () { const g = P.on && P.bots[0]; return g && g.hint && performance.now() - g.hintAt > 6000 ? g.hint : null; };   // 혼자 6초 넘게 헤매면 그때 알려 준다
window.YCPractice = P;
})();
