// index.html의 큰 <style>을 core(서바이벌과 공통이 쓰는 것) / legacy(예전 게임만) / 버림(아무도 안 씀)으로 나눔
// 쓰는 법: node css.js <index.html> <legacy.js> <out_dir> [check]
const fs = require('fs'), path = require('path'), postcss = require('postcss'), sp = require('postcss-selector-parser');
const [IN, LEG, OUT, MODE] = process.argv.slice(2);
const html = fs.readFileSync(IN, 'utf8'), leg = fs.readFileSync(LEG, 'utf8');
const ms = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)];
const big = ms.reduce((a, b) => b[2].length > a[2].length ? b : a);
const nonCss = html.slice(0, big.index) + html.slice(big.index + big[0].length); // 나머지 HTML과 스크립트
function tokens(txt) { const T = new Set(); for (const m of txt.matchAll(/[A-Za-z_][\w-]*-?/g)) { T.add(m[0]); } return T; }
const coreT = tokens(nonCss), legT = tokens(leg);
const prefixes = T => [...T].filter(t => /[-_]$/.test(t) && t.length >= 3);
const coreP = prefixes(coreT), legP = prefixes(legT);
const camel = n => n.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const usedIn = (name, T, P) => T.has(name) || P.some(p => name.startsWith(p)) || (name.startsWith('data-') && T.has(camel(name)));
// 선택자 하나가 쓰이는지: 안의 class, id, [속성] 이름이 모두 그 쪽 글에 있어야 함
function selUsed(sel, T, P) { let ok = true; sp(root => { root.walk(n => { if (!ok) return; if (n.type === 'class' || n.type === 'id') { if (!usedIn(n.value, T, P)) ok = false; } else if (n.type === 'attribute') { if (!usedIn(n.attribute, T, P) && !['type', 'disabled', 'aria-pressed', 'aria-hidden', 'data-theme', 'open', 'href', 'hidden'].includes(n.attribute)) ok = false; } else if (n.type === 'pseudo' && /^:(not|is|where|has)$/.test(n.value)) { /* 안쪽 이름은 없어도 됨 */ n.nodes = []; } }); }).processSync(sel); return ok; }
function selLoose(sel, T, P) { let any = false; sp(root => { root.walk(n => { if ((n.type === 'class' || n.type === 'id') && usedIn(n.value, T, P)) any = true; if (n.type === 'attribute' && usedIn(n.attribute, T, P)) any = true; }); }).processSync(sel); return any; }
function ruleWhere(rule) { let c = false, l = false, ll = false; let sels; try { sels = rule.selectors; } catch (e) { return 'core'; } for (const s of sels) { if (selUsed(s, coreT, coreP)) c = true; else if (selUsed(s, legT, legP)) l = true; else if (selLoose(s, legT, legP)) ll = true; } return c ? 'core' : (l || ll) ? 'legacy' : 'none'; } // 예전 쪽 흔적이 조금이라도 있으면 지우지 않고 legacy로
const root = postcss.parse(big[2]);
const legRoot = postcss.root(), stat = { core: 0, legacy: 0, none: 0 }, size = { core: 0, legacy: 0, none: 0 }, noneList = [];
// 키프레임: 이름이 core 쪽(남은 CSS나 스크립트)에 나오면 남김 · 나중에 따로 봄
function moveTo(dst, node) { // 부모 @media 같은 감싸개를 유지하며 옮김
  const chain = []; let p = node.parent; while (p && p.type !== 'root') { chain.unshift(p); p = p.parent; }
  let cur = dst; for (const a of chain) { let found = cur.last && cur.last.type === 'atrule' && cur.last.name === a.name && cur.last.params === a.params && cur.last.__src === a ? cur.last : null; if (!found) { found = a.clone({ nodes: [] }); found.__src = a; cur.append(found); } cur = found; }
  cur.append(node.clone());
}
root.walkRules(rule => { if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return; const w = ruleWhere(rule); stat[w]++; size[w] += rule.toString().length; if (w === 'legacy') moveTo(legRoot, rule); if (w === 'none') noneList.push(rule.selector.slice(0, 80)); if (w !== 'core') rule.__drop = true; rule.__where = w; });
const fullRoot = postcss.parse(big[2]); fullRoot.walkRules(r => { if (r.parent && r.parent.type === 'atrule' && /keyframes$/.test(r.parent.name)) return; if (ruleWhere(r) === 'none') r.remove(); }); fullRoot.walkAtRules(a => { if (a.nodes && !a.nodes.length) a.remove(); }); // 예전 게임을 열 때 쓰는 전체 스타일 (원래 순서, 안 쓰는 것만 뺌)
root.walkRules(r => { if (r.__drop) r.remove(); });
// 빈 @media 지움
root.walkAtRules(a => { if (a.nodes && !a.nodes.length) a.remove(); });
// 키프레임: 남은 core CSS나 core 스크립트에 이름이 없으면 legacy(legacy에 쓰이면) 또는 버림
const coreCss = root.toString();
root.walkAtRules(/keyframes$/, a => { const n = a.params.trim(); const inCore = coreCss.replace(a.toString(), '').includes(n) || coreT.has(n); if (inCore) return; if (legRoot.toString().includes(n) || legT.has(n)) { legRoot.append(a.clone()); } a.remove(); });
console.log('규칙 수', stat, '크기', size);
console.log('core CSS', big[2].length, '→', root.toString().length, ' legacy.css', legRoot.toString().length);
if (MODE === 'check') { console.log('버리는 예:', noneList.slice(0, 40).join(' | ')); return; }
const newHtml = html.slice(0, big.index) + big[0].replace(big[2], root.toString()) + html.slice(big.index + big[0].length);
fs.mkdirSync(path.join(OUT, 'legacy'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), newHtml);
fs.writeFileSync(path.join(OUT, 'legacy', 'legacy.css'), '/* 예전 아니마룬을 열 때 쓰는 전체 스타일 (1.0.0 다듬기) · 원래 순서 그대로, 아무도 안 쓰던 규칙만 뺌 · loadLegacy()가 index.html의 스타일(#coreCss)을 끄고 이걸 넣음 (예전 규칙이 서바이벌 규칙 사이에 섞여 있어서 순서를 지키려고) */\n' + fullRoot.toString() + '\n');
fs.writeFileSync('css_none.txt', noneList.join('\n'));
