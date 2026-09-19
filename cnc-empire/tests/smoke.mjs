import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('cnc-empire');
const fail=(msg)=>{throw new Error(msg)};
const ok=(msg)=>console.log('✅',msg);

const parts=[];
for(let i=1;i<=7;i++){
  const file=path.join(root,`v3part${i}.txt`);
  const text=await fs.readFile(file,'utf8');
  if(!text.trim())fail(`${file} ist leer`);
  parts.push(text);
  ok(`v3part${i}.txt vorhanden`);
}
const expectedStarts=['(()=>{','let tab=','function rerollOffers','async function syncOnline','function staffExpansionShop','function board','function render'];
for(let i=0;i<parts.length;i++){
  if(!parts[i].trimStart().startsWith(expectedStarts[i]))fail(`v3part${i+1}.txt beginnt nicht an einer sauberen Funktionsgrenze`);
  ok(`v3part${i+1}.txt startet sauber`);
}
for(const [i,bad] of [[0,'!==we'],[1,'if(!o)return;'],[2,'async function'],[3,'>${l}</'],[4,'skalieren jet'],[5,'class="lab']]){
  if(parts[i].trimEnd().endsWith(bad))fail(`v3part${i+1}.txt endet wieder mitten in Code/Template: ${bad}`);
}
ok('Alle Core-Dateigrenzen sind sauber');

const game=parts.join('');
try{new Function(game);ok('Zusammengesetzter Spielkern ist syntaktisch gültig')}catch(e){fail(`Spielkern-Syntaxfehler: ${e.message}`)}

const required=[
  'function tap()',
  'function buy(id)',
  'function makeOffer()',
  'function claim()',
  'function prestige()',
  'function prestigeRequirement()',
  'function prestigeGain()',
  'moneyDisplay',
  'window.CNC_FORMAT_MONEY=euro',
  'staffExpansion',
  'cloudMeta',
  'cloudAudit',
  'function auditCloud(type,detail={})',
  'function buyStaffSlot(id)',
  'Personalentwicklung',
  'function orderMarketMult(mat)',
  'function beginOffline()',
  'settleOffline:()=>offline()',
  'if(!duel&&!document.hidden)',
  'function render()',
  'window.G=',
  'window.CNC_GAME_BRIDGE=',
  'manualClickCash',
  'orderClickParts',
  "player_profiles_s2",
  'const BUY_RATE=1.22;',
  'auto()*sec*.10',
  "['operations','🏭','Betrieb']",
  "['online','🌐','Online']",
  "['community','👥','Community']"
];
for(const marker of required){if(!game.includes(marker))fail(`Kernfunktion/Invariante fehlt: ${marker}`);ok(`Kernmarker ${marker}`)}

const forbiddenGame=[
  'function prestigeMult(){return 1+s.prestige*.12}',
  'function offlineHours(){return Math.min(24,8+s.starShop.night*2)}',
  "const BUY_RATE=1.18;"
];
for(const marker of forbiddenGame){if(game.includes(marker))fail(`Alte Balance-Logik noch im Kern: ${marker}`);ok(`Altlogik entfernt: ${marker}`)}

const index=await fs.readFile(path.join(root,'index.html'),'utf8');
if(index.includes('active-production-v1.js'))fail('Veralteter Active-Production-Patch ist wieder eingebunden');
ok('Kein alter Active-Production-Patch geladen');
if(!index.includes('auth-cloud-v3.js?r='))fail('Aktueller Cloud-Loader fehlt in index.html');
ok('Aktueller Cloud-Loader eingebunden');
if(!index.includes('clan-events-bootstrap-v1.js?r='))fail('Aktueller Firmen-Cup-Bootstrap fehlt');
ok('Aktueller Firmen-Cup-Bootstrap eingebunden');

const auth=await fs.readFile(path.join(root,'auth-cloud-v3.js'),'utf8');
try{new Function(auth);ok('Cloud-Loader ist syntaktisch gültig')}catch(e){fail(`Cloud-Loader-Syntaxfehler: ${e.message}`)}
for(const marker of ['player_saves_s2',"GAME_PART_VERSION='12'", "new Function(parts.join(''))","operations-v1.js?r='+RELEASE_QUERY","const INSTANCE_ID=", ".eq('updated_at',cloudUpdatedAt)", "Cloud-Konflikt · anderer Tab ist neuer", "window.CNC_FORCE_CLOUD_SAVE=async()=>flushCloud(true)"]){
  if(!auth.includes(marker))fail(`Cloud-Loader-Invariante fehlt: ${marker}`);
  ok(`Cloud-Invariante ${marker}`);
}
const hasHardBalance=auth.includes('function hardBalance(')||auth.includes('hardBalance(parts.join');
if(hasHardBalance)fail('Runtime-hardBalance-Patching ist noch aktiv');
ok('Runtime-hardBalance-Patching entfernt');

function installBrowserStubs(){
  const elements=new Map();
  const makeElement=id=>({id,innerHTML:'',textContent:'',className:'',value:'',hidden:false,disabled:false,dataset:{},style:{},addEventListener(){},appendChild(){},remove(){},focus(){}});
  const getElement=id=>{if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id)};
  const store=new Map();
  Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true,writable:true});
  Object.defineProperty(globalThis,'navigator',{value:{onLine:false,clipboard:{writeText:async()=>{}}},configurable:true,writable:true});
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()},configurable:true,writable:true});
  Object.defineProperty(globalThis,'document',{value:{getElementById:getElement,createElement:()=>makeElement(''),body:{appendChild(){}},addEventListener(){},querySelector(){return null}},configurable:true,writable:true});
  globalThis.addEventListener=()=>{};
  globalThis.alert=()=>{};
  globalThis.confirm=()=>true;
  globalThis.location={reload(){}};
  globalThis.setInterval=()=>1;
  globalThis.clearInterval=()=>{};
  globalThis.setTimeout=fn=>{if(typeof fn==='function')fn();return 1};
  globalThis.clearTimeout=()=>{};
  return {getElement,store};
}

async function runRuntimeSmoke(){
  const env=installBrowserStubs();
  try{new Function(game)()}catch(e){fail(`Spielkern startet nicht: ${e.stack||e.message}`)}
  await Promise.resolve();await Promise.resolve();
  if(!window.G)fail('window.G wurde beim Start nicht erzeugt');
  if(!window.CNC_GAME_BRIDGE)fail('CNC_GAME_BRIDGE wurde beim Start nicht erzeugt');
  if(!env.getElement('root').innerHTML.includes('CNC EMPIRE'))fail('Werkstatt-UI wurde nicht gerendert');
  if(!env.getElement('nav').innerHTML.includes('Betrieb')||!env.getElement('nav').innerHTML.includes('Online')||!env.getElement('nav').innerHTML.includes('Community'))fail('Erweiterte Navigation wurde nicht gerendert');
  ok('Spielkern startet und rendert die Hauptnavigation');
  let state=window.CNC_GAME_BRIDGE.getState();
  state.moneyDisplay='scientific';
  window.G.tab('profile');
  if(!env.getElement('root').innerHTML.includes('Kompakte Geldanzeige'))fail('Profil enthält keine Geldanzeige-Einstellung');
  const sci=window.CNC_GAME_BRIDGE.formatMoney(1250000000000);
  if(sci!=='1,25e12 €')fail('Wissenschaftliche Geldanzeige formatiert 1,25e12 nicht korrekt: '+sci);
  window.G.moneyDisplay(false);
  if(window.CNC_GAME_BRIDGE.getState().moneyDisplay!=='standard')fail('Geldanzeige lässt sich nicht zurück auf Standard stellen');
  ok('Profil-Schalter und wissenschaftliche Geldanzeige funktionieren');

  state=window.CNC_GAME_BRIDGE.getState();
  const cashBefore=state.money;
  window.G.tap();
  state=window.CNC_GAME_BRIDGE.getState();
  if(!(state.money>cashBefore))fail('Manuelles Fertigen erhöht den Kontostand nicht');
  ok('Manuelles Fertigen funktioniert');

  state.money=10000;
  const beforeCnc=state.m.cnc;
  window.G.buy('cnc');
  state=window.CNC_GAME_BRIDGE.getState();
  if(state.m.cnc!==beforeCnc+1)fail('CNC-Maschine konnte im Runtime-Test nicht gekauft werden');
  ok('Maschinenkauf funktioniert');

  const offlineMoneyBefore=state.money;
  state.offlineSince=Date.now()-5*3600*1000;
  const offlineRate=window.CNC_GAME_BRIDGE.partRate()*8;
  const offlineResult=window.CNC_GAME_BRIDGE.settleOffline();
  state=window.CNC_GAME_BRIDGE.getState();
  const offlineDelta=state.money-offlineMoneyBefore;
  const expectedOffline=offlineRate*3*3600*.10;
  if(Math.abs(offlineResult.sec-3*3600)>1)fail('Offline-Zeit wird nicht auf 3 Stunden begrenzt: '+offlineResult.sec);
  if(Math.abs(offlineDelta-expectedOffline)>2)fail('Offline-Ertrag ist falsch. Erwartet '+expectedOffline+', erhalten '+offlineDelta);
  if(state.offlineSince!==0)fail('Offline-Zeitpunkt wird nach Auszahlung nicht zurückgesetzt');
  ok('Offline-Ertrag wird auf drei Stunden begrenzt und mit 10 % korrekt ausgezahlt');

  window.CNC_GAME_BRIDGE.beginOffline();
  state=window.CNC_GAME_BRIDGE.getState();
  if(!(Number(state.offlineSince)>0))fail('Hintergrundwechsel speichert keinen Offline-Startzeitpunkt');
  window.CNC_GAME_BRIDGE.settleOffline();
  ok('Hintergrund- und Vordergrund-Lifecycle ist angebunden');

  window.G.orderNew();
  state=window.CNC_GAME_BRIDGE.getState();
  if(!Array.isArray(state.offers)||state.offers.length<3)fail('Auftragsbörse erzeugt keine Angebote');
  window.G.acceptOffer(0);
  state=window.CNC_GAME_BRIDGE.getState();
  if(!state.order)fail('Auftrag konnte nicht angenommen werden');
  state.order.acceptedAt=Date.now()-3*3600*1000;
  state.offlineSince=Date.now()-2*3600*1000;
  const acceptedBeforePause=state.order.acceptedAt;
  const paused=window.CNC_GAME_BRIDGE.settleOffline();
  state=window.CNC_GAME_BRIDGE.getState();
  const shifted=state.order.acceptedAt-acceptedBeforePause;
  if(Math.abs(paused.pausedOrderMs-2*3600*1000)>1500)fail('Offline-Zeit pausiert Auftragsfrist nicht korrekt: '+paused.pausedOrderMs);
  if(Math.abs(shifted-2*3600*1000)>1500)fail('acceptedAt wurde nicht um die Hintergrundzeit verschoben: '+shifted);
  ok('Hintergrundzeit pausiert aktive Auftragsfrist für die Liefertreue');
  const doneBefore=state.order.done;
  window.G.tap();
  state=window.CNC_GAME_BRIDGE.getState();
  if(!(state.order.done>doneBefore))fail('Aktiver Klick erhöht den Auftragsfortschritt nicht');
  ok('Auftrag annehmen + aktiver Fortschritt funktionieren');

  state.prestige=10;state.starsSpent=0;
  const slotBefore=state.staffExpansion.operator;
  window.G.buyStaffSlot('operator');
  state=window.CNC_GAME_BRIDGE.getState();
  if(state.staffExpansion.operator!==slotBefore+1)fail('Prestige-Personalplatz wurde nicht freigeschaltet');
  if(state.starsSpent!==1)fail('Erster Maschinenbediener-Platz muss genau 1 Meisterstern kosten');
  window.G.tab('shop');
  if(!env.getElement('root').innerHTML.includes('Personalentwicklung'))fail('Personalentwicklung wird im Meisterzentrum nicht angezeigt');
  ok('Prestige-Personalplatz kostet korrekt Sterne und wird dauerhaft gespeichert');

  window.CNC_OPERATIONS={productionMultiplier:()=>1};
  state.runRevenue=10000000;
  const prestigeBefore=state.prestige;
  const runBefore=state.run;
  window.G.prestige();
  state=window.CNC_GAME_BRIDGE.getState();
  if(state.prestige!==prestigeBefore+1||state.run!==runBefore+1)fail('Erster Prestige-Reset liefert nicht exakt einen Stern und einen neuen Lauf');
  if(state.staffExpansion.operator!==slotBefore+1)fail('Prestige-Personalplatz ging beim Meisterlauf verloren');
  const prestigeAudit=(state.cloudAudit||[]).find(x=>x?.type==='prestige');
  if(!prestigeAudit)fail('Prestige wird nicht im Cloud-Audit protokolliert');
  if(prestigeAudit.detail?.gainedStars!==1)fail('Prestige-Audit enthält falsche Sternzahl');
  if((state.cloudAudit||[]).length>20)fail('Cloud-Audit wächst über 20 Einträge');
  ok('Prestige-Reset behält Personalplätze und wird im Cloud-Audit protokolliert');
}
await runRuntimeSmoke();

const operations=await fs.readFile(path.join(root,'operations-v1.js'),'utf8');
const operationsCompile=operations.replace(/\bexport\s+(?=async function|function|const|let|class)/g,'').replace(/export\s*\{[^}]*\};?/g,'');
try{new Function(operationsCompile);ok('Betriebsmodul ist syntaktisch gültig')}catch(e){fail(`Betriebsmodul-Syntaxfehler: ${e.message}`)}
for(const marker of ['function dashboardData()','function bottleneckData()','function renderDashboard()','Engpassanalyse','dashboardData,stageRates,qualityYield','function staffMax(id)','Prestige-Platz','const coreAlreadyRenders=','Date.now()-lastUiRender>=2000']){
  if(!operations.includes(marker))fail(`Dashboard/Performance-Invariante fehlt: ${marker}`);
  ok(`Dashboard/Performance-Invariante ${marker}`);
}

const clan=await fs.readFile(path.join(root,'clan-events-v1.js'),'utf8');
try{new Function(clan);ok('Firmen-Cup-Modul ist syntaktisch gültig')}catch(e){fail(`Firmen-Cup-Syntaxfehler: ${e.message}`)}
for(const marker of ['const REWARD_REFRESH_MS=300000;','async function refreshRewards(force=false)','player_profiles_s2','await refreshBattle();window.CNC_GAME_BRIDGE?.render?.()']){
  if(!clan.includes(marker))fail(`Firmen-Cup-Invariante fehlt: ${marker}`);
  ok(`Firmen-Cup-Invariante ${marker}`);
}
if(clan.includes('setInterval(refreshAll,30000)'))fail('Firmen-Cup lädt wieder alle Historiedaten alle 30 Sekunden');
ok('Firmen-Cup-Historie ist gedrosselt');
if(game.includes('resetStaffForPrestige'))fail('Prestige darf Betriebsmitarbeiter nicht mehr zurücksetzen');
if(operations.includes('resetStaffForPrestige'))fail('Betriebsmodul enthält noch alten Mitarbeiter-Reset');
ok('Mitarbeiter-Reset beim Prestige ist vollständig entfernt');

console.log('\nCNC EMPIRE Smoke-Test: GRÜN');