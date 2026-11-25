/* 시험용 정적 파일 서버 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve(root, port) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('not found'); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
    });
    srv.listen(port || 0, '127.0.0.1', () => res(srv));
  });
}
module.exports = { serve };
if (require.main === module) serve(path.resolve(__dirname, '..'), +process.argv[2] || 8765).then(s => console.log('http://127.0.0.1:' + s.address().port));
