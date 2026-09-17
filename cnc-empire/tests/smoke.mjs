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
  'function render()',
  'window.G=',
  'manualClickCash',
  'orderClickParts'
];
for(const marker of required){if(!game.includes(marker))fail(`Kernfunktion fehlt: ${marker}`);ok(`Kernmarker ${marker}`)}

const index=await fs.readFile(path.join(root,'index.html'),'utf8');
if(index.includes('active-production-v1.js'))fail('Veralteter Active-Production-Patch ist wieder eingebunden');
ok('Kein alter Active-Production-Patch geladen');
if(!index.includes('auth-cloud-v3.js'))fail('Cloud-Loader fehlt in index.html');
ok('Cloud-Loader eingebunden');

const auth=await fs.readFile(path.join(root,'auth-cloud-v3.js'),'utf8');
try{new Function(auth);ok('Cloud-Loader ist syntaktisch gültig')}catch(e){fail(`Cloud-Loader-Syntaxfehler: ${e.message}`)}
for(const marker of ['player_saves_s2','GAME_PART_VERSION','new Function(hardBalance(parts.join(\'\')))','CNC_GAME_BRIDGE']){
  if(!auth.includes(marker))fail(`Cloud-Loader-Invariante fehlt: ${marker}`);
  ok(`Cloud-Invariante ${marker}`);
}

console.log('\nCNC EMPIRE Smoke-Test: GRÜN');