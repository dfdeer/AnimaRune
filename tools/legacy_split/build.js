// index.html의 큰 스크립트를 core(그대로 index.html 안)와 legacy(legacy/legacy.js)로 나눔
// 쓰는 법: node build.js <index.html> <out_dir>   (an.js로 g.json을 먼저 만들 것)
const fs = require('fs'), path = require('path');
const [IN, OUT] = process.argv.slice(2);
const html = fs.readFileSync(IN, 'utf8');
const G = JSON.parse(fs.readFileSync('g.json', 'utf8')), S = G.stmts;
const stops = new Set(fs.readFileSync('stops.txt', 'utf8').split(/\s+/).filter(Boolean));
const lexec = new Set(fs.readFileSync('lexec.txt', 'utf8').split(/\s+/).filter(Boolean).map(Number));
const by = {}; S.forEach(s => s.decl.forEach(d => (by[d] = by[d] || []).push(s.i)));
const isStop = j => S[j].decl.some(d => stops.has(d));
const roots = S.filter(s => (!s.decl.length && !lexec.has(s.i)) || s.decl.some(d => /^(sv|SV)/.test(d))).map(s => s.i);
const core = new Set(), q = [...roots];
while (q.length) { const i = q.pop(); if (core.has(i)) continue; core.add(i); for (const r of S[i].refs) for (const j of (by[r] || [])) if (!core.has(j) && !isStop(j)) q.push(j); }
// 검사: core가 참조하는 legacy 이름은 모두 함수 선언이어야 함 (빈 함수로 대신)
const legacyNames = new Map(); S.forEach(s => { if (!core.has(s.i)) s.decl.forEach(d => legacyNames.set(d, s)); });
const stubs = new Set(), bad = [];
for (const i of core) for (const r of S[i].refs) if (legacyNames.has(r)) { const s = legacyNames.get(r); if (s.type === 'FunctionDeclaration') stubs.add(r); else bad.push(r + ' (' + s.type + ') ← ' + (S[i].decl[0] || '실행문' + i)); }
if (bad.length) { console.log('함수가 아닌 legacy 이름을 core가 씀:\n' + [...new Set(bad)].join('\n')); process.exit(1); }
// 이름이 core와 legacy 둘 다에 선언되면 안 됨
const coreNames = new Set(); S.forEach(s => { if (core.has(s.i)) s.decl.forEach(d => coreNames.add(d)); });
const dup = [...legacyNames.keys()].filter(n => coreNames.has(n)); if (dup.length) { console.log('둘 다 선언:', dup); process.exit(1); }
// 자르기: 문장마다 앞의 주석과 빈칸을 같이 붙임
const src = html.slice(G.off); const scriptEnd = src.indexOf('</script>'); const body = src.slice(0, scriptEnd);
let prev = 0; const C = [], L = [];
S.forEach(s => { const seg = body.slice(prev, s.end); (core.has(s.i) ? C : L).push(seg); prev = s.end; });
C.push(body.slice(prev));
const stubTxt = '\n// ===================== (1.0.0 다듬기) 예전 아니마룬 코드 분리 =====================\n'
  + '// 예전 게임 전용 코드는 legacy/legacy.js로 옮김 (사용자 11/07 「예전 것은 폴더에 넣고 꺼내 오지 말기」) · 관리자가 「원래 아니마룬」을 열 때만 loadLegacy()로 불러옴\n'
  + '// 아래 함수들은 legacy에 진짜가 있고, 불러오기 전엔 아무 일도 안 함 (legacy가 같은 이름의 함수로 덮어씀) · 나눈 도구와 방법은 docs/인수인계.md 「코드 분리」\n'
  + 'let LEGACY_ON = false, legacyP = null; const legacyMissed = {};\n'
  + 'function legacyMiss(n){ legacyMissed[n] = (legacyMissed[n]||0) + 1; }\n'
  + "function loadLegacy(){ if(LEGACY_ON) return Promise.resolve(); if(legacyP) return legacyP; legacyP = new Promise((ok, no)=>{ const s = document.createElement('script'); s.src = 'legacy/legacy.js?v='+APP_BUILD; s.onload = ()=>{ LEGACY_ON = true; ok(); }; s.onerror = ()=>{ legacyP = null; no(new Error('legacy')); }; document.head.appendChild(s); }); return legacyP; }\n"
  + [...stubs].sort().map(n => 'function ' + n + '(){ legacyMiss(\'' + n + '\'); }').join('\n') + '\n';
const coreJs = stubTxt + C.join('');
const legacyJs = '// 예전 아니마룬 전용 코드 (1.0.0 다듬기에서 index.html에서 떼어 냄) · index.html의 스크립트를 다 읽은 뒤 loadLegacy()로 불러옴\n// 이 파일의 함수 선언은 index.html의 같은 이름 빈 함수를 덮어씀 · 이 파일의 실행문(예전 버튼 연결 등)은 불러올 때 한 번 실행됨\n' + L.join('') + '\n';
const newHtml = html.slice(0, G.off) + coreJs + src.slice(scriptEnd);
fs.mkdirSync(path.join(OUT, 'legacy'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), newHtml);
fs.writeFileSync(path.join(OUT, 'legacy', 'legacy.js'), legacyJs);
console.log('core 문장', core.size, 'legacy 문장', S.length - core.size, '빈 함수', stubs.size);
console.log('index.html', html.length, '→', newHtml.length, ' legacy.js', legacyJs.length);
fs.writeFileSync('stubs.txt', [...stubs].sort().join('\n'));
