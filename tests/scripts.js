/* 스테이지별 봇 대본. 봇 0이 받침, 봇 1이 올라가는 역할을 주로 맡는다. */
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
  const B = sim.bots, n = sim.n;
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
    for (let k = 0; k < 8 && b.cx() < X(34); k++) {                  // 턱 넘기
      yield* b.hold(1, () => b.cx() > X(30) - 4 || b.me.vx === 0, 6);
      yield* b.jump(X(35) + 10 + i * 6, 6);
      yield* offHead(b, 1);
    }
    // 선반 위 열쇠
    if (n === 1) {
      yield* b.walkTo(X(40)); yield* b.jump(X(41)); yield* b.jump(X(43));
    } else if (b === base) {
      for (let k = 0; k < 400 && !(key(b).hd >= 0 || key(b).used); k++) {          // 열쇠를 얻을 때까지 자리를 지킨다 (밀려나면 다시 선다)
        if (Math.abs(b.cx() - (X(41) - 4)) > 3 && b.me.riders === 0) yield* b.walkTo(X(41) - 4, 2, 20);
        yield* b.wait(0.2);
      }
    } else if (b === climber) {
      yield* stand(b, X(41) - 4 - 34);
      yield* b.until(() => Math.abs(base.cx() - (X(41) - 4)) < 5 && base.me.gr && base.me.gRef >= 0, 30, '받침 자리 잡기 2');
      yield* hopOn(b, base);
      yield* b.jump(X(43));
      yield* b.walkTo(X(43), 4);
      yield* b.until(() => key(b).hd >= 0 || key(b).used, 5, '열쇠 줍기');
      yield* b.walkTo(X(45) + 8, 8); yield* offHead(b, 1);
    } else {
      yield* stand(b, X(41) - 4 - 80 - back * 32);
    }
    if (n > 1 && b !== climber) yield* b.until(() => key(b).hd >= 0 || key(b).used, 40, '열쇠');
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
    yield* goExit(b);
  }));
};

/* ───────── 3. 하나 둘 셋! ───────── */
scripts.saw = function (sim) {
  const B = sim.bots, n = sim.n, rider = B[n - 1], sh = sim.share ? sim.share('saw') : {};
  const sawA = b => b.obj('saw', 0), sawB = b => b.obj('saw', 1), door = b => b.obj('door'), key = b => b.obj('key');
  const need = Math.min(3, Math.max(1, n - 1));
  B.forEach((b, i) => b.play(function* (b) {
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
      yield* b.until(() => sh.riderReady && [0, 1, 2].slice(0, need).every(k => sh['up' + k]), 120, '모두 준비');
      if (!sh.goT) sh.goT = sim.t + 700;
      yield* b.until(() => sim.t >= sh.goT, 5);
      yield* b.jump(1160 - 49 - q * 26, 3);                          // 하나 둘 셋!
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

module.exports = { scripts, hopOn, offHead, goExit, stand, overBox, X };
