(()=>{
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function date(iso){try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))}catch{return '—'}}
  function render(){
    const battle=window.CNC_CLAN_BATTLE,state=battle?.state;if(!state)return '';
    const wins=(state.history||[]).filter(x=>x.claimed);
    const items=wins.length?wins.slice(0,6).map(x=>`<div class="onlineRow"><span>🏆</span><div><div class="name">${esc(x.event.name)}</div><div class="desc">${date(x.event.ends_at)} · ${esc(x.winner?.clan_name||'Siegerfirma')}</div></div><div class="score">+1 ★</div></div>`).join(''):'<div class="muted">Noch kein Firmen-Cup gewonnen.</div>';
    return `<div id="profileTrophyCabinet"><div class="section">🏆 Pokalvitrine</div><div class="grid"><div class="card stat"><div class="label">Firmen-Cup-Siege</div><div class="value">${state.trophies||0}</div><div class="sub">Siegerpokale</div></div><div class="card stat"><div class="label">Cup-Prestige</div><div class="value">+${state.trophies||0} ★</div><div class="sub">durch abgeholte Siege</div></div></div><div class="card item" style="margin-top:9px">${items}</div></div>`;
  }
  function attach(){
    const root=document.getElementById('root');if(!root||document.getElementById('profileTrophyCabinet'))return;
    if(!root.textContent.includes('Werkstattprofil'))return;
    const html=render();if(!html)return;
    root.insertAdjacentHTML('beforeend',html);
  }
  const obs=new MutationObserver(attach);obs.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(attach,2000);attach();
})();
