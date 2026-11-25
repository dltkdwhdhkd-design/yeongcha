/* 스테이지 완주 시험: 봇 팀이 지연·유실이 있는 통신으로 각 스테이지를 끝까지 깬다.
   node tests/stages.test.js [quick]                                                             */
'use strict';
const { YC, Sim } = require('./harness.js');
const { scripts } = require('../js/ai.js');
const quick = process.argv[2] === 'quick';
let pass = 0, fail = 0; const fails = [];
function run(id, n, net, seed, block) {
  const s = new Sim({ n, stages: [id], delay: net[0], jitter: net[1], loss: net[2], seed, block });
  scripts[id](s);
  const ok = s.run(300, () => s.teams.every(t => t.TS.ph === 4));
  const tag = id + ' ' + n + '명 지연' + net[0] + 'ms' + (block ? ' (길막기 켬)' : '') + ' #' + seed;
  if (ok) { pass++; return s.anchor().TS.cl[0] / 1000; }
  fail++; fails.push(tag + ' → ' + s.bots.map(b => b.err ? b.err.message : (b.done ? '끝' : '진행 중')).join(' | '));
  return -1;
}
const NETS = quick ? [[0, 0, 0], [150, 40, 0.02]] : [[0, 0, 0], [80, 20, 0.01], [150, 40, 0.02], [300, 80, 0.05]];
const SEEDS = quick ? [7] : [7, 21];
for (const id of YC.order) {
  if (!scripts[id]) continue;
  const row = [];
  for (let n = 1; n <= 6; n++) { let best = 1e9, bad = 0; for (const net of NETS) for (const seed of SEEDS) { const t = run(id, n, net, seed, false); if (t < 0) bad++; else best = Math.min(best, t); } row.push(n + '명 ' + (bad ? '실패 ' + bad : best.toFixed(0) + '초')); }
  console.log((YC.build(id).name + '        ').slice(0, 8), row.join('  '));
}
// 판마다 달라지는 배치(씨앗)로도 깨지는지
{ let bad = 0, all = 0;
  for (const id of ['ice', 'circuit', 'fire', 'balloon', 'freeze', 'light']) for (const n of [1, 2, 3, 4, 6]) for (const ls of [11, 222, 3333, 44444, 555555, 6789]) {
    const s = new Sim({ n, stages: [id], delay: 80, jitter: 20, loss: 0.01, seed: 7, lseed: ls }); scripts[id](s); all++;
    if (s.run(300, () => s.teams.every(t => t.TS.ph === 4))) pass++; else { bad++; fail++; fails.push(id + ' ' + n + '명 배치 ' + ls + ' → ' + s.bots.map(b => b.err ? b.err.message : (b.done ? '끝' : '진행 중')).join(' | ')); }
  }
  console.log('여러 배치(씨앗) ' + all + '판 중 실패 ' + bad);
}
// 실제 게임처럼 서로 길을 막는 상태에서도
for (const [id, n, net] of [['push', 2, [0, 0, 0]], ['push', 2, [150, 40, 0.02]], ['push', 3, [150, 40, 0.02]]]) run(id, n, net, 7, true);

// 기준 기기가 멈췄다가 돌아와도 이어진다
(function takeover() {
  const s = new Sim({ n: 4, stages: ['push'], delay: 100, jitter: 30, loss: 0.01, seed: 3 });
  scripts.push(s);
  s.run(6);
  const a0 = s.teams.findIndex(t => t.anchor), box0 = s.teams[1].W.boxes[0].x, tm0 = s.teams[1].TS.tm;
  s.bots[a0].off = true;                                             // 탭이 멈춤
  s.run(4, () => false);
  const a1 = s.teams.findIndex((t, i) => t.anchor && i !== a0);
  const okTake = a1 >= 0 && s.teams[a1].epoch > s.teams[a0].epoch && s.teams[a1].TS.tm > tm0 + 1500;
  s.bots[a0].off = false;                                            // 돌아옴
  s.run(3, () => false);
  const one = s.teams.filter(t => t.anchor).length === 1;
  const done = s.run(200, () => s.teams.every(t => t.TS.ph === 4));
  if (okTake && one && done) pass++; else { fail++; fails.push('기준 기기 이어받기: 이어받음 ' + okTake + ', 기준 하나뿐 ' + one + ', 완주 ' + done); }
  console.log('기준 기기 이어받기', okTake && one && done ? '통과' : '실패', '(상자 ' + Math.round(box0) + ' → 이어받은 뒤에도 진행)');
})();

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
for (const f of fails) console.log('  실패: ' + f);
process.exit(fail ? 1 : 0);
