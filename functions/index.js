// 아니마룬 — 휴대폰 푸시 알림 보내는 서버 함수 (Firebase Cloud Functions · Blaze 요금제 필요)
// 배포 방법: docs/푸시_알림_설정.md
//
// 데이터 (Realtime Database)
//   push/{uid}/subs/{sid} = { endpoint, p256dh, auth, t }   기기마다 받는 주소 (게임이 씀)
//   push/{uid}/pref/{kind} = false                        끈 알림만 false로 (없으면 켜짐)
//   push/{uid}/due/{kind} = 시각(ms)                        예약 알림: hearth(화로 가득) · dispatch(파견 완료) · daily(오늘 아직 안 들어옴)
//   pushCfg/pub = 공개 키 (게임이 읽음) · pushCfg/vapid = { pub, priv } (서버만 읽음 — 처음 실행 때 자동으로 만듦)
const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const webpush = require('web-push');

const REGION = 'asia-southeast1'; // Realtime Database 위치와 같게
const DB_INSTANCE = 'spirit-summoner-4e7e1-default-rtdb';
const ADMIN_UID = '8V7bN7HfeIRGHCsGu8aeAcJlUBq2';
setGlobalOptions({ region: REGION, maxInstances: 3, memory: '256MiB' });
admin.initializeApp({ databaseURL: 'https://'+DB_INSTANCE+'.asia-southeast1.firebasedatabase.app' }); // 기본 DB 주소를 직접 지정(지역 DB라서)
const db = ()=>admin.database();

// ---------- 서버 키(VAPID) — 없으면 한 번 만들어 저장 ----------
let vapid = null;
async function getVapid(){
  if(vapid) return vapid;
  const ref = db().ref('pushCfg/vapid');
  let v = (await ref.get()).val();
  if(!v || !v.pub || !v.priv){
    const k = webpush.generateVAPIDKeys();
    const r = await ref.transaction(cur=> (cur && cur.pub && cur.priv) ? cur : { pub: k.publicKey, priv: k.privateKey });
    v = r.snapshot.val();
  }
  await db().ref('pushCfg/pub').set(v.pub);
  webpush.setVapidDetails('https://dfdeer.github.io/AnimaRune/', v.pub, v.priv);
  vapid = v;
  return v;
}

// ---------- 보내기 ----------
const KIND_ON = (pref, kind)=> !(pref && pref[kind]===false);
async function sendTo(uid, kind, msg){
  await getVapid();
  const snap = await db().ref('push/'+uid).get();
  const p = snap.val();
  if(!p || !p.subs || !KIND_ON(p.pref, kind)) return 0;
  const body = JSON.stringify(Object.assign({ tag: kind, url: './' }, msg));
  let n = 0;
  await Promise.all(Object.entries(p.subs).map(async ([sid, s])=>{
    if(!s || !s.endpoint) return;
    try{
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60*60*12, urgency: 'normal' });
      n++;
    }catch(e){
      if(e && (e.statusCode===404 || e.statusCode===410)) await db().ref('push/'+uid+'/subs/'+sid).remove(); // 앱 지움·권한 끔 → 주소 정리
      else logger.warn('push fail', uid, kind, e && e.statusCode, e && e.body);
    }
  }));
  return n;
}
const clip = (s, n)=>{ s = String(s||'').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n-1)+'…' : s; };
async function nameOf(uid){ const v = (await db().ref('players/'+uid+'/name').get()).val(); return clip(v || '소환사', 12); }

// ---------- 바로 보내는 알림 ----------
const DB = { instance: DB_INSTANCE, region: REGION };
// 친구 요청
exports.pushFriendReq = onValueCreated(Object.assign({ ref: 'friendReqs/{uid}/{from}' }, DB), async ev=>{
  const { uid, from } = ev.params;
  await sendTo(uid, 'friend', { title: '🙋 친구 요청', body: (await nameOf(from))+'의 친구 요청' });
});
// 개인 우편
exports.pushMailUser = onValueCreated(Object.assign({ ref: 'mail/user/{uid}/{id}' }, DB), async ev=>{
  const m = ev.data.val() || {};
  await sendTo(ev.params.uid, 'mail', { title: '📮 우편 도착', body: clip(m.title || '새 우편', 40) });
});
// 전체 우편 — 알림을 켠 모든 사람
exports.pushMailAll = onValueCreated(Object.assign({ ref: 'mail/all/{id}' }, DB), async ev=>{
  const m = ev.data.val() || {};
  const all = (await db().ref('push').get()).val() || {};
  for(const uid of Object.keys(all)) await sendTo(uid, 'mail', { title: '📮 우편 도착', body: clip(m.title || '새 우편', 40) });
});
// 문의: 새 문의 → 관리자 · 이어 쓴 메시지 → 상대 · 답장 → 문의한 사람
exports.pushAskNew = onValueCreated(Object.assign({ ref: 'inquiries/{uid}/{id}' }, DB), async ev=>{
  const q = ev.data.val() || {};
  if(ev.params.uid===ADMIN_UID) return;
  await sendTo(ADMIN_UID, 'ask', { title: '📨 새 문의', body: clip((q.name ? q.name+': ' : '')+(q.text||''), 60) });
});
exports.pushAskMsg = onValueCreated(Object.assign({ ref: 'inquiries/{uid}/{id}/msgs/{mid}' }, DB), async ev=>{
  const m = ev.data.val() || {};
  if(m.a===true) await sendTo(ev.params.uid, 'ask', { title: '💬 문의 답장 도착', body: clip(m.m, 60) });
  else if(ev.params.uid!==ADMIN_UID) await sendTo(ADMIN_UID, 'ask', { title: '📨 문의 이어 씀', body: clip(m.m, 60) });
});
exports.pushAskReply = onValueWritten(Object.assign({ ref: 'inquiries/{uid}/{id}/reply' }, DB), async ev=>{
  const after = ev.data.after.val(), before = ev.data.before.val();
  if(!after || after===before) return;
  await sendTo(ev.params.uid, 'ask', { title: '💬 문의 답장 도착', body: clip(after, 60) });
});

// ---------- 예약 알림 (10분마다 확인) ----------
const DUE_MSG = {
  hearth:   { title: '🔥 화로 가득', body: '화로가 가득 찼어 — 강화석·정수 받아 가기' },
  dispatch: { title: '🧭 파견 완료', body: '파견 간 정령이 돌아왔어' },
  daily:    { title: '🌅 오늘의 의뢰', body: '일일 의뢰·월드 보스 도전이 기다리는 중' },
};
exports.pushDueTick = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', region: REGION }, async ()=>{
  await getVapid();
  const all = (await db().ref('push').get()).val() || {};
  const now = Date.now();
  for(const [uid, p] of Object.entries(all)){
    const due = (p && p.due) || {};
    for(const [kind, at] of Object.entries(due)){
      if(!DUE_MSG[kind] || !(typeof at==='number') || at > now) continue;
      await db().ref('push/'+uid+'/due/'+kind).remove(); // 한 번만
      if(now - at > 6*60*60*1000) continue; // 너무 지난 건 버림(서버가 멈췄다가 돌아온 경우)
      await sendTo(uid, kind, DUE_MSG[kind]);
    }
  }
});
