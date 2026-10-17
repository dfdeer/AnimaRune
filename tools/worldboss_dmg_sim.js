// 월드 보스 한 번 도전 피해 측정 (v10.0.0) — 사용: (1) 저장소 루트에서 python3 -m http.server 8765 (2) npm i playwright-core (3) node worldboss_dmg_sim.js
// 성장 단계는 tools/raid_growth_sim.js 와 같음 (덜 · 중간 · 풀 · 풀+고대) · 6마리 · 자동 전투 5라운드 · 그날 약점 속성(×1.5)은 날짜 따라 달라서 값이 조금 흔들림 · 보스마다 4판 평균
// 출력: 보스: 단계 팀 전투력 → 평균 피해
const { chromium } = require('playwright-core');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const g of ['frostGiant','lavaLord','abyssCrystal']){
const p=await b.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
const r=await p.evaluate(([g,ANC])=>{ window.toast=()=>{}; window.sfx=()=>{}; window.save=()=>{}; window.render=()=>{}; window.showSkillStageScreen=()=>{}; window.afterFightMutation=()=>{}; window.unmountBattleScreen=()=>{}; window.wbSubmit=()=>{}; window.bingoBump=()=>{}; state.skillAuto=true;
 window.wbPhase=()=>WB_BOSSES.find(x=>x.g===g); window.wbRemain=()=>4500000; window.wbHp=()=>4500000;
 const base = Object.keys(SPIRITS).filter(k=>SPIRITS[k].rarity==='mythic' && !SPIRITS[k].limited);
 const L=(s,q)=>({lines:s.map(x=>({s:x,q}))}), ENG5=['atk','crit','cdmg','hp','atk'], EQ3=['atk','crit','cdmg'];
 const grow=lv=>{ state.owned={}; state.awaken={}; state.enhanceLevel={}; state.trans={}; state.astral={}; state.engrave={}; state.runes={}; state.eqSub={}; state.eqTrait={}; state.eqMain={}; state.eqQual={}; state.eqAnc={}; state.equipped={}; state.equipOwned={}; state.equipEnh={}; window.isEquipUnlocked=()=>true;
  base.forEach((k,i)=>{ state.owned[k]=6; state.awaken[k]=lv?AWAKEN_MAX:2; state.enhanceLevel[k]=lv?maxEnhanceFor(k):10; if(lv===1){state.trans[k]=2; state.engrave[k]=L(ENG5,1);} if(lv>=2){state.trans[k]=5; state.astral[k]=1; state.engrave[k]=L(ENG5,2); state.runes[k]={id:'atk',tier:'rare'};}
   EQUIP_SLOTS.forEach(sl=>{ const ek=equipKey(sl,SPIRITS[k].element,'mythic')+'#'+(i+1); state.equipOwned[ek]=1; state.equipEnh[ek]=EQ_ENH_MAX.mythic; (state.equipped[k]=state.equipped[k]||{})[sl]=ek; if(lv>=2){state.eqSub[ek]=L(EQ3,2); state.eqTrait[ek]={id:'keen'};} if(lv===3) state.eqAnc[ek]=1; }); }); };
 const out=[]; for(const [nm,lv] of [['덜',0],['중간',1],['풀',2],['풀+고대',3]]){ grow(lv); state.formation=base.slice().sort((a,c)=>spiritCP(c)-spiritCP(a)).slice(0,GRID_SLOTS); let tot=0; const N=4;
  for(let n=0;n<N;n++){ const sf=buildWorldBossFight(); state.skillFight=sf; let t=0; while(t++<4000){ if(checkWorldBossOutcome(sf)) break; const side=settleQueue(sf); if(side==='me') stepMyAutoTurn(); else if(side==='enemy') stepEnemyTurn(); else nextSkillRound(); } tot+=sf.result?sf.result.dmg:0; state.skillFight=null; }
  out.push(nm+' '+Math.round(state.formation.reduce((a,k)=>a+spiritCP(k),0)/1000)+'k → '+Math.round(tot/N)); }
 return g+': '+out.join(' | '); },[g]);
console.log(r); await p.close(); }
await b.close(); })();
