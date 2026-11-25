/* 영차영차 — ai.js : 스테이지별 AI 대본. 맨 앞 번호(n-1)가 받침·버튼 지기 같은 어려운 역할을, 0번이 가장 쉬운 역할을 맡는다.
   (혼자 연습에서는 0번이 사람이다) */
(function (root) {
'use strict';
const T = 32;
const X = c => c * T + 16;                       // 칸 가운데

/* base의 머리 위로 올라간다 (왼쪽에서) */
function* hopOn(b, base, side) {
  side = side || -1; b.me.ride = true;                               // 일부러 올라탄다
  yield* b.walkTo(base.cx() + side * 30, 3);
  for (let k = 0; k < 6; k++) {
    yield* b.jump(base.cx(), 3);
    if (b.me.gRef === -(base.i + 1)) return;
    yield* b.wait(0.2);
    if (b.me.gRef === -(base.i + 1)) return;
    yield* b.walkTo(base.cx() + side * 30, 3);
  }
  throw new Error('머리 위로 못 올라감 (봇 ' + b.i + ')');
}

/* 남의 머리 위에 내려앉았으면 걸어 내려온다 */
function* offHead(b, dir) {
  for (let k = 0; k < 200 && !b.me.gr; k++) yield;
  let t = 0;
  while (b.me.gRef < 0 && t++ < 240) { b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; yield; }
  b.stop();
  for (let k = 0; k < 120 && !b.me.gr; k++) yield;
  b.me.ride = false;
}

/* 나가는 문까지 가서 들어간다 */
function* goExit(b) {
  const e = b.obj('exit'), key = b.obj('key'); b.me.ride = false;
  for (let t = 0; t < 60 && key && key.hd < 0 && !key.used && b.me.want; t++) yield;    // 방금 집은 열쇠가 내 것이 될 때까지 잠깐
  if (!e.open && key && key.hd >= 0 && key.hd !== b.i) {             // 잠긴 문 앞은 열쇠 든 친구에게 비켜 준다
    yield* b.walkTo(e.x - 60 - b.i * 28, 8, 40); yield* offHead(b, -1);
    yield* b.until(() => e.open, 120, '나가는 문 열림');
    yield* b.wait(b.i * 0.25);
  }
  for (let k = 0; k < 40 && !b.me.fin; k++) {
    yield* b.walkTo(e.x + e.w / 2, 9, 30);
    yield* offHead(b, k % 2 ? -1 : 1);
    if (!e.open) { yield* b.until(() => e.open, 30, '나가는 문 열림'); continue; }
    if (b.me.atExit) yield* b.enter(); else yield* b.wait(0.2);
  }
}

/* 상자를 밀지 않고 뛰어 넘어간다 (dir: 가려는 쪽) */
function* overBox(b, box, dir) {
  for (let k = 0; k < 6; k++) {
    const face = dir > 0 ? box.x : box.x + box.w, far = dir > 0 ? box.x + box.w + 16 : box.x - 16;
    if (dir > 0 ? b.cx() > far : b.cx() < far) return;
    let t = 0;
    while (Math.abs(face - b.cx()) > 60 && t++ < 300) { b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; yield; }
    b.inp.r = dir > 0 ? 1 : 0; b.inp.l = dir < 0 ? 1 : 0; b.inp.j = 1; yield;
    for (t = 0; t < 200; t++) { yield; if (b.me.vy >= 0) b.inp.j = 0; if (b.me.gr && t > 3) break; }
    b.inp.j = 0;
    for (t = 0; t < 200 && (dir > 0 ? b.cx() < far : b.cx() > far) && (b.me.gRef === box.id || !b.me.gr); t++) yield;
    b.stop();
    for (t = 0; t < 60 && !b.me.gr; t++) yield;
  }
}

const scripts = {};

/* 자리로 가서 맨땅에 선다 (남의 머리 위면 뒤로 물러나 내려온다) */
function* stand(b, x, tol) {
  b.me.ride = false;
  for (let k = 0; k < 6; k++) {
    yield* b.walkTo(x, tol || 4, 30);
    for (let t = 0; t < 60 && !b.me.gr; t++) yield;
    if (b.me.gRef >= 0) return;
    yield* offHead(b, -1);
    x -= 14;
  }
}

scripts.push = function (sim) {
  const B = sim.bots, n = sim.n, D = 44;
  const base = B[n - 1], climber = B[n - 2];                         // 처음에 가장 앞에 선 둘
  const door = b => b.obj('door'), box = b => b.obj('box'), key = b => b.obj('key');
  B.forEach((b, i) => b.play(function* (b) {
    const back = n - 3 - i;                                          // 뒤따르는 사람의 줄 번호(0이 앞)
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    yield* b.wait((n - 1 - i) * 0.3);                                // 앞사람부터 차례로 출발
    if (n === 1) {
      yield* b.walkTo(X(11)); yield* b.jump(X(12)); yield* b.jump(X(14) - 6);
      yield* b.walkTo(X(16)); yield* b.until(() => b.me.gr, 3);
    } else if (b === base) {
      yield* b.walkTo(X(12) - 4);                                    // 턱 바로 왼쪽
      yield* b.until(() => door(b).open > 0.9, 30, '문 열림');
      yield* b.walkTo(X(18) + 60);
    } else if (b === climber) {
      yield* b.until(() => Math.abs(base.cx() - (X(12) - 4)) < 4 && base.me.gr, 20, '받침 자리 잡기');
      yield* hopOn(b, base);
      yield* b.jump(X(14) - 8);                                      // 턱 위로
      yield* b.until(() => b.me.gr && b.feet() < 330, 3, '턱 위');
      yield* b.walkTo(X(14) - 8);
      yield* b.until(() => B.every(o => o === b || o.cx() > X(18)), 30, '모두 통과');
      yield* b.walkTo(X(16)); yield* offHead(b, -1);
    } else {
      yield* b.until(() => climber.cx() > X(12) - 50 || door(b).open > 0.9, 40, '올라갈 친구가 먼저 감');      // 앞지르지 않는다
      yield* stand(b, X(12) - 4 - 76 - back * 32);
      yield* b.until(() => door(b).open > 0.9, 30, '문 열림');
      yield* offHead(b, -1); yield* b.walkTo(X(17) + i * 30, 6, 20); yield* offHead(b, -1);
    }
    // 굴의 상자: 떨어질 때까지 다 같이 민다
    yield* b.hold(1, () => box(b).y > 12 * T, 40, '상자가 구덩이에 빠짐');
    for (let k = 0; k < 8 && b.cx() < 34 * T + 4; k++) {            // 턱 넘기
      yield* b.hold(1, () => b.cx() > X(30) - 4 || b.me.vx === 0, 6);
      yield* b.jump(X(35) + 10 + i * 6, 6);
      yield* offHead(b, 1);
    }
    // 다 같이 밀어야 움직이는 큰 상자를 언덕 밑까지 → 상자를 딛고 언덕 위로
    const big = b => b.obj('box', 1);
    if (b.cx() < X(34)) yield* b.walkTo(X(36), 8, 20);              // 구덩이 턱을 아직 못 넘었으면 (걷다가 막히면 뛰어넘는다)
    for (let k = 0; k < 4 && (b.cx() > big(b).x + 8 || b.me.gRef === big(b).id); k++) yield* overBox(b, big(b), -1);   // 상자 너머로 갔으면 돌아온다
    yield* b.hold(1, () => big(b).x >= 48 * T - 1, 60, '큰 상자를 언덕까지');
    yield* offHead(b, -1);
    for (let k = 0; k < 30 && b.feet() > 300; k++) {                // 상자를 딛고 언덕으로. 머리 위에 친구가 있으면 그 친구가 먼저 오른다
      if (b.me.gRef === big(b).id) yield* b.jump(X(50) + 8, 6);
      else if (b.me.riders > 0) yield* b.wait(0.25);
      else { yield* b.hold(1, () => b.cx() > big(b).x - 16 || Math.abs(b.me.vx) < 1, 4); yield* b.jump(big(b).x + 34, 6); }
      yield* b.wait(0.1);
    }
    if (b.feet() > 300) throw new Error('언덕에 못 올라감 (봇 ' + i + ')');
    yield* b.walkTo(X(57) + 8, 6, 20);
    // 상자 둘, 단추 둘: 앞 조(번호가 큰 쪽)가 먼 상자를, 뒤 조가 가까운 상자를 민다
    const Q = b => b.obj('box', 2), P = b => b.obj('box', 3), bq = b => b.obj('btn', 1), bp = b => b.obj('btn', 2), gate = b => b.obj('door', 1);
    const half = Math.ceil(n / 2), front = i >= n - half;
    if (n === 1) {
      yield* b.hold(1, () => bq(b).lat, 30, '가까운 상자를 단추에');
      yield* overBox(b, Q(b), 1);
      if (b.feet() < 400) { yield* b.walkTo(P(b).x - 16, 2, 10); yield* b.until(() => b.me.gr && b.feet() > 400, 4, '턱에서 내려옴'); }   // 상자가 턱까지 밀려 가 턱 위에 내려섰으면 틈으로 내려간다
      yield* b.hold(1, () => bp(b).lat, 30, '먼 상자를 단추에');
    } else if (front) {
      yield* overBox(b, Q(b), 1);
      yield* b.hold(1, () => bp(b).lat, 40, '먼 상자를 단추에');
    } else {
      yield* b.until(() => B.every((o, j) => j < n - half || o.cx() > 66 * T + 12), 40, '앞 조가 가까운 상자 턱을 지나감');
      yield* b.hold(1, () => bq(b).lat, 40, '가까운 상자를 단추에');
    }
    yield* b.until(() => gate(b).open > 0.9, 60, '두 단추 문 열림');
    if (b.cx() < Q(b).x + 32) { yield* overBox(b, Q(b), 1); yield* b.walkTo(X(70), 6, 20); }
    yield* overBox(b, P(b), 1);
    if (b.cx() < X(81)) yield* b.walkTo(X(81) + i * 10, 8, 20);
    // 선반 위 열쇠 (하드: 선반이 한 칸 더 높아 셋이 탑을 쌓는다)
    yield* stackUp(b, sim, { what: '열쇠', baseX: X(41 + D) - 4, top: X(43 + D), soloX: X(41 + D), tall: isHard(b), shelfY: isHard(b) ? 9 * T : 10 * T, done: b => key(b).hd >= 0 || key(b).used, goal: X(48 + D) });
    yield* goExit(b);
  }));
};


/* ───────── 2. 미끌미끌 ───────── */
scripts.ice = function (sim) {
  const B = sim.bots, n = sim.n, front = B[n - 1];
  const wood = b => b.obj('box', 0), iron = b => b.obj('box', 1), btn = b => b.obj('btn'), door = b => b.obj('door');
  B.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    yield* b.wait((n - 1 - i) * 0.3);
    yield* b.hold(1, () => wood(b).x >= 575, 60, '나무 상자를 벼랑까지');
    if (b !== front) yield* b.until(() => btn(b).lat && door(b).open > 0.9, 200, '문 열림');      // 밀 사람만 먼저 올라가고 나머지는 아래에서 기다린다
    // 앞사람부터 상자를 딛고 벼랑 위로
    yield* b.until(() => B.every((o, j) => j <= i || o.feet() < 300), 60, '앞사람이 올라감');
    for (let k = 0; k < 12 && b.feet() > 300; k++) {
      if (b.me.gRef === wood(b).id) yield* b.jump(X(21) + 6, 6);
      else { yield* b.hold(1, () => b.cx() > wood(b).x - 16 || b.me.vx === 0, 4); yield* b.jump(wood(b).x + 34, 6); }
      yield* b.wait(0.1);
    }
    if (b.feet() > 300) throw new Error('벼랑 위로 못 올라감 (봇 ' + i + ')');
    if (b === front) {
      // 쇠 상자를 얼음 위로 톡톡 밀어 받침판에 세운다
      const lag = (sim.delay || 0) * 0.003 + (sim.lag || 0);           // 민 결과가 내 화면에 보일 때까지 걸리는 시간만큼 기다렸다가 본다
      for (let k = 0; k < 40 && !btn(b).lat; k++) {
        yield* b.wait(0.2 + lag);
        yield* b.until(() => Math.abs(iron(b).vx) < 2, 25, '쇠 상자가 멈춤');
        yield* b.wait(0.3);
        const bx = iron(b).x;
        if (btn(b).lat) break;
        if (bx > 935 && bx < 1113) { yield* b.wait(0.6); continue; }
        if (bx <= 935) {
          if (b.cx() > bx - 6) yield* overBox(b, iron(b), -1);
          yield* b.hold(1, () => b.me.pu > 0, 8, '쇠 상자에 닿기');
          b.inp.r = 1; yield* b.wait(bx < 850 ? 0.42 : 0.14); b.stop();
        } else {
          if (b.cx() < bx + 70) yield* overBox(b, iron(b), 1);
          yield* b.hold(-1, () => b.me.pu < 0, 8, '쇠 상자에 닿기(오른쪽)');
          b.inp.l = 1; yield* b.wait(0.14); b.stop();
        }
      }
      if (!btn(b).lat) throw new Error('쇠 상자를 받침판에 못 세움');
    }
    yield* b.until(() => btn(b).lat && door(b).open > 0.9, 200, '문 열림');
    yield* b.wait(i * 0.2);
    // 얼음 위 가시 구덩이 셋을 달려가며 뛰어 넘는다 (빠지면 깃발에서 다시)
    yield* b.walkTo(X(46) + i * 6, 8, 30);
    const gaps = []; for (let c = 46; c < 72; c++) if (b.T.W.ch(c, 10) === '^' && b.T.W.ch(c - 1, 10) !== '^') gaps.push(c);   // 판마다 구덩이 자리가 다르다
    for (let k = 0; k < 10 && b.cx() < X(72); k++) {
      yield* b.until(() => b.me.dead <= 0 && b.me.gr, 6);
      let t = 0, jt = 0;
      while (b.cx() < X(72) && b.me.dead <= 0 && t++ < 900) {
        b.inp.r = 1;
        for (const g of gaps) if (b.me.gr && b.cx() > g * T - 30 && b.cx() < g * T - 8) jt = 14;
        b.inp.j = jt-- > 0 ? 1 : 0;
        yield;
      }
      b.stop(); b.inp.j = 0;
      if (b.me.dead > 0) yield* b.until(() => b.me.dead <= 0, 3);
    }
    if (b.cx() < X(72)) throw new Error('얼음 가시밭을 못 건넘 (봇 ' + i + ')');
    // 맨 앞사람이 얼음 위 상자를 밀어 가시 구덩이에 빠뜨린다
    const slab = b => b.obj('box', 2);
    if (b === front) {
      yield* b.until(() => b.me.gr, 4);
      yield* b.hold(1, () => slab(b).x > X(79) || slab(b).y > 250, 20, '얼음 상자 밀기');
    }
    yield* b.until(() => slab(b).y > 280, 30, '상자가 구덩이에 빠짐');
    yield* b.wait(i * 0.15);
    yield* b.walkTo(X(90), 8, 30);
    yield* goExit(b);
  }));
};

/* ───────── 3. 하나 둘 셋! ───────── */
scripts.saw = function (sim) {
  const B = sim.bots, n = sim.n, rider = B[n - 1], sh = sim.share ? sim.share('saw') : {};
  const sawA = b => b.obj('saw', 0), sawB = b => b.obj('saw', 1), door = b => b.obj('door'), key = b => b.obj('key');
  B.forEach((b, i) => b.play(function* (b) {
    const sw = b.obj('saw', 1), need = Math.min((sw && sw.nmax) || 3, Math.max(1, n - 1));   // 동시에 뛰어내릴 사람 수 (하드는 더 많다). 자기 화면에서 읽는다
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    const w = n - 2 - i;                                             // 뒤따르는 사람의 순번 (0이 맨 앞)
    const cross = function* () {                                     // 시소를 건너 문으로
      const over = () => b.cx() > 700 && b.me.gr && !b.me.saw && b.me.gRef === 0 && b.me.dead <= 0 && b.feet() < 418;
      for (let k = 0; k < 8 && !over(); k++) {
        yield* b.until(() => b.me.dead <= 0 && b.me.gr, 6);
        let t = 0; while (!over() && b.me.dead <= 0 && t++ < 400) { b.inp.r = 1; yield; } b.stop();
        yield* b.wait(0.1);
      }
      if (!over()) throw new Error('문으로 못 건너감 (봇 ' + i + ')');
    };
    if (n === 1) {
      yield* b.walkTo(640, 6); yield* b.jump(X(21), 5); yield* b.jump(X(23), 6); yield* b.walkTo(X(25)); yield* b.until(() => b.me.gr && b.feet() > 400, 4);
    } else if (b === rider) {
      yield* b.walkTo(560 + 92, 3);                                  // 오른쪽 끝보다 조금 안쪽 (누르는 친구보다 받침점에 가깝게)
      let up = 0;                                                    // 누르는 친구가 올라타고, 내 쪽이 올라간 채로 잠깐 유지될 때까지
      yield* b.until(() => { up = B.some(o => o !== b && o.me.saw) && sawA(b).th < -0.3 && b.me.saw ? up + 1 : 0; return up > 40; }, 60, '시소가 나를 들어 올림');
      yield* b.jump(X(23), 6);
      yield* b.until(() => b.me.gr && b.feet() < 330, 4, '턱 위');
      yield* b.walkTo(X(23) - 4, 5);
      yield* b.until(() => B.every(o => o === b || o.cx() > X(26)), 90, '모두 문 통과');
      yield* b.walkTo(X(24) + 20, 6); yield* offHead(b, -1);
    } else {
      if (w < 2) {                                                   // 왼쪽 끝에 올라타 누른다
        yield* b.until(() => rider.cx() > 640 && rider.me.gr, 30, '올라갈 사람이 먼저 건넘');
        yield* b.wait(w * 0.7);
        for (let k = 0; k < 6; k++) {
          yield* b.until(() => b.me.dead <= 0 && b.me.gr, 6);
          yield* b.walkTo(402, 3, 20);
          yield* b.jump(441 + (n === 2 ? 0 : (1 - w) * 27), 3);      // 먼저 건널 사람이 안쪽 (둘뿐이면 맨 끝에)
          yield* b.wait(0.15);
          if (b.me.saw) break;
        }
        if (!b.me.saw) throw new Error('시소 왼쪽 끝에 못 올라탐 (봇 ' + i + ')');
      }
      yield* b.until(() => door(b).open > 0.9, 60, '문 열림');
      yield* b.until(() => B.every((o, j) => o === rider || j <= i || o.cx() > X(24)), 90, '앞사람 건넘');
      yield* cross();
      yield* b.walkTo(X(26) + 6, 8);
    }
    // 탑을 넘어 두 번째 시소로. 먼저 건넌 순서대로: 맨 앞이 날아갈 사람, 그다음이 뛰어내릴 사람들
    const orderB = []; for (let j = n - 2; j >= 0; j--) orderB.push(j); orderB.push(n - 1);
    const p = orderB.indexOf(i), riderB = B[orderB[0]];
    yield* b.until(() => orderB.slice(0, p).every(j => B[j].feet() < 230 || B[j].cx() > X(32)), 120, '앞사람이 탑 위로');
    for (let k = 0; k < 14 && b.feet() > 230; k++) { const f = b.feet(); yield* b.jump(f > 400 ? X(27) : f > 340 ? X(28) : X(29) + 10, 4); yield* b.wait(0.05); }
    if (b.feet() > 230) throw new Error('탑에 못 올라감 (봇 ' + i + ')');
    if (n === 1) {
      yield* b.walkTo(X(49) + 14, 4, 40); yield* b.jump(X(48), 4); yield* b.jump(X(47), 4); yield* b.jump(X(46), 4); yield* b.jump(X(44), 6);
      yield* b.walkTo(X(42) + 26, 5);
    } else if (p === 0) {
      yield* b.walkTo(1160 + 105 * 0.92, 3, 30);                     // 탑에서 내려와 시소 오른쪽 끝으로
      sh.riderReady = true;
      yield* b.until(() => b.me.vy < -400, 120, '발사');
      yield* b.hold(1, () => b.me.gr || b.cx() > X(42) + 10, 6);
      yield* b.until(() => b.me.gr, 4);
      if (b.feet() > 200) throw new Error('선반에 못 올라감: 발 높이 ' + Math.round(b.feet()) + ', 세기 ' + sawB(b).kp);
      yield* b.walkTo(X(42) + 26, 5);
    } else if (p <= need) {
      const q = p - 1;
      yield* b.walkTo(X(32) - 14 - q * 26, 2);                       // 탑 꼭대기에 줄 서기
      yield* b.wait(0.3); sh['up' + q] = true;
      yield* b.until(() => sh.riderReady && [0, 1, 2, 3, 4].slice(0, need).every(k => sh['up' + k]), 120, '모두 준비');
      if (!sh.goT) sh.goT = sim.t + 700;
      yield* b.until(() => sim.t >= sh.goT, 5);
      yield* b.jump(1160 - 49 - q * (need > 3 ? 21 : 26), 3);        // 하나 둘 셋! (넷이면 조금 촘촘히 시소 왼쪽 끝에)
      yield* b.wait(1.2);
    } else {
      yield* b.walkTo(X(32) - 14 - (p - 1) * 26, 4);
    }
    if (n > 1) yield* b.until(() => key(b).hd >= 0 || key(b).used, 120, '열쇠');
    yield* b.wait(i * 0.3);
    yield* goExit(b);
  }));
};

/* ───────── 4. 딱 맞게 ───────── */
scripts.spring = function (sim) {
  const B = sim.bots, n = sim.n, half = Math.ceil(n / 2), sh = sim.share ? sim.share('spring') : {};
  const pad = (b, k) => b.obj('pad', k), door = b => b.obj('door'), key = b => b.obj('key');
  B.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    b.noHop = n > 1;                                                 // 줄 설 때 남의 머리 위로 뛰어오르지 않는다
    const onto = function* (k, x) {                                  // k번 발판 위 x 자리로
      const p = pad(b, k);
      for (let t = 0; t < 8; t++) {
        if (b.me.gRef !== p.id) { yield* b.walkTo(p.x - 24, 6, 30); yield* b.jump(Math.min(x, p.x + 40), 4); yield* b.wait(0.1); }
        if (b.me.gRef === p.id) { yield* b.walkTo(x, 4, 10); return; }
        yield* offHead(b, -1);
      }
      throw new Error('발판에 못 올라감 (봇 ' + i + ')');
    };
    const rear = i < half, k = rear ? half - 1 - i : n - 1 - i;      // 조 안에서의 순번 (0이 맨 앞)
    if (n === 1) {
      yield* onto(0, X(9) + 16); yield* b.until(() => door(b).open > 0.9, 10, '문'); yield* b.walkTo(X(26), 8, 30);
    } else if (rear) {                                               // 뒤 조: 첫 저울을 누른다
      yield* b.until(() => B.every((o, j) => j < half || o.cx() > X(11) + 8), 60, '앞 조가 지나감');
      yield* b.until(() => B.every((o, j) => j <= i || j >= half || o.me.gRef === pad(b, 0).id), 60, '앞사람이 올라탐');
      yield* onto(0, X(8) + 84 - k * 27);
      yield* b.until(() => pad(b, 1).ok && door(b).open > 0.9, 90, '둘째 저울 맞음');
      yield* b.until(() => B.every((o, j) => j <= i || j >= half || o.cx() > X(16)), 60, '앞사람이 지나감');
      yield* stand(b, X(19) - 4 - k * 28, 8);
      yield* b.until(() => B.every((o, j) => j < half || o.cx() > X(23)), 60, '앞 조가 내려감');
    } else {                                                         // 앞 조: 먼저 건너가 둘째 저울을 누른다
      yield* b.until(() => B.every((o, j) => j <= i || o.cx() > X(11) + 8), 60, '앞사람이 지나감');
      yield* onto(0, X(9) + 16); yield* stand(b, X(13) + 16 - k * 27, 4);
      yield* b.until(() => pad(b, 0).ok && door(b).open > 0.9, 90, '첫 저울 맞음');
      yield* b.until(() => B.every((o, j) => j <= i || o.me.gRef === pad(b, 1).id), 60, '앞사람이 둘째 저울에');
      yield* onto(1, X(20) + 84 - k * 27);
      yield* b.until(() => B.every((o, j) => j >= half || (o.cx() > X(16) && o.cx() < X(20))), 90, '뒤 조가 문을 지남');
      yield* b.until(() => B.every((o, j) => j <= i || o.cx() > X(23)), 60, '앞사람이 내려감');
    }
    // 발사대
    const rider = B[n - 1], lp = () => pad(b, 2);
    if (n === 1) {
      yield* b.walkTo(X(41) + 14, 6, 40); yield* b.jump(X(40), 4); yield* b.jump(X(39), 4); yield* b.jump(X(38), 4); yield* b.jump(X(36), 6); yield* b.walkTo(X(35) + 16, 5);
    } else {
      yield* b.until(() => B.every((o, j) => j <= i || o.me.gRef === lp().id), 90, '앞사람이 발사대에');
      if (b.cx() < pad(b, 1).x) { yield* onto(1, X(21) + 16); }
      yield* onto(2, X(33) - 16 - (n - 1 - i) * 26);
      yield* b.wait(0.3); sh['on' + i] = true;
      yield* b.until(() => B.every((o, j) => sh['on' + j]) && lp().load === n && lp().comp > lp().maxc - 2, 90, '모두 올라탐');
      if (!sh.goT) sh.goT = sim.t + 800;
      yield* b.until(() => sim.t >= sh.goT, 5);
      if (b === rider) {
        yield* b.until(() => b.me.vy < -400, 20, '발사');
        yield* b.hold(1, () => b.me.gr || b.cx() > X(35), 6);
        yield* b.until(() => b.me.gr, 4);
        if (b.feet() > 200) throw new Error('선반에 못 올라감: 발 높이 ' + Math.round(b.feet()) + ', 세기 ' + lp().kp);
        yield* b.walkTo(X(35) + 16, 5);
      } else { b.inp.j = 1; yield* b.wait(0.25); b.inp.j = 0; yield* b.wait(1.2); }
    }
    if (n > 1) yield* b.until(() => key(b).hd >= 0 || key(b).used, 60, '열쇠');
    b.noHop = false;
    yield* b.wait(i * 0.3);
    yield* goExit(b);
  }));
};

/* ───────── 5. 둥둥 ───────── */
scripts.raft = function (sim) {
  const B = sim.bots, n = sim.n, sh = sim.share ? sim.share('raft') : {};
  const sizes = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] }[n];
  const raft = b => b.obj('raft'), key = b => b.obj('key');
  const group = i => { let c = 0, k = n - 1 - i; for (let g = 0; g < sizes.length; g++) { if (k < c + sizes[g]) return [g, k - c]; c += sizes[g]; } return [0, 0]; };
  const SPOT = [306, 276, 244], TGT = [64, 34, 8];                                      // 둑 끝 줄 서는 자리 (셋째는 열쇠 놓였던 턱 위)
  B.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    const [g, k] = group(i), R = () => raft(b), mates = B.filter((o, j) => group(j)[0] === g);
    const mate = kk => B.find((o, j) => group(j)[0] === g && group(j)[1] === kk);
    const crossed = o => o.cx() > X(28) || o.me.fin;
    if (i === n - 1) { yield* b.walkTo(X(6) - 4, 5); yield* b.jump(X(7), 4); yield* b.until(() => key(b).hd >= 0, 5, '열쇠 줍기'); }       // 지나가던 친구가 먼저 집어도 된다
    const aboard = () => b.me.gr && b.me.gRef === R().id;
    const toSpot = function* () {                                    // 내 자리로: 턱을 넘어가거나(첫째·둘째) 턱 위에 선다(셋째)
      for (let t = 0; t < 6 && Math.abs(b.cx() - SPOT[k]) > 5; t++) {
        if (b.cx() < X(7) - 16) { yield* b.walkTo(X(6) - 4, 5, 20); yield* b.jump(X(7), 4); }
        if (k < 2) yield* b.walkTo(SPOT[k], 3, 10); else yield* b.walkTo(SPOT[k], 4, 10);
        for (let q = 0; q < 60 && !b.me.gr; q++) yield;
      }
    };
    for (let tries = 0; tries < 10 && b.cx() < X(28); tries++) {
      yield* b.until(() => b.me.dead <= 0 && b.me.gr, 10);
      if (!aboard()) {
        // 앞 조가 떠난 뒤, 앞사람부터 차례로 둑 끝에 줄을 선다
        yield* b.until(() => B.every((o, j) => group(j)[0] >= g || crossed(o) || (o.me.gr && o.me.gRef === R().id)), 200, '앞 조가 떠남');
        if (k > 0) yield* b.until(() => Math.abs(mate(k - 1).cx() - SPOT[k - 1]) < 8 || crossed(mate(k - 1)), 60, '앞사람이 자리 잡음');
        yield* toSpot();
        // 한 사람이 "지금!" 하면 다 같이 따른다 (각자 화면이 조금씩 늦으므로 자기 눈만 믿고 기다리면 엇갈린다)
        yield* b.until(() => sh['go' + g] > sim.t || (R().st === 0 && Math.abs(R().x - R().x1) < 2 && R().load === 0 && B.every((o, j) => group(j)[0] >= g || crossed(o))
          && mates.every(o => { const kk = group(o.i)[1]; return Math.abs(o.cx() - SPOT[kk]) < 8 && o.me.gr && o.me.dead <= 0; })), 200, '뗏목 차례');
        if (!(sh['go' + g] > sim.t)) sh['go' + g] = sim.t + 500;
        yield* b.until(() => sim.t >= sh['go' + g], 5);
        yield* b.jump(R().x1 + TGT[k], 3);
        if (!aboard()) { yield* b.wait(1.5); continue; }
      }
      yield* b.until(() => R().st === 2 || b.me.dead > 0 || !aboard(), 60, '건너편 도착');
      if (R().st !== 2 || !aboard()) { yield* b.wait(1.5); continue; }
      yield* b.wait(k * 0.45);                                       // 오른쪽에 선 사람부터 차례로 내린다
      for (let t = 0, jt = 0; t < 600 && !(b.cx() > X(28) + 6 && b.me.gr && b.me.gRef !== R().id) && b.me.dead <= 0; t++) {
        b.inp.r = 1;                                                 // 오른쪽으로 가다가 뗏목 끝에서 둑으로 뛴다 (앞사람에 막히면 기다린다)
        if (b.me.gr && b.me.gRef === R().id && b.cx() > R().x + 78) jt = 18;
        b.inp.j = jt-- > 0 ? 1 : 0;
        yield;
      }
      b.stop(); b.inp.j = 0;
      yield* b.wait(0.1);
    }
    if (b.cx() < X(28)) throw new Error('못 건너감 (봇 ' + i + ')');
    yield* b.walkTo(X(31) + i * 28, 8, 20);
    yield* b.until(() => B.every(o => crossed(o)), 300, '모두 건넘');
    yield* b.wait(i * 0.3);
    yield* goExit(b);
  }));
};


/* ═══════════ 새 스테이지 공통 동작 ═══════════ */
const ctr = o => o.x + o.w / 2;
const tag = (b, t) => b.T.W.objs.filter(o => o.tag === t);                       // 이름표(tag)로 찾기: 난이도마다 단추 수가 달라도 헷갈리지 않는다
const isHard = b => !!(b.T.W.def && b.T.W.def.df === 1);
const need1 = (b, t) => tag(b, t).filter(p => !(p.minN > b.sim.n)).sort((p, q) => p.x - q.x);   // 지금 인원에서 사람이 서야 하는 단추들 (왼쪽부터)
/* 병렬 스위치 두 개로 막힌 곳 건너기: 맨 앞(n-1)이 앞 스위치를 누르고 있고, 다른 사람이 건너가 뒤 스위치를 누르면 그때 건넌다 */
function* swapCross(b, sim, c) {
  const B = sim.bots, n = sim.n, i = b.i, H = n - 1, P = n - 2;
  const A = () => c.A(b), Bp = () => c.B(b);
  if (n === 1) { yield* stand(b, ctr(A()), 4); yield* b.until(() => c.open(b), 15, c.what + ' 열림'); yield* b.walkTo(c.goal, 8, 40); return; }
  if (i === H) {
    yield* stand(b, ctr(A()), 4);
    yield* b.until(() => Bp().on && B.every((o, j) => j === H || o.cx() > c.pass), 120, c.what + ': 뒤 스위치 눌림');
    yield* b.walkTo(c.goal + 10, 8, 40);
  } else {
    yield* b.until(() => c.open(b) && A().on, 120, c.what + ' 열림');
    yield* b.wait((H - 1 - i) * 0.25);
    if (i === P) {
      yield* stand(b, ctr(Bp()), 4);
      yield* b.until(() => B[H].cx() > c.pass2, 120, c.what + ': 앞사람이 건너옴');
      yield* b.walkTo(c.goal - 10, 8, 40);
    } else yield* b.walkTo(c.goal - 30 - i * 8, 8, 40);
  }
}
/* 직렬 스위치: i번째 사람이 i번째 스위치에 선다 (인원보다 많은 스위치는 저절로 켜져 있다) */
function* seriesPlates(b, sim, c) {
  const i = b.i, k = c.plates(b).length;
  if (i < k) yield* stand(b, ctr(c.plates(b)[i]), 4);
  else yield* b.walkTo(ctr(c.plates(b)[0]) - 40 - (i - k) * 10, 8, 40);
  yield* b.until(() => c.done(b), 60, c.what);
  yield* b.wait((sim.n - 1 - i) * 0.15);
  yield* b.walkTo(c.goal - i * 8, 8, 40);
}
/* 친구 머리를 밟고 높은 선반으로: 맨 앞(n-1)이 받침, 그다음(n-2)이 올라가 선반의 스위치를 밟는다.
   c.tall(하드): 선반이 한 칸 더 높다 — 셋 이상이면 n-2가 받침 머리 위에 서고 n-3이 그 위로 오른다
   (앞에 선 사람부터 받침·가운데·오를 사람 순이라 서로 앞지를 일이 없다).
   둘뿐이면 받침이 d 디딤돌 위에 서고, 혼자면 s 디딤돌 둘을 밟는다 */
function* stackUp(b, sim, c) {
  const B = sim.bots, n = sim.n, i = b.i, base = B[n - 1], t3 = c.tall && n >= 3, mid = t3 ? B[n - 2] : null, climber = t3 ? B[n - 3] : B[n - 2];
  const baseSet = () => Math.abs(base.cx() - c.baseX) < 5 && base.me.gr && base.me.gRef >= 0 && Math.abs(base.me.vx) < 5;
  if (n === 1) {
    yield* b.walkTo(c.soloX - (c.tall ? 2 : 1) * T, 4, 40); if (c.tall) yield* b.jump(c.soloX - T);
    yield* b.jump(c.soloX); yield* b.jump(c.top); yield* b.walkTo(c.top, 6); yield* b.until(() => c.done(b), 10, c.what); yield* b.walkTo(c.goal, 8, 40); return;
  }
  if (b === base) {
    for (let k = 0; k < 600 && !c.done(b); k++) { if (Math.abs(b.cx() - c.baseX) > 3 && b.me.riders === 0) yield* b.walkTo(c.baseX, 2, 20); yield* b.wait(0.2); }
  } else if (b === mid) {                                            // 탑의 가운데: 받침 머리 위에 올라가 가만히 선다
    yield* b.until(() => base.cx() > c.baseX - 24 || c.done(b), 60, '받침이 먼저 감');   // 받침보다 앞서 있으면 기다린다 (서로 길을 막지 않게)
    yield* stand(b, c.baseX - 34);
    for (let k = 0; k < 4 && !c.done(b); k++) {
      yield* b.until(baseSet, 30, '받침 자리 잡기');
      yield* hopOn(b, base);
      if (b.tell) b.tell({ k: 'wait' });
      yield* b.until(() => c.done(b) || b.me.gRef !== -(base.i + 1), 90, c.what);
      if (!c.done(b)) { yield* offHead(b, -1); yield* stand(b, c.baseX - 34); }   // 미끄러져 내려왔으면 다시
    }
    yield* b.until(() => c.done(b), 60, c.what);
    yield* offHead(b, -1);
  } else if (b === climber) {
    yield* b.until(() => (mid ? mid : base).cx() > c.baseX - (mid ? 50 : 24) || c.done(b), 60, '앞사람이 먼저 감');
    yield* stand(b, c.baseX - (mid ? 62 : 34));
    for (let k = 0; k < 4 && !c.done(b); k++) {
      if (mid) { yield* b.until(() => baseSet() && mid.me.gr && mid.me.gRef === -(base.i + 1) && Math.abs(mid.me.vx) < 5, 60, '가운데 친구가 올라섬'); yield* hopOn(b, mid); }
      else { yield* b.until(baseSet, 30, '받침 자리 잡기'); yield* hopOn(b, base); }
      yield* b.jump(c.top);
      if (b.feet() < c.shelfY + 4 && b.me.gr) break;                // 선반 위
      yield* offHead(b, -1); yield* stand(b, c.baseX - (mid ? 62 : 34));
    }
    yield* b.walkTo(c.top, 4);
    yield* b.until(() => c.done(b), 8, c.what);
    yield* b.walkTo(c.top + 70, 8); yield* offHead(b, 1);
  } else { yield* b.until(() => climber.cx() > c.baseX - (mid ? 90 : 60) || c.done(b), 60, '앞사람이 먼저 감'); yield* stand(b, c.baseX - (mid ? 110 : 80) - (n - (mid ? 4 : 3) - i) * 32); }
  yield* b.until(() => c.done(b), 60, c.what);
  yield* b.walkTo(c.goal - i * 8, 8, 40);
}
/* 열기구: 나머지가 먼저 타면 맨 앞(n-1)이 아래 버너를 밟아 띄운다. 그다음(n-2)이 위 버너 옆에서 기다렸다가
   버너 지기가 내려온 열기구에 타면 위 버너를 밟아 끌어올린다 */
function* balloonRide(b, sim, c) {
  const B = sim.bots, n = sim.n, i = b.i, H = n - 1, P = n - 2, L = () => c.lift(b);
  const onL = o => o.me.gr && o.me.gRef === L().id;
  // 하드: 한 번에 cap명까지만 뜬다 → P부터 cap명씩 나눠 타고, 버너 지기는 한 무리가 올라갈 때마다 버너에서 내려와 열기구를 내려보낸다
  const cap = L().cap || 99, order = []; for (let j = n - 2; j >= 0; j--) order.push(j);
  const grp = j => Math.floor(order.indexOf(j) / cap), nG = Math.max(1, Math.ceil(order.length / cap));
  const upTop = o => o.cx() > c.landX && o.me.gr && !onL(o);
  const board = function* () {
    for (let k = 0; k < 12 && !onL(b); k++) {
      yield* b.until(() => L().t < 0.02, 40, '열기구가 내려와 있음');
      yield* b.walkTo(L().x - 18, 6, 30); yield* b.jump(c.boardX + (i % 3) * 14 - 14, 4); yield* b.wait(0.15);
    }
    if (!onL(b)) throw new Error('열기구에 못 탐 (봇 ' + i + ')');
  };
  const off = function* () { yield* b.until(() => L().t > 0.995, 40, '열기구가 다 올라감'); yield* b.hold(1, () => b.cx() > c.landX && b.me.gr && !onL(b), 8, '내리기'); };
  if (n === 1) { yield* board(); yield* off(); yield* b.walkTo(c.goal, 8, 40); return; }
  if (i === H) {
    const aside = () => c.h1(b).x - 24;                              // 버너 옆 (버너를 밟지 않는 자리)
    yield* b.walkTo(aside(), 6, 30);
    for (let g = 0; g < nG; g++) {
      const mem = order.filter(j => grp(j) === g);
      yield* b.until(() => mem.every(j => onL(B[j])), 60, '열기구에 탐 (' + (g + 1) + '번째)');
      yield* stand(b, ctr(c.h1(b)), 4);
      yield* b.until(() => mem.every(j => B[j].cx() > c.landX), 90, '올라감 (' + (g + 1) + '번째)');
      if (g < nG - 1) { yield* b.walkTo(aside(), 6, 30); yield* b.until(() => L().t < 0.02, 40, '열기구가 다시 내려옴'); }   // 버너를 끄면 식어서 내려온다
    }
    yield* b.until(() => Math.abs(B[P].cx() - (ctr(c.h2(b)) - 40)) < 12, 30, '위 버너 지기 준비');
    yield* b.walkTo(L().x1 - 30, 6, 30);
    yield* board(); yield* off();
  } else {
    const g = grp(i);
    yield* b.until(() => order.every(j => grp(j) >= g || upTop(B[j])), 200, '내 차례');
    yield* board(); yield* off();
    if (i === P) {
      yield* b.walkTo(ctr(c.h2(b)) - 40, 4, 30);
      yield* b.until(() => onL(B[H]), 60, '버너 지기가 탐');
      yield* stand(b, ctr(c.h2(b)), 4);
      yield* b.until(() => B[H].cx() > c.landX && B[H].me.gr, 60, '버너 지기가 올라옴');
    }
  }
  yield* b.walkTo(c.goal - i * 8, 8, 40);
}

scripts.circuit = function (sim) {
  const door = (b, k) => b.obj('door', k);
  sim.bots.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    yield* swapCross(b, sim, { what: '병렬 문', A: b => tag(b, 'pA')[0], B: b => tag(b, 'pB')[0], open: b => door(b, 0).open > 0.9, pass: 14 * T + 20, pass2: 14 * T + 20, goal: X(19) });
    yield* seriesPlates(b, sim, { what: '직렬 회로', plates: b => need1(b, 'ser'), done: b => door(b, 1).open > 0.9, goal: X(40) });
    yield* swapCross(b, sim, { what: '빛다리', A: b => tag(b, 'bA')[0], B: b => tag(b, 'bB')[0], open: b => door(b, 2).open < 0.2, pass: 55 * T + 8, pass2: 55 * T + 8, goal: X(59) });
    yield* b.wait(i * 0.2);
    yield* goExit(b);
  }));
};
scripts.fire = function (sim) {
  const n = sim.n, fire = (b, k) => b.obj('fire', k), fuel = b => b.obj('box', 0);
  sim.bots.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    // 공기 구멍 막기 (구멍 수는 난이도에 따라 셋·넷)
    const vents = need1(b, 'vent');                                  // 지금 인원에서 막아야 하는 구멍 (왼쪽부터) — 뒤에 선 사람이 왼쪽 구멍을 맡아 서로 앞지르지 않는다
    if (i < vents.length) yield* stand(b, ctr(vents[i]), 4); else yield* b.walkTo(X(16) - 26 - (n - 1 - i) * 26, 8, 30);   // 남는 사람은 불 앞(구멍들보다 오른쪽)에서 기다린다
    yield* b.until(() => fire(b, 0).out > 0.99, 30, '첫 불 꺼짐');
    yield* b.walkTo(X(22) - i * 6, 8, 30);
    // 장작 상자 밀어 내기
    yield* b.hold(1, () => fire(b, 1).out > 0.99, 40, '장작을 밀어 냄');
    yield* b.wait((n - 1 - i) * 0.2);
    for (let k = 0; k < 4 && b.cx() < fuel(b).x + fuel(b).w + 8; k++) yield* overBox(b, fuel(b), 1);
    yield* b.walkTo(X(36), 8, 30);
    // 높은 선반의 물 뿌리개
    yield* stackUp(b, sim, { what: '물 뿌리개', baseX: X(41) - 4, top: X(43), soloX: X(41), tall: isHard(b), shelfY: isHard(b) ? 9 * T : 10 * T, done: b => fire(b, 2).out > 0.99, goal: X(52) });
    yield* b.wait(i * 0.2);
    yield* goExit(b);
  }));
};
scripts.balloon = function (sim) {
  const btn = (b, k) => b.obj('btn', k), lift = (b, k) => b.obj('lift', k);
  sim.bots.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    yield* balloonRide(b, sim, { lift: b => lift(b, 0), h1: b => btn(b, 0), h2: b => btn(b, 1), boardX: 13 * T + 16 + 56, landX: 17 * T + 14, goal: X(23) });
    yield* balloonRide(b, sim, { lift: b => lift(b, 1), h1: b => btn(b, 2), h2: b => btn(b, 3), boardX: 29 * T + 8 + 40, landX: 47 * T + 14, goal: X(54) });
    yield* b.wait(i * 0.2);
    yield* goExit(b);
  }));
};
scripts.freeze = function (sim) {
  const door = (b, k) => b.obj('door', k);
  sim.bots.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    yield* swapCross(b, sim, { what: '얼음 다리', A: b => tag(b, 'cA')[0], B: b => tag(b, 'cB')[0], open: b => door(b, 0).open < 0.2, pass: 20 * T + 8, pass2: 20 * T + 8, goal: X(24) });
    yield* seriesPlates(b, sim, { what: '얼음벽', plates: b => need1(b, 'ser'), done: b => door(b, 1).open > 0.9, goal: X(44) });
    yield* swapCross(b, sim, { what: '넓은 얼음 다리', A: b => tag(b, 'cC')[0], B: b => tag(b, 'cD')[0], open: b => door(b, 2).open < 0.2, pass: 62 * T + 8, pass2: 62 * T + 8, goal: X(65) });
    yield* b.wait(i * 0.2);
    yield* goExit(b);
  }));
};
scripts.light = function (sim) {
  const B = sim.bots, n = sim.n, btn = (b, k) => b.obj('btn', k), sensor = (b, k) => b.obj('sensor', k);   // btn 0: 첫 방 발판
  B.forEach((b, i) => b.play(function* (b) {
    yield* b.until(() => b.T.TS.ph === 2, 10, '시작');
    // 거울 하나
    if (i === n - 1) yield* stand(b, ctr(btn(b, 0)), 4); else yield* b.walkTo(X(6) - i * 10, 8, 30);
    yield* b.until(() => sensor(b, 0).on, 20, '첫 감지기');
    yield* b.walkTo(X(20) + i * 6, 8, 30);                          // 번호가 클수록(발판을 맡을 사람일수록) 앞에 선다
    // 거울 둘 (가운데 발판은 밟지 않는다)
    // 둘째 방의 '맞춰야 하는' 거울 가운데 처음부터 틀어진 것만 그 발판을 밟는다 (헷갈리게 하는 발판·처음부터 맞는 거울의 발판은 밟지 않는다)
    const need = b.T.W.objs.filter(o => o.type === 'mirror' && o.x === 35 * T && o.ok !== undefined && o.d !== o.ok && !(o.soloOk && n <= 1)).map(m => b.T.W.byId[m.link[0]]).sort((p, q) => q.x - p.x);   // 맨 앞사람이 오른쪽 발판
    if (i === n - 1 && need[0]) yield* stand(b, ctr(need[0]), 4);
    else if (i === n - 2 && need[1]) yield* stand(b, ctr(need[1]), 4);
    yield* b.until(() => sensor(b, 1).on, 30, '둘째 감지기');
    yield* b.walkTo(X(44) + i * 6, 8, 30);                          // 받침·가운데를 맡을 사람(번호가 큰 쪽)이 앞에
    // 높은 선반의 스위치
    yield* stackUp(b, sim, { what: '셋째 감지기', baseX: X(48) - 4, top: X(50), soloX: X(48), tall: isHard(b), shelfY: isHard(b) ? 9 * T : 10 * T, done: b => sensor(b, 2).on, goal: X(58) });
    yield* b.wait(i * 0.2);
    yield* goExit(b);
  }));
};

const AI = { scripts, hopOn, offHead, goExit, stand, overBox, X };
if (typeof module !== 'undefined' && module.exports) module.exports = AI; else root.YCAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
