/* 혼자 연습(AI 친구) 시험: 실제 브라우저에서 사람 자리까지 봇이 맡아 열 스테이지를 끝까지 이어서 깬다.
   node tests/practice.js [AI 친구 수=3] [찍을 폴더] [hard]                                                 */
'use strict';
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const { serve } = require('../tools/serve.js');
const DF = process.argv.includes('hard') ? 1 : 0, args = process.argv.slice(2).filter(a => a !== 'hard');
const NAI = +(args[0] || 3), SHOTS = args[1] || '';
(async () => {
  const web = await serve(path.resolve(__dirname, '..') + '/');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log('  [오류] ' + e.message); });
  await page.goto('http://127.0.0.1:' + web.address().port + '/');
  await page.evaluate(([n, df]) => { localStorage.setItem('yc-ai', String(n)); localStorage.setItem('yc-diff', String(df)); window.YCPractice.auto = true; }, [NAI, DF]);
  console.log(DF ? '하드' : '노말', 'AI 친구 ' + NAI + '명');
  await page.click('#b-solo'); await page.click('#b-solo-all');
  await page.evaluate(() => { const G = window.YCApp.G; G.bot = inp => { const b = window.YCPractice.bots[0]; if (b) { inp.l = b.inp.l; inp.r = b.inp.r; inp.j = b.inp.j; inp.jp = b.inp.jp; inp.en = b.inp.en; } }; });
  const t0 = Date.now(); let last = '', ok = false;
  for (;;) {
    await new Promise(r => setTimeout(r, 1000));
    const st = await page.evaluate(() => { const T = window.YCApp.G.team, P = window.YCPractice; return T ? { stage: T.TS.stage, run: T.TS.run, ph: T.TS.ph, cl: T.TS.cl.slice(), err: P.err, berr: P.bots.map(b => b.err ? b.err.message : '').filter(Boolean) } : null; });
    if (!st) break;
    const key = st.stage + '.' + st.run + '.' + st.ph;
    if (key !== last) { last = key; console.log('  ' + ((Date.now() - t0) / 1000).toFixed(0) + '초  스테이지 ' + (st.stage + 1) + ' 다시 ' + st.run + ' 단계 ' + st.ph + (st.err ? '  [AI 길 잃음] ' + st.err : '') + (st.berr.length ? ' ' + st.berr.join(' | ') : '')); if (SHOTS && st.ph === 2) await page.screenshot({ path: path.join(SHOTS, 'p-' + st.stage + '.png') }); }
    if (st.ph === 4) { ok = true; console.log('완주: ' + st.cl.map((v, i) => (i + 1) + ':' + (v / 1000).toFixed(0) + '초').join(' ') + '  합계 ' + (st.cl.reduce((a, b) => a + b, 0) / 1000).toFixed(0) + '초'); break; }
    if (Date.now() - t0 > 900000) { console.log('시간 초과'); break; }
  }
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'p-done.png') });
  console.log((ok && !errors.length ? '통과' : '실패') + ' (페이지 오류 ' + errors.length + ')');
  await browser.close(); web.close(); process.exit(ok && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
