import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('cnc-empire');
const fail=msg=>{throw new Error(msg)};
const ok=msg=>console.log('✅',msg);
const script=await fs.readFile(path.join(root,'balance-bar-v1.js'),'utf8');
const index=await fs.readFile(path.join(root,'index.html'),'utf8');
const style=await fs.readFile(path.join(root,'style-v2.css'),'utf8');

try{new Function(script);ok('Balance-Bar Script ist syntaktisch gültig')}catch(e){fail(`Balance-Bar Syntaxfehler: ${e.message}`)}
if(!index.includes('id="persistentBalanceBar"')||!index.includes('id="persistentBalanceValue"'))fail('Persistentes Kontostand-Feld fehlt in index.html');
if(!index.includes('balance-bar-v1.js?v=1'))fail('Balance-Bar Script ist nicht eingebunden');
if(!index.includes('style-v2.css?v=4'))fail('Aktuelle Style-Version für Balance-Bar fehlt');
if(!style.includes('.persistentBalanceBar{position:sticky'))fail('Kontostand-Feld ist nicht sticky');
ok('Balance-Bar ist persistent und sticky eingebunden');

const elements=new Map([
  ['persistentBalanceBar',{hidden:true}],
  ['persistentBalanceValue',{textContent:'0,00 €'}]
]);
Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true,writable:true});
Object.defineProperty(globalThis,'document',{value:{hidden:false,getElementById:id=>elements.get(id)||null,addEventListener(){}},configurable:true,writable:true});
globalThis.addEventListener=()=>{};
globalThis.setInterval=()=>1;
globalThis.clearInterval=()=>{};
let money=12345.67;
window.CNC_GAME_BRIDGE={getState:()=>({money})};
new Function(script)();
if(elements.get('persistentBalanceBar').hidden)fail('Balance-Bar bleibt trotz geladenem Spielstand versteckt');
if(!elements.get('persistentBalanceValue').textContent.includes('12.345'))fail('Balance-Bar zeigt den Kontostand nicht korrekt an');
money=42;
window.CNC_BALANCE_BAR.update();
if(!elements.get('persistentBalanceValue').textContent.includes('42'))fail('Balance-Bar aktualisiert geänderten Kontostand nicht');
ok('Kontostand wird aus dem laufenden Spiel aktualisiert');

console.log('\nCNC EMPIRE Balance-Smoke-Test: GRÜN');
