/* 화면 찍기: node tools/shot.js "<주소 뒤쪽>" out.png [w h] [pre-eval js] */
'use strict';
const path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { serve } = require('./serve.js');
(async () => {
  const [url, out, w, h, pre] = process.argv.slice(2);
  const srv = await serve(path.resolve(__dirname, '..'));
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: +w || 960, height: +h || 544 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/' + url);
  await p.waitForTimeout(300);
  if (pre) { await p.evaluate(pre); await p.waitForTimeout(200); }
  await p.screenshot({ path: out });
  await b.close(); srv.close(); console.log('saved', out);
})().catch(e => { console.error(e); process.exit(1); });
