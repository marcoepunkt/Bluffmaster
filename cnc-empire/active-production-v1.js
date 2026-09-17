(()=>{
  const OUTPUT={manual:0,cnc:3,bar:14,turnmill:60,robot:280,lights:1400,swiss:8000,grind:45000,fiveaxis:280000,fms:2000000,smart:15000000};
  const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:Math.abs(Number(n)||0)<100?2:0}).format(Number(n)||0);
  const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);
  function state(){return window.CNC_GAME_BRIDGE?.getState?.()||null}
  function machineBase(){const s=state(),m=s?.m||{};return Object.entries(OUTPUT).reduce((sum,[id,out])=>sum+(Number(m[id])||0)*out,0)}
  function prestigeMult(){const p=Math.max(0,Number(state()?.prestige)||0);return 1+Math.min(.60,p*.03)}
  function toolingMult(){const lv=Math.max(0,Number(state()?.starShop?.tooling)||0);return 1+lv*.05}
  function clickCash(){return Math.max(1,machineBase()*.08)*prestigeMult()*toolingMult()}
  function orderClickParts(){const rate=Math.max(.125,Number(window.CNC_GAME_BRIDGE?.partRate?.())||.125);return Math.max(1,Math.round(rate*.15*toolingMult()))}
  function patchTap(){
    if(!window.G||!window.CNC_GAME_BRIDGE)return false;
    if(window.G.__activeProductionPatched)return true;
    const original=window.G.tap;if(typeof original!=='function')return false;
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
        const already=Math.max(0,(Number(after.order.done)||0)-beforeOrder.done);
        const extraParts=Math.max(0,targetParts-already);
        if(extraParts>0)after.order.done=Math.min(Number(after.order.q)||0,(Number(after.order.done)||0)+extraParts);
      }
      window.CNC_GAME_BRIDGE.save?.();
      window.CNC_GAME_BRIDGE.render?.();
    };
    window.G.__activeProductionPatched=true;
    window.CNC_ACTIVE_PRODUCTION={clickCash,orderClickParts,machineBase};
    return true;
  }
  function updateDisplay(){
    if(!patchTap())return;
    const tap=document.querySelector('button.tap');
    if(tap){const html=`TEIL FERTIGEN<br><span style="font-size:11px">+ ${euro(clickCash())}</span>`;if(tap.innerHTML!==html)tap.innerHTML=html}
    const parts=orderClickParts();
    document.querySelectorAll('button.btn.secondary').forEach(b=>{
      if(/^\+\s*[\d.]+\s*Teil/.test(b.textContent.trim())){const text=`+${num(parts)} ${parts===1?'Teil':'Teile'}`;if(b.textContent!==text)b.textContent=text}
    });
    const root=document.getElementById('root');
    if(root&&tap){
      const base=machineBase();
      const hint=base>0?`Aktivfertigung · Maschinenbasis ${euro(base)}/s · Klick ${euro(clickCash())} · Auftrag +${num(parts)} ${parts===1?'Teil':'Teile'}`:`Aktivfertigung aktiv · mit neuen Maschinen steigt der Klick automatisch`;
      let el=document.getElementById('activeProductionHint');
      if(!el){tap.insertAdjacentHTML('afterend','<div id="activeProductionHint" class="desc" style="text-align:center;margin-top:6px"></div>');el=document.getElementById('activeProductionHint')}
      if(el&&el.textContent!==hint)el.textContent=hint;
    }
  }
  let tries=0;
  const boot=setInterval(()=>{tries++;if(patchTap()||tries>120){clearInterval(boot);updateDisplay()}},100);
  setInterval(updateDisplay,500);
})();
