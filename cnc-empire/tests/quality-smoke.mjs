import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('cnc-empire');
const fail=msg=>{throw new Error(msg)};
const ok=msg=>console.log('✅',msg);
const quality=await fs.readFile(path.join(root,'quality-systems-v1.js'),'utf8');
const index=await fs.readFile(path.join(root,'index.html'),'utf8');
const ordersCore=await fs.readFile(path.join(root,'v3part5.txt'),'utf8');

try{new Function(quality);ok('Quality-Modul ist syntaktisch gültig')}catch(e){fail(`Quality-Syntaxfehler: ${e.message}`)}
for(const marker of ['Messschieber','Bügelmessschraube','Höhenmessgerät','Rauheitsmessgerät','Konturmessgerät','3D-KMG','ISO 9001','IATF 16949','ISO 13485','EN 9100','function offerEligibility','function resolveInspection','renderOrderInspection','qualitySystem']){
  if(!quality.includes(marker))fail(`Quality-Invariante fehlt: ${marker}`);
  ok(`Quality-Invariante ${marker}`);
}
if(quality.includes('MutationObserver'))fail('Quality-Modul darf keinen MutationObserver verwenden');
ok('Quality-Modul arbeitet ohne MutationObserver');
if(!index.includes('quality-systems-v1.js?r='))fail('Aktuelles Quality-Modul fehlt in index.html');
ok('Quality-Modul ist in index.html eingebunden');

const elements=new Map();
const makeElement=id=>({id,className:'',textContent:'',innerHTML:'',remove(){},appendChild(){},style:{}});
Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true,writable:true});
Object.defineProperty(globalThis,'document',{value:{createElement:()=>makeElement(''),body:{appendChild(){}},getElementById:id=>elements.get(id)||null},configurable:true,writable:true});
globalThis.alert=()=>{};
globalThis.setTimeout=fn=>{if(typeof fn==='function')fn();return 1};

const main={money:100000000,lifetime:1000000,customerRep:{automotive:30,medical:30,hydraulics:30,aerospace:40},customerStats:{automotive:{completed:5,onTime:5,complaints:0,complaintCost:0},medical:{completed:5,onTime:5,complaints:0,complaintCost:0},hydraulics:{completed:5,onTime:5,complaints:0,complaintCost:0},aerospace:{completed:5,onTime:5,complaints:0,complaintCost:0}},offers:[]};
let saves=0,renders=0;
window.CNC_GAME_BRIDGE={getState:()=>main,spend:v=>{if(main.money<v)return false;main.money-=v;return true},earn:v=>{main.money+=v},save:()=>{saves++},render:()=>{renders++}};
window.CNC_OPERATIONS={state:{staff:{quality:4},qualitySystem:null},render:()=>'<div id="operationsSystems">Betrieb</div>',refresh:async()=>true};
window.CNC_CUSTOMERS={decorateOffer:o=>({...o,customerId:'medical',customer:'Medizintechnik'}),recordOrderClaim:()=>{main.customerStats.medical.completed++}};
window.G={acceptOffer:()=>true,claim:()=>true,tab:()=>true};

new Function(quality)();
await Promise.resolve();await Promise.resolve();
if(!window.CNC_QUALITY)fail('CNC_QUALITY wurde beim Start nicht erzeugt');
ok('Quality-Modul hängt sich an den geladenen Betrieb an');
if(!window.CNC_OPERATIONS.render().includes('Messraum & Prüfmittel')||!window.CNC_OPERATIONS.render().includes('Zertifizierungen'))fail('Quality-Bereich wird nicht an Betrieb angehängt');
ok('Messraum und Zertifizierungen werden gerendert');
if(window.CNC_OPERATIONS.render().includes('🧪 Qualitätsprüfung'))fail('Konkrete QS-Prüfung darf nicht mehr im Bereich Betrieb gerendert werden');
ok('Konkrete QS-Prüfung wurde aus Betrieb entfernt');
if(!ordersCore.includes('CNC_QUALITY?.renderOrderInspection?.()'))fail('Auftragsseite bindet die QS-Prüfung nicht ein');
ok('QS-Prüfung wird direkt in Aufträge eingebunden');

await window.CNC_QUALITY.buyGauge('caliper');
if(window.CNC_QUALITY.state().gaugeLevel!==1)fail('Messschieber-Kauf erhöht Messraum nicht auf Q1');
await window.CNC_QUALITY.buyGauge('micrometer');
if(window.CNC_QUALITY.state().gaugeLevel!==2)fail('Bügelmessschraube erhöht Messraum nicht auf Q2');
ok('Messraum wird sequenziell ausgebaut');

const tagged=window.CNC_CUSTOMERS.decorateOffer({type:'series',name:'Testauftrag',pay:10000});
if(!tagged.qualityTagged||tagged.qualityLevel!==4)fail('Medizintechnik-Auftrag bekommt nicht Q4');
const eligible=window.CNC_QUALITY.offerEligibility(tagged);
if(eligible.ok)fail('Q4-Auftrag darf mit Q2-Messraum nicht freigegeben sein');
ok('Qualitätsstufen sperren ungeeignete Aufträge');

if(!window.CNC_QUALITY.certReady('iso9001'))fail('ISO 9001 sollte mit Q2, QS und genügend Aufträgen auditbereit sein');
await window.CNC_QUALITY.auditCert('iso9001');
if(!window.CNC_QUALITY.state().certs.iso9001)fail('ISO-9001-Audit setzt Zertifikat nicht aktiv');
ok('Zertifizierungsaudit funktioniert');
const qState=window.CNC_QUALITY.state();
qState.pendingInspection={order:{customerId:'medical',customer:'Medizintechnik',name:'QS-Testauftrag',pay:10000,qualityLevel:2},nominal:20,tolerance:.05,measured:20.02,correct:'release',createdAt:Date.now()};
const inlineInspection=window.CNC_QUALITY.renderOrderInspection();
if(!inlineInspection.includes('Qualitätsprüfung')||!inlineInspection.includes('QS-Testauftrag'))fail('Inline-QS-Karte wird für offene Prüfung nicht gerendert');
ok('Offene QS-Prüfung wird als Auftragskarte gerendert');
if(saves<1||renders<1)fail('Quality-System bindet Speichern/Rendern nicht an den Spielzustand');
ok('Quality-System ist an Speichern und Rendern angebunden');

console.log('\nCNC EMPIRE Quality-Smoke-Test: GRÜN');
