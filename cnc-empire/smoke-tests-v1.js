(()=>{
  if(!new URLSearchParams(location.search).has('smoke'))return;
  const wait=(fn,ms=15000)=>new Promise((resolve,reject)=>{const end=Date.now()+ms;const t=setInterval(()=>{try{const v=fn();if(v){clearInterval(t);resolve(v)}else if(Date.now()>end){clearInterval(t);reject(new Error('timeout'))}}catch(e){clearInterval(t);reject(e)}},100)});
  const test=(name,fn)=>{try{const out=fn();return {name,ok:!!out,detail:typeof out==='string'?out:''}}catch(e){return {name,ok:false,detail:e.message||String(e)}}};
  const render=(rows)=>{
    const ok=rows.every(x=>x.ok);
    const box=document.createElement('div');box.id='smokePanel';box.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#0b1422;color:#fff;border:1px solid #334155;border-radius:12px;padding:12px;max-height:48vh;overflow:auto;font:13px system-ui;box-shadow:0 10px 30px #0008';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>Smoke-Test: ${ok?'✅ GRÜN':'❌ FEHLER'}</b><button id="smokeClose" style="background:#1f2937;color:#fff;border:0;border-radius:8px;padding:6px 10px">Schließen</button></div><div style="margin-top:8px">${rows.map(r=>`<div style="padding:4px 0">${r.ok?'✅':'❌'} ${r.name}${r.detail?` <span style="opacity:.7">· ${r.detail}</span>`:''}</div>`).join('')}</div>`;
    document.body.appendChild(box);document.getElementById('smokeClose').onclick=()=>box.remove();
    window.CNC_SMOKE_RESULTS={ok,rows,at:new Date().toISOString()};
    console.table(rows);
  };
  (async()=>{
    const rows=[];
    try{await wait(()=>window.G&&window.CNC_GAME_BRIDGE)}catch(e){render([{name:'Spielkern startet',ok:false,detail:'G/Bridge nicht geladen'}]);return}
    const s=window.CNC_GAME_BRIDGE.getState?.();
    rows.push(test('Spielkern startet',()=>!!window.G&&!!window.CNC_GAME_BRIDGE));
    rows.push(test('Spielzustand vorhanden',()=>s&&typeof s==='object'));
    rows.push(test('Geldwert plausibel',()=>Number.isFinite(Number(s?.money))&&Number(s.money)>=0));
    rows.push(test('Maschinenzustand vorhanden',()=>s?.m&&typeof s.m==='object'&&'cnc' in s.m&&'smart' in s.m));
    rows.push(test('Kernaktionen vorhanden',()=>['tap','buy','setBuyMode','acceptOffer','claim','prestige','tab'].every(k=>typeof window.G[k]==='function')));
    rows.push(test('Teilefluss plausibel',()=>{const r=Number(window.CNC_GAME_BRIDGE.partRate?.());return Number.isFinite(r)&&r>=0}));
    rows.push(test('Cloudstatus-Element vorhanden',()=>!!document.getElementById('cloudStatus')));
    rows.push(test('Werkstatt-UI gerendert',()=>!!document.querySelector('#root .top')&&!!document.querySelector('#nav')));
    rows.push(test('Betriebssystem geladen',()=>!!window.CNC_OPERATIONS&&typeof window.CNC_OPERATIONS.productionMultiplier==='function'));
    rows.push(test('Betriebsfaktor plausibel',()=>{const m=Number(window.CNC_OPERATIONS?.productionMultiplier?.());return Number.isFinite(m)&&m>0&&m<=2.01}));
    rows.push(test('Online-System geladen',()=>!!window.CNC_ONLINE));
    rows.push(test('Aktiver Auftrag konsistent',()=>!s.order||(Number(s.order.q)>0&&Number(s.order.done)>=0&&Number(s.order.done)<=Number(s.order.q))));
    rows.push(test('Prestigezustand konsistent',()=>Number(s.prestige)>=0&&Number(s.starsSpent)>=0&&Number(s.starsSpent)<=Number(s.prestige)));
    render(rows);
  })();
})();