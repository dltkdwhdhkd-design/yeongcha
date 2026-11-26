/* 브라우저 시험용: 실제 게임 화면 안에서 봇이 키를 대신 누른다.
   노드 시험과 같은 대본(scripts.js)을 쓴다. 다른 팀원은 내 화면에 보이는 모습(지연된 모습)으로 판단하고,
   "셋에 뛰자" 같은 약속은 같은 중계 서버의 시험용 통로(zt)로 나눈다.
   e2e.js가 window.__ycSrc = { bot, scripts } 와 함께 페이지에 넣는다. */
(function () {
'use strict';
function load(src) { const module = { exports: {} }; new Function('module', 'exports', 'require', src)(module, module.exports, function (p) { return /core/.test(p) ? window.YC : {}; }); return module.exports; }   // ai.js는 require('./core.js')로 YC를 찾는다
const st = { key: '', bot: null, err: null, log: [], shared: {}, at: {}, hooked: false, Bot: null, scripts: null };
function boot() { if (!st.Bot) { st.Bot = load(window.__ycSrc.bot); st.scripts = load(window.__ycSrc.scripts).scripts; } }
function hook() {
  const Net = window.YCNet; if (st.hooked === Net.onMsg || !Net.base) return;
  const orig = Net.onMsg;
  Net.onMsg = function (ch, d, from) { if (ch === 'zt') { onShare(d); return; } orig(ch, d, from); };
  st.hooked = Net.onMsg; Net.sub('zt');
}
function onShare(d) {
  if (!d || typeof d.ns !== 'string') return;
  const o = st.shared[d.ns] || (st.shared[d.ns] = {}), k = d.ns + '|' + d.k, la = st.at[k];
  if (la === undefined || d.at > la + 300 || d.at < la) { o[d.k] = d.v; st.at[k] = d.at; }             // 거의 동시에 정했으면 먼저 정한 쪽을 따른다
}
function shareObj(ns, solo) {
  const o = st.shared[ns] || (st.shared[ns] = {});
  return new Proxy(o, { set: function (t, k, v) { t[k] = v; const at = Date.now(); st.at[ns + '|' + k] = at; if (!solo) window.YCNet.say('zt', { ns: ns, k: k, v: v, at: at }); return true; } });
}
function proxy(T, s, idx) {
  const g = function () { return T.ghosts[s]; }, rep = function () { const q = g(); return (q && q.rep) || {}; };
  const me = { get gr() { return !!rep().gr; }, get gRef() { return rep().gRef || 0; }, get fin() { return !!rep().fin && rep().sr === T.sr(); }, get dead() { return rep().dead ? 1 : 0; },
    get saw() { const r = rep(), o = T.W.byId[r.gRef]; return o && o.type === 'saw' ? o.id : 0; }, get x() { return g().x; }, get y() { return g().y; }, get vx() { return rep().vx || 0; }, get vy() { return rep().vy || 0; } };
  return { i: idx, me: me, T: null, cx: function () { const q = g(); return (q && q.vis ? q.x : rep().x || 0) + 12; }, feet: function () { const q = g(); return (q && q.vis ? q.y : rep().y || 0) + 28; }, play: function () {}, done: false, err: null, off: false, inp: {} };
}
function attach(G) {
  const T = G.team, stage = T.stages[T.TS.stage], key = stage + ':' + T.TS.stage + ':' + T.TS.run;
  if (st.key === key) return;
  st.key = key; boot(); if (!G.solo) hook();
  const n = T.slots.length, bots = [], teams = [];
  const sim = { n: n, bots: bots, teams: teams, lag: 0.15, get t() { return Date.now(); }, share: function (name) { return shareObj(key + ':' + name, G.solo); } };
  T.slots.forEach(function (s, idx) {
    if (s !== idx) throw new Error('시험은 자리 번호가 0부터 이어져야 한다');
    if (s === T.slot) { teams[idx] = T; bots[idx] = st.bot = new st.Bot(sim, idx); } else bots[idx] = proxy(T, s, idx);
  });
  st.scripts[stage](sim);
  st.log.push(Math.round(performance.now()) + ' attach ' + key + ' n=' + n);
}
/* 게임이 켜지면 봇을 붙인다 */
window.YCTest = st;
st.on = function () {
  const G = window.YCApp.G;
  G.bot = function (inp) {
    st.ticks = (st.ticks || 0) + 1;
    try { attach(G); } catch (e) { st.err = e.message; return; }
    const b = st.bot; if (!b) return;
    b.drive();
    if (b.err && !st.err) { st.err = b.err.message; st.log.push(Math.round(performance.now()) + ' ERR ' + st.err); }
    inp.l = b.inp.l; inp.r = b.inp.r; inp.j = b.inp.j; inp.jp = b.inp.jp; inp.en = b.inp.en;
  };
};
function sig(def) { const t = JSON.stringify([def.id, def.g, def.objs]); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return def.id + ':' + h.toString(36); }   // 맵 지문: 모든 팀이 같은 맵인지 본다
st.info = function () {
  const G = window.YCApp.G, T = G.team; if (!T) return null;
  return { stage: T.TS.stage, run: T.TS.run, ph: T.TS.ph, tm: Math.round(T.time(performance.now())), x: Math.round(T.me.x), y: Math.round(T.me.y), fin: T.me.fin, anchor: T.anchor, n: T.TS.n, err: st.err, cl: T.TS.cl.slice(),
    net: G.solo ? null : window.YCNet.status(), stat: window.YCNet.stat, ticks: st.ticks || 0, stg: T.stages[T.TS.stage], sig: T.W && T.W.def ? sig(T.W.def) : '', team: G.myTeam !== undefined ? G.myTeam : -1, job: st.bot ? st.bot.job : '', le: st.bot ? st.bot.lastErr || '' : '' };
};
})();
