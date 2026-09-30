// 챕터 보스 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) 아무 폴더에서 npm i playwright-core (3) node boss_winrate_sim.js <판수> <챕터목록> [포트]
// 예: node boss_winrate_sim.js 8 1,2,3,4,5,6,7,8,9,10  — 1~5 = 노말 챕터 1~5, 6~10 = 하드 챕터 1~5 (하드 스테이지 번호는 HARD_BASE=500부터)
// 출력: [팀, 승률%, 평균 라운드(마지막 웨이브), 끝났을 때 보스 남은 체력%] · 크로미움 경로 /opt/pw-browsers/chromium
// (v272) 챕터마다 새 페이지·page.evaluate를 따로 호출 — 전부 한 번에 돌리면 브라우저가 죽거나 시간 초과가 남
const { chromium } = require('playwright-core');
const N = parseInt(process.argv[2]||'4'), chs = (process.argv[3]||'1,2,3,4,5,6,7,8,9,10').split(',').map(Number), port = process.argv[4]||'8765';
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const c of chs){
    const p = await b.newPage({ viewport:{width:390,height:844} }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
    const t0 = Date.now();
    const r = await p.evaluate(async ([N,c])=>{
      window.toast=()=>{}; window.sfx=()=>{};
      const all = r=> ELEMENTS.flatMap(e=>['a','b'].map(v=>e+'_'+r+'_'+v)).filter(k=>SPIRITS[k]);
      const mk = (spec, enh, aw)=>{ const out=[]; let off=0; spec.forEach(([r,n])=>{ const l = all(r); for(let i=0;i<n;i++) out.push(l[(off+i*3)%l.length]); off+=n; }); return {keys:out, enh, aw}; };
      // (v275) 강화 최대치(MAX_ENHANCE)가 +10이라 +12·+15 팀은 실제로 못 만듦 → 신화 +10에 각성 단계로 사다리 · 장비·룬은 없음
      const LADDER = [ ['전6+10',[['legendary',6]],10,0], ['신3전3+10',[['mythic',3],['legendary',3]],10,0], ['신6+10',[['mythic',6]],10,0], ['신6+10각2',[['mythic',6]],10,2], ['신6+10각4',[['mythic',6]],10,4], ['신6+10각5',[['mythic',6]],10,5] ];
      const setTeam = t=>{ state.owned = {}; state.awaken = {}; state.enhanceLevel={}; t.keys.forEach(k=>{ state.owned[k]=6; state.awaken[k]=t.aw; state.enhanceLevel[k]=t.enh; }); };
      const run1 = ()=>{ let n=0; while(n++<4000){ const sf = state.skillFight; if(!sf) break; if(sf.result){ if(sf.result.waveClear){ advanceBossWave(); continue; } break; }
        const side = settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=SKILL_ROUND_CAP) break; nextSkillRound(); } } };
      const bossRun = (i, t)=>{ setTeam(t); startBossWaveRun(i, t.keys.slice()); run1(); const sf = state.skillFight, win = !!(sf&&sf.result&&sf.result.win&&!sf.result.waveClear); const rd = sf?sf.round:0; const bu = sf && (sf.enemyUnits||[]).find(u=>u.isBoss); const bh = bu ? Math.max(0,bu.hp)/bu.maxHp : 1; try{ endBossWaveRun(false); }catch(e){} state.skillFight=null; state.bossFight=null; unmountBattleScreen(); return {win, rd, bh}; };
      window.__boss_only=1;
      const hard = c>5, boss = hard ? HARD_BASE + (c-6)*10 + 9 : c*10-1, lab = hard ? HARD_CH_BASE+(c-5) : c, rows = [];
      for(const [name, spec, enh, aw] of LADDER){ const t = mk(spec, enh, aw); let bw=0, rs=0, hs=0; for(let k=0;k<N;k++){ const o = bossRun(boss, t); if(o.win) bw++; rs+=o.rd; hs+=o.bh; } rows.push([name, Math.round(bw/N*100), +(rs/N).toFixed(1), Math.round(hs/N*100)]); }
      return { label: chapterLabel(lab)+' #'+boss, rows };
    }, [N,c]);
    console.log(c, r.label, JSON.stringify(r.rows), ((Date.now()-t0)/1000).toFixed(0)+'s', errs.length?('ERR '+errs.slice(0,2).join(' | ')):'');
    await p.close();
  }
  await b.close();
})();
