const CUSTOMERS={
  automotive:{name:'Automotive',icon:'🚗',materials:['42CrMo4','C55E','Al 6082','1.4301'],desc:'Seriengeschäft mit hohen Stückzahlen.'},
  medical:{name:'Medizintechnik',icon:'🩺',materials:['1.4404','1.4122','POM-C','1.4305'],desc:'Präzision und zuverlässige Liefertermine.'},
  hydraulics:{name:'Hydraulik',icon:'🔩',materials:['42CrMo4','1.4404','C55E','1.4305'],desc:'Robuste Serien für Ventile, Hülsen und Wellen.'},
  aerospace:{name:'Luftfahrt',icon:'✈️',materials:['Al 7075','1.4404','1.4122','Al 6082'],desc:'Kleine bis mittlere Serien mit hohen Anforderungen.'}
};
const TIERS=[
  {rep:80,name:'Rahmenvertrag',premium:.06,qty:1.15},
  {rep:50,name:'A-Lieferant',premium:.04,qty:1.10},
  {rep:25,name:'Serienlieferant',premium:.02,qty:1.06},
  {rep:10,name:'Freigegebener Lieferant',premium:.01,qty:1.03},
  {rep:0,name:'Neukunde',premium:0,qty:1}
];
const UNLOCK=25000;
const game=()=>window.CNC_GAME_BRIDGE||null;
const state=()=>game()?.getState?.()||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
function ensureState(){
  const s=state();if(!s)return null;
  if(!s.customerRep||typeof s.customerRep!=='object')s.customerRep={};
  if(!s.customerStats||typeof s.customerStats!=='object')s.customerStats={};
  for(const id of Object.keys(CUSTOMERS)){
    s.customerRep[id]=Math.max(0,Math.min(100,Number(s.customerRep[id])||0));
    const x=s.customerStats[id]&&typeof s.customerStats[id]==='object'?s.customerStats[id]:{};
    s.customerStats[id]={completed:Math.max(0,Math.floor(Number(x.completed)||0)),onTime:Math.max(0,Math.floor(Number(x.onTime)||0))};
  }
  return s;
}
function unlocked(){return Math.max(0,Number(state()?.lifetime)||0)>=UNLOCK}
function tier(rep){return TIERS.find(x=>rep>=x.rep)||TIERS[TIERS.length-1]}
function chooseCustomer(material){
  const ids=Object.keys(CUSTOMERS).filter(id=>CUSTOMERS[id].materials.includes(material));
  const pool=ids.length?ids:Object.keys(CUSTOMERS);
  return pool[Math.floor(Math.random()*pool.length)];
}
function decorateOffer(offer){
  if(!offer||!unlocked())return offer;
  const s=ensureState();if(!s)return offer;
  const customerId=chooseCustomer(offer.mat),c=CUSTOMERS[customerId],rep=s.customerRep[customerId]||0,t=tier(rep);
  const oldQ=Math.max(1,Number(offer.q)||1),newQ=Math.max(oldQ,Math.round(oldQ*t.qty));
  const quantityFactor=newQ/oldQ;
  return {...offer,name:`${c.icon} ${c.name} · ${offer.name}`,customerId,customer:c.name,customerIcon:c.icon,customerTier:t.name,customerRep:rep,q:newQ,pay:Math.max(100,Math.round((Number(offer.pay)||100)*quantityFactor*(1+t.premium)))};
}
function recordOrderClaim(order){
  if(!order?.customerId||!CUSTOMERS[order.customerId])return;
  const s=ensureState();if(!s)return;
  const id=order.customerId,stats=s.customerStats[id];
  const accepted=Math.max(0,Number(order.acceptedAt)||0),duration=Math.max(30,Number(order.duration)||30);
  const targetMs=duration*1500;
  const onTime=accepted>0&&(Date.now()-accepted)<=targetMs;
  stats.completed+=1;if(onTime)stats.onTime+=1;
  s.customerRep[id]=Math.min(100,(s.customerRep[id]||0)+(onTime?3:1));
  game()?.save?.();
}
function card(id){
  const s=ensureState(),c=CUSTOMERS[id],rep=s?.customerRep?.[id]||0,t=tier(rep),stats=s?.customerStats?.[id]||{completed:0,onTime:0};
  const next=[10,25,50,80,100].find(x=>x>rep)||100;
  const width=Math.min(100,rep);
  return `<div class="card item"><div class="row"><div><div class="name">${c.icon} ${esc(c.name)} · ${esc(t.name)}</div><div class="desc">${esc(c.desc)}</div></div><div class="score">${rep}/100</div></div><div class="progress"><span style="width:${width}%"></span></div><div class="desc">${stats.completed} Aufträge · ${stats.onTime} pünktlich · Preisaufschlag +${Math.round(t.premium*100)} % · Seriengröße ×${t.qty.toFixed(2)}${rep<100?` · nächste Stufe bei ${next} Ruf`:''}</div></div>`;
}
function render(){
  const life=Math.max(0,Number(state()?.lifetime)||0);
  if(!unlocked())return `<div class="section">🤝 Großkunden & Ruf</div><div class="card item"><div class="name">Wird bei 25.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${euro(Math.max(0,UNLOCK-life))} bis Automotive, Medizintechnik, Hydraulik und Luftfahrt.</div></div>`;
  ensureState();
  return `<div class="section">🤝 Großkunden & Ruf</div><div class="notice"><b>Lieferantenstatus:</b> Pünktlich abgeschlossene Kundenaufträge geben mehr Ruf. Höherer Ruf bringt vor allem größere Serien; der maximale Preisaufschlag bleibt bei +6 %.</div><div class="list">${Object.keys(CUSTOMERS).map(card).join('')}</div>`;
}
function attachPanel(){
  const ops=document.getElementById('operationsSystems');if(!ops||document.getElementById('customerReputationPanel'))return;
  const panel=document.createElement('div');panel.id='customerReputationPanel';panel.innerHTML=render();ops.insertAdjacentElement('afterend',panel);
}
const observer=new MutationObserver(()=>attachPanel());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('DOMContentLoaded',attachPanel);
window.CNC_CUSTOMERS={decorateOffer,recordOrderClaim,render,unlocked};
export {decorateOffer,recordOrderClaim,render};
