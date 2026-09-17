(()=>{
const GAUGES=[
  {id:'caliper',level:1,name:'Messschieber',icon:'📏',cost:20000,desc:'Grundmaße und einfache Serienprüfung.'},
  {id:'micrometer',level:2,name:'Bügelmessschraube',icon:'🧭',cost:80000,desc:'Engere Durchmesser- und Passungsprüfungen.'},
  {id:'height',level:3,name:'Höhenmessgerät',icon:'📐',cost:250000,desc:'Positions-, Höhen- und Bezugsmaße.'},
  {id:'roughness',level:4,name:'Rauheitsmessgerät',icon:'〰️',cost:900000,desc:'Ra/Rz-Nachweise für anspruchsvolle Kunden.'},
  {id:'contour',level:5,name:'Konturmessgerät',icon:'📈',cost:3000000,desc:'Radien, Winkel und komplexe Konturen prüfen.'},
  {id:'cmm',level:6,name:'3D-KMG',icon:'🧊',cost:12000000,desc:'Vollständige geometrische Prüfungen und Prüfberichte.'}
];
const CERTS={
  iso9001:{name:'ISO 9001',icon:'✅',cost:50000,desc:'Basis-QM-System für dokumentierte Prozesse.'},
  iatf:{name:'IATF 16949',icon:'🚗',cost:1500000,desc:'Automotive-Serien und auditpflichtige Lieferketten.'},
  iso13485:{name:'ISO 13485',icon:'🩺',cost:4000000,desc:'Qualitätsmanagement für Medizintechnik.'},
  en9100:{name:'EN 9100',icon:'✈️',cost:12000000,desc:'Luftfahrt-Aufträge mit höchsten Nachweisanforderungen.'}
};
const CERT_BY_CUSTOMER={hydraulics:'iso9001',automotive:'iatf',medical:'iso13485',aerospace:'en9100'};
const BASE_QUALITY={hydraulics:2,automotive:2,medical:4,aerospace:5};
let hooked=false,baseOpsRender=null,baseDecorate=null,baseRecord=null,baseAccept=null,baseClaim=null;
const game=()=>window.CNC_GAME_BRIDGE||null;
const ops=()=>window.CNC_OPERATIONS||null;
const main=()=>game()?.getState?.()||null;
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(text){const e=document.createElement('div');e.className='toast';e.textContent=text;document.body.appendChild(e);setTimeout(()=>e.remove(),3000)}
function defaults(){return {version:1,gaugeLevel:0,certs:{iso9001:false,iatf:false,iso13485:false,en9100:false},inspections:0,passed:0,failed:0,qualityPoints:0,claimsSinceInspection:0,pendingInspection:null}}
function state(){
  const o=ops()?.state;if(!o)return null;
  const d=defaults(),x=o.qualitySystem&&typeof o.qualitySystem==='object'?o.qualitySystem:{};
  const certs={...d.certs,...(x.certs||{})};for(const k of Object.keys(certs))certs[k]=!!certs[k];
  o.qualitySystem={...d,...x,gaugeLevel:Math.max(0,Math.min(6,Math.floor(Number(x.gaugeLevel)||0))),certs,inspections:Math.max(0,Math.floor(Number(x.inspections)||0)),passed:Math.max(0,Math.floor(Number(x.passed)||0)),failed:Math.max(0,Math.floor(Number(x.failed)||0)),qualityPoints:Math.max(0,Math.floor(Number(x.qualityPoints)||0)),claimsSinceInspection:Math.max(0,Math.floor(Number(x.claimsSinceInspection)||0)),pendingInspection:x.pendingInspection&&typeof x.pendingInspection==='object'?x.pendingInspection:null};
  return o.qualitySystem;
}
async function persist(){game()?.save?.();await ops()?.refresh?.()}
function customerTotals(){
  const s=main()||{},stats=s.customerStats||{};let completed=0,onTime=0,complaints=0;
  for(const v of Object.values(stats)){completed+=Math.max(0,Number(v?.completed)||0);onTime+=Math.max(0,Number(v?.onTime)||0);complaints+=Math.max(0,Number(v?.complaints)||0)}
  return {completed,onTime,complaints,delivery:completed?onTime/completed:0,complaintRate:completed?complaints/completed:0};
}
function certRequirements(id){
  const q=state(),o=ops()?.state||{},s=main()||{},staff=o.staff||{},tot=customerTotals();
  const rep=s.customerRep||{};
  if(id==='iso9001')return [
    [q.gaugeLevel>=2,'Messraum Stufe 2'],[(Number(staff.quality)||0)>=1,'mind. 1 QS-Mitarbeiter'],[(Number(s.lifetime)||0)>=100000,'100.000 € Gesamtumsatz'],[tot.completed>=5,'5 Großkundenaufträge']
  ];
  if(id==='iatf')return [[q.certs.iso9001,'ISO 9001'],[q.gaugeLevel>=4,'Messraum Stufe 4'],[(Number(rep.automotive)||0)>=25,'Automotive-Ruf 25'],[tot.delivery>=.90,'Liefertreue ≥ 90 %'],[tot.completed>=10,'10 Großkundenaufträge']];
  if(id==='iso13485')return [[q.certs.iso9001,'ISO 9001'],[q.gaugeLevel>=5,'Messraum Stufe 5'],[(Number(staff.quality)||0)>=3,'3 QS-Mitarbeiter'],[(Number(rep.medical)||0)>=25,'Medizintechnik-Ruf 25'],[tot.complaintRate<=.04&&tot.completed>=10,'Reklamationen ≤ 4 %']];
  if(id==='en9100')return [[q.certs.iso9001,'ISO 9001'],[q.gaugeLevel>=6,'3D-KMG'],[(Number(staff.quality)||0)>=4,'4 QS-Mitarbeiter'],[(Number(rep.aerospace)||0)>=35,'Luftfahrt-Ruf 35'],[tot.delivery>=.95&&tot.completed>=15,'Liefertreue ≥ 95 %'],[tot.complaintRate<=.03&&tot.completed>=15,'Reklamationen ≤ 3 %']];
  return [];
}
function certReady(id){return certRequirements(id).every(x=>x[0])}
function requiredLevel(order){
  if(!order?.customerId)return 0;
  let lv=BASE_QUALITY[order.customerId]||1;
  if(order.type==='proto')lv+=1;
  if(order.type==='bulk')lv=Math.max(lv,3);
  return Math.max(1,Math.min(6,lv));
}
function auditedChance(customerId){return ({hydraulics:.12,automotive:.25,medical:.30,aerospace:.38}[customerId]||0)}
function tagOffer(offer){
  if(!offer||offer.qualityTagged||!offer.customerId)return offer;
  const lv=requiredLevel(offer),audit=Math.random()<auditedChance(offer.customerId),certReq=audit?CERT_BY_CUSTOMER[offer.customerId]:null;
  const premium=.03*lv+(audit?.10:0);
  const certName=certReq?CERTS[certReq]?.name:'';
  return {...offer,qualityTagged:true,qualityLevel:lv,qualityAudit:audit,qualityCert:certReq,qualityPremium:premium,pay:Math.max(100,Math.round((Number(offer.pay)||100)*(1+premium))),name:`📐 Q${lv}${certName?' · '+certName:''} · ${offer.name}`};
}
function offerEligibility(offer){
  const q=state();if(!offer?.qualityTagged)return {ok:true};
  if(q.gaugeLevel<(Number(offer.qualityLevel)||0))return {ok:false,msg:`Für diesen Auftrag brauchst du Messraum Stufe ${offer.qualityLevel}. Aktuell: Stufe ${q.gaugeLevel}.`};
  if(offer.qualityCert&&!q.certs[offer.qualityCert])return {ok:false,msg:`Auditpflichtiger Auftrag: ${CERTS[offer.qualityCert]?.name||'Zertifizierung'} fehlt.`};
  return {ok:true};
}
function inspectionFor(order){
  const q=state(),lv=Math.max(1,Number(order.qualityLevel)||requiredLevel(order)||1);
  const tolerances=[.10,.05,.03,.02,.01,.006],tol=tolerances[Math.min(5,lv-1)];
  const nominal=[12,20,25,30,40,50,60,80][Math.floor(Math.random()*8)];
  const severity=Math.random(),span=severity<.68?tol*.85:severity<.90?tol*1.7:tol*3.0;
  const deviation=(Math.random()*2-1)*span;
  const measured=nominal+deviation,abs=Math.abs(deviation);
  const correct=abs<=tol?'release':abs<=tol*2?'adjust':'block';
  return {order:{customerId:order.customerId,customer:order.customer,name:order.name,pay:Number(order.pay)||0,qualityLevel:lv,duration:order.duration,acceptedAt:order.acceptedAt},nominal,tolerance:tol,measured,correct,createdAt:Date.now(),gaugeLevel:q.gaugeLevel};
}
function maybeHoldQuality(order){
  if(!order?.customerId||!order.qualityTagged){baseRecord?.(order);return}
  const q=state();q.claimsSinceInspection+=1;
  const should=q.claimsSinceInspection>=3&&Number(order.qualityLevel)>=2&&!q.pendingInspection;
  if(!should){baseRecord?.(order);persist();return}
  q.claimsSinceInspection=0;q.pendingInspection=inspectionFor(order);persist();
  notify('🧪 Qualitätsprüfung erforderlich – öffne Betrieb.');
}
async function resolveInspection(action){
  const q=state(),p=q?.pendingInspection;if(!p)return;
  const correct=action===p.correct,order=p.order,s=main();
  const statsBefore=order.customerId?s?.customerStats?.[order.customerId]:null;
  const complaintsBefore=Math.max(0,Number(statsBefore?.complaints)||0),costBefore=Math.max(0,Number(statsBefore?.complaintCost)||0);
  baseRecord?.(order);
  q.inspections+=1;
  if(correct){
    q.passed+=1;q.qualityPoints+=Math.max(1,Number(order.qualityLevel)||1);
    const stats=s?.customerStats?.[order.customerId],afterComplaints=Math.max(0,Number(stats?.complaints)||0),afterCost=Math.max(0,Number(stats?.complaintCost)||0);
    if(stats&&afterComplaints>complaintsBefore){
      const refund=Math.max(0,afterCost-costBefore);stats.complaints=complaintsBefore;stats.complaintCost=costBefore;s.money=(Number(s.money)||0)+refund;s.customerRep[order.customerId]=Math.min(100,(Number(s.customerRep?.[order.customerId])||0)+3);s.lastQualityCase=null;
      notify(`✅ Prüfung hat Reklamation verhindert · ${euro(refund)} vermieden`);
    }else{
      const bonus=Math.max(250,Math.round((Number(order.pay)||0)*.02));game()?.earn?.(bonus);if(order.customerId&&s?.customerRep)s.customerRep[order.customerId]=Math.min(100,(Number(s.customerRep[order.customerId])||0)+1);notify(`✅ Prüfentscheidung richtig · Qualitätsbonus ${euro(bonus)}`);
    }
  }else{
    q.failed+=1;
    const penalty=Math.min(Math.max(0,Number(s?.money)||0),Math.max(250,Math.round((Number(order.pay)||0)*.05)));
    if(s){s.money=Math.max(0,(Number(s.money)||0)-penalty);if(order.customerId&&s.customerRep)s.customerRep[order.customerId]=Math.max(0,(Number(s.customerRep[order.customerId])||0)-2)}
    notify(`❌ Falsche Prüfentscheidung · ${euro(penalty)} Qualitätskosten`);
  }
  q.pendingInspection=null;game()?.save?.();await persist();
}
async function buyGauge(id){
  const q=state(),g=GAUGES.find(x=>x.id===id);if(!q||!g)return;
  if(q.gaugeLevel>=g.level)return;
  if(g.level!==q.gaugeLevel+1)return alert('Prüfmittel werden der Reihe nach aufgebaut.');
  if(!game()?.spend?.(g.cost))return alert('Nicht genug Kapital für dieses Prüfmittel.');
  q.gaugeLevel=g.level;await persist();notify(`${g.icon} ${g.name} im Messraum installiert`);
}
async function auditCert(id){
  const q=state(),c=CERTS[id];if(!q||!c||q.certs[id])return;
  if(!certReady(id))return alert('Die Voraussetzungen für dieses Audit sind noch nicht erfüllt.');
  if(!game()?.spend?.(c.cost))return alert('Nicht genug Kapital für das Zertifizierungsaudit.');
  q.certs[id]=true;q.qualityPoints+=10;await persist();notify(`🏅 ${c.name} erfolgreich zertifiziert`);
}
function renderInspection(){
  const p=state()?.pendingInspection;if(!p)return '';
  const diff=p.measured-p.nominal,sign=diff>=0?'+':'';
  return `<div class="section">🧪 Qualitätsprüfung</div><div class="card item"><div class="name">${esc(p.order.customer||'Kunde')} · ${esc(p.order.name||'Fertigungsauftrag')}</div><div class="desc">Prüfmerkmal Ø ${p.nominal.toFixed(3)} mm · Toleranz ±${p.tolerance.toFixed(3)} mm</div><div class="grid" style="margin-top:8px"><div class="card stat"><div class="label">Messwert</div><div class="value">${p.measured.toFixed(3)} mm</div><div class="sub">Abweichung ${sign}${diff.toFixed(3)} mm</div></div><div class="card stat"><div class="label">Entscheidung</div><div class="value">Q${p.order.qualityLevel}</div><div class="sub">Freigeben, nachstellen oder sperren</div></div></div><div class="opsActions" style="margin-top:8px"><button class="btn secondary" onclick="CNC_QUALITY.resolveInspection('release')">✅ Freigeben</button><button class="btn secondary" onclick="CNC_QUALITY.resolveInspection('adjust')">🔧 Nachstellen</button><button class="btn danger" onclick="CNC_QUALITY.resolveInspection('block')">⛔ Charge sperren</button></div></div>`;
}
function renderGauge(){
  const q=state(),current=GAUGES.find(x=>x.level===q.gaugeLevel),cards=GAUGES.map(g=>{const owned=q.gaugeLevel>=g.level,next=g.level===q.gaugeLevel+1;return `<div class="card item"><div class="row"><div><div class="name">${owned?'✅':g.icon} ${esc(g.name)}</div><div class="desc">${esc(g.desc)}</div></div><div class="score">Q${g.level}</div></div><button class="btn ${owned?'secondary':''}" ${owned||!next?'disabled':''} onclick="CNC_QUALITY.buyGauge('${g.id}')">${owned?'Vorhanden':next?'Kaufen · '+euro(g.cost):'Vorstufe fehlt'}</button></div>`}).join('');
  return `<div class="section">📏 Messraum & Prüfmittel</div><div class="notice"><b>Messraum Stufe ${q.gaugeLevel}/6.</b> ${current?esc(current.name):'Noch keine professionelle Messtechnik.'} Höhere Stufen schalten anspruchsvollere Qualitätsaufträge frei.</div><div class="list">${cards}</div>`;
}
function renderCerts(){
  const q=state(),cards=Object.entries(CERTS).map(([id,c])=>{const owned=q.certs[id],req=certRequirements(id),ready=req.every(x=>x[0]);const rows=req.map(([ok,t])=>`${ok?'✅':'⬜'} ${esc(t)}`).join(' · ');return `<div class="card item"><div class="row"><div><div class="name">${c.icon} ${esc(c.name)}</div><div class="desc">${esc(c.desc)}</div></div><div class="score">${owned?'AKTIV':ready?'BEREIT':'LOCK'}</div></div><div class="desc" style="margin-top:6px">${rows}</div><button class="btn ${owned?'secondary':''}" ${owned||!ready?'disabled':''} onclick="CNC_QUALITY.auditCert('${id}')">${owned?'Zertifiziert':'Audit · '+euro(c.cost)}</button></div>`}).join('');
  return `<div class="section">🏅 Zertifizierungen</div><div class="notice">Zertifikate werden nicht einfach freigekauft: Messraum, QS, Ruf, Liefertreue und Reklamationsquote müssen zum Audit passen. Sie schalten auditpflichtige Premiumaufträge frei.</div><div class="list">${cards}</div>`;
}
function renderSummary(){const q=state();return `<div class="section">🎯 Qualitätsstatus</div><div class="grid"><div class="card stat"><div class="label">Prüfungen</div><div class="value">${num(q.inspections)}</div><div class="sub">${num(q.passed)} richtig · ${num(q.failed)} falsch</div></div><div class="card stat"><div class="label">Qualitätspunkte</div><div class="value">${num(q.qualityPoints)}</div><div class="sub">Messraum Q${q.gaugeLevel}</div></div></div>`}
function render(){return `${renderInspection()}${renderGauge()}${renderCerts()}${renderSummary()}`}
function patch(){
  if(hooked||!ops()||!window.CNC_CUSTOMERS||!window.G)return false;
  state();
  baseOpsRender=ops().render.bind(ops());ops().render=()=>baseOpsRender()+`<div id="qualitySystems">${render()}</div>`;
  baseDecorate=window.CNC_CUSTOMERS.decorateOffer.bind(window.CNC_CUSTOMERS);window.CNC_CUSTOMERS.decorateOffer=offer=>tagOffer(baseDecorate(offer));
  baseRecord=window.CNC_CUSTOMERS.recordOrderClaim.bind(window.CNC_CUSTOMERS);window.CNC_CUSTOMERS.recordOrderClaim=order=>maybeHoldQuality(order);
  baseAccept=window.G.acceptOffer.bind(window.G);window.G.acceptOffer=i=>{const o=main()?.offers?.[i];const e=offerEligibility(o);if(!e.ok){alert(e.msg);window.G.tab?.('operations');return}baseAccept(i)};
  baseClaim=window.G.claim.bind(window.G);window.G.claim=()=>{if(state()?.pendingInspection){alert('Erst die offene Qualitätsprüfung im Bereich Betrieb abschließen.');window.G.tab?.('operations');return}baseClaim()};
  const s=main();if(Array.isArray(s?.offers)){s.offers=s.offers.map(tagOffer);game()?.save?.()}
  window.CNC_QUALITY={state,render,buyGauge,auditCert,resolveInspection,offerEligibility,requiredLevel,certReady};
  hooked=true;game()?.render?.();return true;
}
async function boot(){for(let i=0;i<120&&!patch();i++)await new Promise(r=>setTimeout(r,100));if(!hooked)console.warn('CNC quality systems could not attach')}
boot();
})();
