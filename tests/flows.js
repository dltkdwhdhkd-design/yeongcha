/* 교실에서 생길 일들 시험 (봇 없이): 새로 고침, 기준 기기 이어받기, 늦게 들어오기, 넘기기, 선생님 새로 고침, 끝내기, 한 판 더, 내보내기, 방 닫기
   준비·실행은 e2e.js와 같다:  node tests/flows.js [rtc=1|0]                                                        */
'use strict';
const path = require('path'), http = require('http');
const DEPS = process.env.E2E_DEPS || '/tmp/e2e/node_modules';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const { serve } = require('../tools/serve.js');
const ROOT = path.resolve(__dirname, '..') + '/', RTC = process.argv[2] !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function broker() {
  const aedes = require(DEPS + '/aedes')(), { WebSocketServer, createWebSocketStream } = require(DEPS + '/ws');
  const srv = http.createServer(), wss = new WebSocketServer({ server: srv });
  wss.on('connection', ws => aedes.handle(createWebSocketStream(ws)));
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ port: srv.address().port, close: () => { aedes.close(); srv.close(); } })));
}
(async () => {
  const web = await serve(ROOT), mq = await broker();
  const url = 'http://127.0.0.1:' + web.address().port + '/?mq=ws://127.0.0.1:' + mq.port + (RTC ? '' : '&rtc=0');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
  const errors = [], results = [];
  const check = (name, ok, extra) => { results.push([name, !!ok]); console.log((ok ? '  통과  ' : '  실패  ') + name + (extra ? '  ' + extra : '')); };
  const open = async (who, w, h) => { const p = await (await browser.newContext({ viewport: { width: w || 640, height: h || 360 } })).newPage(); p.on('pageerror', e => { errors.push(who + ': ' + e.message); console.log('  [오류] ' + who + ': ' + e.message); }); p.on('dialog', d => d.accept()); await p.goto(url); return p; };
  const join = async (p, name, code) => { await p.click('#b-join'); await p.fill('#in-name', name); await p.fill('#in-code', code); await p.click('#b-enter'); };
  const st = p => p.evaluate(() => { const A = window.YCApp, G = A.G, T = G.team; return { scr: document.querySelector('.scr.on').id, on: G.on, slot: T ? T.slot : -1, ph: T ? T.TS.ph : -1, stage: T ? T.TS.stage : -1, n: T ? T.TS.n : 0, anchor: T ? T.anchor : false, ep: T ? T.seenEp : 0, x: T ? T.me.x : 0, cl: T ? T.TS.cl.slice() : [], sk: T ? T.TS.sk.slice() : [], ghosts: T ? Object.keys(T.ghosts).map(k => ({ s: +k, vis: T.ghosts[k].vis, x: Math.round(T.ghosts[k].x) })) : [], direct: window.YCNet.status().direct }; });
  const until = async (fn, ms, step) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > (ms || 8000)) return null; await sleep(step || 200); } };

  const host = await open('선생님', 1280, 720);
  await host.click('#b-host'); await host.waitForFunction(() => /^\d{4}$/.test(document.getElementById('hc-code').textContent));
  const code = await host.textContent('#hc-code');
  const a = await open('학생A'), b = await open('학생B');
  await join(a, '가람', code); await join(b, '나래', code);
  await host.waitForFunction(() => window.YCApp.H.players.size === 2, null, { timeout: 15000 });
  await sleep(RTC ? 4000 : 800);
  await host.click('#hc-start');
  check('시작하면 두 학생 모두 게임 시작', await until(async () => (await st(a)).ph === 2 && (await st(b)).ph === 2, 12000));
  let sa = await st(a), sb = await st(b);
  check('기준 기기는 한 대', sa.anchor !== sb.anchor, 'A=' + sa.anchor + ' B=' + sb.anchor);
  if (RTC) check('팀원끼리 직접 연결', sa.direct === 1 && sb.direct === 1);

  // 키보드로 움직이면 상대 화면에 보인다 (앞에 선 사람이 걷는다. 뒤에 선 사람은 앞사람에게 막힌다)
  const [fw, bk] = sa.slot > sb.slot ? [a, b] : [b, a], x0 = (await st(fw)).x;
  await fw.keyboard.down('ArrowRight'); await sleep(700); await fw.keyboard.up('ArrowRight'); await sleep(900);
  const sf = await st(fw), sk2 = await st(bk), gF = sk2.ghosts.find(g => g.s === sf.slot);
  check('앞사람이 걸으면 다른 화면에서도 같은 자리에 보임', gF && gF.vis && Math.abs(gF.x - sf.x) < 6 && sf.x > x0 + 60, '걸은 사람 x ' + Math.round(x0) + '→' + Math.round(sf.x) + ', 다른 화면에서 본 x=' + (gF && gF.x));

  // 기준 기기가 아닌 쪽이 새로 고침
  const [anc, oth] = sa.anchor ? [a, b] : [b, a];
  const slotOth = (await st(oth)).slot;
  await oth.reload();
  const back = await until(async () => { const s = await st(oth); return s.on && s.ph === 2 && s.slot === slotOth ? s : null; }, 10000);
  check('새로 고침하면 저절로 같은 자리로 돌아옴', back, back ? '' : JSON.stringify(await st(oth)));
  check('돌아온 뒤에도 기준 기기는 한 대', await until(async () => (await st(anc)).anchor && !(await st(oth)).anchor, 5000));
  check('새로 고침한 기기가 팀 상태를 다시 받음', await until(() => oth.evaluate(() => window.YCApp.G.team.heard), 5000));

  // 기준 기기가 새로 고침 → 다른 기기가 이어받는다
  const tm0 = await anc.evaluate(() => window.YCApp.G.team.TS.tm);
  await anc.reload();
  const took = await until(async () => { const s = await st(oth); return s.anchor && s.ep >= 2 ? s : null; }, 8000);
  check('기준 기기가 사라지면 다른 기기가 이어받음', took);
  const one = await until(async () => { const x = await st(a), y = await st(b); return x.on && y.on && x.ph === 2 && y.ph === 2 && (x.anchor ? 1 : 0) + (y.anchor ? 1 : 0) === 1; }, 12000);
  const desc = p => p.evaluate(() => { const T = window.YCApp.G.team; return T ? (T.anchor ? '기준' : '-') + ' ep' + T.seenEp + ' 스테이지' + T.TS.stage + '.' + T.TS.run + ' 단계' + T.TS.ph + ' 시간' + Math.round(T.time(performance.now())) : '없음'; });
  const tm1 = await oth.evaluate(() => window.YCApp.G.team.time(performance.now()));
  check('돌아온 뒤 기준 기기 한 대, 시간은 이어서 흐름', one && tm1 > tm0, '시간 ' + Math.round(tm0) + ' → ' + Math.round(tm1) + ' [새로 고침한 쪽 ' + await desc(anc) + ' / 이어받은 쪽 ' + await desc(oth) + ']');

  // 둘이 거의 동시에 새로 고침 (팀 상태를 가진 기기가 잠깐 하나도 없음): 각자 적어 둔 상태로 이어 간다
  await until(() => anc.evaluate(() => window.YCApp.G.team.heard), 5000); await sleep(1200);
  const tw0 = await oth.evaluate(() => window.YCApp.G.team.time(performance.now()));
  await Promise.all([a.reload(), b.reload()]);
  const both = await until(async () => { const x = await st(a), y = await st(b); return x.on && y.on && x.ph === 2 && y.ph === 2 && x.stage === 0 && y.stage === 0 && (x.anchor ? 1 : 0) + (y.anchor ? 1 : 0) === 1; }, 15000);
  const tw1 = await a.evaluate(() => window.YCApp.G.team.time(performance.now()));
  check('둘이 함께 새로 고침해도 처음으로 돌아가지 않고 이어짐', both && tw1 > tw0 - 2500, '시간 ' + Math.round(tw0) + ' → ' + Math.round(tw1) + ' [' + await desc(a) + ' / ' + await desc(b) + ']');

  // 늦게 들어온 학생
  const c = await open('학생C'); await join(c, '다온', code);
  const late = await until(async () => { const s = await st(c); return s.on && s.ph === 2 ? s : null; }, 12000);
  check('게임 중에 들어온 학생이 바로 합류', late, late ? '자리 ' + late.slot : '');
  check('팀 인원이 3명으로 늘어남', await until(async () => (await st(a)).n === 3 && (await st(b)).n === 3, 8000));

  // 선생님이 넘기기
  await host.waitForSelector('#hp-views .view .skip'); await host.click('#hp-views .view .skip');
  const skipped = await until(async () => { const s = await st(a); return s.stage === 1 && s.sk[0] === 1 && s.cl[0] > 90000 ? s : null; }, 8000);
  check('넘기기: 다음 스테이지로 가고 벌칙 1분 30초', skipped, skipped ? '기록 ' + (skipped.cl[0] / 1000).toFixed(1) + '초' : JSON.stringify(await st(a)));

  // 선생님 화면 새로 고침 → 열어 둔 방 다시 열기
  await host.reload(); await host.waitForSelector('#b-resume:not([hidden])'); await host.click('#b-resume');
  const hs = await until(async () => host.evaluate(() => { const H = window.YCApp.H; const v = H.viewers[0], rows = document.querySelectorAll('#hp-rank .rk').length; return H.ph === 'play' && H.players.size === 3 && v && v.W && v.TS.stage === 1 && rows ? { rows: rows, views: document.querySelectorAll('#hp-views .view').length } : null; }), 10000);
  check('선생님이 새로 고침해도 방이 그대로 이어짐', hs && hs.rows === 1 && hs.views === 1, JSON.stringify(hs));
  const going = await until(async () => { const x = await st(a), y = await st(b), z = await st(c); return x.ph === 2 && y.ph === 2 && z.ph === 2 && x.stage === 1 && y.stage === 1 && z.stage === 1; }, 6000);
  const ta = await a.evaluate(() => window.YCApp.G.team.time(performance.now())); await sleep(1500);
  const tb2 = await a.evaluate(() => window.YCApp.G.team.time(performance.now()));
  check('그동안 학생 게임은 멈추지 않음 (같은 스테이지에서 시간이 계속 감)', going && tb2 > ta + 1000, (ta / 1000).toFixed(1) + '초 → ' + (tb2 / 1000).toFixed(1) + '초');

  // 끝내기 → 결과
  await host.click('#hp-end');
  check('끝내면 선생님·학생 모두 결과 화면', await until(async () => (await host.evaluate(() => window.YCApp.H.ph)) === 'end' && (await st(a)).scr === 's-end' && (await st(b)).scr === 's-end' && (await st(c)).scr === 's-end', 8000));

  // 한 판 더
  await host.click('#he-again');
  check('한 판 더: 학생들이 대기실로 돌아옴', await until(async () => (await st(a)).scr === 's-wait' && (await st(b)).scr === 's-wait' && (await st(c)).scr === 's-wait', 8000));
  // 내보내기 (이름표 두 번 누르기)
  await host.waitForSelector('#hc-teams .chip'); await sleep(300);
  const chip = '#hc-teams .chip:has-text("다온")'; await host.click(chip); await sleep(200); await host.click(chip);
  check('내보낸 학생은 첫 화면으로', await until(async () => (await st(c)).scr === 's-title', 8000));
  check('남은 인원 2명', await until(() => host.evaluate(() => window.YCApp.H.players.size === 2), 4000));
  await sleep(1800);                                                // 다시 들어오지 못한다 (자동 재입장 없음)
  check('내보낸 학생이 저절로 다시 들어오지 않음', (await st(c)).scr === 's-title' && await host.evaluate(() => window.YCApp.H.players.size === 2));
  await host.click('#hc-start');
  check('둘이서 다시 시작', await until(async () => (await st(a)).ph === 2 && (await st(b)).ph === 2 && (await st(a)).stage === 0, 12000));
  // 방 닫기
  await host.reload(); await host.click('#b-resume'); await sleep(1500);
  await host.click('#hp-end'); await sleep(800); await host.click('#he-close');
  check('방을 닫으면 학생들이 첫 화면으로', await until(async () => (await st(a)).scr === 's-title' && (await st(b)).scr === 's-title', 8000));
  check('페이지 오류 없음', errors.length === 0, errors.join(' / '));

  const bad = results.filter(r => !r[1]).length;
  console.log('\n통과 ' + (results.length - bad) + ' / 실패 ' + bad);
  await browser.close(); web.close(); mq.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
