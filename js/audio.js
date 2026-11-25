/* 영차영차 — audio.js : 효과음 (파일 없이 그 자리에서 만들어 낸다) */
(function (root) {
'use strict';
const A = { ctx: null, on: true, master: null, last: {} };
try { A.on = localStorage.getItem('yc-mute') !== '1'; } catch (e) {}
A.unlock = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try { const C = root.AudioContext || root.webkitAudioContext; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination); } catch (e) { A.ctx = null; }
};
A.toggle = function () { A.on = !A.on; try { localStorage.setItem('yc-mute', A.on ? '0' : '1'); } catch (e) {} return A.on; };
function tone(type, f0, f1, dur, vol, at) {
  const c = A.ctx, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
}
let nbuf = null;
function noise(dur, vol, freq, q, at) {
  const c = A.ctx, t = c.currentTime + (at || 0);
  if (!nbuf) { nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = nbuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.master); s.start(t, Math.random() * 0.5, dur + 0.05);
}
/* 같은 소리가 너무 촘촘히 겹치지 않게 */
A.play = function (name, gap) {
  if (!A.on || !A.ctx || A.ctx.state !== 'running') return;
  const now = performance.now(); if (now - (A.last[name] || 0) < (gap || 40)) return; A.last[name] = now;
  switch (name) {
    case 'jump': tone('square', 330, 620, 0.11, 0.10); break;
    case 'land': tone('sine', 150, 70, 0.09, 0.22); noise(0.06, 0.10, 500, 0.8); break;
    case 'heavy': tone('sawtooth', 110, 80, 0.14, 0.12); break;
    case 'push': noise(0.12, 0.07, 260, 1.2); break;
    case 'stuck': tone('sawtooth', 95, 85, 0.16, 0.08); break;
    case 'thud': tone('sine', 110, 45, 0.18, 0.4); noise(0.12, 0.2, 180, 0.7); break;
    case 'btn': tone('square', 880, 660, 0.05, 0.12); break;
    case 'door': tone('triangle', 300, 520, 0.18, 0.16); break;
    case 'kick': tone('sine', 180, 900, 0.28, 0.3); noise(0.2, 0.15, 1200, 0.6); break;
    case 'boing': tone('sine', 140, 760, 0.3, 0.3); tone('sine', 280, 1100, 0.22, 0.12, 0.03); break;
    case 'launch': noise(0.5, 0.18, 1800, 0.5); tone('triangle', 500, 1300, 0.4, 0.14); break;
    case 'water': noise(0.35, 0.35, 900, 0.6); tone('sine', 500, 120, 0.3, 0.2); break;
    case 'die': tone('square', 500, 120, 0.28, 0.14); break;
    case 'respawn': tone('triangle', 400, 800, 0.12, 0.14); break;
    case 'key': tone('triangle', 1319, 1319, 0.1, 0.2); tone('triangle', 1760, 1760, 0.2, 0.2, 0.09); break;
    case 'unlock': [784, 988, 1319].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, i * 0.09)); break;
    case 'enter': tone('sine', 700, 300, 0.22, 0.2); break;
    case 'flag': tone('triangle', 988, 988, 0.12, 0.16); break;
    case 'tick': tone('square', 440, 440, 0.09, 0.14); break;
    case 'go': tone('square', 880, 880, 0.3, 0.18); break;
    case 'clear': [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, i === 4 ? 0.5 : 0.14, 0.22, i * 0.11)); break;
    case 'done': [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, i === 7 ? 0.7 : 0.15, 0.22, i * 0.12)); break;
    case 'sink': tone('sine', 220, 60, 0.7, 0.25); noise(0.5, 0.15, 400, 0.5); break;
    case 'sail': tone('triangle', 392, 523, 0.2, 0.12); break;
    case 'join': tone('triangle', 660, 990, 0.12, 0.14); break;
    case 'ui': tone('square', 700, 700, 0.04, 0.08); break;
  }
};
root.YCAudio = A;
})(window);
