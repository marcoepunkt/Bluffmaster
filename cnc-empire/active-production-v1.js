(()=>{
  const OUTPUT={manual:0,cnc:3,bar:14,turnmill:60,robot:280,lights:1400,swiss:8000,grind:45000,fiveaxis:280000,fms:2000000,smart:15000000};
  const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:Math.abs(Number(n)||0)<100?2:0}).format(Number(n)||0);
  const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);

  function state(){return window.CNC_GAME_BRIDGE?.getState?.()||null}
  function machineBase(){
    const s=state(),m=s?.m||{};
    return Object.entries(OUTPUT).reduce((sum,[id,out])=>sum+(Number(m[id])||0)*out,0);
  }
  function prestigeMult(){const p=Math.max(0,Number(state()?.prestige)||0);return 1+Math.min(.60,p*.03)}
  function toolingMult(){const lv=Math.max(0,Number(state()?.starShop?.tooling)||0);return 1+lv*.05}
  function clickCash(){return Math.max(1,machineBase()*.08)*prestigeMult()*toolingMult()}
  function orderClickParts(){
    const rate=Math.max(.125,Number(window.CNC_GAME_BRIDGE?.partRate?.())||.125);
    return Math.max(1,Math.round(rate*.15*toolingMult()));
  }

  function patchTap(){
    if(!window.G||!window.CNC_GAME_BRIDGE||window.G.__activeProductionPatched)return false;
    const original=window.G.tap;
    if(typeof original!=='function')return false;
    window.G.tap=()=>{
      if(document.querySelector('.duelbtn'))return original();
      const s=state();if(!s)return original();
      const beforeMoney=Number(s.money)||0;
      const beforeOrder=s.order?{id:s.order.id,done:Number(s.order.done)||0}:null;
      const targetCash=clickCash(),targetParts=orderClickParts();
      original();
      const after=state();if(!after)return;
      const earned=(Number(after.money)||0)-beforeMoney;
      const extraCash=Math.max(0,targetCash-earned);
      if(extraCash>0)window.CNC_GAME_BRIDGE.earn?.(extraCash);
      if(beforeOrder&&after.order&&after.order.id===beforeOrder.id){
        const extraParts=Math.max(0,targetParts-1);
        if(extraParts>0)after.order.done=Math.min(Number(after.order.q)||0,(Number(after.order.done)||0)+extraParts);
      }
      window.CNC_GAME_BRIDGE.save?.();
      window.CNC_GAME_BRIDGE.render?.();
    };
    window.G.__activeProductionPatched=true;
    window.CNC_ACTIVE_PRODUCTION={clickCash,orderClickParts,machineBase};
    return true;
  }

  function relabel(){
    if(!window.G?.__activeProductionPatched)return;
    const tap=document.querySelector('button.tap');
    if(tap)tap.innerHTML=`TEIL FERTIGEN<br><span style="font-size:11px">+ ${euro(clickCash())}</span>`;
    document.querySelectorAll('button.btn.secondary').forEach(b=>{
      if(/^\+\s*[\d.]+\s*Teil/.test(b.textContent.trim()))b.textContent=`+${num(orderClickParts())} Teile`;
    });
    const root=document.getElementById('root');
    if(root&&tap&&!document.getElementById('activeProductionHint')){
      const base=machineBase();
      const hint=base>0
        ?`Aktivfertigung: 8 % Maschinen-Grundleistung pro Klick · Maschinenbasis ${euro(base)}/s · Auftragstipp +${num(orderClickParts())} Teile`
        :`Aktivfertigung aktiv · nach Prestige startet der Klick bei ${euro(clickCash())}; mit neuen Maschinen steigt er automatisch · Auftragstipp +${num(orderClickParts())} Teil`;
      tap.insertAdjacentHTML('afterend',`<div id="activeProductionHint" class="desc" style="text-align:center;margin-top:6px">${hint}</div>`);
    }
  }

  let tries=0;
  const wait=setInterval(()=>{
    tries++;
    if(patchTap()||tries>120){clearInterval(wait);relabel()}
  },100);
  const obs=new MutationObserver(relabel);obs.observe(document.documentElement,{childList:true,subtree:true});
})();
