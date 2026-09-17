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
  'function orderMarketMult(mat)',
  'function render()',
  'window.G=',
  'window.CNC_GAME_BRIDGE=',
  'manualClickCash',
  'orderClickParts',
  "player_profiles_s2",
  'const BUY_RATE=1.22;',
  'auto()*sec*.10',
  "['operations','👥','Betrieb']",
  "['online','🌐','Online']"
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
if(!index.includes('auth-cloud-v3.js'))fail('Cloud-Loader fehlt in index.html');
ok('Cloud-Loader eingebunden');

const auth=await fs.readFile(path.join(root,'auth-cloud-v3.js'),'utf8');
try{new Function(auth);ok('Cloud-Loader ist syntaktisch gültig')}catch(e){fail(`Cloud-Loader-Syntaxfehler: ${e.message}`)}
for(const marker of ['player_saves_s2','GAME_PART_VERSION',"new Function(parts.join(''))"]){
  if(!auth.includes(marker))fail(`Cloud-Loader-Invariante fehlt: ${marker}`);
  ok(`Cloud-Invariante ${marker}`);
}
if(auth.includes('function hardBalance(')||auth.includes('hardBalance(parts.join'))){
  fail('Runtime-hardBalance-Patching ist noch aktiv');
}
ok('Runtime-hardBalance-Patching entfernt');

const operations=await fs.readFile(path.join(root,'operations-v1.js'),'utf8');
const operationsCompile=operations.replace(/\bexport\s+(?=async function|function|const|let|class)/g,'').replace(/export\s*\{[^}]*\};?/g,'');
try{new Function(operationsCompile);ok('Betriebsmodul ist syntaktisch gültig')}catch(e){fail(`Betriebsmodul-Syntaxfehler: ${e.message}`)}
for(const marker of ['function dashboardData()','function bottleneckData()','function renderDashboard()','Engpassanalyse','dashboardData,stageRates,qualityYield']){
  if(!operations.includes(marker))fail(`Dashboard-Invariante fehlt: ${marker}`);
  ok(`Dashboard-Invariante ${marker}`);
}

console.log('\nCNC EMPIRE Smoke-Test: GRÜN');