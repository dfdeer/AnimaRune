// 챕터 보스 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node boss_winrate_sim.js <판수> <챕터목록>
// 예: node boss_winrate_sim.js 8 1,2,3,4,5,6,7,8,9,10  (6~10 = 하드 챕터 1~5) · 크로미움 경로 /opt/pw-browsers/chromium
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'4'), chs = (process.argv[3]||'5,6,7,8,9,10').split(',').map(Number);
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
  const r = await p.evaluate(async ([N,chs])=>{
    window.toast=()=>{}; window.sfx=()=>{};
    const all = r=> ELEMENTS.flatMap(e=>['a','b'].map(v=>e+'_'+r+'_'+v)).filter(k=>SPIRITS[k]);
    const mk = (spec, enh, aw)=>{ const out=[]; let off=0; spec.forEach(([r,n])=>{ const l = all(r); for(let i=0;i<n;i++) out.push(l[(off+i*3)%l.length]); off+=n; }); return {keys:out, enh, aw}; };
    const LADDER = [ ['전6+10',[['legendary',6]],10,0], ['신3전3+10',[['mythic',3],['legendary',3]],10,0], ['신6+10',[['mythic',6]],10,0], ['신6+12각2',[['mythic',6]],12,2], ['신6+15각5',[['mythic',6]],15,5] ];
    const setTeam = t=>{ state.owned = {}; state.awaken = {}; state.enhanceLevel={}; t.keys.forEach(k=>{ state.owned[k]=6; state.awaken[k]=t.aw; state.enhanceLevel[k]=t.enh; }); };
    const run1 = ()=>{ let n=0; while(n++<4000){ const sf = state.skillFight; if(!sf) break; if(sf.result){ if(sf.result.waveClear){ advanceBossWave(); continue; } break; }
      const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=SKILL_ROUND_CAP) break; nextSkillRound(); } } };
    const stageRun = (i, t)=>{ setTeam(t); state.formation = recommendFormation(enemyGridForStage(i).els, t.keys); startSkillStageFight(i); run1(); const sf = state.skillFight; const o = { win: !!(sf&&sf.result&&sf.result.win), r: sf?sf.round:0 }; state.skillFight=null; unmountBattleScreen(); return o; };
    const bossRun = (i, t)=>{ setTeam(t); startBossWaveRun(i, t.keys.slice()); run1(); const sf = state.skillFight, win = !!(sf&&sf.result&&sf.result.win&&!sf.result.waveClear); try{ endBossWaveRun(false); }catch(e){} state.skillFight=null; state.bossFight=null; unmountBattleScreen(); return {win}; };
    const out = {}; window.__boss_only=1;
    for(const c of chs){
      const first = (c-1)*10, last = c*10-2, boss = c*10-1, rows = [];
      rows.push('적 1마리 공격력 '+Math.round(enemySlotPower(first))+' → '+Math.round(enemySlotPower(last))+' · 적 수 '+enemyCountForStage(first));
      for(const [name, spec, enh, aw] of LADDER){
        const t = mk(spec, enh, aw);
        const rate = i=>'-';
        let bw=0; for(let k=0;k<N;k++) if(bossRun(boss, t).win) bw++;
        rows.push(name+' (정령력 '+Math.round(unitPower(t.keys[0]))+'): 첫 '+rate(first)+'% · 끝 '+rate(last)+'% · 보스 '+Math.round(bw/N*100)+'%');
      }
      out[chapterLabel(c)] = rows;
    }
    return out;
  }, [N,chs]);
  console.log(JSON.stringify(r,null,1)); console.log(errs.slice(0,3).join('\n')); await b.close();
})();
