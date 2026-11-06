// 최상위 문장마다 선언 이름과 참조 이름을 뽑아 의존 그래프를 만듦
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const html = fs.readFileSync(process.argv[2], 'utf8');
const ms = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const main = ms.reduce((a, b) => b[2].length > a[2].length ? b : a);
const src = main[2];
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
const stmts = ast.body.map((n, i) => {
  const decl = [];
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') decl.push(n.id.name);
  if (n.type === 'VariableDeclaration') n.declarations.forEach(d => { const pat = p => { if (!p) return; if (p.type === 'Identifier') decl.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'AssignmentPattern') pat(p.left); else if (p.type === 'RestElement') pat(p.argument); }; pat(d.id); });
  const refs = new Set();
  walk.fullAncestor(n, (node, st, anc) => {
    if (node.type !== 'Identifier') return;
    const p = anc[anc.length - 2];
    if (p && p.type === 'MemberExpression' && p.property === node && !p.computed) return;
    if (p && (p.type === 'Property') && p.key === node && !p.computed && !p.shorthand) return;
    refs.add(node.name);
  });
  // 문자열 안의 이름도 (onclick 등) 대략
  walk.full(n, node => { if (node.type === 'Literal' && typeof node.value === 'string') { for (const m of node.value.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) refs.add(m[1]); } if (node.type === 'TemplateElement') { for (const m of node.value.cooked.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) refs.add(m[1]); } });
  return { i, type: n.type, decl, refs: [...refs], start: n.start, end: n.end, len: n.end - n.start };
});
fs.writeFileSync(process.argv[3], JSON.stringify({ off: main.index + main[0].indexOf('>') + 1, stmts }));
console.log('문장', stmts.length, '선언', stmts.filter(s => s.decl.length).length, '실행문', stmts.filter(s => !s.decl.length).length);
