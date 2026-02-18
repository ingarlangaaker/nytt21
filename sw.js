const CACHE="farmapp-cache-v1";
const CORE=["./","./index.html","./app.js","./manifest.webmanifest","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",(e)=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",(e)=>{e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",(e)=>{
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{
    if(e.request.method==="GET" && res.ok){
      const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy));
    }
    return res;
  }).catch(()=>cached)));
});
