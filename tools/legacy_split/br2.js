// 뿌리 = 서바이벌 선언 + 모든 실행문 · 멈춤(stops) 함수는 core에서 빈 함수로 대신함
const fs = require('fs');
const G = JSON.parse(fs.readFileSync('g.json', 'utf8')), S = G.stmts;
const by = {}; S.forEach(s => s.decl.forEach(d => (by[d] = by[d] || []).push(s.i)));
const stops = new Set(fs.readFileSync('stops.txt', 'utf8').split(/\s+/).filter(Boolean));
const isStop = j => S[j].decl.some(d => stops.has(d));
function close(roots, st) { const seen = new Set(), q = [...roots]; while (q.length) { const i = q.pop(); if (seen.has(i)) continue; seen.add(i); for (const r of S[i].refs) for (const j of (by[r] || [])) if (!seen.has(j) && !st(j)) q.push(j); } return seen; }
const roots = S.filter(s => !s.decl.length || s.decl.some(d => /^(sv|SV)/.test(d))).map(s => s.i);
const base = close(roots, isStop); const sz = R => [...R].reduce((a, i) => a + S[i].len, 0);
const tot = S.reduce((a, s) => a + s.len, 0);
console.log('core', sz(base), Math.round(sz(base) / tot * 100) + '%', base.size, '/', S.length);
// 멈춤인데 함수가 아닌 것 (안 됨)
for (const n of stops) for (const j of (by[n] || [])) if (S[j].type !== 'FunctionDeclaration') console.log('함수 아님!', n, S[j].type);
const N = +(process.argv[2] || 0);
if (N) { const cands = [...base].filter(i => S[i].type === 'FunctionDeclaration' && !S[i].decl.some(d => /^(sv|SV)/.test(d))); const res = [];
  for (const c of cands) { const nm = S[c].decl[0]; const R = close(roots, j => isStop(j) || j === c); res.push([sz(base) - sz(R), nm]); }
  res.sort((a, b) => b[0] - a[0]).slice(0, N).forEach(r => console.log(r[0], r[1])); }
if (process.argv[3] === 'roots') { // 실행문 중 멈춤 함수를 부르는 것
  S.filter(s => !s.decl.length).forEach(s => { const hit = s.refs.filter(r => stops.has(r)); if (hit.length) console.log('실행문', s.i, hit.join(',')); }); }
fs.writeFileSync('core.json', JSON.stringify([...base]));
