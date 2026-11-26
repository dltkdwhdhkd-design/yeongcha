/* 영차영차 — levels.js : 스테이지
   한 칸 = 32픽셀. 캐릭터는 24×28, 혼자 뛰면 2칸(64)까지, 친구 머리를 밟으면 3칸(96)까지 오른다.
   글자: # 땅, I 얼음, S 모래, ^ 가시, s 혼자 연습할 때만 생기는 디딤돌, d 팀이 둘 이하일 때만 생기는 디딤돌
   장치는 누르고 있는 동안만 작동한다. 누르는 사람이 남아 버리면, 건너간 사람이 저쪽에서 다른 수로 길을 열어 주어야 한다.
   M: { hard } — 하드는 같은 스테이지에 장치(기믹)가 더 붙는다. 통신이 늦어도 할 수 있게, 시간을 더 짧게 조이지는 않는다
   need·eq에 배열을 주면 팀 인원마다 다르다 (배열[인원], 끝을 넘으면 마지막 값)  */
(function (root) {
'use strict';
const YC = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.YC;
const T = YC.T, LB = YC.LB, S = YC.stages;
const X = c => c * T;
const GY = 13;                                   // 땅 윗면이 있는 줄
/* 판마다 조금씩 다른 배치: seed가 0이면 늘 기본값(d), 아니면 씨앗으로 고른다 (같은 팀은 같은 씨앗) */
function Rnd(seed) {
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { on: !!seed, i: (a, b, d) => seed ? a + Math.floor(r() * (b - a + 1)) : d, b: d => seed ? r() < 0.5 : d,
    pick: (arr, d) => seed ? arr[Math.floor(r() * arr.length)] : d,
    perm: (arr) => { const a = arr.slice(); if (seed) for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    slots: (cands, k, d) => { if (!seed) return d; const a = cands.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, k).sort((x, y) => x - y); } };
}
const TWO3 = [1, 1, 1, 2];                       // 셋 이상이면 두 명 (둘 이하면 한 명)

/* 높은 선반: 노말은 친구 머리 하나를 밟고(3칸), 하드는 셋이 탑을 쌓아야(4칸) 오른다.
   하드에서 팀이 둘뿐이면 d 디딤돌 위에서 받쳐 주고, 혼자면 s 디딤돌 두 개를 밟고 오른다. 선반이 있는 줄을 돌려준다 */
function shelf(L, c0, c1, hard) {
  const row = hard ? 9 : 10; L.fill(c0, row, c1, row);
  if (hard) { L.fill(c0 - 1, 12, c0 - 1, 12, 'd'); L.fill(c0 - 2, 12, c0 - 2, 12, 's'); L.fill(c0 - 1, 11, c0 - 1, 11, 's'); }
  else L.fill(c0 - 1, 12, c0 - 1, 12, 's');
  return row;
}

/* 1. 영차! — 같은 방향으로 밀기 (알짜힘) */
S.push = (R, M) => {
  const L = new LB(92, 17), H = M.hard;
  L.fill(0, GY, 91, 16);
  L.spawn = { x: X(2), y: X(GY) };
  // A. 선반 위 단추를 밟는 동안만 문이 열린다. 건너간 사람들이 상자를 저쪽 단추(상자만 눌린다)로 밀어 올려야 선반 친구도 건너온다
  const r1 = shelf(L, 8, 10, H);
  L.add({ type: 'sign', x: X(4), y: X(GY), icon: H ? 'stack3' : 'stack' });
  const b1 = L.add({ type: 'btn', x: X(8) + 16, y: X(r1), w: 64, need: 1, soloLatch: true });
  L.fill(15, 0, 16, 10);
  const b2 = L.add({ type: 'btn', x: X(20), y: X(GY), w: 96, need: 1, boxOnly: true });
  L.add({ type: 'door', x: X(15) + 8, y: X(11), w: 48, h: 64, link: [b1, b2], fast: true });
  L.add({ type: 'flag', x: X(17), y: X(GY), idx: 1 });
  L.fill(19, 12, 19, 12);                         // 상자 멈춤턱: 밀어 붙이면 상자가 단추 위에 선다 (사람은 넘어 다닌다)
  L.add({ type: 'box', x: X(26), y: X(11), w: 64, h: 64, need: 'most', mat: 'wood' });
  // B. 굴 속의 무거운 상자: 모두가 밀어야 움직인다. 가시 구덩이에 밀어 넣어 다리로
  L.fill(30, 5, 39, 10);
  L.add({ type: 'box', x: X(31), y: X(11), w: 64, h: 64, need: 'all', mat: 'wood' });
  L.fill(40, 13, 41, 14, ' '); L.fill(40, 14, 41, 14, '^');
  L.fill(42, 12, 42, 12);
  L.add({ type: 'flag', x: X(44), y: X(GY), idx: 2 });
  // C. 문은 벽 양쪽 상자가 모두 단추에 있을 때만 열린다. 친구 머리를 밟고 벽을 넘어가 저쪽 상자를 민다
  //    (하드: 이쪽 상자는 한 명 빼고 모두가 밀어야 움직인다 → 벽을 넘기 전에 먼저 밀어 두지 않으면 사람이 모자란다)
  L.add({ type: 'box', x: X(47), y: X(11), w: 64, h: 64, need: H ? 'most' : 'rest', mat: 'wood' });
  const bq = L.add({ type: 'btn', x: X(51), y: X(GY), w: 96, need: 1, boxOnly: true });
  L.fill(54, 12, 54, 12);
  L.fill(58, 10, 59, 10);                         // 벽 꼭대기 (밑은 문)
  L.fill(56, 12, 56, 12, 's'); L.fill(57, 11, 57, 11, 's');
  L.fill(61, 12, 61, 12);
  const bp = L.add({ type: 'btn', x: X(62), y: X(GY), w: 96, need: 1, boxOnly: true });
  L.add({ type: 'box', x: X(67), y: X(11), w: 64, h: 64, need: 'half', mat: 'wood' });
  L.add({ type: 'door', x: X(58) + 8, y: X(11), w: 48, h: 64, link: [bq, bp], mode: 'all' });
  L.add({ type: 'flag', x: X(70), y: X(GY), idx: 3 });
  // D. 선반 위의 열쇠, 나가는 문 (하드는 한 칸 더 높아 셋이 탑을 쌓는다)
  const kr = shelf(L, 76, 78, H);
  if (H) L.add({ type: 'sign', x: X(73), y: X(GY), icon: 'stack3' });
  L.add({ type: 'key', x: X(77) + 4, y: X(kr) - 34 });
  L.add({ type: 'exit', x: X(86), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'push', name: '영차!', sub: '같은 방향으로 밀기', sci: '알짜힘' });
};

/* 2. 미끌미끌 — 마찰력: 모래 위에서는 다 같이, 얼음 위에서는 살살 */
S.ice = (R, M) => {
  const L = new LB(104, 17), H = M.hard;
  L.fill(0, GY, 19, 16);
  L.fill(9, GY, 19, GY, 'S');                     // 모래밭
  L.fill(8, 10, 8, 11);                           // 상자만 걸리는 턱 (사람은 아래로 지나간다)
  L.fill(20, 9, 103, 16);                         // 높은 땅
  L.fill(24, 9, 40, 9, 'I');                      // 얼음판 (오른쪽 턱 밑까지: 끝까지 미끄러져 간 쇠 상자도 한 명이 되밀 수 있게)
  L.spawn = { x: X(1), y: X(GY) };
  L.add({ type: 'sign', x: X(13), y: X(GY), icon: 'push', need: 'all' });
  L.add({ type: 'box', x: X(10), y: X(11), w: 64, h: 64, need: 'most', needS: 'all', mat: 'wood' });
  L.add({ type: 'flag', x: X(21), y: X(9), idx: 1 });
  // B. 쇠 상자가 받침판 위에 서 있는 동안만 문이 열린다 → 상자를 살살 세운 뒤, 건드리지 않게 위로 넘어간다
  if (H) { L.fill(28, 9, 30, 9, 'S'); L.add({ type: 'sign', x: X(29), y: X(9), icon: 'push', need: 'all' }); L.add({ type: 'sign', x: X(37), y: X(9), icon: 'ice' }); }   // 하드: 받침판 바로 앞에 모래 — 쇠 상자가 여기서 멈추면 다 같이 밀어야 한다
  else L.add({ type: 'sign', x: X(28), y: X(9), icon: 'ice' });
  L.add({ type: 'box', x: X(25), y: X(7), w: 64, h: 64, need: 'most', mat: 'iron', wt: 2 });
  const b = L.add({ type: 'btn', x: X(31), y: X(9), w: 96, need: 'w2', boxOnly: true, ov: 24 });
  L.fill(22, 7, 22, 7); L.fill(41, 7, 41, 7);     // 쇠 상자가 벼랑이나 문까지 못 가게 막는 턱 (사람은 아래로 지나간다)
  L.fill(43, 0, 44, 6);
  L.add({ type: 'door', x: X(43) + 8, y: X(7), w: 48, h: 64, link: [b], fast: true });
  // C. 얼음 위 가시 구덩이: 미끄러워서 멈추기 어렵다. 달려가며 뛰어 넘는다
  L.add({ type: 'flag', x: X(46), y: X(9), idx: 2 });
  L.fill(48, 9, 71, 9, 'I');
  let gaps;
  if (H) { const g1 = R.i(50, 52, 51), g2 = g1 + R.i(5, 6, 5), g3 = g2 + R.i(5, 6, 6); gaps = [g1, g2, g3, g3 + R.i(5, 6, 5)]; }   // 하드: 구덩이 넷
  else gaps = R.on ? [R.i(51, 54), R.i(59, 61), R.i(66, 68)] : [53, 59, 65];
  for (const g of gaps) { L.fill(g, 9, g + 1, 9, ' '); L.fill(g, 10, g + 1, 10, '^'); }
  L.add({ type: 'flag', x: X(73), y: X(9), idx: 3 });
  // D. 얼음 위 단추(사람)를 밟고 있는 동안 문이 열린다. 미끄러워서 단추 위에 멈춰 서기도 어렵다.
  //    건너간 사람이 널빤지 상자를 되밀어 저쪽 단추(상자만)에 세워야 이쪽 사람들이 건너오고, 그다음 상자를 밀어 구덩이를 메운다
  L.fill(74, 9, 100, 9, 'I');
  const bx = L.add({ type: 'btn', x: X(74), y: X(9), w: H ? 128 : 96, need: H ? 'most' : 'half', soloLatch: true });   // 하드: 한 명 빼고 모두가 얼음 위 단추에
  L.fill(80, 0, 81, 6);
  const by = L.add({ type: 'btn', x: X(85), y: X(9), w: 96, need: 1, boxOnly: true });
  L.add({ type: 'door', x: X(80) + 8, y: X(7), w: 48, h: 64, link: [bx, by], fast: true });
  L.fill(84, 7, 84, 7);                           // 되민 널빤지가 저쪽 단추 위에서 서게 하는 턱 (사람은 아래로 지나간다)
  L.add({ type: 'box', x: X(89), y: X(7), w: 96, h: 64, need: 'most', mat: 'wood' });
  L.fill(98, 9, 100, 9, ' '); L.fill(98, 10, 100, 10, '^');
  L.fill(101, 8, 101, 8);                         // 상자를 구덩이 바로 위에서 세우는 턱
  L.add({ type: 'exit', x: X(102) - 4, y: X(9) - 60, w: 44, h: 60 });
  return L.done({ id: 'ice', name: '미끌미끌', sub: '모래는 다 같이, 얼음은 살살', sci: '마찰력' });
};

/* 3. 하나 둘 셋! — 시소: 무거운 쪽이 내려가고, 뛰어내리면 반대쪽이 튄다 */
S.saw = (R, M) => {
  const L = new LB(62, 17), H = M.hard, D = 6;
  L.fill(0, GY, 12, 16);
  L.fill(22, GY, 61, 16);
  L.spawn = { x: X(2), y: X(GY) };
  // A. 구덩이 위 시소로 턱 위에 올라간다 (하드: 셋 이상이면 두 명. 누르는 사람은 끝에, 올라갈 사람은 조금 안쪽에 서야 들린다).
  //    턱 위 단추를 밟는 동안만 저 앞 문이 열린다 → 건너간 친구가 문 너머 단추를 밟아 주어야 턱 위 친구가 건너온다
  L.add({ type: 'saw', px: 560, py: 421, L: 136, max: 0.349, hi: 0, rest: 0, base: 560, solo: 1, launchV: 0, vref: 500 });   // 오른쪽 끝은 받침에 걸려 수평보다 내려가지 않는다
  L.fill(22, 10, 23, 10);
  L.fill(21, 12, 21, 12, 's');
  const b1 = L.add({ type: 'btn', x: X(22) + 6, y: X(10), w: 52, need: H ? TWO3 : 1, soloLatch: true });
  L.fill(27, 0, 28, 10);
  const b1f = L.add({ type: 'btn', x: X(30), y: X(GY), w: 64, need: 1, latchN: H ? 2 : undefined });   // 하드: 이 단추가 열쇠 앞 유리문도 연다 (둘이면 한 번 밟으면 고정)
  L.add({ type: 'door', x: X(27) + 8, y: X(11), w: 48, h: 64, link: [b1, b1f], fast: true });
  L.add({ type: 'flag', x: X(29) + 8, y: X(GY), idx: 1 });
  // B. 탑에서 여럿이 동시에 뛰어내려 반대쪽 친구를 열쇠 선반으로 쏘아 올린다
  L.fill(27 + D, 11, 27 + D, 12); L.fill(28 + D, 9, 28 + D, 12); L.fill(29 + D, 7, 31 + D, 12);
  L.add({ type: 'sign', x: X(29 + D) + 16, y: X(7), icon: 'drop' });
  L.add({ type: 'saw', px: 1160 + X(D), py: 370, L: 120, max: 0.3936, rest: 0.3936, base: 416, launchV: 1100, vref: 480, nsub: H ? 1 : undefined });   // nsub: 유리문 단추를 지키는 사람만큼 뛰어내릴 사람 수가 준다
  if (H) {
    L.add({ type: 'door', x: X(41 + D) + 8, y: X(2), w: 16, h: X(4), link: [b1f], style: 'glass' });
    L.add({ type: 'wire', pts: [[X(31), X(GY)], [X(31), X(1) + 16], [X(41 + D) + 16, X(1) + 16], [X(41 + D) + 16, X(2)]], link: [b1f] });
    L.fill(42 + D, 6, 43 + D, 6);                 // 하드: 선반이 좁다
  } else L.fill(41 + D, 6, 44 + D, 6);
  L.add({ type: 'key', x: X(42 + D) + 16, y: X(6) - 34 });
  L.fill(48 + D, 11, 48 + D, 11, 's'); L.fill(47 + D, 9, 47 + D, 9, 's'); L.fill(46 + D, 7, 46 + D, 7, 's');   // 혼자 연습용 디딤돌 (아래로는 지나다닌다)
  L.add({ type: 'exit', x: X(51 + D), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'saw', name: '하나 둘 셋!', sub: '시소로 친구 쏘아 올리기', sci: '무게와 시소' });
};

/* 4. 딱 맞게 — 용수철: 저울은 딱 맞는 인원만, 발사대는 다 같이 눌렀다가 한 번에 */
S.spring = (R, M) => {
  const L = new LB(50, 17), H = M.hard;
  L.fill(0, GY, 49, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 문 앞뒤 저울: 어느 한쪽에 정해진 인원이 딱 맞게 서 있는 동안 문이 열린다
  const p1 = L.add({ type: 'pad', x: X(8), y: 380, w: 96, fy: X(GY), maxc: 30, mode: 'scale', eq: 'half' });
  L.fill(14, 0, 15, 10);
  const p2 = L.add({ type: 'pad', x: X(20), y: 380, w: 96, fy: X(GY), maxc: 30, mode: 'scale', eq: 'rest' });
  L.add({ type: 'door', x: X(14) + 8, y: X(11), w: 48, h: 64, link: [p1, p2], fast: true });
  L.add({ type: 'flag', x: X(24), y: X(GY), idx: 1 });
  // B. 발사대: 먼저 한 명을 왼쪽 높은 선반으로 쏘아 올린다. 그 친구가 단추를 밟고 있는 동안만 열쇠 앞 유리문이 열리므로, 남은 사람끼리 다시 쏘아 열쇠로
  //    (하드: 넷 이상이면 바닥 저울에도 한 명이 딱 서 있어야 유리문이 열린다)
  L.add({ type: 'pad', x: X(28), y: 376, w: 160, fy: X(GY), maxc: 36, mode: 'launch', launchV: 960, nsub: H ? [0, 0, 0, 1, 2] : [0, 0, 0, 1] });
  L.fill(22, 6, 25, 6);
  const bB = L.add({ type: 'btn', x: X(23), y: X(6), w: 64, need: 1, minN: 2, latchN: 2, style: 'sw' });   // 둘뿐이면 한 번 밟으면 고정
  const gl = [bB];
  if (H) gl.push(L.add({ type: 'pad', x: X(25), y: 384, w: 64, fy: X(GY), maxc: 24, mode: 'scale', eq: 1, minN: 4 }));
  L.add({ type: 'door', x: X(33) + 8, y: X(2), w: 16, h: X(4), link: gl, mode: 'all', style: 'glass' });
  L.add({ type: 'wire', pts: [[X(24), X(6)], [X(24), X(1) + 16], [X(33) + 16, X(1) + 16], [X(33) + 16, X(2)]], link: [bB] });
  L.fill(34, 6, 36, 6);
  L.add({ type: 'key', x: X(35) + 4, y: X(6) - 34 });
  L.fill(40, 11, 40, 11, 's'); L.fill(39, 9, 39, 9, 's'); L.fill(38, 7, 38, 7, 's');
  L.add({ type: 'exit', x: X(44), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'spring', name: '딱 맞게', sub: '용수철저울과 용수철 발사대', sci: '탄성력' });
};

/* 5. 둥둥 — 부력: 가벼우면 높이 떠서 벽에 걸리고, 너무 무거우면 가라앉는다 */
S.raft = (R, M) => {
  const L = new LB(44, 17), H = M.hard;
  L.fill(0, 12, 9, 16);                           // 이쪽 둑 (한 칸 높아 쇠 추를 뗏목으로 밀어 떨어뜨릴 수 있다)
  L.fill(10, 16, 27, 16);
  L.fill(28, GY, 43, 16);
  L.fill(18, 0, 19, 11);                          // 물 위로 내려온 벽
  L.spawn = { x: X(3), y: X(12) };
  L.fill(7, 10, 7, 10);                           // 떠 있는 턱: 사람과 쇠 추는 아래로 지나간다
  L.add({ type: 'key', x: X(7) + 4, y: X(10) - 34 });
  L.add({ type: 'box', x: X(1), y: X(12) - 28, w: 28, h: 28, need: 1, mat: 'iron', wt: 2 });   // 쇠 추: 사람 둘 무게
  L.add({ type: 'sign', x: X(1) - 18, y: X(12) - 30, txt: '쇠 추 = 2명', size: 12, w: 84 });
  L.add({ type: 'water', x: X(10), y: 423, w: X(18), h: 121 });
  L.add({ type: 'raft', x: X(10) + 12, w: 96, x2: X(28) - 108, wy: 423, rise: 30, per: 8, cap: 3, speed: 90, soloPer: 3 });   // 빈 뗏목 393, 1명 401, 2명 409(둘도 벽에 걸림), 3명 417 — 무게가 딱 3(사람 셋, 또는 한 명 + 쇠 추)이어야 지나간다
  if (H) {                                        // 하드: 물길을 막는 수문 — 이쪽 둑 단추나 건너편 단추를 누르는 동안만 열린다 (둘이면 한 번 밟으면 고정)
    const g1 = L.add({ type: 'btn', x: X(4), y: X(12), w: 64, need: 1, latchN: 2, soloLatch: true });
    const g2 = L.add({ type: 'btn', x: X(31), y: X(GY), w: 64, need: 1 });
    L.add({ type: 'door', x: X(23) + 8, y: 0, w: 16, h: 398, link: [g1, g2], fast: true, style: 'glass' });
    L.add({ type: 'wire', pts: [[X(5), X(12)], [X(5), X(1)], [X(23) + 16, X(1)]], link: [g1] });
    L.add({ type: 'wire', pts: [[X(32), X(GY)], [X(32), X(1)], [X(23) + 16, X(1)]], link: [g2] });
  }
  L.add({ type: 'exit', x: X(36), y: X(GY) - 60, w: 44, h: 60, locked: true });   // 건너편에는 깃발을 두지 않는다: 물에 빠지면 처음 나루로
  return L.done({ id: 'raft', name: '둥둥', sub: '뗏목에 몇 명이 타야 할까', sci: '부력' });
};

/* 6. 찌릿찌릿 — 전기 회로: 병렬은 스위치 하나만, 직렬은 모두 눌러야 전류가 흐른다 */
S.circuit = (R, M) => {
  const L = new LB(70, 17), H = M.hard;
  L.fill(0, GY, 69, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 병렬 회로 문: 문 앞뒤 스위치 가운데 하나만 눌려도 열린다 → 누를 사람을 바꿔 가며 모두 지나간다 (하드: 저쪽 스위치는 셋 이상이면 두 명)
  L.add({ type: 'sign', x: X(3), y: X(GY), txt: '병렬', size: 15 });
  const a1 = L.add({ type: 'btn', x: X(7), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true, tag: 'pA' });
  L.fill(12, 0, 13, 10);
  const a2 = L.add({ type: 'btn', x: X(15), y: X(GY), w: 64, need: H ? TWO3 : 1, style: 'sw', tag: 'pB' });
  L.add({ type: 'door', x: X(12) + 8, y: X(11), w: 48, h: 64, link: [a1, a2], fast: true });
  L.add({ type: 'wire', pts: [[X(8), X(GY)], [X(8), X(9)], [X(12), X(9)]], link: [a1] });
  L.add({ type: 'wire', pts: [[X(16), X(GY)], [X(16), X(9)], [X(14), X(9)]], link: [a2] });
  L.add({ type: 'cell', x: X(12), y: X(8) });
  L.add({ type: 'flag', x: X(17) + 16, y: X(GY), idx: 1 });
  // B. 직렬 회로: 스위치를 모두 함께 누르고 있는 동안만 전구가 켜지고 문이 열린다 (팀 인원보다 하나 적다).
  //    건너간 사람이 저쪽의 '우회 스위치'(스위치들을 건너뛰어 전구로 바로 잇는 병렬 길)를 누르면 모두 건너온다
  //    (하드: 사이에 합선 스위치가 섞여 있다 — 밟으면 전류가 전구를 건너뛰어 불이 꺼진다)
  L.add({ type: 'sign', x: X(19) + 8, y: X(10), txt: '직렬', size: 15 });
  let sx, shx = -1;
  const P7 = [21, 23, 25, 27, 29, 31, 33];
  if (H) { const pos = R.perm(P7).slice(0, 6).sort((a, b) => a - b), k = R.i(0, 5, 5); shx = pos[k]; sx = pos.filter((c, j) => j !== k); }
  else sx = R.slots(P7, 5, [21, 24, 27, 30, 33]);
  const ss = [], ord = R.perm([1, 2, 3, 4, 5]);                                       // 몇 번째 스위치가 '인원이 많을 때만' 생기는지도 판마다 다르다
  sx.forEach((c, k) => ss.push(L.add({ type: 'btn', x: X(c), y: X(GY), w: 48, need: 1, style: 'sw', minN: ord[k] + 1, tag: 'ser' })));
  const sc = H ? L.add({ type: 'btn', x: X(shx), y: X(GY), w: 48, need: 1, style: 'sw', tag: 'short' }) : null, nl = sc ? [sc] : undefined;
  const rs = L.add({ type: 'relay', link: ss, mode: 'all', mom: true });
  L.fill(37, 0, 38, 10);
  const byp = L.add({ type: 'btn', x: X(40), y: X(GY), w: 64, need: 1, style: 'sw', tag: 'byp' });
  L.add({ type: 'door', x: X(37) + 8, y: X(11), w: 48, h: 64, link: [rs, byp], nlink: nl, fast: true });
  L.add({ type: 'wire', pts: [[X(21) + 24, X(10)], [X(37), X(10)]], link: ss, mode: 'all', nlink: nl });
  L.add({ type: 'bulb', x: X(30), y: X(8), link: [rs, byp], nlink: nl });
  L.add({ type: 'wire', pts: [[X(41), X(GY)], [X(41), X(8) + 16], [X(30) + 32, X(8) + 16]], link: [byp], nlink: nl });
  if (sc) L.add({ type: 'wire', pts: [[X(shx) + 24, X(GY)], [X(shx) + 24, X(9) + 8], [X(30) + 16, X(9) + 8]], link: [sc] });
  L.add({ type: 'flag', x: X(43), y: X(GY), idx: 2 });
  // C. 병렬 다리: 낭떠러지 위 빛다리. 앞뒤 스위치 가운데 하나만 눌려도 놓인다 (하드: 다리 앞의 '끊는 스위치'를 밟으면 다리가 꺼진다 — 뛰어넘는다)
  const b1 = L.add({ type: 'btn', x: X(45), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true, tag: 'bA' });
  const nc = H ? L.add({ type: 'btn', x: X(47), y: X(GY), w: 32, need: 1, style: 'sw', tag: 'cut' }) : null;
  L.fill(48, GY, 56, 16, ' ');
  const b2 = L.add({ type: 'btn', x: X(58), y: X(GY), w: 64, need: 1, style: 'sw', tag: 'bB' });
  L.add({ type: 'door', x: X(48), y: X(GY), w: X(9), h: 14, link: [b1, b2], nlink: nc ? [nc] : undefined, inv: true, rate: 3, style: 'bridge' });
  L.add({ type: 'wire', pts: [[X(46), X(GY)], [X(46), X(11)], [X(60) - 12, X(11)], [X(60) - 12, X(GY)]], link: [b1, b2], nlink: nc ? [nc] : undefined });
  L.add({ type: 'flag', x: X(61), y: X(GY), idx: 3 });
  L.add({ type: 'exit', x: X(65), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'circuit', name: '찌릿찌릿', sub: '직렬은 모두, 병렬은 하나만', sci: '전기 회로' });
};

/* 7. 불을 꺼라 — 연소의 세 조건(탈 물질·산소·발화점) 가운데 하나만 없애도 꺼진다 */
S.fire = (R, M) => {
  const L = new LB(62, 17), H = M.hard;
  L.fill(0, GY, 61, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 산소 막기: 공기 구멍을 모두 막고 있는 동안만 불이 꺼져 있다 (구멍은 팀 인원보다 하나 적다).
  //    건너간 사람이 저쪽 공기 밸브를 잠그면 구멍을 막던 사람들도 지나온다 (하드: 사이에 풀무가 섞여 있다 — 밟으면 바람이 들어가 불이 살아난다)
  L.add({ type: 'sign', x: X(1), y: X(10), txt: '산소 차단', size: 13, w: 84 });
  const vx = H ? R.slots([2, 4, 6, 8, 10, 12, 14], 6, [2, 4, 6, 8, 10, 12]) : R.slots([2, 4, 6, 8, 10, 12], 5, [2, 4, 6, 8, 10]);
  const bel = H ? R.i(0, 5, 2) : -1, ordV = R.perm([1, 2, 3, 4, 5]), vs = [];
  let bw = null, k = 0;
  vx.forEach((c, j) => {
    if (j === bel) { bw = L.add({ type: 'btn', x: X(c), y: X(GY), w: 64, need: 1, style: 'heat', tag: 'bel' }); return; }
    const o = ordV[k++]; vs.push(L.add({ type: 'btn', x: X(c), y: X(GY), w: 64, need: 1, style: 'vent', soloLatch: o === 1, minN: o === 1 ? undefined : o + 1, tag: 'vent' }));
  });
  const rv = L.add({ type: 'relay', link: vs, mode: 'all', mom: true });
  L.fill(18, 0, 20, 8);
  const dm = L.add({ type: 'btn', x: X(22), y: X(GY), w: 64, need: 1, style: 'vent', tag: 'damper' });
  L.add({ type: 'sign', x: X(22), y: X(10), txt: '공기 밸브', size: 12, w: 70 });
  L.add({ type: 'fire', x: X(18), y: X(9), w: 96, h: 128, link: [rv, dm], nlink: bw ? [bw] : undefined, rc: 4 });
  L.add({ type: 'flag', x: X(25), y: X(GY), idx: 1 });
  // B. 탈 물질 치우기: 장작 상자 위에서 불이 탄다. 상자를 밀어 내면 꺼진다
  L.add({ type: 'sign', x: X(27), y: X(GY), txt: '탈 물질', size: 13, w: 76 });
  L.fill(30, 0, 33, 8);
  const fp = L.add({ type: 'btn', x: X(31), y: X(GY), w: 64, need: 1, boxOnly: true, style: 'hide' });
  L.add({ type: 'box', x: X(31), y: X(11), w: 64, h: 64, need: H ? 'all' : 'most', mat: 'wood' });
  L.add({ type: 'fire', x: X(31), y: X(9), w: 64, h: 64, link: [fp], inv: true, stay: true });
  L.fill(35, 11, 35, 11);                         // 상자를 받침에서 조금만 밀어 내고 세우는 턱 (사람은 아래로, 상자 위에서는 걸어 넘는다)
  L.add({ type: 'flag', x: X(38), y: X(GY), idx: 2 });
  // C. 온도 낮추기: 높은 선반의 물 뿌리개는 밟는 동안만 물이 나온다. 건너간 사람이 저쪽 수도꼭지를 틀어 주면 선반 친구도 지나온다
  L.add({ type: 'sign', x: X(40), y: X(GY), txt: '발화점 아래로', size: 12, w: 96 });
  const sr = shelf(L, 44, 46, H);
  const sp = L.add({ type: 'btn', x: X(44) + 16, y: X(sr), w: 64, need: 1, soloLatch: true, style: 'water', tag: 'sp' });
  L.fill(50, 0, 52, 8);
  const sp2 = L.add({ type: 'btn', x: X(54), y: X(GY), w: 64, need: H ? TWO3 : 1, style: 'water', tag: 'sp2' });
  L.add({ type: 'fire', x: X(50), y: X(9), w: 96, h: 128, link: [sp, sp2], spray: true, rc: 4 });
  L.add({ type: 'exit', x: X(58), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'fire', name: '불을 꺼라', sub: '산소 · 탈 물질 · 온도', sci: '연소의 조건' });
};

/* 8. 두둥실 — 기체는 데우면 부피가 커져 가벼워진다: 버너를 켜면 열기구가 뜬다 (두 명까지) */
S.balloon = (R, M) => {
  const L = new LB(72, 17), H = M.hard, cap = 2, nd = H ? [1, 1, 1, 1, 2] : 1;      // 하드: 넷 이상이면 버너를 두 명이 함께 밟아야 켜진다
  L.fill(0, GY, 71, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 높은 언덕으로 올라가는 열기구. 아래 버너든 위 버너든 켜져 있으면 뜬다
  L.fill(17, 7, 30, 12);
  const h1 = L.add({ type: 'btn', x: X(R.i(6, 9, 8)), y: X(GY), w: 64, need: nd, style: 'heat' });          // 처음 서 있는 자리(1~5칸)와 겹치지 않게
  const h2 = L.add({ type: 'btn', x: X(19), y: X(7), w: 64, need: nd, style: 'heat' });
  L.add({ type: 'lift', x: X(13) + 16, y: X(GY) - 16, w: 112, h: 16, x2: X(13) + 16, y2: X(7), speed: 60, cap: cap, link: [h1, h2], solo: true, style: 'balloon' });
  L.add({ type: 'sign', x: X(10), y: X(GY), txt: '2명까지', size: 13, w: 70 });
  L.add({ type: 'flag', x: X(23), y: X(7), idx: 1 });
  // B. 낭떠러지를 건너는 열기구: 데우는 동안 비스듬히 떠올라 건너편 높은 땅에 닿는다
  L.fill(31, GY, 46, 16, ' ');
  L.fill(47, 5, 58, 16);
  const h3 = L.add({ type: 'btn', x: X(26), y: X(7), w: 64, need: nd, style: 'heat' });
  const h4 = L.add({ type: 'btn', x: X(R.i(49, 53, 50)), y: X(5), w: 64, need: nd, style: 'heat' });
  L.add({ type: 'lift', x: X(29) + 8, y: X(7) - 16, w: 112, h: 16, x2: X(43) + 8, y2: X(5), speed: 70, cap: cap, link: [h3, h4], solo: true, style: 'balloon' });
  L.add({ type: 'flag', x: X(53), y: X(5), idx: 2 });
  L.add({ type: 'exit', x: X(65), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'balloon', name: '두둥실', sub: '데우면 떠오르는 열기구', sci: '기체의 온도와 부피' });
};

/* 9. 꽁꽁 사르르 — 상태 변화: 물을 얼려 다리를 놓고, 얼음벽은 녹인다 (누르는 동안만) */
S.freeze = (R, M) => {
  const L = new LB(72, 17), H = M.hard;
  L.fill(0, GY, 71, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 얼음 다리: 앞뒤 냉각판 가운데 하나만 눌려 있어도 물이 언다. 떼면 녹는다 (하드: 건너편 냉각판은 셋 이상이면 두 명)
  L.fill(10, GY, 19, 15, ' ');
  L.add({ type: 'water', x: X(10), y: X(GY) + 7, w: X(10), h: 89 });
  const c1 = L.add({ type: 'btn', x: X(6), y: X(GY), w: 64, need: 1, style: 'cool', soloLatch: true, tag: 'cA' });
  const c2 = L.add({ type: 'btn', x: X(21), y: X(GY), w: 64, need: H ? TWO3 : 1, style: 'cool', tag: 'cB' });
  L.add({ type: 'door', x: X(10), y: X(GY), w: X(10), h: 14, link: [c1, c2], inv: true, rate: 1.6, style: 'ice' });
  L.add({ type: 'flag', x: X(23), y: X(GY), idx: 1 });
  // B. 얼음벽: 가열판을 모두 함께 누르고 있는 동안만 녹아 있다 (떼면 곧 다시 언다. 가열판은 팀 인원보다 하나 적다).
  //    건너간 사람이 저쪽 가열판을 밟아 주면 모두 지나온다 (하드: 사이에 냉각판이 섞여 있다 — 밟으면 식어 버린다)
  const P7 = [24, 26, 28, 30, 32, 34, 36];
  let hx, dcx = -1;
  if (H) { const pos = R.perm(P7).slice(0, 6).sort((a, b) => a - b), k = R.i(0, 5, 5); dcx = pos[k]; hx = pos.filter((c, j) => j !== k); }
  else hx = R.slots(P7, 5, [26, 28, 30, 32, 34]);
  const hs = [], ord = R.perm([1, 2, 3, 4, 5]);
  hx.forEach((c, k) => hs.push(L.add({ type: 'btn', x: X(c), y: X(GY), w: 48, need: 1, style: 'heat', soloLatch: ord[k] === 1, minN: ord[k] === 1 ? undefined : ord[k] + 1, tag: 'ser' })));
  const dc = H ? L.add({ type: 'btn', x: X(dcx), y: X(GY), w: 48, need: 1, style: 'cool', tag: 'dec' }) : null;
  const rl = L.add({ type: 'relay', link: hs, mode: 'all', mom: true, nlink: dc ? [dc] : undefined });
  L.fill(40, 0, 41, 6);
  const hf = L.add({ type: 'btn', x: X(43), y: X(GY), w: 64, need: 1, style: 'heat', tag: 'hf' });
  L.add({ type: 'door', x: X(40), y: X(7), w: 64, h: X(6), link: [rl, hf], rate: 0.8, rc: 4, style: 'icewall' });
  L.add({ type: 'flag', x: X(46), y: X(GY), idx: 2 });
  // C. 더 넓은 물: 이번 얼음은 빨리 녹는다 (하드: 이쪽 냉각판 두 개를 함께 눌러야 언다. 셋 이상일 때)
  L.fill(52, GY, 63, 15, ' ');
  L.add({ type: 'water', x: X(52), y: X(GY) + 7, w: X(12), h: 89 });
  const c3 = L.add({ type: 'btn', x: X(48), y: X(GY), w: 64, need: 1, style: 'cool', soloLatch: true, tag: 'cC' });
  const c4 = L.add({ type: 'btn', x: X(65), y: X(GY), w: 64, need: 1, style: 'cool', tag: 'cD' });
  const c5 = H ? L.add({ type: 'btn', x: X(50), y: X(GY), w: 64, need: 1, style: 'cool', minN: 3, tag: 'cE' }) : null;
  const rN = H ? L.add({ type: 'relay', link: [c3, c5], mode: 'all', mom: true }) : null;
  L.add({ type: 'door', x: X(52), y: X(GY), w: X(12), h: 14, link: H ? [rN, c4] : [c3, c4], inv: true, rate: 3, style: 'ice' });
  L.add({ type: 'exit', x: X(68), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'freeze', name: '꽁꽁 사르르', sub: '얼리면 다리, 데우면 녹는 벽', sci: '상태 변화' });
};

/* 10. 빛을 따라 — 빛의 반사: 거울 방향을 바꿔 빛을 감지기에 맞힌다 (빛이 닿아 있는 동안만 문이 열린다) */
S.light = (R, M) => {
  const L = new LB(80, 17), H = M.hard;
  L.fill(0, GY, 79, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // A. 거울 하나: 발판을 밟는 동안 거울이 돌아가 빛이 감지기로 꺾인다.
  //    건너간 사람이 저쪽 발판을 밟으면, 위로 올라간 빛이 벽 위 틈을 지나 저쪽 거울에서 꺾여 저쪽 감지기에 닿는다
  L.add({ type: 'beam', x: X(2), y: X(6), dir: 0 });
  L.fill(1, 7, 3, 7);
  const p1 = L.add({ type: 'btn', x: X(8), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true, tag: 'lA' });
  L.add({ type: 'mirror', x: X(13), y: X(6), d: 0, ok: 1, link: [p1] });
  const z1 = L.add({ type: 'sensor', x: X(13), y: X(11), mom: true });
  L.add({ type: 'mirror', x: X(13), y: X(2), d: 0 });                              // 고정 거울: 위로 간 빛을 벽 위 틈으로
  L.fill(16, 0, 17, 10); L.fill(16, 2, 17, 2, ' ');
  const p1f = L.add({ type: 'btn', x: X(21), y: X(GY), w: 64, need: 1, style: 'sw', tag: 'lB' });
  L.add({ type: 'mirror', x: X(20), y: X(2), d: 0, ok: 1, link: [p1f] });
  const z1f = L.add({ type: 'sensor', x: X(20), y: X(11), mom: true });
  L.add({ type: 'door', x: X(16) + 8, y: X(11), w: 48, h: 64, link: [z1, z1f], fast: true });
  L.add({ type: 'flag', x: X(24), y: X(GY), idx: 1 });
  // B. 거울 둘 + 헷갈리게 하는 발판: 첫 거울은 늘 틀어져 있다. 가운데 발판을 밟으면 거울이 하나 더 나타나 빛을 가로챈다.
  //    문 너머에는 따로 빛이 있어, 저쪽 발판을 밟으면 저쪽 감지기에 닿는다
  L.add({ type: 'beam', x: X(27), y: X(4), dir: 0 });
  L.fill(26, 5, 28, 5);
  const px = H ? R.perm([29, 32, 35, 38]) : R.perm([29, 33, 37]);                        // 하드: 헷갈리게 하는 발판이 둘
  const d3 = R.b(false) ? 1 : 0;
  const p2 = L.add({ type: 'btn', x: X(px[0]), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true });
  const p4 = L.add({ type: 'btn', x: X(px[1]), y: X(GY), w: 64, need: 1, style: 'sw' });
  const p3 = L.add({ type: 'btn', x: X(px[2]), y: X(GY), w: 64, need: 1, style: 'sw' });
  const p6 = H ? L.add({ type: 'btn', x: X(px[3]), y: X(GY), w: 64, need: 1, style: 'sw' }) : null;
  L.add({ type: 'mirror', x: X(41), y: X(4), d: 0, ok: 1, link: [p2] });
  L.add({ type: 'mirror', x: X(41), y: X(7), d: 0, link: [p4], opt: true });
  if (H) L.add({ type: 'mirror', x: X(41), y: X(8), d: 1, link: [p6], opt: true });
  L.add({ type: 'mirror', x: X(41), y: X(10), d: d3, ok: 1, link: [p3], okN: 2 });     // 둘 이하면 처음부터 맞다
  const z2 = L.add({ type: 'sensor', x: X(45), y: X(10), mom: true });
  L.fill(47, 0, 48, 10);
  L.add({ type: 'beam', x: X(53), y: X(9), dir: 2 }); L.fill(53, 10, 53, 10);
  const p2f = L.add({ type: 'btn', x: X(51), y: X(GY), w: 64, need: 1, style: 'sw', tag: 'lD' });
  L.add({ type: 'mirror', x: X(50), y: X(9), d: 0, ok: 1, link: [p2f] });
  const z2f = L.add({ type: 'sensor', x: X(50), y: X(6), mom: true });
  L.add({ type: 'door', x: X(47) + 8, y: X(11), w: 48, h: 64, link: [z2, z2f], fast: true });
  L.add({ type: 'flag', x: X(54), y: X(GY), idx: 2 });
  // C. 높은 선반의 발판: 친구 머리를 밟고 올라가 밟는 동안 빛이 감지기에 닿는다. 문 너머에도 따로 빛이 있다 (하드: 저쪽 발판은 셋 이상이면 두 명)
  L.add({ type: 'beam', x: X(56), y: X(3), dir: 0 });
  L.fill(55, 4, 57, 4);
  const lr = shelf(L, 59, 61, H);
  const p5 = L.add({ type: 'btn', x: X(59) + 16, y: X(lr), w: 64, need: 1, style: 'sw', soloLatch: true, tag: 'lE' });
  L.add({ type: 'mirror', x: X(64), y: X(3), d: 0, ok: 1, link: [p5] });
  const z3 = L.add({ type: 'sensor', x: X(64), y: X(9), mom: true });
  L.fill(66, 0, 67, 10);
  L.add({ type: 'beam', x: X(73), y: X(9), dir: 2 }); L.fill(73, 10, 73, 10);
  const p3f = L.add({ type: 'btn', x: X(71), y: X(GY), w: 64, need: H ? TWO3 : 1, style: 'sw', tag: 'lF' });
  L.add({ type: 'mirror', x: X(70), y: X(9), d: 0, ok: 1, link: [p3f] });
  const z3f = L.add({ type: 'sensor', x: X(70), y: X(6), mom: true });
  L.add({ type: 'door', x: X(66) + 8, y: X(11), w: 48, h: 64, link: [z3, z3f], fast: true });
  L.add({ type: 'exit', x: X(75), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'light', name: '빛을 따라', sub: '거울로 빛 꺾기', sci: '빛의 반사' });
};

YC.order = ['push', 'ice', 'saw', 'spring', 'raft', 'circuit', 'fire', 'balloon', 'freeze', 'light'];
const cache = {};
/* df: 0 노말, 1 하드. 같은 (스테이지, 씨앗, 난이도)면 늘 같은 판 */
YC.build = (id, seed, df) => {
  df = df === 1 ? 1 : 0; const k = id + ':' + (seed >>> 0) + ':' + df;
  if (!cache[k]) { const ks = Object.keys(cache); if (ks.length > 60) delete cache[ks[0]]; const d = S[id](Rnd(seed >>> 0), { hard: df === 1 }); d.df = df; cache[k] = d; }
  return cache[k];
};
YC.DIFF = ['노말', '하드'];
})(typeof window !== 'undefined' ? window : globalThis);
