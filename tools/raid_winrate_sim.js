// 레이드 승률 시뮬레이션 — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) npm i playwright-core (3) node raid_winrate_sim.js <포트> <판수> <보스목록> <난이도목록> [결과.json]
// 예: node raid_winrate_sim.js 8765 4 frostTyrant,infernoDrake easy,normal,hard,extreme
// 출력: [팀, 둘 합산 전투력, 승률%, 평균 라운드, 끝났을 때 보스 남은 체력%] — 혼자 도전 + AI 동료(4+4마리), 둘 다 자동 전투 · 30라운드에서 끊음
// (v8.3.0) 헬·인페르노·카오스는 이 사다리(최대 신화+15각5 · 장비 없음)로 못 잼 — 신화 각2 +10 + 장비 배율 2.2(43,777) · 각5 +15 장비 2.2 부가 15% 초월 5(88,608) · 성좌 각5 +15 장비 2.2 부가 30% 초월 10(154,539) 팀을 weaponMult·armorMult·transLevel·subTotals를 덮어써서 잼
// 추천 전투력(RAID_REC_CP)은 4판 중 3판 이상 이긴 가장 약한 팀 기준. 이 사다리는 칸이 성겨서, 표를 바꿀 땐 바꾸기 전 코드도 같은 사다리로 재서 비율로 옮길 것
const { chromium } = require('playwright-core');
const port=process.argv[2], N=parseInt(process.argv[3]||'4'), bosses=(process.argv[4]||'frostTyrant,infernoDrake,abyssEye,eldertree,dawnJudge').split(','), diffs=(process.argv[5]||'easy,normal,hard,extreme').split(',');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const out={};
for(const boss of bosses){ for(const diff of diffs){
  const p=await b.newPage({viewport:{width:390,height:844}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:'+port+'/index.html'); await p.waitForTimeout(900);
  const r = await p.evaluate(([N,boss,diff])=>{ window.toast=()=>{}; window.sfx=()=>{}; raidNet.role='solo';
    const all = r=> ELEMENTS.flatMap(e=>['a','b'].map(v=>e+'_'+r+'_'+v)).filter(k=>SPIRITS[k]);
    const LADDER=[['레+5','rare',5,0],['에+5','epic',5,0],['에+10','epic',10,0],['에+15','epic',15,0],['전+1','legendary',1,0],['전+5','legendary',5,0],['전+10','legendary',10,0],['신+10','mythic',10,0],['신+12각2','mythic',12,2],['신+15각5','mythic',15,5]];
    const rows=[];
    for(const [nm,rar,enh,aw] of LADDER){
      const ks = all(rar); state.owned={}; state.awaken={}; state.enhanceLevel={}; ks.forEach(k=>{ state.owned[k]=6; state.awaken[k]=aw; state.enhanceLevel[k]=enh; });
      const pay = arr=>arr.map(k=>({key:k, atk:unitAtk(k), arm:armorMult(k), rune:null, aw}));
      const h = pay([ks[0],ks[3],ks[6],ks[9]].filter(Boolean)), g = pay([ks[1],ks[4],ks[7],ks[10]].filter(Boolean));
      let w=0, rs=0, cp=0, bh=0;
      for(let k=0;k<N;k++){
        const sf = buildRaidFight(h, g, boss, diff); cp = teamCP(sf.myUnits); state.skillFight = sf;
        let n=0; while(n++<6000){ if(sf.result) break; const side=settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else { if(sf.round>=30) break; nextSkillRound(); } }
        if(sf.result && sf.result.win) w++; rs+=sf.round; const bu=sf.enemyUnits.find(u=>u.isBoss); bh += bu? Math.max(0,bu.hp)/bu.maxHp : 0;
        state.skillFight=null; unmountBattleScreen();
      }
      rows.push([nm, cp, Math.round(w/N*100), +(rs/N).toFixed(1), Math.round(bh/N*100)]);
    }
    return rows; }, [N,boss,diff]);
  out[boss+'/'+diff]=r; console.log(boss, diff, JSON.stringify(r), errs.length?'ERR '+errs.slice(0,2).join(' | '):''); await p.close();
}}
if(process.argv[6]) require('fs').writeFileSync(process.argv[6], JSON.stringify(out)); await b.close(); })();
