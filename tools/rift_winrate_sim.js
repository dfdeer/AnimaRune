// 별빛 균열 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node rift_winrate_sim.js <판수> <층들>
// 예: node rift_winrate_sim.js 10 6,8,10,11,12  — 지금 기간(서버 시각 대신 기기 시각의 pickupPeriod) 그 층 그대로
// 팀: 기본 신화 10마리(한정 성좌 빼고) + 이번 픽업 둘 중에서 '추천 배치'(recommendFormation)로 6마리 · 강화 +10
// (v8.17.2) 장비: 기본은 정령마다 같은 속성 신화 무기·방어구 +10 (사용자 결정 10/15) · GEAR=0 node ... 이면 장비 없음
// 수치 바꿔 보기: TWEAK='RIFT_TIERS[11].hp=10;' node rift_winrate_sim.js 10 12
// 출력: 층 · 기믹 · [팀, 승률%, 별3%(10라운드 안 + 전원 생존), 평균 라운드] · 크로미움 경로 /opt/pw-browsers/chromium
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'6'), floors = (process.argv[3]||'6,7,8,9,10,11,12').split(',').map(Number), port = process.argv[4]||'8765';
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const f of floors){
    const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
    const t0 = Date.now();
    const r = await p.evaluate(async ([N,f,TWEAK,GEAR])=>{
      window.toast=()=>{}; window.sfx=()=>{}; window.save=()=>{}; window.showSkillStageScreen=()=>{}; window.render=()=>{}; window.afterFightMutation=()=>{}; window.unmountBattleScreen=()=>{}; window.bingoBump=()=>{}; state.skillAuto = true;
      if(TWEAK) eval(TWEAK);
      const per = riftPeriod(), mythics = Object.keys(SPIRITS).filter(k=>SPIRITS[k].rarity==='mythic' && !SPIRITS[k].limited); // 기본 신화 10마리 (한정 성좌는 이번 픽업 둘만)
      const pool = [...new Set(mythics.concat(per.pair))];
      // [이름, 성좌로 볼지, 각성, 픽업 정령 넣을지]
      const LADDER = [ ['신화 각0', false, 0, false], ['신화 각2', false, 2, false], ['신화 각2+픽업', false, 2, true], ['성좌 각2', true, 2, false], ['성좌 각2+픽업', true, 2, true], ['성좌 각4+픽업', true, 4, true] ];
      const simGear = ks=>{ if(!GEAR) return; window.isEquipUnlocked=()=>true; state.equipped={}; state.equipOwned={}; state.equipEnh={}; ks.forEach((k,i)=>{ const el = SPIRITS[k].element; EQUIP_SLOTS.forEach(sl=>{ const ek = equipKey(sl, el, 'mythic')+'#'+(i+1); state.equipOwned[ek]=1; state.equipEnh[ek]=EQ_ENH_MAX.mythic; (state.equipped[k]=state.equipped[k]||{})[sl]=ek; }); }); };
      const run1 = ()=>{ let n=0; while(n++<4000){ const sf = state.skillFight; if(!sf || sf.result) break; if(checkRiftOutcome(sf)) break;
        const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=SKILL_ROUND_CAP) break; nextSkillRound(); } } };
      const P = riftPlan(f, per), rows = [];
      for(const [name, ast, aw, withPu] of LADDER){
        const cand = withPu ? pool : pool.filter(k=>!per.pair.includes(k));
        state.owned = {}; state.awaken = {}; state.enhanceLevel = {}; state.astral = {};
        cand.forEach(k=>{ state.owned[k]=6; state.awaken[k]=aw; state.enhanceLevel[k]=10; if(ast) state.astral[k]=1; });
        const base = recommendFormation([P.el], cand.filter(k=>!per.pair.includes(k))).filter(Boolean);
        state.formation = (withPu ? per.pair.concat(base.slice(0, GRID_SLOTS-2)) : base).slice(0, GRID_SLOTS); // 픽업 넣는 팀은 픽업 둘 + 추천 4
        const team = state.formation.filter(Boolean); simGear(team);
        let w=0, s3=0, rs=0;
        for(let k=0;k<N;k++){ state.skillFight = buildRiftFight(f); run1(); const sf = state.skillFight, res = sf && sf.result; if(res && res.win){ w++; rs+=res.rounds; if(res.bits===7) s3++; } }
        rows.push([name+' ('+team.map(k=>SPIRITS[k].name).join('·')+')', Math.round(w/N*100), Math.round(s3/N*100), w ? +(rs/w).toFixed(1) : '-']);
      }
      return { gim: (P.duo ? P.duo.name : P.gim)+' · '+P.el+' · 추천 '+riftRecCP(f), rows };
    }, [N, f, process.env.TWEAK||'', process.env.GEAR!=='0']);
    console.log(f+'층', r.gim, ((Date.now()-t0)/1000).toFixed(0)+'s'+(errs.length?(' ERR '+errs.slice(0,2).join(' | ')):''));
    r.rows.forEach(x=>console.log('   ', JSON.stringify(x)));
    await p.close();
  }
  await b.close();
})();
