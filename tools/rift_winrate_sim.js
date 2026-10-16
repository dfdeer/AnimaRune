// 별빛 균열 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node rift_winrate_sim.js <판수> <층들>
// 예: node rift_winrate_sim.js 20 10,11,12  — 지금 기간(기기 시각의 pickupPeriod) 그 층 그대로
// 수치 바꿔 보기: TWEAK='RIFT_TIERS[11].hp=12; RIFT_TIERS[11].atk=2.3;' node rift_winrate_sim.js 20 12
// 기준 팀 3개 (사용자 결정 10/17 — 12층: 픽업 있는 풀성장 = 널널 · 픽업 없는 풀성장 = 조금 빡빡 · 덜 성장 = 정말 잘해야 / 10·11층은 12층보다 쉽게)
//   풀성장 = 운이 없는 성장은 끝까지: 각성 5 · 강화 최대(+15) · 성좌 승급 · 신화 무기·방어구 +10 (같은 속성)
//            운이 걸린 성장은 절반쯤: 초월 5 · 각인 3줄 영웅(공격력·치명타·체력) · 장비 부가 능력 줄마다 영웅(같은 셋) · 장비 고유 효과 예리함 · 희귀 맹공의 룬
//   덜 성장 = 각성 2 · 강화 +10 · 신화 장비 +10 (부가 능력·고유 효과 없음) · 초월·각인·룬·성좌 없음
//   팀 = 기본 신화 10마리(한정 성좌 빼고) 중 추천 배치 · 「+픽업」은 그 층에 맞춘 픽업 + 추천 5 · GEAR=0 이면 장비 없이
// 출력: 층 · 기믹 · 추천 전투력 · [팀, 팀 전투력, 승률%, 별3%(10라운드 안 + 전원 생존), 평균 라운드] · 크로미움 경로 /opt/pw-browsers/chromium
// 자동 전투 기준 — 직접 하면(대상·스킬 골라 쓰기) 이보다 잘 깸
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'10'), floors = (process.argv[3]||'10,11,12').split(',').map(Number), port = process.argv[4]||'8765';
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const f of floors){
    const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
    const t0 = Date.now();
    const r = await p.evaluate(async ([N,f,TWEAK,GEAR])=>{
      window.toast=()=>{}; window.sfx=()=>{}; window.save=()=>{}; window.showSkillStageScreen=()=>{}; window.render=()=>{}; window.afterFightMutation=()=>{}; window.unmountBattleScreen=()=>{}; window.bingoBump=()=>{}; state.skillAuto = true;
      if(TWEAK) eval(TWEAK);
      const per = riftPeriod(), P = riftPlan(f, per), pu = P.pu;
      const base = Object.keys(SPIRITS).filter(k=>SPIRITS[k].rarity==='mythic' && !SPIRITS[k].limited);
      const L3 = s=>({ lines: s.map(x=>({ s:x, q:2 })) }); // 영웅 품질 = 5단계 중 가운데
      const grow = (keys, full)=>{
        state.owned={}; state.awaken={}; state.enhanceLevel={}; state.trans={}; state.astral={}; state.engrave={}; state.runes={}; state.eqSub={}; state.eqTrait={};
        state.equipped={}; state.equipOwned={}; state.equipEnh={}; window.isEquipUnlocked=()=>true;
        keys.forEach((k,i)=>{ state.owned[k]=6; state.awaken[k] = full ? AWAKEN_MAX : 2; state.enhanceLevel[k] = full ? maxEnhanceFor(k) : 10;
          if(full){ state.trans[k]=5; state.astral[k]=1; state.engrave[k]=L3(['atk','crit','hp']); state.runes[k]={ id:'atk', tier:'rare' }; }
          if(GEAR) EQUIP_SLOTS.forEach(sl=>{ const ek = equipKey(sl, SPIRITS[k].element, 'mythic')+'#'+(i+1); state.equipOwned[ek]=1; state.equipEnh[ek]=EQ_ENH_MAX.mythic; (state.equipped[k]=state.equipped[k]||{})[sl]=ek;
            if(full){ state.eqSub[ek]=L3(['atk','crit','hp']); state.eqTrait[ek]={ id:'keen' }; } }); }); };
      const run1 = ()=>{ let n=0; while(n++<4000){ const sf = state.skillFight; if(!sf || sf.result) break; if(checkRiftOutcome(sf)) break;
        const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=SKILL_ROUND_CAP) break; nextSkillRound(); } } };
      const PROFILES = [ ['풀성장+픽업', true, true], ['풀성장', true, false], ['덜 성장', false, false] ];
      const rows = [];
      for(const [name, full, withPu] of PROFILES){
        grow(withPu ? base.concat([pu]) : base.slice(), full);
        const rec = recommendFormation([P.el], base).filter(Boolean);
        state.formation = (withPu ? [pu].concat(rec.slice(0, GRID_SLOTS-1)) : rec).slice(0, GRID_SLOTS);
        const team = state.formation.filter(Boolean);
        let w=0, s3=0, rs=0;
        for(let k=0;k<N;k++){ state.skillFight = buildRiftFight(f); run1(); const res = state.skillFight && state.skillFight.result; if(res && res.win){ w++; rs+=res.rounds; if(res.bits===7) s3++; } }
        rows.push([name+' ('+team.map(k=>SPIRITS[k].name).join('·')+')', team.reduce((a,k)=>a+spiritCP(k),0), Math.round(w/N*100), Math.round(s3/N*100), w ? +(rs/w).toFixed(1) : '-']);
      }
      return { gim: (P.duo ? P.duo.name : P.gim)+' · '+P.el+' · 픽업 '+SPIRITS[pu].name+' · 추천 '+riftRecCP(f), rows };
    }, [N, f, process.env.TWEAK||'', process.env.GEAR!=='0']);
    console.log(f+'층', r.gim, ((Date.now()-t0)/1000).toFixed(0)+'s'+(errs.length?(' ERR '+errs.slice(0,2).join(' | ')):''));
    r.rows.forEach(x=>console.log('   ', JSON.stringify(x)));
    await p.close();
  }
  await b.close();
})();
