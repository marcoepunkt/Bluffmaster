let sb=null,user=null,readState=()=>null,timer=null;
const S={market:[],marketMap:new Map(),clan:null,membership:null,members:[],clanBoard:[],event:null,myParts:0,loading:false,error:'',lastRefresh:0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);
const money=n=>window.CNC_FORMAT_MONEY?.(n)??new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
function code6(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=new Uint8Array(6);crypto.getRandomValues(a);return Array.from(a,b=>chars[b%chars.length]).join('')}
function currentState(){return readState?.()||{}}
function marketMultiplier(material){return Number(S.marketMap.get(material)?.multiplier)||1}
function communityBonus(){return S.event&&Number(S.event.progress_parts)>=Number(S.event.target_parts)?Number(S.event.completion_bonus)||1:1}
function timeLeft(iso){const ms=Math.max(0,new Date(iso).getTime()-Date.now());const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return h>24?Math.ceil(h/24)+' Tage':h+'h '+m+'m'}
function marketTrendClass(t){return t==='HEISS'?'hot':t==='SCHWACH'?'weak':'stable'}
async function refreshMarket(){
  const {data,error}=await sb.from('world_market_s2').select('material,multiplier,trend,next_change_at,sort_order').order('sort_order');
  if(error)throw error;S.market=data||[];S.marketMap=new Map(S.market.map(x=>[x.material,x]));
}
async function refreshCommunity(){
  const now=new Date().toISOString();
  let {data,error}=await sb.from('community_event_status_s2').select('*').lte('starts_at',now).gt('ends_at',now).order('starts_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  if(!data){const next=await sb.from('community_event_status_s2').select('*').gt('starts_at',now).order('starts_at').limit(1).maybeSingle();if(next.error)throw next.error;data=next.data||null}
  S.event=data;
  S.myParts=0;
  if(S.event&&new Date(S.event.starts_at)<=new Date()&&new Date(S.event.ends_at)>new Date()){
    const mine=await sb.from('community_contributions_s2').select('parts').eq('event_id',S.event.id).eq('user_id',user.id).maybeSingle();
    if(mine.error)throw mine.error;S.myParts=Number(mine.data?.parts)||0;
  }
}
async function refreshClan(){
  const mem=await sb.from('clan_members_s2').select('user_id,clan_id,display_name,joined_at').eq('user_id',user.id).maybeSingle();
  if(mem.error)throw mem.error;S.membership=mem.data||null;S.clan=null;S.members=[];
  const board=await sb.from('clan_leaderboard_s2').select('clan_id,name,members,season_score,prestige_total').order('season_score',{ascending:false}).limit(25);
  if(board.error)throw board.error;S.clanBoard=board.data||[];
  if(!S.membership)return;
  const clanRes=await sb.from('clans_s2').select('id,name,join_code,owner_id,created_at').eq('id',S.membership.clan_id).maybeSingle();
  if(clanRes.error)throw clanRes.error;S.clan=clanRes.data||null;if(!S.clan)return;
  const [members,contrib]=await Promise.all([
    sb.from('clan_members_s2').select('user_id,display_name,joined_at').eq('clan_id',S.clan.id).order('joined_at'),
    sb.from('clan_contributions_s2').select('user_id,season_score,prestige').eq('clan_id',S.clan.id)
  ]);
  if(members.error)throw members.error;if(contrib.error)throw contrib.error;
  const cm=new Map((contrib.data||[]).map(x=>[x.user_id,x]));
  S.members=(members.data||[]).map(m=>({...m,score:Number(cm.get(m.user_id)?.season_score)||0,prestige:Number(cm.get(m.user_id)?.prestige)||0})).sort((a,b)=>b.score-a.score);
}
async function syncClanScore(){
  if(!S.membership)return;const st=currentState();const name=String(st.name||'Werkstatt').slice(0,30);const score=Math.max(0,Math.floor(Number(st.lifetime)||0));const prestige=Math.max(0,Math.floor(Number(st.prestige)||0));
  await sb.from('clan_members_s2').update({display_name:name}).eq('user_id',user.id);
  const {error}=await sb.from('clan_contributions_s2').upsert({user_id:user.id,clan_id:S.membership.clan_id,season_score:score,prestige,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)console.warn('Clan sync',error);
}
async function refresh(){
  if(S.loading)return;S.loading=true;S.error='';try{await Promise.all([refreshMarket(),refreshCommunity(),refreshClan()]);await syncClanScore();S.lastRefresh=Date.now()}catch(e){console.error('CNC online refresh',e);S.error=String(e?.message||e)}finally{S.loading=false}
}
async function createClan(){
  if(S.membership)return alert('Du bist bereits in einer Firma.');
  const el=document.getElementById('clanNameInput');const name=String(el?.value||'').trim();if(name.length<3||name.length>24)return alert('Firmenname: 3 bis 24 Zeichen.');
  let clan=null;
  for(let i=0;i<5;i++){
    const join_code=code6();const ins=await sb.from('clans_s2').insert({name,join_code,owner_id:user.id}).select('id,name,join_code,owner_id').single();
    if(!ins.error){clan=ins.data;break}if(String(ins.error?.message||'').toLowerCase().includes('join_code'))continue;alert('Firma konnte nicht erstellt werden: '+ins.error.message);return;
  }
  if(!clan)return alert('Kein freier Firmencode gefunden. Bitte erneut versuchen.');
  const st=currentState();const mem=await sb.from('clan_members_s2').insert({user_id:user.id,clan_id:clan.id,display_name:String(st.name||'Werkstatt').slice(0,30)});
  if(mem.error){await sb.from('clans_s2').delete().eq('id',clan.id);alert('Beitritt zur eigenen Firma fehlgeschlagen.');return}
  await refresh();window.G?.tab?.('online');
}
async function joinClan(){
  if(S.membership)return alert('Du bist bereits in einer Firma.');const el=document.getElementById('clanCodeInput');const code=String(el?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6)return alert('Der Firmencode hat 6 Zeichen.');
  const res=await sb.from('clans_s2').select('id,name').eq('join_code',code).maybeSingle();if(res.error)return alert('Firma konnte nicht gesucht werden.');if(!res.data)return alert('Firmencode nicht gefunden.');
  const st=currentState();const mem=await sb.from('clan_members_s2').insert({user_id:user.id,clan_id:res.data.id,display_name:String(st.name||'Werkstatt').slice(0,30)});if(mem.error)return alert('Beitritt fehlgeschlagen: '+mem.error.message);
  await refresh();window.G?.tab?.('online');
}
async function leaveClan(){
  if(!S.membership||!S.clan)return;const ok=confirm('Firma wirklich verlassen? Deine bisherigen Firmenpunkte werden aus der Firmenwertung entfernt.');if(!ok)return;
  if(S.clan.owner_id===user.id){
    const next=S.members.find(m=>m.user_id!==user.id);
    if(next){const tr=await sb.from('clans_s2').update({owner_id:next.user_id}).eq('id',S.clan.id);if(tr.error)return alert('Firmenleitung konnte nicht übertragen werden.');}
    else {const del=await sb.from('clans_s2').delete().eq('id',S.clan.id);if(del.error)return alert('Firma konnte nicht gelöscht werden.');await refresh();window.G?.tab?.('online');return;}
  }
  await sb.from('clan_contributions_s2').delete().eq('user_id',user.id);
  const del=await sb.from('clan_members_s2').delete().eq('user_id',user.id);if(del.error)return alert('Firma konnte nicht verlassen werden.');
  await refresh();window.G?.tab?.('online');
}
async function recordOrderClaim(order){
  if(!S.event||!order)return;const now=Date.now();if(now<new Date(S.event.starts_at).getTime()||now>=new Date(S.event.ends_at).getTime())return;if(String(order.mat)!==String(S.event.material))return;
  const add=Math.max(0,Math.floor(Number(order.q)||0));if(!add)return;const next=S.myParts+add;
  const {error}=await sb.from('community_contributions_s2').upsert({event_id:S.event.id,user_id:user.id,parts:next,updated_at:new Date().toISOString()},{onConflict:'event_id,user_id'});
  if(error){console.warn('Community contribution',error);return}S.myParts=next;S.event={...S.event,progress_parts:Number(S.event.progress_parts||0)+add,contributors:Math.max(Number(S.event.contributors)||0,1)};
  setTimeout(()=>refreshCommunity().then(()=>{if(document.getElementById('onlineSystems'))window.G?.tab?.('online')}),400);
}
function renderClan(){
  const rank=S.membership?S.clanBoard.findIndex(x=>x.clan_id===S.membership.clan_id)+1:0;
  const board=S.clanBoard.length?S.clanBoard.slice(0,10).map((c,i)=>`<div class="onlineRow"><b>${i+1}</b><div><div class="name">${esc(c.name)}</div><div class="desc">${num(c.members)} Mitglieder · ★ ${num(c.prestige_total)}</div></div><div class="score">${money(c.season_score)}</div></div>`).join(''):'<div class="muted">Noch keine Firmen gegründet.</div>';
  if(!S.clan)return `<div class="section">🏢 Firmen / Clans</div><div class="card item"><div class="name">Gemeinsam Saisonpunkte sammeln</div><div class="desc">Gründe eine Firma oder tritt mit einem 6-stelligen Firmencode bei. Die Umsätze aller Mitglieder zählen für die Firmenrangliste.</div><input id="clanNameInput" class="field" maxlength="24" placeholder="Firmenname"><button class="btn onlineWide" onclick="CNC_ONLINE.createClan()">Firma gründen</button><div class="onlineOr">oder</div><input id="clanCodeInput" class="field" maxlength="6" autocapitalize="characters" placeholder="Firmencode"><button class="btn secondary onlineWide" onclick="CNC_ONLINE.joinClan()">Firma beitreten</button></div><div class="section">Firmenrangliste</div><div class="card item">${board}</div>`;
  const memberRows=S.members.map((m,i)=>`<div class="onlineRow"><span>${i+1}</span><div><div class="name">${esc(m.display_name)}${m.user_id===S.clan.owner_id?' 👑':''}</div><div class="desc">★ ${num(m.prestige)} Meister</div></div><div class="score">${money(m.score)}</div></div>`).join('');
  return `<div class="section">🏢 Deine Firma</div><div class="card item clanHero"><div class="row"><div><div class="name">${esc(S.clan.name)}</div><div class="desc">Firmenrang ${rank||'–'} · ${S.members.length} Mitglieder</div></div><div class="clanCode">${esc(S.clan.join_code)}</div></div><div class="desc">Teile den Firmencode mit Freunden.</div><button class="btn danger mini" onclick="CNC_ONLINE.leaveClan()">Firma verlassen</button></div><div class="section">Mitglieder</div><div class="card item">${memberRows||'<div class="muted">Keine Mitglieder.</div>'}</div><div class="section">Firmenrangliste</div><div class="card item">${board}</div>`;
}
function renderMarket(){
  const next=S.market[0]?.next_change_at;const cards=S.market.map(m=>`<div class="marketChip ${marketTrendClass(m.trend)}"><b>${esc(m.material)}</b><span>×${Number(m.multiplier).toFixed(2)}</span><small>${esc(m.trend)}</small></div>`).join('');
  return `<div class="section">📈 Live-Weltmarkt</div><div class="card item"><div class="desc">Jeder Auftrag wird mit dem aktuellen Materialfaktor verrechnet. Die Kurse sind für alle Spieler gleich und wechseln alle 6 Stunden.${next?' Nächster Wechsel in '+timeLeft(next)+'.':''}</div><div class="marketGrid">${cards}</div></div>`;
}
function renderCommunity(){
  if(!S.event)return `<div class="section">🌍 Community-Auftrag</div><div class="card item"><div class="muted">Kein Community-Auftrag geplant.</div></div>`;
  const now=Date.now(),start=new Date(S.event.starts_at).getTime(),active=now>=start&&now<new Date(S.event.ends_at).getTime();const progress=Number(S.event.progress_parts)||0,target=Number(S.event.target_parts)||1,pct=Math.min(100,progress/target*100),done=progress>=target;
  return `<div class="section">🌍 Community-Auftrag</div><div class="card item communityCard"><div class="row"><div><div class="name">${esc(S.event.name)}</div><div class="desc">${esc(S.event.material)} · ${active?'endet in '+timeLeft(S.event.ends_at):'startet in '+timeLeft(S.event.starts_at)}</div></div><div class="score">${pct.toFixed(1)}%</div></div><div class="progress"><span style="width:${pct}%"></span></div><div class="row"><span class="muted">${num(progress)} / ${num(target)} Teile</span><span class="muted">${num(S.event.contributors)} Spieler</span></div><div class="communityMine">Dein Beitrag: <b>${num(S.myParts)} Teile</b></div><div class="notice onlineNotice">${done?`✅ Ziel erreicht: Bis Eventende erhalten alle Spieler ×${Number(S.event.completion_bonus).toFixed(2)} auf neue Aufträge.`:`Schließe Aufträge aus <b>${esc(S.event.material)}</b> ab. Die gefertigte Stückzahl zählt automatisch für alle.`}</div></div>`;
}
function render(){
  if(S.loading&&!S.lastRefresh)return `<div id="onlineSystems"><div class="notice">Online-Systeme werden geladen …</div></div>`;
  return `<div id="onlineSystems">${S.error?'<div class="notice">Online-Daten konnten nicht vollständig aktualisiert werden.</div>':''}${renderCommunity()}${renderMarket()}${renderClan()}<div class="onlineRefresh"><button class="btn secondary" onclick="CNC_ONLINE.manualRefresh()">Online-Daten aktualisieren</button></div></div>`;
}
async function manualRefresh(){await refresh();window.G?.tab?.('online')}
function start(){if(timer)clearInterval(timer);timer=setInterval(async()=>{await syncClanScore();if(Date.now()-S.lastRefresh>30000)await refresh()},15000)}
function stop(){if(timer)clearInterval(timer);timer=null}
export async function initCncOnline(ctx){sb=ctx.supabase;user=ctx.user;readState=ctx.readState||(()=>null);const api={render,refresh,manualRefresh,marketMultiplier,communityBonus,recordOrderClaim,createClan,joinClan,leaveClan,start,stop,state:S};window.CNC_ONLINE=api;await refresh();start();return api}
