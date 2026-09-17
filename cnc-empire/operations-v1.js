let sb=null,user=null,readState=()=>null,tickTimer=null,syncTimer=null,dirty=false,lastSaved='';

const MATERIALS={
  '1.4404':8.0,'42CrMo4':6.5,'Al 7075':7.0,'1.4301':7.2,'POM-C':3.0,'1.4122':8.5,
  '1.4305':7.5,'C55E':5.5,'Al 6082':4.8,'1.4021':6.2,'PE-HD':2.4,'PET':2.7
};
const ROLES={
  operator:{name:'Maschinenbediener',icon:'👷',desc:'+1,5 % Maschinenleistung je Mitarbeiter · beschleunigt Sägen & Versand',base:6000,rate:1.85,max:10},
  setter:{name:'Einrichter',icon:'🔧',desc:'+2,5 % Maschinenleistung je Mitarbeiter · beschleunigt Drehen',base:25000,rate:1.90,max:8},
  programmer:{name:'CNC-Programmierer',icon:'💻',desc:'+3 % Maschinenleistung je Mitarbeiter · optimiert Drehprozesse',base:100000,rate:1.95,max:6},
  quality:{name:'Qualitätssicherung',icon:'📏',desc:'verbessert Gutteilquote und Prüfgeschwindigkeit',base:60000,rate:1.85,max:8},
  master:{name:'Meister',icon:'⭐',desc:'+4 % Maschinenleistung je Meister · stärkt alle Bereiche',base:400000,rate:2.00,max:4}
};
const SHIFTS={
  early:{name:'Frühschicht',icon:'🌅',mult:1,need:0,staff:0,desc:'Solider Einschichtbetrieb.'},
  late:{name:'Früh + Spät',icon:'🌆',mult:1.08,need:50000,staff:2,desc:'+8 % Maschinenleistung. Ab 50.000 € Gesamtumsatz und 2 Mitarbeitern.'},
  night:{name:'3-Schicht',icon:'🌙',mult:1.16,need:750000,staff:6,desc:'+16 % Maschinenleistung. Ab 750.000 € Gesamtumsatz und 6 Mitarbeitern.'}
};
const UPGRADES={
  highPressure:{name:'Hochdruck-KSS',icon:'💧',desc:'-12 % Werkzeugverschleiß je Stufe · +3 % Drehleistung in der Kette',base:40000,rate:3.00,max:3},
  probe:{name:'Messtaster',icon:'🎯',desc:'+0,2 % Gutteilquote und +3 % Prüfleistung je Stufe',base:90000,rate:3.00,max:3},
  toolMeasure:{name:'Werkzeugvermessung',icon:'📐',desc:'-15 % Störungsrisiko und -8 % Maschinenverschleiß je Stufe',base:180000,rate:3.00,max:3},
  chuck:{name:'Optimierte Spanntechnik',icon:'🗜️',desc:'+4 % Drehleistung in der Produktionskette je Stufe',base:400000,rate:3.00,max:3},
  barfeed:{name:'Stangenlader-Optimierung',icon:'🔩',desc:'+4 % Sägen und Versand je Stufe',base:700000,rate:3.00,max:3}
};
const INCIDENTS=['Werkzeugbruch','KSS-Druck zu niedrig','Spindelüberlast','Stangenlader-Störung','Messtasterfehler'];

const defaults=()=>({
  version:4,
  staff:{operator:0,setter:0,programmer:0,quality:0,master:0},
  upgrades:{highPressure:0,probe:0,toolMeasure:0,chuck:0,barfeed:0},
  shift:'early',
  material:'1.4404',
  inventory:{raw:0,sawn:0,turned:0,checked:0},
  totalShipped:0,
  scrap:0,
  chainRevenue:0,
  maintenance:{tool:100,coolant:100,health:100,downUntil:0,incident:'',failures:0},
  lastTick:Date.now()
});
let S=defaults();

const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Math.max(0,Number(n)||0));
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,Number(n)||0));

function normalize(raw){
  const d=defaults(),x=raw&&typeof raw==='object'?raw:{};
  const staff={...d.staff,...(x.staff||{})};
  for(const k of Object.keys(staff))staff[k]=Math.max(0,Math.floor(Number(staff[k])||0));
  const upgrades={...d.upgrades,...(x.upgrades||{})};
  for(const [id,u] of Object.entries(UPGRADES))upgrades[id]=Math.max(0,Math.min(u.max,Math.floor(Number(upgrades[id])||0)));
  const inv={...d.inventory,...(x.inventory||{})};
  for(const k of Object.keys(inv))inv[k]=Math.max(0,Number(inv[k])||0);
  const m={...d.maintenance,...(x.maintenance||{})};
  m.tool=clamp(m.tool);m.coolant=clamp(m.coolant);m.health=clamp(m.health);
  m.downUntil=Math.max(0,Number(m.downUntil)||0);m.incident=String(m.incident||'').slice(0,60);m.failures=Math.max(0,Math.floor(Number(m.failures)||0));
  const material=MATERIALS[x.material]?x.material:d.material;
  const shift=SHIFTS[x.shift]?x.shift:'early';
  return {...d,...x,staff,upgrades,inventory:inv,maintenance:m,material,shift,lastTick:Number(x.lastTick)||Date.now(),totalShipped:Math.max(0,Number(x.totalShipped)||0),scrap:Math.max(0,Number(x.scrap)||0),chainRevenue:Math.max(0,Number(x.chainRevenue)||0)};
}
function game(){return window.CNC_GAME_BRIDGE||null}
function totalStaff(){return Object.values(S.staff).reduce((a,b)=>a+(Number(b)||0),0)}
function lifetime(){return Math.max(0,Number(readState()?.lifetime)||0)}
function runRevenue(){return Math.max(0,Number(readState()?.runRevenue)||0)}
function chainUnlocked(){return lifetime()>=5000}
function maintenanceUnlocked(){return lifetime()>=15000}
function equipmentUnlocked(){return lifetime()>=50000}
function shiftUnlocked(id){const x=SHIFTS[id];return !!x&&lifetime()>=x.need&&totalStaff()>=x.staff}
function isDown(){return maintenanceUnlocked()&&Number(S.maintenance.downUntil)>Date.now()}
function maintenanceMultiplier(){
  if(!maintenanceUnlocked())return 1;
  if(isDown())return 1e-9;
  const m=S.maintenance;
  const tool=m.tool>=60?1:.75+(m.tool/60)*.25;
  const coolant=m.coolant>=40?1:.85+(m.coolant/40)*.15;
  const health=m.health>=50?1:.80+(m.health/50)*.20;
  return Math.max(.5,Math.min(1,tool*coolant*health));
}
function productionMultiplier(){
  const st=S.staff;
  const staffMult=1+st.operator*.015+st.setter*.025+st.programmer*.03+st.master*.04;
  const shift=shiftUnlocked(S.shift)?SHIFTS[S.shift]:SHIFTS.early;
  return Math.min(2.0,staffMult*shift.mult)*maintenanceMultiplier();
}
function qualityYield(){return Math.min(.995,.955+S.staff.quality*.005+S.staff.master*.003+S.upgrades.probe*.002)}
function hireCost(id){const r=ROLES[id],lv=S.staff[id]||0;return r?Math.round(r.base*Math.pow(r.rate,lv)):Infinity}
function upgradeCost(id){const u=UPGRADES[id],lv=S.upgrades[id]||0;return u?Math.round(u.base*Math.pow(u.rate,lv)):Infinity}
function marketFactor(material){return Number(window.CNC_ONLINE?.marketMultiplier?.(material))||1}
function rawUnitCost(material=S.material){return (MATERIALS[material]||6)*marketFactor(material)}
function saleUnitValue(material=S.material){return rawUnitCost(material)*1.25}
function maintenanceCost(type){
  const scale=1+Math.min(30,Math.sqrt(runRevenue()/1000000));
  const base={tool:1500,coolant:1000,service:7500,repair:4000}[type]||1000;
  return Math.round(base*scale);
}
function stageRates(){
  if(isDown())return {saw:0,turn:0,inspect:0,ship:0};
  const machineRate=Math.max(.125,Number(game()?.partRate?.())||.125);
  const base=(machineRate/Math.max(.5,productionMultiplier()))*.25;
  const flowTune=1+S.upgrades.barfeed*.04;
  const turnTune=1+S.upgrades.chuck*.04+S.upgrades.highPressure*.03;
  const inspectTune=1+S.upgrades.probe*.03;
  return {
    saw:base*(.55+S.staff.operator*.055+S.staff.master*.025)*flowTune,
    turn:base*(.45+S.staff.setter*.07+S.staff.programmer*.055+S.staff.master*.03)*turnTune,
    inspect:base*(.35+S.staff.quality*.075+S.staff.master*.04)*inspectTune,
    ship:base*(.65+S.staff.operator*.035+S.staff.master*.025)*flowTune
  };
}
function customerKpis(){
  const stats=readState()?.customerStats||{};let completed=0,onTime=0,complaints=0;
  for(const x of Object.values(stats)){completed+=Math.max(0,Number(x?.completed)||0);onTime+=Math.max(0,Number(x?.onTime)||0);complaints+=Math.max(0,Number(x?.complaints)||0)}
  return {completed,onTime,complaints,deliveryRate:completed?onTime/completed:null,complaintRate:completed?complaints/completed:null};
}
function bottleneckData(){
  if(!chainUnlocked())return {id:'locked',name:'Noch gesperrt',rate:0,action:'Produktionskette bei 5.000 € Gesamtumsatz freischalten.'};
  if(isDown())return {id:'maintenance',name:'Maschinenstillstand',rate:0,action:'Störung beheben oder Wartungszustand wiederherstellen.'};
  const r=stageRates();
  const labels={saw:'Sägen',turn:'Drehen',inspect:'Prüfen',ship:'Versand'};
  const actions={
    saw:'Maschinenbediener einstellen oder Stangenlader-Optimierung ausbauen.',
    turn:'Einrichter/CNC-Programmierer verstärken oder Spanntechnik/Hochdruck-KSS ausbauen.',
    inspect:'Qualitätssicherung verstärken oder Messtaster ausbauen.',
    ship:'Maschinenbediener verstärken oder Stangenlader-Optimierung ausbauen.'
  };
  const [id,rate]=Object.entries(r).sort((a,b)=>a[1]-b[1])[0]||['saw',0];
  return {id,name:labels[id]||id,rate,action:actions[id]||'Kapazität dieses Prozessschritts erhöhen.',rates:r};
}
function dashboardData(){
  const partRate=Math.max(.125,Number(game()?.partRate?.())||.125);
  const customers=customerKpis(),bottleneck=bottleneckData();
  return {
    autoPerSecond:partRate*8,
    partRate,
    productionMultiplier:productionMultiplier(),
    availability:maintenanceMultiplier(),
    qualityYield:qualityYield(),
    customers,
    bottleneck,
    staff:totalStaff(),
    shift:SHIFTS[S.shift]?.name||'Frühschicht'
  };
}
function markDirty(){dirty=true}
function rerender(){if(document.getElementById('operationsSystems'))game()?.render?.()}

async function persist(force=false){
  if(!user||(!dirty&&!force))return true;
  const raw=JSON.stringify(S);if(!force&&raw===lastSaved){dirty=false;return true}
  const {error}=await sb.from('player_operations_s2').upsert({user_id:user.id,state:S,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error){console.warn('CNC operations save',error);return false}
  lastSaved=raw;dirty=false;return true;
}
async function load(){
  const {data,error}=await sb.from('player_operations_s2').select('state,updated_at').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  S=normalize(data?.state);
  if(!data){dirty=true;await persist(true)}else lastSaved=JSON.stringify(S);
  if(!shiftUnlocked(S.shift))S.shift='early';
  return S;
}
async function refresh(){await persist(true);await load();rerender()}

async function hire(id){
  const r=ROLES[id];if(!r)return;
  const lv=S.staff[id]||0;if(lv>=r.max)return alert('Diese Position ist bereits voll besetzt.');
  const cost=hireCost(id);const g=game();if(!g)return alert('Spiel wird noch geladen.');
  if(!g.spend(cost))return alert('Nicht genug Kapital für diese Einstellung.');
  S.staff[id]=lv+1;markDirty();await persist(true);rerender();
}
async function buyUpgrade(id){
  const u=UPGRADES[id];if(!u||!equipmentUnlocked())return;
  const lv=S.upgrades[id]||0;if(lv>=u.max)return alert('Diese Ausstattung ist bereits maximal ausgebaut.');
  const cost=upgradeCost(id),g=game();if(!g)return alert('Spiel wird noch geladen.');
  if(!g.spend(cost))return alert('Nicht genug Kapital für diese Ausstattung.');
  S.upgrades[id]=lv+1;markDirty();await persist(true);rerender();
}
async function setShift(id){
  if(!SHIFTS[id])return;if(!shiftUnlocked(id))return alert('Diese Schicht ist noch nicht freigeschaltet.');
  S.shift=id;markDirty();await persist(true);rerender();
}
async function setMaterial(material){
  if(!MATERIALS[material])return;
  const inv=S.inventory;if(inv.raw+inv.sawn+inv.turned+inv.checked>0)return alert('Erst die laufende Materialcharge fertig produzieren.');
  S.material=material;markDirty();await persist(true);rerender();
}
async function buyMaterial(batch=250){
  if(!chainUnlocked())return alert('Produktionskette wird bei 5.000 € Gesamtumsatz freigeschaltet.');
  const n=Math.max(1,Math.floor(Number(batch)||250));const cost=Math.round(rawUnitCost()*n);const g=game();
  if(!g)return alert('Spiel wird noch geladen.');if(!g.spend(cost))return alert('Nicht genug Kapital für die Materialcharge.');
  S.inventory.raw+=n;markDirty();await persist(true);rerender();
}
async function maintain(type){
  if(!maintenanceUnlocked())return;
  const g=game();if(!g)return alert('Spiel wird noch geladen.');
  const cost=maintenanceCost(type);if(!g.spend(cost))return alert('Nicht genug Kapital für diese Wartung.');
  const m=S.maintenance;
  if(type==='tool'){m.tool=100;m.health=clamp(m.health+2)}
  else if(type==='coolant'){m.coolant=100;m.health=clamp(m.health+1)}
  else if(type==='service'){m.health=100;m.tool=clamp(m.tool+15);m.coolant=clamp(m.coolant+15)}
  else if(type==='repair'){m.downUntil=0;m.incident='';m.health=clamp(m.health+12);m.tool=clamp(m.tool+8);m.coolant=clamp(m.coolant+8)}
  markDirty();await persist(true);rerender();
}

function move(from,to,capacity){
  const q=Math.min(S.inventory[from]||0,Math.max(0,capacity));if(q<=0)return 0;
  S.inventory[from]-=q;if(to)S.inventory[to]=(S.inventory[to]||0)+q;return q;
}
function wearTick(dt){
  if(!maintenanceUnlocked()||dt<=0)return;
  const m=S.maintenance;
  if(m.downUntil&&m.downUntil<=Date.now()){m.downUntil=0;m.incident='';markDirty()}
  if(isDown())return;
  const active=Math.max(0,Number(game()?.partRate?.())||0)>.125;
  if(!active)return;
  const shiftWear=shiftUnlocked(S.shift)?SHIFTS[S.shift].mult:1;
  const masterCare=Math.max(.65,1-S.staff.master*.05);
  const toolCare=Math.max(.55,1-S.upgrades.highPressure*.12);
  const machineCare=Math.max(.65,1-S.upgrades.toolMeasure*.08);
  const riskCare=Math.max(.50,1-S.upgrades.toolMeasure*.15);
  const capped=Math.min(dt,600);
  m.tool=clamp(m.tool-capped*.00080*shiftWear*masterCare*toolCare);
  m.coolant=clamp(m.coolant-capped*.00045*shiftWear*masterCare);
  m.health=clamp(m.health-capped*.00012*shiftWear*masterCare*machineCare);
  const riskPerHour=(.002+(m.tool<25?.018:0)+(m.coolant<20?.018:0)+(m.health<50?.012:0))*riskCare;
  const probability=1-Math.exp(-(riskPerHour/3600)*capped);
  if(Math.random()<probability){
    m.incident=INCIDENTS[Math.floor(Math.random()*INCIDENTS.length)];
    m.downUntil=Date.now()+180000;
    m.failures+=1;
    markDirty();
  }
}
function processTick(){
  const now=Date.now();let dt=Math.max(0,(now-S.lastTick)/1000);S.lastTick=now;
  wearTick(dt);
  if(!chainUnlocked()||!game()){if(dt>5)markDirty();return}
  dt=Math.min(dt,600);if(dt<=0)return;
  const r=stageRates();let changed=false;
  const shipped=move('checked',null,r.ship*dt);
  if(shipped>0){const revenue=shipped*saleUnitValue();S.totalShipped+=shipped;S.chainRevenue+=revenue;game().earn(revenue);changed=true}
  const inspected=move('turned',null,r.inspect*dt);
  if(inspected>0){const good=inspected*qualityYield();S.inventory.checked+=good;S.scrap+=inspected-good;changed=true}
  if(move('sawn','turned',r.turn*dt)>0)changed=true;
  if(move('raw','sawn',r.saw*dt)>0)changed=true;
  if(changed)markDirty();
}

function staffCard(id){
  const r=ROLES[id],lv=S.staff[id]||0,cost=hireCost(id),maxed=lv>=r.max;
  return `<div class="card item opsStaff"><div class="row"><div><div class="name">${r.icon} ${esc(r.name)}</div><div class="desc">${esc(r.desc)}</div></div><div class="opsLevel">${lv}/${r.max}</div></div><button class="btn ${maxed?'secondary':''}" ${maxed?'disabled':''} onclick="CNC_OPERATIONS.hire('${id}')">${maxed?'Voll besetzt':'Einstellen · '+money(cost)}</button></div>`;
}
function upgradeCard(id){
  const u=UPGRADES[id],lv=S.upgrades[id]||0,cost=upgradeCost(id),maxed=lv>=u.max;
  return `<div class="card item opsStaff"><div class="row"><div><div class="name">${u.icon} ${esc(u.name)}</div><div class="desc">${esc(u.desc)}</div></div><div class="opsLevel">${lv}/${u.max}</div></div><button class="btn ${maxed?'secondary':''}" ${maxed?'disabled':''} onclick="CNC_OPERATIONS.buyUpgrade('${id}')">${maxed?'MAX':'Ausbauen · '+money(cost)}</button></div>`;
}
function shiftCard(id){
  const x=SHIFTS[id],on=S.shift===id,unlocked=shiftUnlocked(id);
  return `<button class="opsShift ${on?'on':''}" ${unlocked?'':'disabled'} onclick="CNC_OPERATIONS.setShift('${id}')"><b>${x.icon} ${esc(x.name)}</b><span>×${x.mult.toFixed(2)} Produktion</span><small>${esc(x.desc)}</small></button>`;
}
function renderDashboard(){
  const d=dashboardData(),c=d.customers,b=d.bottleneck;
  const delivery=c.deliveryRate==null?'—':Math.round(c.deliveryRate*100)+' %';
  const complaints=c.complaintRate==null?'—':(c.complaintRate*100).toFixed(1)+' %';
  return `<div class="section">📊 Betriebsdashboard</div><div class="grid"><div class="card stat"><div class="label">Fertigungsleistung</div><div class="value">${money(d.autoPerSecond)}/s</div><div class="sub">${num(d.partRate)} Teile/s</div></div><div class="card stat"><div class="label">Gutteilquote</div><div class="value">${(d.qualityYield*100).toFixed(1)} %</div><div class="sub">QS + Messtaster</div></div><div class="card stat"><div class="label">Verfügbarkeit</div><div class="value">${Math.round(d.availability*100)} %</div><div class="sub">Werkzeug · KSS · Zustand</div></div><div class="card stat"><div class="label">Liefertreue</div><div class="value">${delivery}</div><div class="sub">${c.completed} Großkundenaufträge</div></div><div class="card stat"><div class="label">Reklamationen</div><div class="value">${complaints}</div><div class="sub">${c.complaints} Qualitätsfälle</div></div><div class="card stat"><div class="label">Produktionsfaktor</div><div class="value">×${d.productionMultiplier.toFixed(2)}</div><div class="sub">${esc(d.shift)}</div></div></div><div class="section">🚦 Engpassanalyse</div><div class="card item"><div class="row"><div><div class="name">${b.id==='maintenance'?'⚠️':'🔎'} Engpass: ${esc(b.name)}</div><div class="desc">${b.id==='locked'?'Produktionskette noch nicht aktiv':`Kapazität ${num(b.rate)} Teile/s`}</div></div>${b.rates?`<div class="score">${num(Math.min(...Object.values(b.rates)))} /s</div>`:''}</div><div class="desc" style="margin-top:8px"><b>Empfehlung:</b> ${esc(b.action)}</div>${b.rates?`<div class="desc" style="margin-top:6px">Sägen ${num(b.rates.saw)}/s · Drehen ${num(b.rates.turn)}/s · Prüfen ${num(b.rates.inspect)}/s · Versand ${num(b.rates.ship)}/s</div>`:''}</div>`;
}
function renderEquipment(){
  if(!equipmentUnlocked()){
    const left=Math.max(0,50000-lifetime());
    return `<div class="section">🧰 Maschinen-Tuning</div><div class="card item"><div class="name">Wird bei 50.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${money(left)} bis Hochdruck-KSS, Messtaster, Werkzeugvermessung, Spanntechnik und Stangenlader-Upgrades.</div></div>`;
  }
  return `<div class="section">🧰 Maschinen-Tuning</div><div class="notice"><b>Ausstattung statt Geldmultiplikator:</b> Tuning verbessert Verschleiß, Qualität und einzelne Prozessschritte. Höhere Stufen sind jetzt echte Investitionsentscheidungen.</div><div class="list">${Object.keys(UPGRADES).map(upgradeCard).join('')}</div>`;
}
function renderMaintenance(){
  if(!maintenanceUnlocked()){
    const left=Math.max(0,15000-lifetime());
    return `<div class="section">🔧 Wartung & Werkzeuge</div><div class="card item"><div class="name">Wird bei 15.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${money(left)} bis Werkzeugzustand, KSS und Maschinenwartung aktiv werden.</div></div>`;
  }
  const m=S.maintenance,down=isDown(),left=Math.max(0,Math.ceil((m.downUntil-Date.now())/1000));
  const status=down?`<div class="notice"><b>⚠️ ${esc(m.incident||'Maschinenstörung')}</b><br>Stillstand noch ca. ${left} s. Du kannst die Störung sofort beheben oder die Reparaturzeit abwarten.</div>`:'';
  return `<div class="section">🔧 Wartung & Werkzeuge</div>${status}<div class="grid"><div class="card stat"><div class="label">Werkzeugzustand</div><div class="value">${m.tool.toFixed(0)} %</div><div class="sub">Unter 60 % sinkt Leistung</div></div><div class="card stat"><div class="label">Kühlschmierstoff</div><div class="value">${m.coolant.toFixed(0)} %</div><div class="sub">Unter 40 % sinkt Leistung</div></div><div class="card stat"><div class="label">Maschinenzustand</div><div class="value">${m.health.toFixed(0)} %</div><div class="sub">${num(m.failures)} Störungen gesamt</div></div><div class="card stat"><div class="label">Verfügbarkeit</div><div class="value">×${maintenanceMultiplier().toFixed(2)}</div><div class="sub">wirkt nur bremsend, nie als Bonus</div></div></div><div class="list" style="margin-top:9px"><div class="card item"><div class="name">Verbrauch & Instandhaltung</div><div class="desc">Die Kosten wachsen jetzt mit der Größe des aktuellen Meisterlaufs. Kleine Betriebe bleiben günstig, große Fabriken haben spürbare Betriebskosten.</div><div class="opsActions"><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('tool')">Werkzeug wechseln · ${money(maintenanceCost('tool'))}</button><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('coolant')">KSS nachfüllen · ${money(maintenanceCost('coolant'))}</button><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('service')">Wartung · ${money(maintenanceCost('service'))}</button>${down?`<button class="btn" onclick="CNC_OPERATIONS.maintain('repair')">Störung sofort beheben · ${money(maintenanceCost('repair'))}</button>`:''}</div></div></div>`;
}
function renderChain(){
  if(!chainUnlocked()){
    const left=Math.max(0,5000-lifetime());
    return `<div class="section">🏭 Produktionskette</div><div class="card item"><div class="name">Wird bei 5.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${money(left)} bis Material → Sägen → Drehen → Prüfen → Versand.</div></div>`;
  }
  const r=stageRates(),inv=S.inventory,yieldPct=qualityYield()*100;
  const options=Object.keys(MATERIALS).map(m=>`<option value="${esc(m)}" ${m===S.material?'selected':''}>${esc(m)}</option>`).join('');
  const rawCost=Math.round(rawUnitCost()*250);
  return `<div class="section">🏭 Produktionskette</div><div class="card item"><div class="row"><div><div class="name">Aktuelle Charge</div><div class="desc">Materialpreis berücksichtigt den Weltmarkt.</div></div><select class="opsSelect" onchange="CNC_OPERATIONS.setMaterial(this.value)">${options}</select></div><button class="btn onlineWide" onclick="CNC_OPERATIONS.buyMaterial(250)">250 Rohteile einkaufen · ${money(rawCost)}</button></div><div class="opsFlow"><div class="card stat"><div class="label">Rohmaterial</div><div class="value">${num(inv.raw)}</div><div class="sub">→ Sägen ${num(r.saw)}/s</div></div><div class="card stat"><div class="label">Gesägt</div><div class="value">${num(inv.sawn)}</div><div class="sub">→ Drehen ${num(r.turn)}/s</div></div><div class="card stat"><div class="label">Gedreht</div><div class="value">${num(inv.turned)}</div><div class="sub">→ Prüfen ${num(r.inspect)}/s</div></div><div class="card stat"><div class="label">Geprüft</div><div class="value">${num(inv.checked)}</div><div class="sub">→ Versand ${num(r.ship)}/s</div></div></div><div class="card item opsQuality"><div class="row"><div><div class="name">Qualitätslage</div><div class="desc">Gutteilquote ${yieldPct.toFixed(1)} % · Ausschuss gesamt ${num(S.scrap)}</div></div><div class="score">${num(S.totalShipped)} 📦</div></div><div class="desc">Kettenumsatz: ${money(S.chainRevenue)} · Verkauf je Gutteil aktuell ${money(saleUnitValue())}</div></div>`;
}
function render(){
  const mult=productionMultiplier(),staff=totalStaff();
  return `<div id="operationsSystems"><div class="notice"><b>👥 Betriebsführung aktiv.</b> Mitarbeiter und Schichten verstärken die Fertigung kontrolliert. Vollausbau ersetzt keinen Maschinenpark; Wartung und Investitionen bleiben relevant.</div>${renderDashboard()}<div class="grid"><div class="card stat"><div class="label">Mitarbeiter</div><div class="value">${staff}</div><div class="sub">5 Fachbereiche</div></div><div class="card stat"><div class="label">Produktionsfaktor</div><div class="value">×${mult.toFixed(2)}</div><div class="sub">${esc(SHIFTS[S.shift]?.name||'Frühschicht')}</div></div></div><div class="section">Schichtmodell</div><div class="opsShifts">${Object.keys(SHIFTS).map(shiftCard).join('')}</div><div class="section">Mitarbeiter</div><div class="list">${Object.keys(ROLES).map(staffCard).join('')}</div>${renderEquipment()}${renderMaintenance()}${renderChain()}</div>`;
}
function start(){
  if(tickTimer)clearInterval(tickTimer);if(syncTimer)clearInterval(syncTimer);
  tickTimer=setInterval(()=>{processTick();if(document.getElementById('operationsSystems')&&!document.querySelector('input:focus,textarea:focus,select:focus'))rerender()},1000);
  syncTimer=setInterval(()=>persist(false),10000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true)});
  window.addEventListener('pagehide',()=>persist(true));
}
function stop(){if(tickTimer)clearInterval(tickTimer);if(syncTimer)clearInterval(syncTimer);tickTimer=null;syncTimer=null;persist(true)}

export async function initCncOperations(ctx){
  sb=ctx.supabase;user=ctx.user;readState=ctx.readState||(()=>null);await load();
  const api={render,refresh,hire,buyUpgrade,setShift,setMaterial,buyMaterial,maintain,productionMultiplier,dashboardData,stageRates,qualityYield,get state(){return S},start,stop};
  window.CNC_OPERATIONS=api;start();return api;
}
