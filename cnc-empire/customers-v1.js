const CUSTOMERS={
  automotive:{name:'Automotive',icon:'🚗',materials:['42CrMo4','C55E','Al 6082','1.4301'],desc:'Seriengeschäft mit hohen Stückzahlen.',qualityFactor:.90},
  medical:{name:'Medizintechnik',icon:'🩺',materials:['1.4404','1.4122','POM-C','1.4305'],desc:'Präzision und zuverlässige Liefertermine.',qualityFactor:1.15},
  hydraulics:{name:'Hydraulik',icon:'🔩',materials:['42CrMo4','1.4404','C55E','1.4305'],desc:'Robuste Serien für Ventile, Hülsen und Wellen.',qualityFactor:1.00},
  aerospace:{name:'Luftfahrt',icon:'✈️',materials:['Al 7075','1.4404','1.4122','Al 6082'],desc:'Kleine bis mittlere Serien mit hohen Anforderungen.',qualityFactor:1.20}
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
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
function notify(text){const e=document.createElement('div');e.className='toast';e.textContent=text;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)}
function ensureState(){
  const s=state();if(!s)return null;
  if(!s.customerRep||typeof s.customerRep!=='object')s.customerRep={};
  if(!s.customerStats||typeof s.customerStats!=='object')s.customerStats={};
  for(const id of Object.keys(CUSTOMERS)){
    s.customerRep[id]=Math.max(0,Math.min(100,Number(s.customerRep[id])||0));
    const x=s.customerStats[id]&&typeof s.customerStats[id]==='object'?s.customerStats[id]:{};
    s.customerStats[id]={
      completed:Math.max(0,Math.floor(Number(x.completed)||0)),
      onTime:Math.max(0,Math.floor(Number(x.onTime)||0)),
      complaints:Math.max(0,Math.floor(Number(x.complaints)||0)),
      complaintCost:Math.max(0,Number(x.complaintCost)||0)
    };
  }
  if(!s.lastQualityCase||typeof s.lastQualityCase!=='object')s.lastQualityCase=null;
  return s;
}
function unlocked(){return Math.max(0,Number(state()?.lifetime)||0)>=UNLOCK}
function tier(rep){return TIERS.find(x=>rep>=x.rep)||TIERS[TIERS.length-1]}
function chooseCustomer(material){
  const ids=Object.keys(CUSTOMERS).filter(id=>CUSTOMERS[id].materials.includes(material));
  const pool=ids.length?ids:Object.keys(CUSTOMERS);
  return pool[Math.floor(Math.random()*pool.length)];
}
function qualitySnapshot(){
  const o=window.CNC_OPERATIONS?.state||{};
  const staff=o.staff||{},up=o.upgrades||{},m=o.maintenance||{};
  const yieldRate=Math.min(.995,.955+(Number(staff.quality)||0)*.005+(Number(staff.master)||0)*.003+(Number(up.probe)||0)*.002);
  return {yieldRate,tool:clamp(m.tool??100,0,100),coolant:clamp(m.coolant??100,0,100),health:clamp(m.health??100,0,100)};
}
function complaintRisk(customerId){
  const q=qualitySnapshot();
  let risk=.008+Math.max(0,.985-q.yieldRate)*.45;
  if(q.tool<60)risk+=(60-q.tool)/60*.035;
  if(q.coolant<40)risk+=(40-q.coolant)/40*.030;
  if(q.health<60)risk+=(60-q.health)/60*.025;
  risk*=CUSTOMERS[customerId]?.qualityFactor||1;
  return clamp(risk,.005,.12);
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
  const id=order.customerId,c=CUSTOMERS[id],stats=s.customerStats[id];
  const accepted=Math.max(0,Number(order.acceptedAt)||0),duration=Math.max(30,Number(order.duration)||30);
  const targetMs=duration*1500;
  const onTime=accepted>0&&(Date.now()-accepted)<=targetMs;
  const risk=complaintRisk(id),complaint=Math.random()<risk;
  stats.completed+=1;if(onTime)stats.onTime+=1;
  if(complaint){
    const requested=Math.max(250,Math.round((Number(order.pay)||0)*(.08+Math.random()*.07)));
    const charged=Math.min(requested,Math.max(0,Number(s.money)||0));
    s.money=Math.max(0,(Number(s.money)||0)-charged);
    stats.complaints+=1;stats.complaintCost+=charged;
    s.customerRep[id]=Math.max(0,(s.customerRep[id]||0)-2);
    s.lastQualityCase={customerId:id,customer:c.name,cost:charged,at:Date.now(),order:String(order.name||'Fertigungsauftrag').slice(0,80)};
    notify(`⚠️ Reklamation ${c.name}: ${euro(charged)} Kosten · -2 Ruf`);
  }else{
    s.customerRep[id]=Math.min(100,(s.customerRep[id]||0)+(onTime?3:1));
  }
  game()?.save?.();
}
function card(id){
  const s=ensureState(),c=CUSTOMERS[id],rep=s?.customerRep?.[id]||0,t=tier(rep),stats=s?.customerStats?.[id]||{completed:0,onTime:0,complaints:0,complaintCost:0};
  const next=[10,25,50,80,100].find(x=>x>rep)||100;
  const width=Math.min(100,rep),risk=complaintRisk(id)*100;
  return `<div class="card item"><div class="row"><div><div class="name">${c.icon} ${esc(c.name)} · ${esc(t.name)}</div><div class="desc">${esc(c.desc)}</div></div><div class="score">${rep}/100</div></div><div class="progress"><span style="width:${width}%"></span></div><div class="desc">${stats.completed} Aufträge · ${stats.onTime} pünktlich · ${stats.complaints} Reklamationen · Reklamationskosten ${euro(stats.complaintCost)}</div><div class="desc">Aktuelles Reklamationsrisiko ca. ${risk.toFixed(1)} % · Preisaufschlag +${Math.round(t.premium*100)} % · Seriengröße ×${t.qty.toFixed(2)}${rep<100?` · nächste Stufe bei ${next} Ruf`:''}</div></div>`;
}
function render(){
  const life=Math.max(0,Number(state()?.lifetime)||0);
  if(!unlocked())return `<div class="section">🤝 Großkunden & Ruf</div><div class="card item"><div class="name">Wird bei 25.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${euro(Math.max(0,UNLOCK-life))} bis Automotive, Medizintechnik, Hydraulik und Luftfahrt.</div></div>`;
  const s=ensureState();
  const last=s?.lastQualityCase?`<div class="notice"><b>Letzter Qualitätsfall:</b> ${esc(s.lastQualityCase.customer||'Kunde')} · ${euro(s.lastQualityCase.cost||0)} Kosten.</div>`:'';
  return `<div class="section">🤝 Großkunden & Ruf</div><div class="notice"><b>Lieferantenstatus & Qualität:</b> Pünktliche Aufträge erhöhen den Ruf. QS, Messtaster und guter Maschinenzustand senken Reklamationen. Schlechte Werkzeuge, KSS oder Maschinenzustand erhöhen das Risiko. Eine Reklamation kostet 8–15 % des Auftragswerts und 2 Rufpunkte.</div>${last}<div class="list">${Object.keys(CUSTOMERS).map(card).join('')}</div>`;
}
function attachPanel(){
  const ops=document.getElementById('operationsSystems');if(!ops||document.getElementById('customerReputationPanel'))return;
  const panel=document.createElement('div');panel.id='customerReputationPanel';panel.innerHTML=render();ops.insertAdjacentElement('afterend',panel);
}
const observer=new MutationObserver(()=>attachPanel());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('DOMContentLoaded',attachPanel);
window.CNC_CUSTOMERS={decorateOffer,recordOrderClaim,render,unlocked,complaintRisk,qualitySnapshot};
export {decorateOffer,recordOrderClaim,render};
