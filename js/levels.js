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
  const L = new LB(102, 17), D = 44;              // D: 새로 넣은 방만큼 뒤쪽(열쇠·나가는 문)을 민 칸 수
  L.fill(0, GY, 101, 16);
  L.spawn = { x: X(2), y: X(GY) };
  // 높은 턱: 친구 머리를 밟고 올라가 버튼을 밟고 있으면 아래 문이 열린다
  L.fill(13, 10, 14, 10);
  L.fill(12, 12, 12, 12, 's');
  const b1 = L.add({ type: 'btn', x: X(13) + 6, y: X(10), w: 52, need: 1 });
  L.add({ type: 'door', x: X(13) + 8, y: X(11), w: 48, h: 64, link: [b1] });
  L.add({ type: 'sign', x: X(9), y: X(GY), icon: 'stack' });
  L.add({ type: 'flag', x: X(17), y: X(GY), idx: 1 });
  // 굴 속의 무거운 상자: 가시 구덩이까지 밀어 넣으면 다리가 된다 (먼저 뛰어들면 가시에 찔린다)
  L.fill(21, 5, 30, 10);
  L.add({ type: 'box', x: X(22), y: X(11), w: 64, h: 64, need: 'most', mat: 'wood' });
  L.fill(31, 13, 32, 14, ' ');
  L.fill(31, 14, 32, 14, '^');
  L.fill(33, 12, 33, 12);
  L.add({ type: 'flag', x: X(35), y: X(GY), idx: 2 });
  // 모두가 같은 쪽으로 밀어야만 움직이는 큰 상자: 언덕 밑까지 밀어 계단으로 쓴다 (한 명이라도 반대로 밀면 멈춘다)
  L.add({ type: 'box', x: X(38), y: X(11), w: 64, h: 64, need: 'all', mat: 'wood' });
  L.add({ type: 'sign', x: X(42), y: X(GY), icon: 'push', need: 'all' });
  L.fill(50, 9, 56, 12);
  L.add({ type: 'flag', x: X(54), y: X(9), idx: 3 });
  // 상자 둘, 단추 둘: 팀이 둘로 나뉘어 각자 상자를 단추 위로 민다. 둘 다 눌려야 문이 열린다
  L.add({ type: 'box', x: X(59), y: X(11), w: 64, h: 64, need: 'rest', mat: 'wood' });
  const bq = L.add({ type: 'btn', x: X(62), y: X(GY), w: 128, need: 1, boxOnly: true, latchT: 1 });
  L.fill(66, 11, 66, 11);                         // 상자만 걸리는 턱 (사람은 아래로 지나가고, 상자 위에서는 걸어 넘는다)
  L.add({ type: 'box', x: X(68), y: X(11), w: 64, h: 64, need: 'half', mat: 'wood' });
  const bp = L.add({ type: 'btn', x: X(71), y: X(GY), w: 128, need: 1, boxOnly: true, latchT: 1 });
  L.fill(75, 11, 75, 11);
  L.fill(78, 0, 79, 10);
  L.add({ type: 'door', x: X(78) + 8, y: X(11), w: 48, h: 64, link: [bq, bp], mode: 'all' });
  L.add({ type: 'flag', x: X(81), y: X(GY), idx: 4 });
  // 선반 위의 열쇠, 나가는 문
  L.fill(42 + D, 10, 44 + D, 10);                 // 떠 있는 선반 (아래로는 지나다닌다)
  L.fill(41 + D, 12, 41 + D, 12, 's');
  L.add({ type: 'key', x: X(43 + D) + 4, y: X(10) - 34 });
  L.add({ type: 'exit', x: X(51 + D), y: X(GY) - 60, w: 44, h: 60, locked: true });
  return L.done({ id: 'push', name: '영차!', sub: '같은 방향으로 밀기', sci: '알짜힘' });
};

/* 2. 미끌미끌 — 마찰력: 모래 위에서는 다 같이, 얼음 위에서는 살살 */
S.ice = () => {
  const L = new LB(102, 17);
  L.fill(0, GY, 19, 16);
  L.fill(9, GY, 19, GY, 'S');                     // 모래밭
  L.fill(8, 10, 8, 11);                           // 상자만 걸리는 턱 (사람은 아래로 지나간다)
  L.fill(20, 9, 101, 16);                         // 높은 땅
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
  // 얼음 위 가시 구덩이: 미끄러워서 멈추기 어렵다. 달려가며 뛰어 넘는다
  L.add({ type: 'flag', x: X(46), y: X(9), idx: 2 });
  L.fill(48, 9, 71, 9, 'I');
  for (const g of [53, 59, 65]) { L.fill(g, 9, g + 1, 9, ' '); L.fill(g, 10, g + 1, 10, '^'); }
  // 얼음 위에서는 한 명만 밀어도 상자가 미끄러져 간다: 넓은 가시 구덩이에 빠뜨려 다리로 쓴다
  L.add({ type: 'flag', x: X(73), y: X(9), idx: 3 });
  L.fill(75, 9, 84, 9, 'I');
  L.add({ type: 'box', x: X(76), y: X(7), w: 96, h: 64, need: 'most', mat: 'wood' });
  L.fill(85, 9, 87, 9, ' '); L.fill(85, 10, 87, 10, '^');
  L.fill(88, 8, 88, 8);                           // 상자를 구덩이 바로 위에서 세우는 턱
  L.add({ type: 'exit', x: X(96), y: X(9) - 60, w: 44, h: 60 });
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

/* 6. 찌릿찌릿 — 전기 회로: 병렬은 스위치 하나만, 직렬은 모두 눌러야 전류가 흐른다 */
S.circuit = () => {
  const L = new LB(68, 17);
  L.fill(0, GY, 67, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // 병렬 회로 문: 문 앞뒤 스위치 가운데 하나만 눌려도 열린다 → 누를 사람을 바꿔 가며 모두 지나간다
  L.add({ type: 'sign', x: X(4), y: X(GY), txt: '병렬', size: 15 });
  const a1 = L.add({ type: 'btn', x: X(8), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true });
  L.fill(12, 0, 13, 10);
  const a2 = L.add({ type: 'btn', x: X(15), y: X(GY), w: 64, need: 1, style: 'sw' });
  const d1 = L.add({ type: 'door', x: X(12) + 8, y: X(11), w: 48, h: 64, link: [a1, a2] });
  L.add({ type: 'wire', pts: [[X(9), X(GY)], [X(9), X(9)], [X(12), X(9)]], link: [a1] });
  L.add({ type: 'wire', pts: [[X(16), X(GY)], [X(16), X(9)], [X(14), X(9)]], link: [a2] });
  L.add({ type: 'cell', x: X(12), y: X(8) });
  L.add({ type: 'flag', x: X(19), y: X(GY), idx: 1 });
  // 직렬 회로: 스위치를 모두 함께 눌러야 전구가 켜지고, 잠깐 켜져 있으면 문이 딸깍 열린 채로 남는다 (인원이 적으면 스위치가 줄어든다)
  L.add({ type: 'sign', x: X(21), y: X(GY), txt: '직렬', size: 15 });
  const ss = [], sx = [23, 26, 29, 32];
  sx.forEach((c, k) => ss.push(L.add({ type: 'btn', x: X(c), y: X(GY), w: 48, need: 1, style: 'sw', minN: k + 1 })));
  const rl = L.add({ type: 'relay', link: ss, mode: 'all', latchT: 1.2 });
  L.fill(36, 0, 37, 10);
  L.add({ type: 'door', x: X(36) + 8, y: X(11), w: 48, h: 64, link: [rl] });
  L.add({ type: 'wire', pts: [[X(23) + 24, X(10)], [X(36), X(10)]], link: ss, mode: 'all' });
  L.add({ type: 'bulb', x: X(30), y: X(8), link: ss, mode: 'all' });
  L.add({ type: 'flag', x: X(40), y: X(GY), idx: 2 });
  // 병렬 다리: 낭떠러지 위 빛다리. 앞뒤 스위치 가운데 하나만 눌려도 놓인다
  const b1 = L.add({ type: 'btn', x: X(43), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true });
  L.fill(46, GY, 54, 16, ' ');
  const b2 = L.add({ type: 'btn', x: X(56), y: X(GY), w: 64, need: 1, style: 'sw' });
  L.add({ type: 'door', x: X(46), y: X(GY), w: X(9), h: 14, link: [b1, b2], inv: true, rate: 1.2, style: 'bridge' });
  L.add({ type: 'wire', pts: [[X(44), X(GY)], [X(44), X(11)], [X(58) - 12, X(11)], [X(58) - 12, X(GY)]], link: [b1, b2] });
  L.add({ type: 'flag', x: X(59), y: X(GY), idx: 3 });
  L.add({ type: 'exit', x: X(63), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'circuit', name: '찌릿찌릿', sub: '직렬은 모두, 병렬은 하나만', sci: '전기 회로' });
};

/* 7. 불을 꺼라 — 연소의 세 조건(탈 물질·산소·발화점)을 하나씩 없앤다 */
S.fire = () => {
  const L = new LB(60, 17);
  L.fill(0, GY, 59, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // 산소 막기: 공기 구멍 두 곳을 함께 막으면 불이 꺼진다
  L.add({ type: 'sign', x: X(4), y: X(GY), txt: '산소 차단', size: 13, w: 84 });
  const v1 = L.add({ type: 'btn', x: X(8), y: X(GY), w: 64, need: 1, style: 'vent', soloLatch: true });
  const v2 = L.add({ type: 'btn', x: X(12), y: X(GY), w: 64, need: 1, style: 'vent', minN: 2 });
  L.fill(17, 0, 19, 8);
  L.add({ type: 'fire', x: X(17), y: X(9), w: 96, h: 128, link: [v1, v2], mode: 'all', stay: true });
  L.add({ type: 'flag', x: X(21), y: X(GY), idx: 1 });
  // 탈 물질 치우기: 장작 상자 위에서 불이 탄다. 상자를 밀어 내면 꺼진다
  L.add({ type: 'sign', x: X(24), y: X(GY), txt: '탈 물질', size: 13, w: 76 });
  L.fill(28, 0, 31, 8);
  const fp = L.add({ type: 'btn', x: X(29), y: X(GY), w: 64, need: 1, boxOnly: true, style: 'hide' });
  L.add({ type: 'box', x: X(29), y: X(11), w: 64, h: 64, need: 'most', mat: 'wood' });
  L.add({ type: 'fire', x: X(29), y: X(9), w: 64, h: 64, link: [fp], inv: true, stay: true });
  L.fill(33, 11, 33, 11);                         // 상자를 받침에서 조금만 밀어 내고 세우는 턱 (사람은 아래로, 상자 위에서는 걸어 넘는다)
  L.add({ type: 'flag', x: X(36), y: X(GY), idx: 2 });
  // 온도 낮추기: 높은 선반 위의 물 뿌리개를 틀면 불이 식어 꺼진다 (친구 머리를 밟고 올라간다)
  L.add({ type: 'sign', x: X(38), y: X(GY), txt: '발화점 아래로', size: 12, w: 96 });
  L.fill(42, 10, 44, 10);
  L.fill(41, 12, 41, 12, 's');
  const sp = L.add({ type: 'btn', x: X(42) + 16, y: X(10), w: 64, need: 1, latch: true, style: 'water' });
  L.fill(48, 0, 50, 8);
  L.add({ type: 'fire', x: X(48), y: X(9), w: 96, h: 128, link: [sp], stay: true, spray: true });
  L.add({ type: 'exit', x: X(55), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'fire', name: '불을 꺼라', sub: '산소 · 탈 물질 · 온도', sci: '연소의 조건' });
};

/* 8. 두둥실 — 기체는 데우면 부피가 커져 가벼워진다: 버너를 켜면 열기구가 뜬다 */
S.balloon = () => {
  const L = new LB(72, 17);
  L.fill(0, GY, 71, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // 높은 언덕으로 올라가는 열기구. 아래 버너든 위 버너든 켜져 있으면 뜬다
  L.fill(17, 7, 30, 12);
  const h1 = L.add({ type: 'btn', x: X(8), y: X(GY), w: 64, need: 1, style: 'heat' });
  const h2 = L.add({ type: 'btn', x: X(19), y: X(7), w: 64, need: 1, style: 'heat' });
  L.add({ type: 'lift', x: X(13) + 16, y: X(GY) - 16, w: 112, h: 16, x2: X(13) + 16, y2: X(7), speed: 60, link: [h1, h2], solo: true, style: 'balloon' });
  L.add({ type: 'flag', x: X(23), y: X(7), idx: 1 });
  // 낭떠러지를 건너는 열기구: 데우는 동안 비스듬히 떠올라 건너편 높은 땅에 닿는다
  L.fill(31, GY, 46, 16, ' ');
  L.fill(47, 5, 58, 16);
  const h3 = L.add({ type: 'btn', x: X(26), y: X(7), w: 64, need: 1, style: 'heat' });
  const h4 = L.add({ type: 'btn', x: X(50), y: X(5), w: 64, need: 1, style: 'heat' });
  L.add({ type: 'lift', x: X(29) + 8, y: X(7) - 16, w: 112, h: 16, x2: X(43) + 8, y2: X(5), speed: 70, link: [h3, h4], solo: true, style: 'balloon' });
  L.add({ type: 'flag', x: X(53), y: X(5), idx: 2 });
  L.add({ type: 'exit', x: X(65), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'balloon', name: '두둥실', sub: '데우면 떠오르는 열기구', sci: '기체의 온도와 부피' });
};

/* 9. 꽁꽁 사르르 — 상태 변화: 물을 얼려 다리를 놓고, 얼음벽은 녹인다 */
S.freeze = () => {
  const L = new LB(70, 17);
  L.fill(0, GY, 69, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // 얼음 다리: 앞뒤 냉각판 가운데 하나만 눌려 있어도 물이 언다. 떼면 천천히 녹는다
  L.fill(10, GY, 19, 15, ' ');
  L.add({ type: 'water', x: X(10), y: X(GY) + 7, w: X(10), h: 89 });
  const c1 = L.add({ type: 'btn', x: X(6), y: X(GY), w: 64, need: 1, style: 'cool', soloLatch: true });
  const c2 = L.add({ type: 'btn', x: X(21), y: X(GY), w: 64, need: 1, style: 'cool' });
  L.add({ type: 'door', x: X(10), y: X(GY), w: X(10), h: 14, link: [c1, c2], inv: true, rate: 0.7, style: 'ice' });
  L.add({ type: 'flag', x: X(24), y: X(GY), idx: 1 });
  // 얼음벽: 가열판을 모두 함께 눌러야 녹는다 (인원이 적으면 가열판이 줄어든다)
  const hs = [], hx = [27, 30, 33, 36];
  hx.forEach((c, k) => hs.push(L.add({ type: 'btn', x: X(c), y: X(GY), w: 48, need: 1, style: 'heat', minN: k + 1 })));
  const rl = L.add({ type: 'relay', link: hs, mode: 'all', latchT: 1.5 });
  L.fill(40, 0, 41, 6);
  L.add({ type: 'door', x: X(40), y: X(7), w: 64, h: X(6), link: [rl], rate: 0.8, style: 'icewall' });
  L.add({ type: 'flag', x: X(44), y: X(GY), idx: 2 });
  // 더 넓은 물: 이번 얼음은 빨리 녹는다
  L.fill(50, GY, 61, 15, ' ');
  L.add({ type: 'water', x: X(50), y: X(GY) + 7, w: X(12), h: 89 });
  const c3 = L.add({ type: 'btn', x: X(46), y: X(GY), w: 64, need: 1, style: 'cool', soloLatch: true });
  const c4 = L.add({ type: 'btn', x: X(63), y: X(GY), w: 64, need: 1, style: 'cool' });
  L.add({ type: 'door', x: X(50), y: X(GY), w: X(12), h: 14, link: [c3, c4], inv: true, rate: 1.4, style: 'ice' });
  L.add({ type: 'exit', x: X(66), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'freeze', name: '꽁꽁 사르르', sub: '얼리면 다리, 데우면 녹는 벽', sci: '상태 변화' });
};

/* 10. 빛을 따라 — 빛의 반사: 거울 방향을 바꿔 빛을 감지기에 맞힌다 */
S.light = () => {
  const L = new LB(64, 17);
  L.fill(0, GY, 63, 16);
  L.spawn = { x: X(1), y: X(GY) };
  // 거울 하나: 발판을 밟으면 거울이 돌아가 빛이 감지기로 꺾인다
  L.add({ type: 'beam', x: X(2), y: X(6), dir: 0 });
  L.fill(1, 7, 3, 7);
  const p1 = L.add({ type: 'btn', x: X(8), y: X(GY), w: 64, need: 1, style: 'sw', soloLatch: true });
  L.add({ type: 'mirror', x: X(13), y: X(6), d: 0, link: [p1] });
  const z1 = L.add({ type: 'sensor', x: X(13), y: X(11), latchT: 0.5 });
  L.fill(16, 0, 17, 10);
  L.add({ type: 'door', x: X(16) + 8, y: X(11), w: 48, h: 64, link: [z1] });
  L.add({ type: 'flag', x: X(19), y: X(GY), idx: 1 });
  // 거울 둘 + 헷갈리게 하는 발판: 맞는 발판 둘을 함께 밟는다 (가운데 발판을 밟으면 거울이 하나 더 나타나 빛을 가로챈다)
  L.add({ type: 'beam', x: X(21), y: X(4), dir: 0 });
  L.fill(20, 5, 22, 5);
  const p2 = L.add({ type: 'btn', x: X(23), y: X(GY), w: 64, need: 1, style: 'sw' });
  const p4 = L.add({ type: 'btn', x: X(27), y: X(GY), w: 64, need: 1, style: 'sw' });
  const p3 = L.add({ type: 'btn', x: X(31), y: X(GY), w: 64, need: 1, style: 'sw', minN: 2 });
  L.add({ type: 'mirror', x: X(35), y: X(4), d: 0, link: [p2] });
  L.add({ type: 'mirror', x: X(35), y: X(7), d: 0, link: [p4], opt: true });
  L.add({ type: 'mirror', x: X(35), y: X(10), d: 0, link: [p3] });
  const z2 = L.add({ type: 'sensor', x: X(39), y: X(10), latchT: 0.6 });
  L.fill(41, 0, 42, 10);
  L.add({ type: 'door', x: X(41) + 8, y: X(11), w: 48, h: 64, link: [z2] });
  L.add({ type: 'flag', x: X(44), y: X(GY), idx: 2 });
  // 높은 선반의 스위치: 친구 머리를 밟고 올라가 밟아야 빛이 감지기에 닿는다
  L.add({ type: 'beam', x: X(46), y: X(3), dir: 0 });
  L.fill(45, 4, 47, 4);
  L.fill(49, 10, 51, 10); L.fill(48, 12, 48, 12, 's');
  const p5 = L.add({ type: 'btn', x: X(49) + 16, y: X(10), w: 64, need: 1, style: 'sw' });
  L.add({ type: 'mirror', x: X(54), y: X(3), d: 0, link: [p5] });
  const z3 = L.add({ type: 'sensor', x: X(54), y: X(9), latchT: 0.6 });
  L.fill(56, 0, 57, 10);
  L.add({ type: 'door', x: X(56) + 8, y: X(11), w: 48, h: 64, link: [z3] });
  L.add({ type: 'exit', x: X(60), y: X(GY) - 60, w: 44, h: 60 });
  return L.done({ id: 'light', name: '빛을 따라', sub: '거울로 빛 꺾기', sci: '빛의 반사' });
};

YC.order = ['push', 'ice', 'saw', 'spring', 'raft', 'circuit', 'fire', 'balloon', 'freeze', 'light'];
const cache = {};
YC.build = id => cache[id] || (cache[id] = S[id]());
})(typeof window !== 'undefined' ? window : globalThis);
