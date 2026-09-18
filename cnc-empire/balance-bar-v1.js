(()=>{
  const euro=n=>window.CNC_FORMAT_MONEY?.(n)??new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:Math.abs(Number(n)||0)<100?2:0}).format(Number(n)||0);
  let last='';
  function update(){
    const bar=document.getElementById('persistentBalanceBar');
    const value=document.getElementById('persistentBalanceValue');
    if(!bar||!value)return;
    const s=window.CNC_GAME_BRIDGE?.getState?.();
    if(!s){bar.hidden=true;return}
    bar.hidden=false;
    const text=euro(s.money);
    if(text!==last){value.textContent=text;last=text}
  }
  const timer=setInterval(update,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  window.addEventListener('pageshow',update);
  window.CNC_BALANCE_BAR={update,stop:()=>clearInterval(timer)};
  update();
})();
