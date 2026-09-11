(()=>{
const K='cncEmpireMobileV2';
const OLDK='cncEmpireMobileV1';
const API='https://bssewblessvmhrytfojh.supabase.co/rest/v1/player_profiles';
const APIKEY='sb_publishable_nnbYZe8ndtMaUkD5pEP-JQ_7Ff1c7d3';
const machines=[
['manual','Konventionelle Drehbank',0,0,'🛠️'],
['cnc','CNC-Drehmaschine',450,4,'⚙️'],
['bar','Stangenlader-Zelle',3500,24,'🔩'],
['turnmill','Dreh-Fräszentrum',18000,110,'🧰'],
['robot','Roboterzelle',95000,520,'🤖'],
['lights','Lights-Out Fertigung',550000,2900,'🏭']
];
function weekKey(){
  const d=new Date();
  const u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=u.getUTCDay()||7;
  u.setUTCDate(u.getUTCDate()+4-day);
  const y=new Date(Date.UTC(u.getUTCFullYear(),0,1));
  const w=Math.ceil((((u-y)/86400000)+1)/7);
  return u.getUTCFullYear()+'-'+String(w).padStart(2,'0');
}
const fresh=()=>({
  name:'Meine Werkstatt',money:120,lifetime:120,runRevenue:120,week:0,weekKey:weekKey(),prestige:0,run:0,tap:1,
  m:{manual:1,cnc:0,bar:0,turnmill:0,robot:0,lights:0},friendCodes:[],friends:[],last:Date.now(),order:null,duelBest:0,
  friendCode:'',playerSecret:'',onlineRegistered:false
});
let raw={};
try{raw=JSON.parse(localStorage.getItem(K)||localStorage.getItem(OLDK)||'{}')}catch{}
let s={...fresh(),...raw};
for(const x of machines)if(s.m[x[0]]==null)s.m[x[0]]=0;
if(!Array.isArray(s.friendCodes))s.friendCodes=[];
if(!Array.isArray(s.friends))s.friends=[];
if(s.runRevenue==null)s.runRevenue=s.run===0?(s.lifetime||120):120;
if(s.weekKey!==weekKey()){s.week=0;s.weekKey=weekKey()}
let tab='shop',duel=null,onlineBusy=false,lastSync=0;
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:n<100?2:0}).format(Number(n)||0);
const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);
function save(){s.last=Date.now();localStorage.setItem(K,JSON.stringify(s))}
function mult(){return 1+s.prestige*.12}
function auto(){return machines.reduce((a,x)=>a+s.m[x[0]]*x[3],0)*mult()}
function click(){return s.tap*mult()}
function cost(x){const lv=s.m[x[0]];return x[2]===0?0:Math.floor(x[2]*Math.pow(1.18,lv))}
function add(v,score=true){s.money+=v;s.lifetime+=v;s.runRevenue+=v;if(score)s.week+=v*.12}
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),1500)}
function buy(id){const x=machines.find(z=>z[0]===id),c=cost(x);if(s.money<c)return toast('Zu wenig Kapital');s.money-=c;s.m[id]++;s.week+=c*.04;save();render();syncOnline()}
function tap(){if(duel){duel.score++;render();return}add(click());if(s.order)s.order.done++;save();render()}
function orderNew(){const mats=['1.4404','42CrMo4','Al 7075','1.4301','POM-C'];const names=['Präzisionswellen','Flanschserie','Hydraulikhülsen','Distanzringe','Spindelmuttern'];const q=30+Math.floor(Math.random()*71),pay=Math.round((180+auto()*12+click()*18)*(1+Math.random()*1.7));s.order={name:names[Math.floor(Math.random()*names.length)],mat:mats[Math.floor(Math.random()*mats.length)],q,done:0,pay};save();render()}
function claim(){if(!s.order||s.order.done<s.order.q)return;add(s.order.pay);s.week+=s.order.pay*.35;toast('Auftrag abgerechnet');s.order=null;save();render();syncOnline(true)}
function prestige(){
  if(s.runRevenue<250000)return toast('Noch '+euro(250000-s.runRevenue)+' bis Meisterprestige');
  const gain=Math.max(1,Math.floor(Math.sqrt(s.runRevenue/250000)));
  if(!confirm('Meisterlauf neu starten? Du erhältst '+gain+' Meistersterne.'))return;
  const keep={name:s.name,prestige:s.prestige+gain,run:s.run+1,friendCodes:s.friendCodes,friends:s.friends,duelBest:s.duelBest,lifetime:s.lifetime,week:s.week,weekKey:s.weekKey,friendCode:s.friendCode,playerSecret:s.playerSecret,onlineRegistered:s.onlineRegistered};
  s={...fresh(),...keep};save();render();syncOnline(true)
}
function randomSecret(){const a=new Uint8Array(32);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
function randomFriendCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=new Uint8Array(8);crypto.getRandomValues(a);return Array.from(a,b=>chars[b%chars.length]).join('')}
async function sha256(text){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('')}
function headers(extra={}){return {'apikey':APIKEY,'Authorization':'Bearer '+APIKEY,'Content-Type':'application/json','x-client-info':s.playerSecret,...extra}}
function publicStats(){return {display_name:s.name,week_score:Math.max(0,Math.floor(s.week)),prestige:s.prestige,duel_best:s.duelBest,lifetime:Math.max(0,Math.floor(s.lifetime)),updated_at:new Date().toISOString()}}
async function ensureOnline(){
  if(onlineBusy)return false;
  if(!navigator.onLine)return false;
  if(!s.playerSecret){s.playerSecret=randomSecret();save()}
  if(!s.friendCode){s.friendCode=randomFriendCode();s.onlineRegistered=false;save()}
  if(s.onlineRegistered)return true;
  onlineBusy=true;
  try{
    for(let i=0;i<4;i++){
      const body={friend_code:s.friendCode,write_secret_hash:await sha256(s.playerSecret),...publicStats()};
      const r=await fetch(API,{method:'POST',headers:headers({'Prefer':'return=minimal'}),body:JSON.stringify(body)});
      if(r.ok){s.onlineRegistered=true;save();onlineBusy=false;return true}
      if(r.status===409){s.friendCode=randomFriendCode();save();continue}
      const t=await r.text();console.warn('CNC online register',r.status,t);break;
    }
  }catch(e){console.warn('CNC online register',e)}
  onlineBusy=false;return false
}
async function syncOnline(force=false){
  if(!navigator.onLine)return;
  if(!force&&Date.now()-lastSync<12000)return;
  if(!await ensureOnline())return;
  lastSync=Date.now();
  try{
    const q='?friend_code=eq.'+encodeURIComponent(s.friendCode);
    const r=await fetch(API+q,{method:'PATCH',headers:headers({'Prefer':'return=minimal'}),body:JSON.stringify(publicStats())});
    if(!r.ok)console.warn('CNC online sync',r.status,await r.text())
  }catch(e){console.warn('CNC online sync',e)}
}
async function loadFriends(showToast=false){
  if(!navigator.onLine){if(showToast)toast('Offline – Freundeswerte lokal');return}
  if(!await ensureOnline())return;
  await syncOnline(true);
  const codes=[...new Set(s.friendCodes.map(c=>String(c).toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean))];
  if(!codes.length){s.friends=[];save();render();return}
  try{
    const select='friend_code,display_name,week_score,prestige,duel_best,lifetime,updated_at';
    const q='?select='+select+'&friend_code=in.('+codes.join(',')+')';
    const r=await fetch(API+q,{headers:headers()});
    if(!r.ok)throw new Error(await r.text());
    const rows=await r.json();
    s.friends=rows.map(p=>({code:p.friend_code,n:p.display_name,w:Number(p.week_score)||0,p:Number(p.prestige)||0,d:Number(p.duel_best)||0,l:Number(p.lifetime)||0,u:p.updated_at}));
    save();render();if(showToast)toast('Freundesliste aktualisiert')
  }catch(e){console.warn('CNC friend load',e);if(showToast)toast('Online-Abgleich fehlgeschlagen')}
}
async function addFriend(){
  const el=document.getElementById('friendcode');
  const code=(el?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==8)return toast('Freundescode hat 8 Zeichen');
  if(code===s.friendCode)return toast('Das ist dein eigener Code');
  if(s.friendCodes.includes(code))return toast('Freund ist schon hinzugefügt');
  try{
    const q='?select=friend_code,display_name,week_score,prestige,duel_best,lifetime,updated_at&friend_code=eq.'+encodeURIComponent(code);
    const r=await fetch(API+q,{headers:headers()});
    const rows=r.ok?await r.json():[];
    if(!rows.length)return toast('Freundescode nicht gefunden');
    s.friendCodes.push(code);save();toast(rows[0].display_name+' hinzugefügt');await loadFriends()
  }catch{toast('Keine Online-Verbindung')}
}
function removeFriend(code){s.friendCodes=s.friendCodes.filter(c=>c!==code);s.friends=s.friends.filter(f=>f.code!==code);save();render()}
function copyCode(){if(!s.friendCode)return toast('Online-Code wird erstellt');navigator.clipboard?.writeText(s.friendCode);toast('Freundescode kopiert')}
function startDuel(){duel={score:0,left:20};render();const t=setInterval(()=>{if(!duel)return clearInterval(t);duel.left--;if(duel.left<=0){clearInterval(t);s.duelBest=Math.max(s.duelBest,duel.score);toast('Schicht beendet: '+duel.score+' Teile');duel=null;save();syncOnline(true)}render()},1000)}
function offline(){const sec=Math.min(8*3600,Math.max(0,(Date.now()-(s.last||Date.now()))/1000));const v=auto()*sec;if(v>1){add(v,false);toast('Offline-Ertrag '+euro(v))}s.last=Date.now();save()}
function stats(){return `<div class="grid"><div class="card stat"><div class="label">Kontostand</div><div class="value">${euro(s.money)}</div><div class="sub">Gesamt ${euro(s.lifetime)}</div></div><div class="card stat"><div class="label">Automatisch</div><div class="value">${euro(auto())}/s</div><div class="sub">×${mult().toFixed(2)} Meisterbonus</div></div></div>`}
function shop(){
  const best=[...machines].reverse().find(x=>s.m[x[0]]>0)||machines[0];
  const remain=Math.max(0,250000-s.runRevenue);
  return `${stats()}<div class="card hero"><div class="machine"><div class="chuck"></div><div><h2>${best[1]}</h2><p>Tippe, fertige Teile, investiere in Automatisierung und baue deine Fertigung zum Konzern aus.</p></div></div><button class="tap" onclick="G.tap()">TEIL FERTIGEN<br><span style="font-size:11px">+ ${euro(click())}</span></button></div><div class="section">Maschinenpark</div><div class="list">${machines.slice(1).map(x=>`<div class="card item"><div class="row"><div><div class="name">${x[4]} ${x[1]}</div><div class="desc">Stufe ${s.m[x[0]]} · ${euro(x[3]*mult())}/s je Maschine</div></div><button class="btn" ${s.money<cost(x)?'disabled':''} onclick="G.buy('${x[0]}')">${euro(cost(x))}</button></div></div>`).join('')}</div><div class="section">Meisterprestige</div><div class="card item"><div class="row"><div><div class="name">★ Meisterlauf</div><div class="desc">Aktueller Lauf: ${euro(s.runRevenue)} · ${remain?euro(remain)+' fehlen':'bereit für Prestige'} · Bonus +${Math.round((mult()-1)*100)} %</div></div><button class="btn secondary" onclick="G.prestige()">Prestige</button></div></div>`
}
function orders(){const o=s.order;return `${stats()}<div class="section">Fertigungsauftrag</div>${o?`<div class="card item"><div class="row"><div><div class="name">${o.name}</div><div class="desc">${o.mat} · ${o.q} Teile</div></div><div class="score">${euro(o.pay)}</div></div><div class="progress"><span style="width:${Math.min(100,o.done/o.q*100)}%"></span></div><div class="row"><span class="muted">${Math.floor(o.done)} / ${o.q}</span>${o.done>=o.q?'<button class="btn" onclick="G.claim()">Abrechnen</button>':'<button class="btn secondary" onclick="G.tap()">Teil fertigen</button>'}</div></div>`:`<div class="card item"><div class="desc" style="margin-bottom:10px">Keine Serie eingeplant.</div><button class="btn" onclick="G.orderNew()">Neuen Auftrag annehmen</button></div>`}<div class="section">Kennzahlen</div><div class="grid"><div class="card stat"><div class="label">Manuell</div><div class="value">${euro(click())}</div><div class="sub">pro Teil</div></div><div class="card stat"><div class="label">Teilefluss</div><div class="value">${auto().toFixed(1)}</div><div class="sub">Teile/s</div></div></div>`}
function board(){
  const me={code:s.friendCode,n:s.name,w:Math.floor(s.week),p:s.prestige,d:s.duelBest,l:Math.floor(s.lifetime),you:1};
  const all=[me,...s.friends].sort((a,b)=>(b.w||0)-(a.w||0));
  const db=[...all].sort((a,b)=>(b.d||0)-(a.d||0));
  const rows=a=>a.length?a.map((p,i)=>`<div class="leader"><b>${i+1}</b><div><div class="name">${p.n}${p.you?' · DU':''}</div><div class="muted">${p.code||''} · ${p.p||0} ★ Meister</div></div><div class="score">${num(p.w||0)}</div></div>`).join(''):'<div class="muted">Noch keine Freunde hinzugefügt.</div>';
  return `<div class="notice"><b>Online-Freundesliga aktiv.</b> Deine Werte werden automatisch synchronisiert. <button class="btn secondary mini" onclick="G.refreshFriends()">Aktualisieren</button></div><div class="section">Wochenliga KW ${s.weekKey.split('-')[1]}</div><div class="card item">${rows(all)}</div><div class="section">20-Sekunden-Schichtduell</div><div class="card duel"><div class="muted">${duel?'Noch '+duel.left+' Sekunden':'Bestwert '+s.duelBest+' Teile'}</div><div class="duelbig">${duel?duel.score:s.duelBest}</div>${duel?'<button class="duelbtn" onclick="G.tap()">TEIL FERTIG</button>':'<button class="btn" onclick="G.startDuel()">Duell starten</button>'}</div><div class="section">Duell-Ranking</div><div class="card item">${db.map((p,i)=>`<div class="leader"><b>${i+1}</b><div><div class="name">${p.n}${p.you?' · DU':''}</div><div class="muted">${p.code||''}</div></div><div class="score">${p.d||0}</div></div>`).join('')}</div>`
}
function profile(){
  const friendRows=s.friends.length?s.friends.map(f=>`<div class="leader"><span>👤</span><div><div class="name">${f.n}</div><div class="muted">${f.code} · ${num(f.w)} Wochenpunkte</div></div><button class="btn danger mini" onclick="G.removeFriend('${f.code}')">×</button></div>`).join(''):'<div class="muted" style="padding-top:8px">Noch keine Freunde verbunden.</div>';
  return `<div class="section">Werkstattprofil</div><div class="card item"><div class="name">Werkstattname</div><input id="nm" class="field" maxlength="22" value="${s.name.replaceAll('"','&quot;')}"><button class="btn" style="margin-top:8px" onclick="G.name()">Speichern</button></div><div class="section">Online-Freunde</div><div class="card item"><div class="row"><div><div class="name">Dein Freundescode</div><div class="desc">Teile nur diesen Code – nicht deinen Spielstand.</div></div><span class="online ${navigator.onLine?'ok':''}">${navigator.onLine?'ONLINE':'OFFLINE'}</span></div><div class="bigcode">${s.friendCode||'WIRD ERSTELLT'}</div><button class="btn secondary" onclick="G.copyCode()">Code kopieren</button><div class="row" style="align-items:flex-end;margin-top:10px"><input id="friendcode" class="field" maxlength="8" autocapitalize="characters" placeholder="8-stelliger Freundescode"><button class="btn" style="margin-left:8px" onclick="G.addFriend()">Hinzufügen</button></div>${friendRows}</div><div class="section">Karriere</div><div class="grid"><div class="card stat"><div class="label">Meistersterne</div><div class="value">${s.prestige}</div><div class="sub">${s.run} Läufe</div></div><div class="card stat"><div class="label">Duellbestwert</div><div class="value">${s.duelBest}</div><div class="sub">Teile / 20 s</div></div></div><div class="section">System</div><div class="card item"><button class="btn danger" onclick="G.reset()">Spielstand löschen</button></div>`
}
function render(){
  document.getElementById('root').innerHTML=`<div class="top"><div class="brand">CNC EMPIRE<small>Span zu Cash</small></div><div class="pill">★ ${s.prestige}</div></div>${tab==='shop'?shop():tab==='orders'?orders():tab==='board'?board():profile()}`;
  const n=[['shop','⚙️','Werkstatt'],['orders','📋','Aufträge'],['board','🏆','Rangliste'],['profile','👤','Profil']];
  document.getElementById('nav').innerHTML=n.map(x=>`<button class="${tab===x[0]?'on':''}" onclick="G.tab('${x[0]}')"><span>${x[1]}</span>${x[2]}</button>`).join('')
}
window.G={
  tap,buy,orderNew,claim,prestige,copyCode,addFriend,removeFriend,startDuel,
  refreshFriends:()=>loadFriends(true),
  tab:x=>{if(!duel){tab=x;render();if(x==='board'||x==='profile')loadFriends()}},
  name:()=>{s.name=document.getElementById('nm').value.trim()||'Meine Werkstatt';save();toast('Name gespeichert');render();syncOnline(true)},
  reset:()=>{if(confirm('Spielstand wirklich löschen? Dein Freundescode geht dabei ebenfalls verloren.')){localStorage.removeItem(K);localStorage.removeItem(OLDK);location.reload()}}
};
offline();render();
ensureOnline().then(()=>{render();syncOnline(true);loadFriends()});
setInterval(()=>{if(!duel){const v=auto();if(v){add(v);if(s.order)s.order.done+=Math.max(.1,auto()/8);save();render()}syncOnline()}},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)syncOnline(true)});
window.addEventListener('online',()=>{toast('Wieder online');ensureOnline().then(()=>loadFriends())});
})();
