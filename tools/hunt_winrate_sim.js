// 보스 토벌 단계별 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node hunt_winrate_sim.js <판수> <단계들> [보스들]
// 예: node hunt_winrate_sim.js 6 1,2,3,4,5,6   — 보스 6종 모두 (보스마다 판수만큼)
// 수치 바꿔 보기: TWEAK='HUNT_TIER_DEF[5].hp=8;' node hunt_winrate_sim.js 6 6
// 팀 3개 (기본 신화 10마리 중 추천 배치, 장비는 같은 속성 신화 무기·방어구 +10):
//   덜 성장 = 각성 2 · 강화 +10 · 장비 주효과 공격력/체력 · 품질 75 · 그 밖 없음
//   중간    = 각성 3 · 강화 최대 · 초월 2 · 각인 5줄 희귀(공격력·치명타 확률·치명타 피해·체력·깡공격력) · 장비 각인 희귀 · 희귀 맹공의 룬
//   풀성장  = 각성 5 · 강화 최대 · 성좌 · 초월 5 · 각인 5줄 영웅 · 장비 각인 영웅 · 고유 효과 예리함 · 희귀 맹공의 룬 (운 요소 절반)
// 출력: 단계 · 추천 전투력 · [팀, 팀 전투력, 승률%(보스 평균), 평균 라운드] · 크로미움 /opt/pw-browsers/chromium · 자동 전투 기준
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'4'), tiers = (process.argv[3]||'1,2,3,4,5,6').split(',').map(Number), port = process.argv[5]||'8765';
const bossArg = process.argv[4] || '';
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const t of tiers){
    const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
    const r = await p.evaluate(async ([N,t,TWEAK,bossArg])=>{
      window.toast=()=>{}; window.sfx=()=>{}; window.save=()=>{}; window.showSkillStageScreen=()=>{}; window.render=()=>{}; window.checkAchievements=()=>{}; window.bingoBump=()=>{}; state.skillAuto = true; window.isEquipUnlocked=()=>true;
      if(TWEAK) eval(TWEAK);
      const base = Object.keys(SPIRITS).filter(k=>SPIRITS[k].rarity==='mythic' && !SPIRITS[k].limited);
      const L5 = (q, ss)=>({ lines: ss.map(x=>({ s:x, q })) });
      const grow = lv=>{ state.owned={}; state.awaken={}; state.enhanceLevel={}; state.trans={}; state.astral={}; state.engrave={}; state.runes={}; state.eqSub={}; state.eqTrait={}; state.eqMain={}; state.eqQual={}; state.equipped={}; state.equipOwned={}; state.equipEnh={};
        base.forEach((k,i)=>{ state.owned[k]=6; state.awaken[k] = lv===2 ? 5 : lv===1 ? 3 : 2; state.enhanceLevel[k] = lv>=1 ? maxEnhanceFor(k) : 10;
          if(lv>=1){ state.trans[k] = lv===2 ? 5 : 2; state.engrave[k] = L5(lv===2 ? 2 : 1, ['atk','crit','cdmg','hp','atkf']); state.runes[k] = { id:'atk', tier:'rare' }; }
          if(lv===2) state.astral[k] = 1;
          EQUIP_SLOTS.forEach(sl=>{ const ek = equipKey(sl, SPIRITS[k].element, 'mythic')+'#'+(i+1); state.equipOwned[ek]=1; state.equipEnh[ek]=EQ_ENH_MAX.mythic; (state.equipped[k]=state.equipped[k]||{})[sl]=ek;
            if(lv>=1){ state.eqSub[ek] = L5(lv===2 ? 2 : 1, ['atk','crit','cdmg']); } if(lv===2) state.eqTrait[ek] = { id:'keen' }; }); }); };
      const run1 = ()=>{ let n=0; while(n++<4000){ const sf = state.skillFight; if(!sf || sf.result) break; if(checkSkillStageOutcome0(sf)) break;
        const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=SKILL_ROUND_CAP) break; nextSkillRound(); } } };
      const bosses = bossArg ? bossArg.split(',') : CHAPTER_BOSS_GIMMICK.slice();
      const rows = [];
      for(const [name, lv] of [['덜 성장',0],['중간',1],['풀성장',2]]){
        grow(lv); let w=0, n=0, rs=0, cp=0;
        for(const g of bosses){ const el = HUNT_EL[g]; state.formation = recommendFormation(el ? [el] : [], base).slice(0, GRID_SLOTS); cp = state.formation.filter(Boolean).reduce((a,k)=>a+spiritCP(k),0);
          for(let k=0;k<N;k++){ state.hunt = { e:HUNT_CAP, t:serverNow(), best:{}, pity:0 }; state.skillFight = buildHuntFight(g, t); run1(); const res = state.skillFight && state.skillFight.result; n++; if(res && res.win){ w++; rs+=res.rounds; } } }
        rows.push([name, cp, Math.round(w/n*100), w ? +(rs/w).toFixed(1) : '-']);
      }
      return { rec: huntRecCP(CHAPTER_BOSS_GIMMICK[0], t), rows };
    }, [N, t, process.env.TWEAK||'', bossArg]);
    console.log(t+'단계 · 추천 '+r.rec+(errs.length?(' ERR '+errs.slice(0,2).join(' | ')):''));
    r.rows.forEach(x=>console.log('   ', JSON.stringify(x)));
    await p.close();
  }
  await b.close();
})();
