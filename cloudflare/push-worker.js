// 아니마룬 — 휴대폰 푸시 알림 보내는 서버 (Cloudflare Workers 무료 요금제 · 카드 필요 없음)
// 설정 방법: docs/푸시_알림_설정.md
//
// 환경 변수 (Cloudflare 화면 → 설정 → 변수 및 비밀)
//   DB_URL    = https://spirit-summoner-4e7e1-default-rtdb.asia-southeast1.firebasedatabase.app
//   DB_SECRET = Firebase 데이터베이스 비밀 키 (비밀로 저장)
//
// 데이터 (Realtime Database)
//   push/{uid}/subs/{sid} = { endpoint, p256dh, auth, t }  기기마다 받는 주소 (게임이 씀)
//   push/{uid}/pref/{kind} = false                        끈 알림만 false
//   pushDue/{uid}/{kind} = 시각(ms)                         예약 알림: hearth · dispatch · daily (게임이 씀)
//   pushCfg/pub · pushCfg/url                              공개 키·이 서버 주소 (/setup 때 만듦, 게임이 읽음)
//   pushCfg/vapid · pushSent/{key} · pushQ/{id}            서버만 씀 (비밀 키 · 보낸 표시 · 전체 우편 대기열)
//
// 알림이 가는 길
//   ① 바로: 게임이 친구 요청·우편·문의를 저장한 직후 POST /ping → 서버가 DB에서 진짜 있는지 확인하고 한 번만 보냄
//   ② 예약: 1분마다 pushDue에서 시각이 된 것 · 전체 우편 대기열(pushQ)을 조금씩 보냄
const ADMIN_UID = '8V7bN7HfeIRGHCsGu8aeAcJlUBq2';
const SUBJECT = 'https://dfdeer.github.io/AnimaRune/';
const FRESH_MS = 15*60*1000;     // 이보다 오래된 항목은 ping이 와도 안 보냄
const PER_RUN = 25;              // 한 번 실행에 보내는 최대 알림 수 (무료 요금제 외부 요청 50개 제한)
const DUE_MSG = {
  hearth:   { title: '🔥 화로 가득', body: '강화석·정수 받기' },
  dispatch: { title: '🧭 파견 완료', body: '파견 간 정령 귀환' },
  daily:    { title: '🌅 오늘의 의뢰', body: '일일 의뢰·월드 보스 도전이 기다리는 중' },
};

// ---------- 작은 도구 ----------
const enc = new TextEncoder();
const b64u = buf=>{ let s = ''; new Uint8Array(buf).forEach(b=>{ s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u = s=>{ s = String(s).replace(/-/g,'+').replace(/_/g,'/'); const raw = atob(s + '='.repeat((4 - s.length%4)%4)); return Uint8Array.from(raw, c=>c.charCodeAt(0)); };
const cat = (...a)=>{ const n = a.reduce((x,y)=>x+y.length, 0), o = new Uint8Array(n); let i = 0; a.forEach(x=>{ o.set(x, i); i += x.length; }); return o; };
const clip = (s, n)=>{ s = String(s||'').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n-1)+'…' : s; };
const safeKey = s=> /^[A-Za-z0-9_-]{1,64}$/.test(String(s||''));
const json = (o, st)=> new Response(JSON.stringify(o), { status: st||200, headers: { 'content-type':'application/json', 'access-control-allow-origin':'*' } });

// ---------- Realtime Database (REST) ----------
function dbUrl(env, path, q){
  const u = new URL(env.DB_URL.replace(/\/$/,'')+'/'+path+'.json');
  if(!env.DB_BEARER) u.searchParams.set('auth', env.DB_SECRET);
  if(env.DB_NS) u.searchParams.set('ns', env.DB_NS); // 시험용(에뮬레이터)
  if(q) Object.entries(q).forEach(([k,v])=>u.searchParams.set(k, v));
  return u.toString(); }
async function dbReq(env, method, path, body, q){
  const h = { 'content-type':'application/json' }; if(env.DB_BEARER) h.authorization = 'Bearer '+env.DB_BEARER; // 시험용(에뮬레이터)
  const r = await fetch(dbUrl(env, path, q), { method, headers: h, body: body===undefined ? undefined : JSON.stringify(body) });
  if(!r.ok) throw new Error('db '+method+' '+path+' '+r.status);
  return r.json();
}
const dbGet = (env, p, q)=>dbReq(env, 'GET', p, undefined, q);
const dbPatch = (env, upd)=>dbReq(env, 'PATCH', '', upd);   // 여러 곳을 한 번에 (값 null = 지우기)

// ---------- 서버 키(VAPID) — 없으면 만들어서 DB에 보관 ----------
async function getVapid(env){
  let v = await dbGet(env, 'pushCfg/vapid');
  if(!v || !v.d || !v.pub){
    const k = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign', 'verify']);
    const j = await crypto.subtle.exportKey('jwk', k.privateKey);
    v = { d: j.d, x: j.x, y: j.y, pub: b64u(cat(new Uint8Array([4]), unb64u(j.x), unb64u(j.y))) };
    await dbPatch(env, { 'pushCfg/vapid': v, 'pushCfg/pub': v.pub });
  }
  return v;
}
async function vapidHeader(v, endpoint){
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ:'JWT', alg:'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now()/1000) + 12*3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', { kty:'EC', crv:'P-256', d:v.d, x:v.x, y:v.y, ext:true }, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, enc.encode(head+'.'+body)); // 64바이트 r||s = JWS 형식 그대로
  return 'vapid t='+head+'.'+body+'.'+b64u(sig)+', k='+v.pub;
}

// ---------- 알림 내용 암호화 (RFC 8291 · aes128gcm) ----------
async function hkdf(salt, ikm, info, len){
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt, info }, k, len*8));
}
async function encryptPayload(p256dh, authSecret, text){
  const ua = unb64u(p256dh), auth = unb64u(authSecret);
  const eph = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return cat(head, asPub, ct);
}

// ---------- 보내기 ----------
// 반환: { sent, gone:[sid…] } — 사라진 기기(404·410)는 모아서 한 번에 지움
async function sendTo(env, v, uid, kind, msg, budget){
  const p = await dbGet(env, 'push/'+uid);
  const out = { sent: 0, gone: [] };
  if(!p || !p.subs || (p.pref && p.pref[kind]===false)) return out;
  const text = JSON.stringify(Object.assign({ tag: kind, url: './' }, msg));
  for(const [sid, s] of Object.entries(p.subs)){
    if(!s || !s.endpoint || budget.n <= 0) continue;
    budget.n--;
    try{
      const r = await fetch(s.endpoint, { method:'POST', headers: { 'content-encoding':'aes128gcm', 'content-type':'application/octet-stream', ttl: '43200', urgency: 'normal', authorization: await vapidHeader(v, s.endpoint) }, body: await encryptPayload(s.p256dh, s.auth, text) });
      if(r.status===404 || r.status===410) out.gone.push('push/'+uid+'/subs/'+sid);
      else if(r.ok) out.sent++;
      else console.log('push fail', uid, kind, r.status, (await r.text()).slice(0, 200));
    }catch(e){ console.log('push error', uid, kind, String(e)); }
  }
  return out;
}
async function nameOf(env, uid){ const v = await dbGet(env, 'players/'+uid+'/name').catch(()=>null); return clip(v || '소환사', 12); }

// ---------- ① 바로 보내기: 게임이 부르는 /ping ----------
// 보내는 사람이 무엇을 적든, 서버가 DB에서 실제 항목을 읽어서 확인 — 가짜 알림·같은 알림 두 번은 안 감
async function handlePing(env, o){
  const now = Date.now(), v = await getVapid(env), budget = { n: PER_RUN };
  let key = null, jobs = []; // [uid, kind, msg]
  if(o.t==='friend' && safeKey(o.to) && safeKey(o.from)){
    const r = await dbGet(env, 'friendReqs/'+o.to+'/'+o.from);
    if(r && now - (r.t||0) < FRESH_MS){
      key = 'f_'+o.to+'_'+o.from+'_'+(r.t||0);
      if(r.accept) jobs.push([o.to, 'friend', { title:'🤝 친구 수락', body: clip(r.name || await nameOf(env, o.from), 12)+'이(가) 친구 요청을 받음' }]);
      else if(!r.reject) jobs.push([o.to, 'friend', { title:'🙋 친구 요청', body: clip(r.name || await nameOf(env, o.from), 12)+'의 친구 요청' }]);
    }
  }else if(o.t==='mail' && safeKey(o.to) && safeKey(o.id)){
    const m = await dbGet(env, 'mail/user/'+o.to+'/'+o.id);
    if(m && now - (m.t||0) < FRESH_MS){ key = 'm_'+o.to+'_'+o.id; jobs.push([o.to, 'mail', { title:'📮 우편 도착', body: clip(m.title || '새 우편', 40) }]); }
  }else if(o.t==='mailAll' && safeKey(o.id)){
    const m = await dbGet(env, 'mail/all/'+o.id);
    if(m && now - (m.t||0) < FRESH_MS){ // 전체 우편은 대기열에 넣고 예약 실행이 조금씩 보냄
      const done = await dbGet(env, 'pushSent/a_'+o.id);
      if(!done) await dbPatch(env, { ['pushQ/'+o.id]: { title: clip(m.title || '새 우편', 40), t: now, after: '' }, ['pushSent/a_'+o.id]: now });
      return { ok: true, queued: !done };
    }
  }else if(o.t==='askNew' && safeKey(o.uid) && safeKey(o.id)){
    const q = await dbGet(env, 'inquiries/'+o.uid+'/'+o.id);
    if(q && now - (q.t||0) < FRESH_MS && o.uid!==ADMIN_UID){ key = 'q_'+o.uid+'_'+o.id; jobs.push([ADMIN_UID, 'ask', { title:'📨 새 문의', body: clip((q.name ? q.name+': ' : '')+(q.text||''), 60) }]); }
  }else if(o.t==='askMsg' && safeKey(o.uid) && safeKey(o.id) && safeKey(o.mid)){
    const m = await dbGet(env, 'inquiries/'+o.uid+'/'+o.id+'/msgs/'+o.mid);
    if(m && now - (m.t||0) < FRESH_MS){ key = 'k_'+o.uid+'_'+o.id+'_'+o.mid;
      if(m.a===true) jobs.push([o.uid, 'ask', { title:'💬 문의 답장 도착', body: clip(m.m, 60) }]);
      else if(o.uid!==ADMIN_UID) jobs.push([ADMIN_UID, 'ask', { title:'📨 문의 이어 씀', body: clip(m.m, 60) }]); }
  }
  if(!key || !jobs.length) return { ok: true, sent: 0 };
  key = key.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
  if(await dbGet(env, 'pushSent/'+key)) return { ok: true, dup: true };
  await dbPatch(env, { ['pushSent/'+key]: now });
  let sent = 0; const upd = {};
  for(const [uid, kind, msg] of jobs){ const r = await sendTo(env, v, uid, kind, msg, budget); sent += r.sent; r.gone.forEach(g=>{ upd[g] = null; }); }
  if(Object.keys(upd).length) await dbPatch(env, upd);
  return { ok: true, sent };
}

// ---------- ② 예약 실행 (1분마다) ----------
async function tick(env){
  const now = Date.now(), v = await getVapid(env), budget = { n: PER_RUN }, upd = {};
  // 예약 알림
  const due = await dbGet(env, 'pushDue') || {};
  for(const [uid, d] of Object.entries(due)){
    if(!d || typeof d!=='object') continue;
    for(const [kind, at] of Object.entries(d)){
      if(!DUE_MSG[kind] || typeof at!=='number' || at > now || budget.n <= 0) continue;
      upd['pushDue/'+uid+'/'+kind] = null; // 한 번만
      if(now - at > 6*3600*1000) continue; // 너무 지난 건 버림
      const r = await sendTo(env, v, uid, kind, DUE_MSG[kind], budget); r.gone.forEach(g=>{ upd[g] = null; });
    }
  }
  // 앞자리 업데이트 알림 — 10분마다 배포된 sw.js의 APP_VERSION을 보고, 앞자리가 오르면 알림을 켠 모든 사람에게 한 번 (사용자 결정)
  if(new Date(now).getUTCMinutes() % 10 === 0){ try{
    const t = await (await fetch(SUBJECT+'sw.js?t='+now)).text(), m = t.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
    if(m){ const major = +m[1], p = await dbGet(env, 'pushCfg/major'), prev = typeof p==='number' ? p : 4; // 처음 켤 때는 5.0.0 알림이 가게 4부터
      if(major > prev){ upd['pushCfg/major'] = major; upd['pushQ/upd'+major] = { head:'🎉 '+m[1]+'.0 업데이트', title:'새 콘텐츠 · 우편함에 업데이트 선물', kind:'update', t: now, after:'' }; }
      else if(typeof p!=='number') upd['pushCfg/major'] = major; }
  }catch(e){ console.log('ver check', String(e)); } }
  // 전체 우편 대기열 — 사람 이름순으로 이어서
  const q = await dbGet(env, 'pushQ') || {};
  for(const [id, item] of Object.entries(q)){
    if(budget.n <= 0) break;
    if(!item || now - (item.t||0) > 24*3600*1000){ upd['pushQ/'+id] = null; continue; }
    const uids = Object.keys(await dbGet(env, 'push', { shallow: 'true' }) || {}).sort().filter(u=>u > (item.after||''));
    let last = item.after || '';
    for(const uid of uids){ if(budget.n <= 0) break; const r = await sendTo(env, v, uid, item.kind || 'mail', { title: item.head || '📮 우편 도착', body: item.title }, budget); r.gone.forEach(g=>{ upd[g] = null; }); last = uid; }
    if(budget.n > 0) upd['pushQ/'+id] = null; else upd['pushQ/'+id+'/after'] = last;
  }
  // 하루 지난 '보낸 표시' 정리 (하루 한 번쯤)
  if(new Date(now).getUTCMinutes()===7 && new Date(now).getUTCHours()===19){
    const sent = await dbGet(env, 'pushSent') || {};
    Object.entries(sent).forEach(([k, t])=>{ if(!(t > now - 2*86400000)) upd['pushSent/'+k] = null; });
  }
  if(Object.keys(upd).length) await dbPatch(env, upd);
}

export default {
  async fetch(req, env, ctx){
    const url = new URL(req.url);
    if(req.method==='OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin':'*', 'access-control-allow-methods':'POST, GET', 'access-control-allow-headers':'content-type' } });
    try{
      if(url.pathname==='/setup'){ // 처음 한 번: 서버 키를 만들고, 게임이 이 주소를 알 수 있게 저장
        const v = await getVapid(env);
        await dbPatch(env, { 'pushCfg/url': url.origin });
        return new Response('아니마룬 알림 서버 준비 완료\n주소: '+url.origin+'\n공개 키: '+v.pub.slice(0, 12)+'…\n', { headers: { 'content-type':'text/plain; charset=utf-8' } });
      }
      if(url.pathname==='/ping' && req.method==='POST'){
        const o = JSON.parse((await req.text()).slice(0, 2000) || '{}');
        return json(await handlePing(env, o));
      }
      return new Response('animarune push', { headers: { 'content-type':'text/plain' } });
    }catch(e){ console.log('error', String(e)); return json({ ok:false }, 500); }
  },
  async scheduled(ev, env, ctx){ ctx.waitUntil(tick(env)); },
};
