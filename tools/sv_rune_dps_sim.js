// 서바이벌 룬 초당 피해 시뮬 (1.0.0 다듬기, 사용자 11/07 「대충 계산해서 해 보고 시뮬로도 해 보고 둘 다 비교」)
// 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node tools/sv_rune_dps_sim.js [초=30] [Lv=5]
// 방법: 룬 하나만 들고(유물, 트리, 업그레이드 없음, 공격력 100, 이동 속도 120) 움직이지 않는 허수아비에게 준 피해를 잼
//   단일 = 몸에 붙은 허수아비 1마리 (14px, 36px 둘 중 높은 값: 발밑 덫은 겹쳐야 밟음) · 무리 = 14~200px 둘레에 40마리 (밀려나도 매 틱 제자리로)
//   계산 = 수치표(SV_SKS) 첫 피해 줄 × 개수 줄 ÷ 쿨타임 (한 마리에 한 번씩만 맞는다고 친 대충 값) · 체력 500 (최대 체력 비례 피해가 있어 크게 두지 않음)
// 출력: 룬, 계산, 단일, 무리 (초당 피해, 공격력 100 기준)
const { chromium } = require('playwright-core');
const SEC = +(process.argv[2] || 30), LV = +(process.argv[3] || 5);
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport:{ width:1280, height:720 } }); const errs = []; pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/index.html'); await pg.waitForTimeout(3000);
  await pg.evaluate(()=>{ document.getElementById('svSplash')?.remove(); document.querySelector('.svs-cfw')?.remove(); state.svNick='시뮬'; });
  const ids = await pg.evaluate(()=>Object.keys(SV_SKS));
  const rows = [];
  for(const id of ids){
    const r = await pg.evaluate(([id, SEC, LV])=>{
      const one = (n, d0)=>{ if(sv.game){ cancelAnimationFrame(sv.raf); sv.game = null; sv.cv = null; } sv.leader = 'fire_a'; sv.stage = 0; svStart('solo');
        const G = sv.game; cancelAnimationFrame(sv.raf); const p = G.players[0];
        p.atk = 100; p.spd = 120; p.def = 0; p.maxHp = p.hp = 500; p.ps = {}; p.tr = null; p.wp = [{ id, lv:LV, evo:false, cd:0, a:0 }]; p.ultCd = 1e9;
        G.en.length = 0; const home = [];
        const T = G.en; const mk = (x, y)=>{ const e = { x, y, r:16, spd:0, hp:1e12, max:1e12, dmg:0, xp:0, kind:'normal', art:'', mob:'', fl:0 }; T.push(e); home.push([e, x, y]); };
        if(n === 1) mk(p.x + d0, p.y); else for(let k=0;k<n;k++){ const a = k*2.399, d = d0 + (k%7)*28; mk(p.x + Math.cos(a)*d, p.y + Math.sin(a)*d); }
        const px = p.x, py = p.y; sv.keys = {};
        for(let i=0; i<SEC*20; i++){ G.spawnT = 99; G.packT = 99; G.eliteT = 99; try{ svInput(0.05); }catch(e){} svTick(0.05); p.hp = p.maxHp; p.x = px; p.y = py; home.forEach(([e, x, y])=>{ e.x = x; e.y = y; e.hp = 1e12; }); G.en = G.en.filter(e=>home.some(h=>h[0]===e)); }
        return Math.round(((p.st && p.st.dmg) || 0)/SEC); };
      const row = SV_SKS[id].find(r=>r[1].b), cd = (SV_SK[id] && SV_SK[id].cd) || 0;
      const cnt = SV_SKS[id].find(r=>r[2]==='개'), nn = cnt ? cnt[1](LV) : 1, per = row ? row[1](LV) : 0, calc = cd > 0 ? Math.round(per*nn/cd) : null;
      return { id, nm: svSkNm0(id), per, nn, cd, calc, single: Math.max(one(1, 14), one(1, 36)), crowd: one(40, 14) };
    }, [id, SEC, LV]);
    rows.push(r); console.log([r.id, r.nm, '한 대 '+r.per+(r.nn>1?'×'+r.nn:''), '쿨 '+r.cd, '계산 '+(r.calc==null ? '계속' : r.calc), '단일 '+r.single, '무리 '+r.crowd].join(' | '));
  }
  const med = a=>{ const s = a.slice().sort((x, y)=>x - y); return s[Math.floor(s.length/2)]; };
  console.log('중간값 단일', med(rows.map(r=>r.single)), '무리', med(rows.map(r=>r.crowd)));
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
