// 레이드 성장 단계별 승률 시뮬 (v10.0.0) — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) npm i playwright-core (3) node raid_growth_sim.js <판수> <보스들> <난이도들> [포트]
// 예: node raid_growth_sim.js 8 frostTyrant,dawnJudge hell,inferno,chaos
// 수치 바꿔 보기: TWEAK='RAID_DIFFS[6].atk=150; RAID_DIFFS[6].hp=200;' node raid_growth_sim.js 8 frostTyrant chaos
// 팀 = 기본 신화 10마리(한정 성좌 빼고) 중 보스 상성 점수가 높은 8마리 → 4마리씩 둘(혼자 도전 + AI 동료와 같은 꼴) · 둘 다 자동 전투 · 30라운드에서 끊음
// 성장 단계 (균열 시뮬 tools/rift_winrate_sim.js 와 같은 기준 · 사용자 결정 10/17):
//   덜 성장 = 각성 2 · 강화 +10 · 같은 속성 신화 무기·방어구 +10 (장비 각인·고유 효과 없음)
//   중간    = 각성 5 · 강화 최대 · 신화 장비 +10 · 초월 2 · 각인 5줄 희귀
//   풀성장  = 각성 5 · 강화 최대 · 성좌 승급 · 초월 5 · 각인 5줄 영웅 · 장비 각인 영웅 3줄 · 고유 효과 예리함 · 희귀 맹공의 룬 (운 요소 절반)
//   풀+고대 = 풀성장 + 장비 둘 다 고대 승급
// 출력: [단계, 둘 합산 전투력, 승률%, 평균 라운드, 끝났을 때 보스 남은 체력%] · 크로미움 경로 /opt/pw-browsers/chromium
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'6'), bosses = (process.argv[3]||'frostTyrant').split(','), diffs = (process.argv[4]||'hell,inferno,chaos').split(','), port = process.argv[5]||'8765';
(async()=>{ const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
for(const boss of bosses) for(const diff of diffs){
  const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
  const r = await p.evaluate(([N,boss,diff,TWEAK])=>{ window.toast=()=>{}; window.sfx=()=>{}; window.save=()=>{}; window.bingoBump=()=>{}; window.render=()=>{}; window.showSkillStageScreen=()=>{}; window.afterFightMutation=()=>{}; window.unmountBattleScreen=()=>{}; raidNet.role='solo'; state.skillAuto = true;
    if(TWEAK) eval(TWEAK);
    const base = Object.keys(SPIRITS).filter(k=>SPIRITS[k].rarity==='mythic' && !SPIRITS[k].limited);
    const L = (s, q)=>({ lines: s.map(x=>({ s:x, q })) }), ENG5 = ['atk','crit','cdmg','hp','atk'], EQ3 = ['atk','crit','cdmg'];
    const grow = (lv)=>{ // 0 덜 · 1 중간 · 2 풀 · 3 풀+고대
      state.owned={}; state.awaken={}; state.enhanceLevel={}; state.trans={}; state.astral={}; state.engrave={}; state.runes={}; state.eqSub={}; state.eqTrait={}; state.eqMain={}; state.eqQual={}; state.eqAnc={};
      state.equipped={}; state.equipOwned={}; state.equipEnh={}; window.isEquipUnlocked=()=>true;
      base.forEach((k,i)=>{ state.owned[k]=6; state.awaken[k] = lv ? AWAKEN_MAX : 2; state.enhanceLevel[k] = lv ? maxEnhanceFor(k) : 10;
        if(lv===1){ state.trans[k]=2; state.engrave[k]=L(ENG5, 1); }
        if(lv>=2){ state.trans[k]=5; state.astral[k]=1; state.engrave[k]=L(ENG5, 2); state.runes[k]={ id:'atk', tier:'rare' }; }
        EQUIP_SLOTS.forEach(sl=>{ const ek = equipKey(sl, SPIRITS[k].element, 'mythic')+'#'+(i+1); state.equipOwned[ek]=1; state.equipEnh[ek]=EQ_ENH_MAX.mythic; (state.equipped[k]=state.equipped[k]||{})[sl]=ek;
          if(lv>=2){ state.eqSub[ek]=L(EQ3, 2); state.eqTrait[ek]={ id:'keen' }; } if(lv===3) state.eqAnc[ek]=1; }); }); };
    const info = raidBossById(boss);
    const score = k=>{ const el = SPIRITS[k].element; return spiritCP(k) * (beats(el, info.element) ? 1.15 : (beats(info.element, el) ? 0.85 : 1)); };
    const rows = [];
    for(const [nm, lv] of [['덜 성장',0],['중간',1],['풀성장',2],['풀+고대',3]]){
      grow(lv);
      const top = base.slice().sort((a,c)=>score(c)-score(a)).slice(0,8);
      const pay = arr=>arr.map(k=>({ key:k, atk:unitAtk(k), arm:spiritHpMult(k), rune:spiritRune(k), aw:awakenLevel(k), ast:isAstral(k), sub:battleSubFor(k) }));
      const h = pay(top.filter((_,i)=>i%2===0)), g = pay(top.filter((_,i)=>i%2===1));
      let w=0, rs=0, bh=0, cp=0;
      for(let n=0;n<N;n++){
        const sf = buildRaidFight(h, g, boss, diff); sf.alone = null; cp = teamCP(sf.myUnits); state.skillFight = sf;
        let t=0; while(t++<6000){ if(sf.result) break; const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=30) break; nextSkillRound(); } }
        if(sf.result && sf.result.win) w++; rs += sf.round; const bu = sf.enemyUnits.find(u=>u.isBoss); bh += bu ? Math.max(0,bu.hp)/bu.maxHp : 0;
        state.skillFight = null; unmountBattleScreen();
      }
      rows.push([nm, cp, Math.round(w/N*100), +(rs/N).toFixed(1), Math.round(bh/N*100)]);
    }
    return { rec: raidRecCP(boss, diff), rows };
  }, [N, boss, diff, process.env.TWEAK||'']);
  console.log(boss, diff, '추천 '+r.rec, errs.length ? 'ERR '+errs.slice(0,2).join(' | ') : '');
  r.rows.forEach(x=>console.log('   ', JSON.stringify(x)));
  await p.close();
}
await b.close(); })();
