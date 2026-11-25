/* 영차영차 — net.js : 통신
   자체 서버 없이 공개 MQTT 중계 서버 여러 곳을 동시에 쓴다. (설치·가입·키 없음)
   - 방 코드 4자리가 곧 주소다. 선생님 기기가 방을 열고, 학생 기기는 같은 코드로 들어온다.
   - 방 안내·입장처럼 드문 메시지는 연결된 모든 서버로 보낸다(한 곳이 죽어도 된다).
   - 초당 여러 번 오가는 게임 상태는 왕복이 가장 빠른 서버 한 곳으로만 보낸다. 받는 쪽은 모든 서버를 듣는다.
   - 같은 팀끼리는 될 수 있으면 기기끼리 직접 연결(WebRTC)해서 주고받는다. 같은 교실 와이파이라면 중계 서버를
     돌아오는 것보다 훨씬 빠르다. 직접 연결이 안 되는 짝은 그대로 중계 서버를 쓴다.
   - 내용이 공개 서버를 지나므로 실명 대신 별명을 쓴다.

   주소 뒤에 붙이는 시험용 옵션:  ?mq=wss://a,wss://b  (중계 서버를 직접 지정. 앞에 sig+ 를 붙이면 안내 전용)
                                  ?rtc=0  (직접 연결 끄기)        */
(function (root) {
'use strict';
const PFX = 'yc1/';
const qs = new URLSearchParams(root.location ? root.location.search : '');
// [이름, 주소, 사용자, 암호, 안내 전용인가]
//  emqx 두 곳은 연결 하나당 초당 10개까지만 전달하므로(2026-11 실측) 게임 상태 중계에는 쓰지 않는다.
const BROKERS = (function () {
  const custom = qs.get('mq');
  if (custom) return custom.split(',').map((u, i) => { let url = u.trim(); const sig = url.indexOf('sig+') === 0; if (sig) url = url.slice(4); return ['m' + (i + 1), url, undefined, undefined, sig]; }).filter(b => /^wss?:\/\//.test(b[1]));
  return [
    ['mosquitto', 'wss://test.mosquitto.org:8081/mqtt'],
    ['hivemq', 'wss://broker.hivemq.com:8884/mqtt'],
    ['shiftr', 'wss://public.cloud.shiftr.io/', 'public', 'public'],
    ['emqx-cn', 'wss://broker-cn.emqx.io:8084/mqtt', undefined, undefined, true],
    ['emqx', 'wss://broker.emqx.io:8084/mqtt', undefined, undefined, true]
  ];
})();

const enc = new TextEncoder(), dec = new TextDecoder();
const rnd = n => { let s = ''; const a = new Uint8Array(n); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach((v, i) => { a[i] = Math.random() * 256; }); for (let i = 0; i < n; i++) s += (a[i] % 36).toString(36); return s; };
function str(s) { const b = enc.encode(s), o = new Uint8Array(b.length + 2); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
function packet(head, parts) {
  let len = 0; for (const p of parts) len += p.length;
  const rem = []; let n = len; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; rem.push(b); } while (n > 0);
  const o = new Uint8Array(1 + rem.length + len); o[0] = head; o.set(rem, 1); let at = 1 + rem.length;
  for (const p of parts) { o.set(p, at); at += p.length; }
  return o;
}

/* MQTT 3.1.1 가운데 쓰는 것만 (접속, 구독, 보내기, 받기, 핑) */
function Link(name, url, user, pass, sig, onMsg, onState) {
  this.name = name; this.url = url; this.user = user; this.pass = pass; this.sig = !!sig; this.onMsg = onMsg; this.onState = onState;
  this.ws = null; this.ready = false; this.subs = new Set(); this.rtt = 0; this.wait = 800; this.pid = 1; this.buf = new Uint8Array(0); this.lastIn = 0; this.dead = false; this.timer = 0; this.pingAt = 0; this.pingTopic = ''; this.fails = 0;
  this.connect();
}
Link.prototype.connect = function () {
  if (this.dead) return;
  let ws;
  try { ws = this.ws = new WebSocket(this.url, ['mqtt']); } catch (e) { this.retry(); return; }
  ws.binaryType = 'arraybuffer';
  const self = this;
  ws.onopen = function () {
    if (self.ws !== ws) return;
    const flags = 2 | (self.user ? 128 : 0) | (self.pass ? 64 : 0);
    const parts = [str('MQTT'), new Uint8Array([4, flags, 0, 30]), str('yc' + rnd(12))];
    if (self.user) parts.push(str(self.user)); if (self.pass) parts.push(str(self.pass));
    ws.send(packet(0x10, parts));
  };
  ws.onmessage = function (e) { if (self.ws === ws) self.feed(new Uint8Array(e.data)); };
  ws.onclose = ws.onerror = function () { if (self.ws !== ws) return; self.ws = null; const was = self.ready; self.ready = false; clearInterval(self.timer); if (was) self.onState(); self.retry(); };
};
Link.prototype.retry = function () { if (this.dead) return; this.fails++; const self = this; setTimeout(function () { if (!self.ws) self.connect(); }, this.wait); this.wait = Math.min(8000, this.wait * 1.7); };
Link.prototype.feed = function (chunk) {
  let b = this.buf;
  if (b.length) { const n = new Uint8Array(b.length + chunk.length); n.set(b); n.set(chunk, b.length); b = n; } else b = chunk;
  let at = 0;
  for (;;) {
    if (b.length - at < 2) break;
    let len = 0, mul = 1, i = at + 1, ok = false;
    for (; i < b.length && i < at + 5; i++) { len += (b[i] & 127) * mul; mul *= 128; if (!(b[i] & 128)) { ok = true; i++; break; } }
    if (!ok) break;
    if (b.length - i < len) break;
    this.handle(b[at], b.subarray(i, i + len));
    at = i + len;
  }
  this.buf = at ? b.slice(at) : b;
};
Link.prototype.handle = function (head, body) {
  const type = head >> 4; this.lastIn = Date.now();
  if (type === 2) {                                                   // 접속 승인
    if (body[1] !== 0) { try { this.ws.close(); } catch (e) {} return; }
    this.ready = true; this.wait = 800; this.fails = 0;
    this.pingTopic = PFX + 'x/' + rnd(10);
    const topics = [this.pingTopic]; this.subs.forEach(t => topics.push(t));
    this.rawSub(topics);
    const self = this; clearInterval(this.timer);
    this.timer = setInterval(function () {
      if (!self.ready) return;
      if (Date.now() - self.lastIn > 45000) { try { self.ws.close(); } catch (e) {} return; }
      try { self.ws.send(new Uint8Array([0xC0, 0])); } catch (e) {}
      self.ping();
    }, 6000);
    setTimeout(function () { self.ping(); }, 300);
    this.onState();
  } else if (type === 3) {                                            // 받은 메시지
    const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl));
    let at = 2 + tl; if ((head >> 1) & 3) at += 2;
    const pay = body.subarray(at);
    if (topic === this.pingTopic) { const t = performance.now() - this.pingAt; if (t > 0 && t < 5000) this.rtt = this.rtt ? this.rtt * 0.6 + t * 0.4 : t; return; }
    this.onMsg(topic, pay, this);
  }
};
Link.prototype.ping = function () { if (!this.ready) return; this.pingAt = performance.now(); this.raw(this.pingTopic, new Uint8Array([49])); };
Link.prototype.rawSub = function (topics) {
  if (!this.ready || !topics.length) return;
  const parts = [new Uint8Array([this.pid >> 8, this.pid & 255])]; this.pid = this.pid % 65000 + 1;
  for (const t of topics) { parts.push(str(t)); parts.push(new Uint8Array([0])); }
  try { this.ws.send(packet(0x82, parts)); } catch (e) {}
};
Link.prototype.sub = function (t) { if (this.subs.has(t)) return; this.subs.add(t); this.rawSub([t]); };
Link.prototype.unsub = function (t) {
  if (!this.subs.delete(t) || !this.ready) return;
  const parts = [new Uint8Array([this.pid >> 8, this.pid & 255]), str(t)]; this.pid = this.pid % 65000 + 1;
  try { this.ws.send(packet(0xA2, parts)); } catch (e) {}
};
Link.prototype.raw = function (topic, bytes) { if (!this.ready) return false; try { if (this.ws.bufferedAmount > 200000) return false; this.ws.send(packet(0x30, [str(topic), bytes])); return true; } catch (e) { return false; } };
Link.prototype.close = function () { this.dead = true; clearInterval(this.timer); const ws = this.ws; this.ws = null; this.ready = false; if (ws) { try { ws.send(new Uint8Array([0xE0, 0])); } catch (e) {} try { ws.close(); } catch (e) {} } };

/* ───────── 방 하나에 대한 통신 ───────── */
const Net = { links: [], base: '', id: '', onMsg: null, onState: null, db: '', seen: new Map(), q: 0, opened: 0, stat: { in: 0, out: 0 } };
Net.open = function (code, id, onMsg, onState) {
  Net.close();
  Net.base = PFX + code + '/'; Net.id = id; Net.onMsg = onMsg; Net.onState = onState || function () {}; Net.db = ''; Net.q = Math.floor(Date.now() / 100) % 1e8; Net.opened = Date.now();
  Net.links = BROKERS.map(b => new Link(b[0], b[1], b[2], b[3], b[4], Net.recv, function () { Net.onState(); }));
  if (RTC_ON) Net.sub('s/' + id);                                                            // 직접 연결 안내를 받는 곳
};
Net.close = function () { Net.mesh([]); for (const l of Net.links) l.close(); Net.links = []; Net.seen.clear(); Net.base = ''; Net.offers = {}; };
Net.recv = function (topic, pay) {
  if (topic.indexOf(Net.base) !== 0 || pay.length > 60000) return;
  const ch = topic.slice(Net.base.length);
  let m; try { m = JSON.parse(dec.decode(pay)); } catch (e) { return; }
  if (m === null || typeof m !== 'object') return;
  Net.stat.in++;
  if (Array.isArray(m) || m.f === undefined) { Net.onMsg(ch, m, ''); return; }                 // 팀 안 상태: 겹침은 받는 쪽이 순번으로 거른다
  if (m.f === Net.id) return;
  const key = m.f + ':' + m.q;                                                               // 여러 서버로 온 같은 메시지는 한 번만
  if (Net.seen.has(key)) return;
  Net.seen.set(key, 1); if (Net.seen.size > 3000) { let k = 0; for (const x of Net.seen.keys()) { Net.seen.delete(x); if (++k > 1500) break; } }
  if (ch.charCodeAt(0) === 115 && ch.charCodeAt(1) === 47) { if (ch === 's/' + Net.id) Net.signal(m.d, m.f); return; }
  Net.onMsg(ch, m.d, m.f);
};
Net.sub = function (ch) { for (const l of Net.links) l.sub(Net.base + ch); };
Net.unsub = function (ch) { for (const l of Net.links) l.unsub(Net.base + ch); };
/* 게임 상태를 실어 보낼 서버: 방에서 정한 곳이 연결돼 있으면 그곳, 아니면 내게 가장 빠른 곳 */
Net.dataLink = function () {
  let best = null;
  for (const l of Net.links) { if (!l.ready) continue; if (l.name === Net.db) return l; if (!best || (best.sig && !l.sig) || (best.sig === l.sig && (l.rtt || 9999) < (best.rtt || 9999))) best = l; }
  return best;
};
/* 방 안내·입장 (모든 서버로) */
Net.say = function (ch, d) { const b = enc.encode(JSON.stringify({ f: Net.id, q: ++Net.q, d: d })); let n = 0; for (const l of Net.links) if (l.raw(Net.base + ch, b)) n++; Net.stat.out += n; return n; };
/* 게임 상태 (한 곳으로). env가 참이면 보낸 사람 표시를 붙인다 */
Net.send = function (ch, d, env) { const l = Net.dataLink(); if (!l) return false; Net.stat.out++; return l.raw(Net.base + ch, enc.encode(JSON.stringify(env ? { f: Net.id, q: ++Net.q, d: d } : d))); };
Net.status = function () {
  let up = 0, data = 0; const br = {};
  for (const l of Net.links) if (l.ready) { up++; if (!l.sig) data++; br[l.name] = Math.round(l.rtt) || 0; }
  const l = Net.dataLink();
  let direct = 0, drtt = 0; const now = performance.now();
  if (now - (Net.statAt || 0) > 2000) { Net.statAt = now; for (const id of Net.want) { const p = Net.peers[id]; if (p && p.ok(now)) p.stat(); } }
  for (const id of Net.want) { const p = Net.peers[id]; if (p && p.ok(now)) { direct++; if (p.rtt > drtt) drtt = p.rtt; } }
  return { up: up, total: Net.links.length, data: data, rtt: l ? Math.round(l.rtt) : 0, via: l ? l.name : '', sigOnly: !!(l && l.sig), br: br, slow: !up && Date.now() - Net.opened > 9000, direct: direct, want: Net.want.length, drtt: Math.round(drtt) };
};
/* 선생님 기기: 모두에게 가장 무난한 서버를 고른다. list: [{이름: 왕복ms}, ...] (학생들이 알려 온 값) */
Net.pickDb = function (list, cur) {
  let best = '', score = 1e9, curScore = 1e9;
  for (const l of Net.links) {
    if (!l.ready || l.sig) continue;
    let worst = l.rtt || 400, ok = true;
    for (const br of list) { if (!br || br[l.name] === undefined) { ok = false; break; } worst = Math.max(worst, br[l.name] || 400); }
    if (!ok) continue;
    if (worst < score) { score = worst; best = l.name; }
    if (l.name === cur) curScore = worst;
  }
  if (cur && curScore < 1e9 && curScore <= score * 1.25 + 30) return cur;                    // 조금 빠르다고 자꾸 바꾸지 않는다
  if (!best) { const l = Net.dataLink(); best = l ? l.name : ''; }
  return best;
};

/* ───────── 팀원끼리 직접 연결 (WebRTC 데이터 채널) ─────────
   연결 안내(제안·응답)는 중계 서버로 주고받는다. 아이디가 앞서는 쪽이 제안한다.
   채널은 순서·재전송 없이 쓴다(늦은 것은 버리는 편이 낫다). 받는 쪽이 순번으로 겹침을 거른다. */
const RTC_ON = qs.get('rtc') !== '0' && typeof root.RTCPeerConnection !== 'undefined';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
Net.peers = {}; Net.want = []; Net.offers = {}; Net.hb = 0;
function Peer(id) { this.id = id; this.pc = null; this.dc = null; this.n = 0; this.tries = 0; this.lastIn = 0; this.openAt = 0; this.timer = 0; this.dead = false; this.init = Net.id < id; if (this.init) this.offer(); }
Peer.prototype.ok = function (now) { return !!this.dc && this.dc.readyState === 'open' && this.openAt > 0 && (now - this.lastIn < 1500 || now - this.openAt < 1500); };
Peer.prototype.stat = function () {                     // 직접 연결의 왕복 시간 (브라우저가 재어 둔 값)
  const self = this, pc = this.pc; if (!pc || !pc.getStats || this.statBusy) return;
  this.statBusy = true;
  pc.getStats().then(function (rs) {
    let v = 0; rs.forEach(function (r) { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime > 0 && (r.nominated || r.selected)) v = Math.max(v, r.currentRoundTripTime * 1000); });
    if (v > 0) self.rtt = self.rtt ? self.rtt * 0.5 + v * 0.5 : v;
  }).catch(function () {}).then(function () { self.statBusy = false; });
};
Peer.prototype.send = function (s) { try { if (this.dc.bufferedAmount > 60000) return false; this.dc.send(s); return true; } catch (e) { return false; } };
Peer.prototype.drop = function () {
  clearTimeout(this.timer); const pc = this.pc, dc = this.dc; this.pc = null; this.dc = null; this.openAt = 0;
  if (dc) { dc.onopen = dc.onclose = dc.onmessage = null; try { dc.close(); } catch (e) {} }
  if (pc) { pc.onconnectionstatechange = pc.ondatachannel = null; try { pc.close(); } catch (e) {} }
};
Peer.prototype.close = function () { this.dead = true; this.drop(); };
Peer.prototype.make = function () {
  const self = this, pc = this.pc = new root.RTCPeerConnection({ iceServers: ICE });
  pc.onconnectionstatechange = function () { if (self.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) self.lost(); };
  return pc;
};
Peer.prototype.hook = function (dc) {
  const self = this; this.dc = dc;
  dc.onopen = function () { if (self.dc !== dc) return; self.openAt = performance.now(); self.tries = 0; clearTimeout(self.timer); Net.onState(); };
  dc.onclose = function () { if (self.dc === dc) self.lost(); };
  dc.onmessage = function (e) { if (self.dc !== dc) return; self.lastIn = performance.now(); Net.direct(e.data); };
};
/* 끊기거나 실패함: 제안하는 쪽이 조금 뒤에 다시 건다. 몇 번 해도 안 되면 그만둔다(중계 서버만 씀) */
Peer.prototype.lost = function () {
  const was = this.openAt > 0; this.drop(); if (was) Net.onState();
  if (this.dead || !this.init) return;
  if (was) this.tries = 0;
  if (++this.tries > 4) return;
  const self = this; this.timer = setTimeout(function () { if (!self.dead) self.offer(); }, 1500 * this.tries);
};
/* 후보 주소를 다 모은 뒤(길어도 1.5초) 한 번에 보낸다: 안내 메시지가 두 개면 끝난다 */
function gathered(pc) {
  return new Promise(function (res) {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 1500);
    pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
Peer.prototype.offer = function () {
  this.drop(); if (this.dead) return;
  const self = this, pc = this.make(), n = this.n = Date.now();
  this.hook(pc.createDataChannel('g', { ordered: false, maxRetransmits: 0 }));
  this.timer = setTimeout(function () { if (self.pc === pc && !self.openAt) self.lost(); }, 12000);
  pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gathered(pc); })
    .then(function () { if (self.pc === pc && pc.localDescription) Net.say('s/' + self.id, { t: 'o', n: n, sdp: pc.localDescription.sdp }); })
    .catch(function () { if (self.pc === pc) self.lost(); });
};
Peer.prototype.onSignal = function (m) {
  const self = this;
  if (m.t === 'o' && !this.init) {
    if (!(m.n > this.n)) return;                                                             // 지난 제안
    this.drop(); this.n = m.n;
    const pc = this.make();
    pc.ondatachannel = function (e) { if (self.pc === pc) self.hook(e.channel); };
    pc.setRemoteDescription({ type: 'offer', sdp: m.sdp }).then(function () { return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); }).then(function () { return gathered(pc); })
      .then(function () { if (self.pc === pc && pc.localDescription) Net.say('s/' + self.id, { t: 'a', n: m.n, sdp: pc.localDescription.sdp }); })
      .catch(function () { if (self.pc === pc) self.drop(); });
  } else if (m.t === 'a' && this.init && m.n === this.n && this.pc && this.pc.signalingState === 'have-local-offer') {
    this.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(function () {});
  }
};
Net.signal = function (m, from) {
  if (!RTC_ON || !m || typeof m.sdp !== 'string' || m.sdp.length > 20000) return;
  const p = Net.peers[from];
  if (p) p.onSignal(m); else if (m.t === 'o') Net.offers[from] = { m: m, at: Date.now() };       // 아직 팀원인 줄 모르는 사람의 제안은 잠깐 맡아 둔다
};
/* 직접 연결할 상대(같은 팀 사람들의 아이디)를 정한다. 빠진 사람과는 끊는다 */
Net.mesh = function (ids) {
  const want = []; for (const id of ids) if (id && id !== Net.id && want.indexOf(id) < 0) want.push(id);
  Net.want = want;
  for (const id of Object.keys(Net.peers)) if (want.indexOf(id) < 0) { Net.peers[id].close(); delete Net.peers[id]; }
  if (!RTC_ON || !Net.base) return;
  for (const id of want) if (!Net.peers[id]) {
    const p = Net.peers[id] = new Peer(id), o = Net.offers[id];
    if (o) { delete Net.offers[id]; if (Date.now() - o.at < 20000) p.onSignal(o.m); }
  }
};
Net.direct = function (s) {
  if (typeof s !== 'string') return;
  const i = s.indexOf('\n'); if (i < 1) return;
  let m; try { m = JSON.parse(s.slice(i + 1)); } catch (e) { return; }
  if (m === null || typeof m !== 'object') return;
  Net.stat.in++; Net.stat.din = (Net.stat.din || 0) + 1;
  Net.onMsg(s.slice(0, i), m, '');
};
/* 같은 팀에게 게임 상태 보내기: 직접 연결된 사람에게는 바로, 한 명이라도 직접이 안 되면 중계 서버로도 보낸다.
   모두 직접 연결돼 있어도 가끔은 중계 서버로도 보내 둔다(직접 연결이 조용히 죽었을 때 멈추지 않게) */
Net.team = function (ch, d) {
  const s = JSON.stringify(d), now = performance.now(); let ok = 0;
  for (const id of Net.want) { const p = Net.peers[id]; if (!p || !p.dc || p.dc.readyState !== 'open') continue; if (p.send(ch + '\n' + s) && p.ok(now)) ok++; }
  if (ok < Net.want.length || !Net.want.length || ++Net.hb % 12 === 0) { const l = Net.dataLink(); if (l) { Net.stat.out++; l.raw(Net.base + ch, enc.encode(s)); } }
  else Net.stat.dout = (Net.stat.dout || 0) + 1;
};
Net.newId = function () { return rnd(10); };
root.YCNet = Net;
})(typeof window !== 'undefined' ? window : globalThis);
