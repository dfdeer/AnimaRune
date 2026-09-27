// 아니마룬 — 오프라인 실행용 서비스 워커
// 파일을 새 버전으로 올릴 때 아래 CACHE 이름의 숫자를 올리면 예전 캐시가 정리돼요.
const CACHE = 'animarune-v200';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './assets/home_stage.webp', './assets/home_expedition.webp', './assets/home_raid.webp',
  './assets/ui/frame_common.webp', './assets/ui/frame_epic.webp', './assets/ui/frame_legendary.webp', './assets/ui/frame_mythic.webp', './assets/ui/frame_rare.webp', './assets/ui/ic_achieve.webp', './assets/ui/ic_duel.webp', './assets/ui/ic_el_dark.webp', './assets/ui/ic_el_fire.webp', './assets/ui/ic_el_light.webp', './assets/ui/ic_el_water.webp', './assets/ui/ic_el_wood.webp', './assets/ui/ic_essence.webp', './assets/ui/ic_expedition.webp', './assets/ui/ic_explore.webp', './assets/ui/ic_friends.webp', './assets/ui/ic_guide.webp', './assets/ui/ic_hearth.webp', './assets/ui/ic_menu.webp', './assets/ui/ic_quest.webp', './assets/ui/ic_raid.webp', './assets/ui/ic_runestone.webp', './assets/ui/ic_settings.webp', './assets/ui/ic_spirits.webp', './assets/ui/ic_stone.webp', './assets/ui/ic_summon.webp', './assets/ui/ic_ticket.webp', './assets/ui/ic_tower.webp'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// 네트워크 우선(온라인이면 항상 최신), 실패하면 캐시
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
      return res;
    }).catch(()=> caches.match(req).then(r=> r || caches.match('./index.html')))
  );
});
