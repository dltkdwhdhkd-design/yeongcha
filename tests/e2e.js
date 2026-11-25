/* 끝에서 끝까지 시험: 실제 브라우저 여러 개 + 내 컴퓨터에 띄운 중계 서버.
   선생님 화면 1개와 학생 화면 N개를 띄워 방 만들기 → 입장 → 팀 나누기 → 시작 → (봇이) 스테이지 완주 → 결과 화면까지 확인한다.

   준비:  아무 폴더에서 npm i aedes ws  →  E2E_DEPS=그폴더/node_modules  (기본 /tmp/e2e/node_modules)
   실행:  node tests/e2e.js [학생 수=4] [팀 수=1] [rtc=1|0] [스테이지=push,ice,saw,spring,raft] [찍을 폴더]            */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const DEPS = process.env.E2E_DEPS || '/tmp/e2e/node_modules';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const { serve } = require('../tools/serve.js');
const ROOT = path.resolve(__dirname, '..') + '/';
const N = +process.argv[2] || 4, TEAMS = +process.argv[3] || 1, RTC = process.argv[4] !== '0', STAGES = (process.argv[5] || 'push,ice,saw,spring,raft').split(','), SHOTS = process.argv[6] || '';
const ALL = ['push', 'ice', 'saw', 'spring', 'raft', 'circuit', 'fire', 'balloon', 'freeze', 'light'];

function broker() {
  const aedes = require(DEPS + '/aedes')(), { WebSocketServer, createWebSocketStream } = require(DEPS + '/ws');
  const srv = http.createServer(), wss = new WebSocketServer({ server: srv });
  wss.on('connection', ws => aedes.handle(createWebSocketStream(ws)));
  let count = 0; aedes.on('publish', () => { count++; });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ port: srv.address().port, count: () => count, close: () => { aedes.close(); srv.close(); } })));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

(async () => {
  const web = await serve(ROOT), mq = await broker();
  const url = 'http://127.0.0.1:' + web.address().port + '/?mq=ws://127.0.0.1:' + mq.port + (RTC ? '' : '&rtc=0');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const watch = (page, who) => { page.on('pageerror', e => { errors.push(who + ': ' + e.message); console.log('  [오류] ' + who + ': ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); }); page.on('dialog', d => d.accept()); };
  const src = 'window.__ycSrc = ' + JSON.stringify({ bot: fs.readFileSync(ROOT + 'js/bot.js', 'utf8'), scripts: fs.readFileSync(ROOT + 'js/ai.js', 'utf8') }) + ';\n' + fs.readFileSync(ROOT + 'tests/webbot.js', 'utf8');

  // 선생님
  const host = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage(); watch(host, '선생님');
  await host.goto(url); await host.click('#b-host');
  await host.waitForFunction(() => /^\d{4}$/.test(document.getElementById('hc-code').textContent));
  const code = await host.textContent('#hc-code');
  console.log('방 ' + code + ' · 학생 ' + N + '명 · 팀 ' + TEAMS + '개 · 직접 연결 ' + (RTC ? '켬' : '끔') + ' · 스테이지 ' + STAGES.join(','));

  // 학생들
  const kids = [];
  for (let i = 0; i < N; i++) {
    const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage(); watch(page, '학생' + i);
    await page.addInitScript({ content: src });
    await page.goto(url); await page.click('#b-join');
    await page.fill('#in-name', '봇' + i); await page.fill('#in-code', code); await page.click('#b-enter');
    kids.push(page);
  }
  await host.waitForFunction(n => window.YCApp.H.players.size === n, N, { timeout: 15000 });
  for (const k of kids) await k.waitForFunction(() => document.getElementById('w-team').textContent !== '', null, { timeout: 15000 });
  // 팀 수 맞추기
  for (let g = 0; g < 12; g++) { const cur = +(await host.textContent('#hc-tn')); if (cur === TEAMS) break; await host.click(cur < TEAMS ? '#hc-tp' : '#hc-tm'); await sleep(120); }
  for (const id of ALL) if (STAGES.indexOf(id) < 0) await host.click('#hc-stages .chk:nth-child(' + (ALL.indexOf(id) + 1) + ')');
  await sleep(RTC ? 4500 : 1200);                                   // 대기실에서 팀원끼리 미리 직접 연결할 시간
  await shot(host, 'host-lobby'); await shot(kids[0], 'kid-wait');
  const teamsTxt = await host.evaluate(() => [...window.YCApp.H.players.values()].map(p => p.name + ':' + p.team + '/' + p.slot).join(' '));
  console.log('팀 나누기: ' + teamsTxt);
  for (const k of kids) await k.evaluate(() => window.YCTest.on());
  if (process.env.E2E_HARD) await host.click('#hc-diff .chk:nth-child(2)');               // E2E_HARD=1: 하드로
  await host.click('#hc-start');
  const t0 = Date.now(); let lastKey = '', shots = {}, ok = false, botErr = null, directSeen = 0, directAll = 0; let tk0 = null, tkT = 0, minTps = 999;
  for (;;) {
    await sleep(1000);
    const el = (Date.now() - t0) / 1000;
    const infos = await Promise.all(kids.map(k => k.evaluate(() => window.YCTest.info()).catch(() => null)));
    const hs = await host.evaluate(() => { const H = window.YCApp.H; return { ph: H.ph, rk: H.ph === 'end' ? H.final : null, views: Object.keys(H.viewers).length }; });
    if (infos.every(i => i)) { const tk = infos.map(i => i.ticks), now = Date.now(); if (tk0 && now - tkT > 900) { const tps = Math.min.apply(null, tk.map((v, i) => (v - tk0[i]) * 1000 / (now - tkT))); if (tps > 0 && tps < minTps) minTps = tps; } tk0 = tk; tkT = now; }
    const key = infos.map(i => i ? i.stage + '.' + i.ph : '-').join(' ');
    if (key !== lastKey) { lastKey = key; console.log('  ' + el.toFixed(0) + '초  스테이지.단계 [' + key + ']  기준 기기 ' + infos.map(i => i && i.anchor ? 'A' : '.').join('') + '  직접 ' + infos.map(i => i && i.net ? i.net.direct + '/' + i.net.want : '-').join(' ')); }
    for (const s of [6, 14, 30, 60, 100, 140]) if (el > s && !shots[s]) { shots[s] = 1; await shot(host, 'host-play-' + s); await shot(kids[0], 'kid0-play-' + s); await shot(kids[N - 1], 'kidN-play-' + s); }
    if (infos.every(i => i && i.ph === 2)) { directSeen++; if (infos.every(i => i.net.want === 0 || i.net.direct === i.net.want)) directAll++; }
    for (let i = 0; i < N; i++) if (infos[i] && infos[i].err) { botErr = '학생' + i + ' 봇: ' + infos[i].err + ' ' + JSON.stringify(infos[i]); }
    if (botErr) { console.log('  [봇 멈춤] ' + botErr); await shot(host, 'err-host'); for (let i = 0; i < N; i++) await shot(kids[i], 'err-kid' + i); break; }
    if (hs.ph === 'end') { ok = true; console.log('  ' + el.toFixed(0) + '초  결과 화면'); break; }
    if (el > 600) { console.log('  [시간 초과] ' + JSON.stringify(infos)); break; }
  }
  await sleep(800);
  await shot(host, 'host-end'); await shot(kids[0], 'kid-end');
  // 확인
  const checks = [];
  const res = await host.evaluate(() => { const H = window.YCApp.H; return { ph: H.ph, final: H.final, pods: document.querySelectorAll('#he-podium .pod').length, rows: document.querySelectorAll('#he-table .rk').length, awards: document.querySelectorAll('#he-awards .aw').length, stat: (H.finalStat || []).length }; });
  checks.push(['결과 화면까지 감', ok && res.ph === 'end']);
  checks.push(['모든 팀 완주', !!res.final && res.final.length === TEAMS && res.final.every(r => r[3] === 1 && r[1] === STAGES.length)]);
  checks.push(['시상대·기록표', res.pods === Math.min(3, TEAMS) && res.rows === TEAMS]);
  checks.push(['개인 기록 모임', res.stat === N]);
  const ends = await Promise.all(kids.map(k => k.evaluate(() => ({ end: document.getElementById('s-end').classList.contains('on'), mine: document.getElementById('e-mine').textContent, net: window.YCNet.status(), stat: window.YCNet.stat }))));
  checks.push(['학생 화면도 결과 표시', ends.every(e => e.end && /위/.test(e.mine))]);
  checks.push(['페이지 오류 없음', errors.length === 0]);
  if (RTC && N / TEAMS > 1) checks.push(['게임 내내 팀원끼리 직접 연결됨 (' + directAll + '/' + directSeen + '번 확인)', directSeen > 0 && directAll >= directSeen * 0.9]);
  else checks.push(['직접 연결 없이 중계 서버만으로 진행', ends.every(e => !(e.stat.din > 0))]);
  console.log('결과: ' + (res.final || []).map((r, i) => (i + 1) + '위 ' + (r[0] + 1) + '팀 ' + (r[2] / 1000).toFixed(1) + '초').join(', '));
  console.log('통신: 중계 서버를 지난 메시지 ' + mq.count() + '개 · 학생별 [직접 받은 것/중계로 보낸 것] ' + ends.map(e => (e.stat.din || 0) + '/' + e.stat.out).join(' '));
  console.log('가장 느렸던 학생 화면의 계산 속도: 초당 ' + minTps.toFixed(0) + '틱 (60이 정상)');
  let bad = 0; for (const c of checks) { console.log((c[1] ? '  통과  ' : '  실패  ') + c[0]); if (!c[1]) bad++; }
  await browser.close(); web.close(); mq.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
