let sb=null,user=null,readState=()=>null,tickTimer=null,syncTimer=null,dirty=false,lastSaved='';

const MATERIALS={
  '1.4404':8.0,'42CrMo4':6.5,'Al 7075':7.0,'1.4301':7.2,'POM-C':3.0,'1.4122':8.5,
  '1.4305':7.5,'C55E':5.5,'Al 6082':4.8,'1.4021':6.2,'PE-HD':2.4,'PET':2.7
};
const ROLES={
  operator:{name:'Maschinenbediener',icon:'👷',desc:'+3 % Maschinenleistung je Mitarbeiter · beschleunigt Sägen & Versand',base:4000,rate:1.62,max:10},
  setter:{name:'Einrichter',icon:'🔧',desc:'+5 % Maschinenleistung je Mitarbeiter · beschleunigt Drehen',base:15000,rate:1.68,max:8},
  programmer:{name:'CNC-Programmierer',icon:'💻',desc:'+6 % Maschinenleistung je Mitarbeiter · optimiert Drehprozesse',base:65000,rate:1.72,max:6},
  quality:{name:'Qualitätssicherung',icon:'📏',desc:'verbessert Gutteilquote und Prüfgeschwindigkeit',base:35000,rate:1.66,max:8},
  master:{name:'Meister',icon:'⭐',desc:'+8 % Maschinenleistung je Meister · stärkt alle Bereiche',base:250000,rate:1.80,max:4}
};
const SHIFTS={
  early:{name:'Frühschicht',icon:'🌅',mult:1,need:0,staff:0,desc:'Solider Einschichtbetrieb.'},
  late:{name:'Früh + Spät',icon:'🌆',mult:1.12,need:25000,staff:2,desc:'+12 % Maschinenleistung. Ab 25.000 € Gesamtumsatz und 2 Mitarbeitern.'},
  night:{name:'3-Schicht',icon:'🌙',mult:1.25,need:250000,staff:5,desc:'+25 % Maschinenleistung. Ab 250.000 € Gesamtumsatz und 5 Mitarbeitern.'}
};
const INCIDENTS=['Werkzeugbruch','KSS-Druck zu niedrig','Spindelüberlast','Stangenlader-Störung','Messtasterfehler'];

const defaults=()=>({
  version:2,
  staff:{operator:0,setter:0,programmer:0,quality:0,master:0},
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
  const inv={...d.inventory,...(x.inventory||{})};
  for(const k of Object.keys(inv))inv[k]=Math.max(0,Number(inv[k])||0);
  const m={...d.maintenance,...(x.maintenance||{})};
  m.tool=clamp(m.tool);m.coolant=clamp(m.coolant);m.health=clamp(m.health);
  m.downUntil=Math.max(0,Number(m.downUntil)||0);m.incident=String(m.incident||'').slice(0,60);m.failures=Math.max(0,Math.floor(Number(m.failures)||0));
  const material=MATERIALS[x.material]?x.material:d.material;
  const shift=SHIFTS[x.shift]?x.shift:'early';
  return {...d,...x,staff,inventory:inv,maintenance:m,material,shift,lastTick:Number(x.lastTick)||Date.now(),totalShipped:Math.max(0,Number(x.totalShipped)||0),scrap:Math.max(0,Number(x.scrap)||0),chainRevenue:Math.max(0,Number(x.chainRevenue)||0)};
}
function game(){return window.CNC_GAME_BRIDGE||null}
function totalStaff(){return Object.values(S.staff).reduce((a,b)=>a+(Number(b)||0),0)}
function lifetime(){return Math.max(0,Number(readState()?.lifetime)||0)}
function chainUnlocked(){return lifetime()>=5000}
function maintenanceUnlocked(){return lifetime()>=15000}
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
  const staffMult=1+st.operator*.03+st.setter*.05+st.programmer*.06+st.master*.08;
  const shift=shiftUnlocked(S.shift)?SHIFTS[S.shift]:SHIFTS.early;
  return Math.min(2.5,staffMult*shift.mult)*maintenanceMultiplier();
}
function qualityYield(){return Math.min(.995,.955+S.staff.quality*.005+S.staff.master*.003)}
function hireCost(id){const r=ROLES[id],lv=S.staff[id]||0;return r?Math.round(r.base*Math.pow(r.rate,lv)):Infinity}
function marketFactor(material){return Number(window.CNC_ONLINE?.marketMultiplier?.(material))||1}
function rawUnitCost(material=S.material){return (MATERIALS[material]||6)*marketFactor(material)}
function saleUnitValue(material=S.material){return rawUnitCost(material)*1.25}
function maintenanceCost(type){
  const scale=1+Math.min(7,Math.log10(1+lifetime()/10000))*0.85;
  const base={tool:650,coolant:450,service:2400,repair:1100}[type]||500;
  return Math.round(base*scale);
}
function stageRates(){
  if(isDown())return {saw:0,turn:0,inspect:0,ship:0};
  const machineRate=Math.max(.125,Number(game()?.partRate?.())||.125);
  const base=(machineRate/Math.max(.5,productionMultiplier()))*.25;
  return {
    saw:base*(.55+S.staff.operator*.055+S.staff.master*.025),
    turn:base*(.45+S.staff.setter*.07+S.staff.programmer*.055+S.staff.master*.03),
    inspect:base*(.35+S.staff.quality*.075+S.staff.master*.04),
    ship:base*(.65+S.staff.operator*.035+S.staff.master*.025)
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
  const capped=Math.min(dt,600);
  m.tool=clamp(m.tool-capped*.00080*shiftWear*masterCare);
  m.coolant=clamp(m.coolant-capped*.00045*shiftWear*masterCare);
  m.health=clamp(m.health-capped*.00012*shiftWear*masterCare);
  const riskPerHour=.002+(m.tool<25?.018:0)+(m.coolant<20?.018:0)+(m.health<50?.012:0);
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
function shiftCard(id){
  const x=SHIFTS[id],on=S.shift===id,unlocked=shiftUnlocked(id);
  return `<button class="opsShift ${on?'on':''}" ${unlocked?'':'disabled'} onclick="CNC_OPERATIONS.setShift('${id}')"><b>${x.icon} ${esc(x.name)}</b><span>×${x.mult.toFixed(2)} Produktion</span><small>${esc(x.desc)}</small></button>`;
}
function renderMaintenance(){
  if(!maintenanceUnlocked()){
    const left=Math.max(0,15000-lifetime());
    return `<div class="section">🔧 Wartung & Werkzeuge</div><div class="card item"><div class="name">Wird bei 15.000 € Gesamtumsatz freigeschaltet</div><div class="desc">Noch ${money(left)} bis Werkzeugzustand, KSS und Maschinenwartung aktiv werden.</div></div>`;
  }
  const m=S.maintenance,down=isDown(),left=Math.max(0,Math.ceil((m.downUntil-Date.now())/1000));
  const status=down?`<div class="notice"><b>⚠️ ${esc(m.incident||'Maschinenstörung')}</b><br>Stillstand noch ca. ${left} s. Du kannst die Störung sofort beheben oder die Reparaturzeit abwarten.</div>`:'';
  return `<div class="section">🔧 Wartung & Werkzeuge</div>${status}<div class="grid"><div class="card stat"><div class="label">Werkzeugzustand</div><div class="value">${m.tool.toFixed(0)} %</div><div class="sub">Unter 60 % sinkt Leistung</div></div><div class="card stat"><div class="label">Kühlschmierstoff</div><div class="value">${m.coolant.toFixed(0)} %</div><div class="sub">Unter 40 % sinkt Leistung</div></div><div class="card stat"><div class="label">Maschinenzustand</div><div class="value">${m.health.toFixed(0)} %</div><div class="sub">${num(m.failures)} Störungen gesamt</div></div><div class="card stat"><div class="label">Verfügbarkeit</div><div class="value">×${maintenanceMultiplier().toFixed(2)}</div><div class="sub">wirkt nur bremsend, nie als Bonus</div></div></div><div class="list" style="margin-top:9px"><div class="card item"><div class="name">Verbrauch & Instandhaltung</div><div class="desc">Verschleiß läuft langsam mit der Produktion. Meister reduzieren den Verschleiß leicht.</div><div class="opsActions"><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('tool')">Werkzeug wechseln · ${money(maintenanceCost('tool'))}</button><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('coolant')">KSS nachfüllen · ${money(maintenanceCost('coolant'))}</button><button class="btn secondary" onclick="CNC_OPERATIONS.maintain('service')">Wartung · ${money(maintenanceCost('service'))}</button>${down?`<button class="btn" onclick="CNC_OPERATIONS.maintain('repair')">Störung sofort beheben · ${money(maintenanceCost('repair'))}</button>`:''}</div></div></div>`;
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
  return `<div id="operationsSystems"><div class="notice"><b>👥 Betriebsführung aktiv.</b> Mitarbeiter und Schichten verstärken deine vorhandene Fertigung. Wartung kann die Leistung nur reduzieren – sie erzeugt keinen zusätzlichen Geldbonus.</div><div class="grid"><div class="card stat"><div class="label">Mitarbeiter</div><div class="value">${staff}</div><div class="sub">5 Fachbereiche</div></div><div class="card stat"><div class="label">Produktionsfaktor</div><div class="value">×${mult.toFixed(2)}</div><div class="sub">${esc(SHIFTS[S.shift]?.name||'Frühschicht')}</div></div></div><div class="section">Schichtmodell</div><div class="opsShifts">${Object.keys(SHIFTS).map(shiftCard).join('')}</div><div class="section">Mitarbeiter</div><div class="list">${Object.keys(ROLES).map(staffCard).join('')}</div>${renderMaintenance()}${renderChain()}</div>`;
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
  const api={render,refresh,hire,setShift,setMaterial,buyMaterial,maintain,productionMultiplier,state:S,start,stop};
  window.CNC_OPERATIONS=api;start();return api;
}
