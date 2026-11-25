/* 영차영차 — levels.js : 스테이지
   한 칸 = 32픽셀. 캐릭터는 24×28, 혼자 뛰면 2칸(64)까지, 친구 머리를 밟으면 3칸(96)까지 오른다.
   글자: # 땅, I 얼음, S 모래, ^ 가시, s 혼자 연습할 때만 생기는 디딤돌                              */
(function (root) {
'use strict';
const YC = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.YC;
const T = YC.T, LB = YC.LB, S = YC.stages;
const X = c => c * T;
const GY = 13;                                   // 땅 윗면이 있는 줄

/* 1. 영차! — 같은 방향으로 밀기 (알짜힘) */
S.push = () => {
  const L = new LB(58, 17);
  L.fill(0, GY, 57, 16);
  L.spawn = { x: X(2), y: X(GY) };
  // 높은 턱: 친구 머리를 밟고 올라가 버튼을 밟고 있으면 아래 문이 열린다
  L.fill(13, 10, 14, 10);
  L.fill(12, 12, 12, 12, 's');
  const b1 = L.add({ type: 'btn', x: X(13) + 6, y: X(10), w: 52, need: 1 });
  L.add({ type: 'door', x: X(13) + 8, y: X(11), w: 48, h: 64, link: [b1] });
  L.add({ type: 'sign', x: X(9), y: X(GY), icon: 'stack' });
  L.add({ type: 'flag', x: X(17), y: X(GY), idx: 1 });
  // 굴 속의 무거운 상자: 구덩이까지 밀어 넣으면 다리가 된다
  L.fill(21, 5, 30, 10);
  L.add({ type: 'box', x: X(22), y: X(11), w: 64, h: 64, need: 'most', mat: 'wood' });
  L.fill(31, 13, 32, 14, ' ');
  L.fill(33, 12, 33, 12);
  L.add({ type: 'flag', x: X(35), y: X(GY), idx: 2 });
  // 선반 위의 열쇠, 나가는 문
  L.fill(42, 10, 44, 10);                         // 떠 있는 선반 (아래로는 지나다닌다)
  L.fill(41, 12, 41, 12, 's');
  L.add({ type: 'key', x: X(43) + 4, y: X(10) - 34 });
  L.add({ type: 'exit', x: X(51), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'push', name: '영차!', sub: '같은 방향으로 밀기', sci: '알짜힘' });
};

/* 2. 미끌미끌 — 마찰력: 모래 위에서는 다 같이, 얼음 위에서는 살살 */
S.ice = () => {
  const L = new LB(56, 17);
  L.fill(0, GY, 19, 16);
  L.fill(9, GY, 19, GY, 'S');                     // 모래밭
  L.fill(8, 10, 8, 11);                           // 상자만 걸리는 턱 (사람은 아래로 지나간다)
  L.fill(20, 9, 55, 16);                          // 높은 땅
  L.fill(24, 9, 39, 9, 'I');                      // 얼음판
  L.spawn = { x: X(1), y: X(GY) };
  L.add({ type: 'sign', x: X(13), y: X(GY), icon: 'push', need: 'all' });
  L.add({ type: 'box', x: X(10), y: X(11), w: 64, h: 64, need: 'most', needS: 'all', mat: 'wood' });
  L.add({ type: 'flag', x: X(21), y: X(9), idx: 1 });
  L.add({ type: 'sign', x: X(28), y: X(9), icon: 'ice' });
  L.add({ type: 'box', x: X(25), y: X(7), w: 64, h: 64, need: 'most', mat: 'iron', wt: 2 });
  const b = L.add({ type: 'btn', x: X(31), y: X(9), w: 128, need: 'w2', boxOnly: true, latchT: 1.5 });   // 쇠 상자를 세워 두는 자리
  L.fill(22, 7, 22, 7); L.fill(41, 7, 41, 7);     // 쇠 상자가 벼랑이나 문까지 못 가게 막는 턱 (사람은 아래로 지나간다)
  L.fill(43, 0, 44, 6);
  L.add({ type: 'door', x: X(43) + 8, y: X(7), w: 48, h: 64, link: [b] });
  L.add({ type: 'exit', x: X(50), y: X(9) - 60, w: 44, h: 60 });
  return L.done({ id: 'ice', name: '미끌미끌', sub: '모래는 다 같이, 얼음은 살살', sci: '마찰력' });
};

/* 3. 하나 둘 셋! — 시소: 무거운 쪽이 내려가고, 뛰어내리면 반대쪽이 튄다 */
S.saw = () => {
  const L = new LB(56, 17);
  L.fill(0, GY, 12, 16);
  L.fill(22, GY, 55, 16);
  L.spawn = { x: X(2), y: X(GY) };
  // 구덩이 위의 시소: 한 명을 높은 턱 위로 올려 보낸다
  L.add({ type: 'saw', px: 560, py: 421, L: 136, max: 0.349, hi: 0, rest: 0, base: 560, solo: 1, launchV: 0, vref: 500 });   // 오른쪽 끝은 받침에 걸려 수평보다 내려가지 않는다
  L.fill(22, 10, 23, 10);
  L.fill(21, 12, 21, 12, 's');
  const b1 = L.add({ type: 'btn', x: X(22) + 6, y: X(10), w: 52, need: 1 });
  L.add({ type: 'door', x: X(22), y: X(11), w: 48, h: 64, link: [b1] });           // 문 앞에 설 자리를 두지 않는다
  L.add({ type: 'flag', x: X(24) + 8, y: X(GY), idx: 1 });
  // 탑에서 뛰어내려 반대쪽 친구를 선반까지 쏘아 올린다
  L.fill(27, 11, 27, 12); L.fill(28, 9, 28, 12); L.fill(29, 7, 31, 12);
  L.add({ type: 'sign', x: X(29) + 16, y: X(7), icon: 'drop' });
  L.add({ type: 'saw', px: 1160, py: 370, L: 120, max: 0.3936, rest: 0.3936, base: 416, launchV: 1100, vref: 480 });
  L.fill(41, 6, 44, 6);
  L.add({ type: 'key', x: X(42) + 16, y: X(6) - 34 });
  L.fill(48, 11, 48, 11, 's'); L.fill(47, 9, 47, 9, 's'); L.fill(46, 7, 46, 7, 's');   // 혼자 연습용 디딤돌 (아래로는 지나다닌다)
  L.add({ type: 'exit', x: X(51), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'saw', name: '하나 둘 셋!', sub: '시소로 친구 쏘아 올리기', sci: '무게와 시소' });
};

/* 4. 딱 맞게 — 용수철: 저울은 딱 맞는 인원만, 발사대는 다 같이 눌렀다가 한 번에 */
S.spring = () => {
  const L = new LB(50, 17);
  L.fill(0, GY, 49, 16);
  L.spawn = { x: X(1), y: X(GY) };
  const p1 = L.add({ type: 'pad', x: X(8), y: 380, w: 96, fy: X(GY), maxc: 30, mode: 'scale', eq: 'half' });
  L.fill(14, 0, 15, 10);
  const p2 = L.add({ type: 'pad', x: X(20), y: 380, w: 96, fy: X(GY), maxc: 30, mode: 'scale', eq: 'rest' });
  L.add({ type: 'door', x: X(14) + 8, y: X(11), w: 48, h: 64, link: [p1, p2] });
  L.add({ type: 'flag', x: X(24), y: X(GY), idx: 1 });
  L.add({ type: 'pad', x: X(28), y: 376, w: 160, fy: X(GY), maxc: 36, mode: 'launch', launchV: 960 });
  L.fill(34, 6, 36, 6);
  L.add({ type: 'key', x: X(35) + 4, y: X(6) - 34 });
  L.fill(40, 11, 40, 11, 's'); L.fill(39, 9, 39, 9, 's'); L.fill(38, 7, 38, 7, 's');
  L.add({ type: 'exit', x: X(44), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'spring', name: '딱 맞게', sub: '용수철저울과 용수철 발사대', sci: '탄성력' });
};

/* 5. 둥둥 — 부력: 가벼우면 높이 떠서 벽에 걸리고, 너무 무거우면 가라앉는다 */
S.raft = () => {
  const L = new LB(44, 17);
  L.fill(0, GY, 9, 16);
  L.fill(10, 16, 27, 16);
  L.fill(28, GY, 43, 16);
  L.fill(18, 0, 19, 11);                          // 물 위로 내려온 벽
  L.spawn = { x: X(1), y: X(GY) };
  L.fill(7, 11, 7, 12);
  L.add({ type: 'key', x: X(7) + 4, y: X(11) - 34 });
  L.add({ type: 'water', x: X(10), y: 423, w: X(18), h: 121 });
  L.add({ type: 'raft', x: X(10) + 12, w: 96, x2: X(28) - 108, wy: 423, rise: 22, per: 8, cap: 3, speed: 90 });   // 빈 뗏목 401, 1명 409(벽에 걸림), 2명 417, 3명 425
  L.add({ type: 'exit', x: X(36), y: X(GY) - 60, w: 44, h: 60, locked: true });   // 건너편에는 깃발을 두지 않는다: 물에 빠지면 처음 나루로
  return L.done({ id: 'raft', name: '둥둥', sub: '뗏목에 몇 명이 타야 할까', sci: '부력' });
};

YC.order = ['push', 'ice', 'saw', 'spring', 'raft'];
const cache = {};
YC.build = id => cache[id] || (cache[id] = S[id]());
})(typeof window !== 'undefined' ? window : globalThis);
