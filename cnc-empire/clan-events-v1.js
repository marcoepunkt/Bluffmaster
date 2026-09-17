let sb=null,user=null,api=null,timer=null;
const BATTLE_REFRESH_MS=30000;
const REWARD_REFRESH_MS=300000;
const B={event:null,nextEvent:null,board:[],mine:null,loading:false,error:'',lastRefresh:0,lastRewardRefresh:0,rewards:[],history:[],openRewards:[],trophies:0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n)||0);
const date=iso=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(iso));
function timeLeft(iso){const ms=Math.max(0,new Date(iso).getTime()-Date.now());const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);return d>0?`${d} Tage ${h} Std.`:h>0?`${h} Std. ${m} Min.`:`${m} Min.`}
function durationText(a,b){const h=Math.max(0,Math.round((new Date(b)-new Date(a))/3600000));return h%24===0?`${h/24} Tage`:`${h} Std.`}
async function readConfig(){const text=await fetch('./v3part1.txt?v=10',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Konfiguration fehlt');return r.text()});const url=text.match(/const API='(https:\/\/[^']+)\/rest\/v1\/player_profiles_s2'/)?.[1];const key=text.match(/const APIKEY='([^']+)'/)?.[1];if(!url||!key)throw new Error('Online-Konfiguration fehlt');return {url,key}}
async function initClient(){const [{createClient},cfg]=await Promise.all([import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm'),readConfig()]);sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data:{session}}=await sb.auth.getSession();user=session?.user||null;if(!user)throw new Error('Nicht angemeldet')}
function currentClan(){return api?.state?.membership?.clan_id||null}
function applyPrestige(value){const p=Math.max(0,Math.floor(Number(value)||0)),st=window.CNC_GAME_BRIDGE?.getState?.();if(!st)return;if(p>Math.max(0,Math.floor(Number(st.prestige)||0))){st.prestige=p;window.CNC_GAME_BRIDGE?.save?.()}}
async function eventBoard(eventId){const q=await sb.from('clan_event_leaderboard_s2').select('event_id,clan_id,clan_name,parts,contributors').eq('event_id',eventId).order('parts',{ascending:false}).limit(25);if(q.error)throw q.error;return q.data||[]}
async function refreshBattle(){
  if(!sb||!user||B.loading)return;B.loading=true;B.error='';
  try{
    const previousEventId=B.event?.id||null;
    const now=new Date().toISOString();
    const [active,next]=await Promise.all([
      sb.from('clan_events_s2').select('*').lte('starts_at',now).gt('ends_at',now).order('starts_at',{ascending:false}).limit(1).maybeSingle(),
      sb.from('clan_events_s2').select('*').gt('starts_at',now).order('starts_at').limit(1).maybeSingle()
    ]);
    if(active.error)throw active.error;if(next.error)throw next.error;
    B.event=active.data||null;B.nextEvent=next.data||null;B.board=[];B.mine=null;
    if(previousEventId&&previousEventId!==B.event?.id)B.lastRewardRefresh=0;
    if(B.event){
      B.board=await eventBoard(B.event.id);
      const mine=await sb.from('clan_event_contributions_s2').select('event_id,clan_id,parts').eq('event_id',B.event.id).eq('user_id',user.id).maybeSingle();
      if(mine.error)throw mine.error;B.mine=mine.data||null;
    }
    B.lastRefresh=Date.now();
  }catch(e){console.error('Clan battle refresh',e);B.error=String(e?.message||e)}finally{B.loading=false}
}
async function refreshRewards(force=false){
  if(!sb||!user)return;
  if(!force&&Date.now()-B.lastRewardRefresh<REWARD_REFRESH_MS)return;
  try{
    const now=new Date().toISOString();
    const [events,rewards,contrib]=await Promise.all([
      sb.from('clan_events_s2').select('id,event_key,name,material,starts_at,ends_at,target_per_clan').lte('ends_at',now).order('ends_at',{ascending:false}).limit(12),
      sb.from('clan_event_rewards_s2').select('event_id,clan_id,awarded_at').eq('user_id',user.id).order('awarded_at',{ascending:false}),
      sb.from('clan_event_contributions_s2').select('event_id,clan_id,parts').eq('user_id',user.id)
    ]);
    if(events.error)throw events.error;if(rewards.error)throw rewards.error;if(contrib.error)throw contrib.error;
    B.rewards=rewards.data||[];B.trophies=B.rewards.length;
    const rewardIds=new Set(B.rewards.map(x=>x.event_id));
    const mineMap=new Map((contrib.data||[]).map(x=>[x.event_id,x]));
    const history=[];
    for(const ev of events.data||[]){
      const board=await eventBoard(ev.id),winner=board[0]||null,mine=mineMap.get(ev.id)||null;
      const ownRow=mine?board.find(x=>x.clan_id===mine.clan_id):null;
      const eligible=!!(mine&&Number(mine.parts)>0&&winner&&ownRow&&Number(ownRow.parts)===Number(winner.parts));
      const claimed=rewardIds.has(ev.id);
      history.push({event:ev,winner,mine,rank:mine?board.findIndex(x=>x.clan_id===mine.clan_id)+1:0,eligible,claimed});
    }
    B.history=history;B.openRewards=history.filter(x=>x.eligible&&!x.claimed);B.lastRewardRefresh=Date.now();
  }catch(e){console.error('Clan reward/history refresh',e);B.error=B.error||String(e?.message||e)}
}
async function refreshAll(forceRewards=false){await refreshBattle();await refreshRewards(forceRewards)}
async function record(order){if(!B.event||!order)return;const now=Date.now(),start=new Date(B.event.starts_at).getTime(),end=new Date(B.event.ends_at).getTime();if(now<start||now>=end)return;if(String(order.mat)!==String(B.event.material))return;const clanId=currentClan();if(!clanId)return;const add=Math.max(0,Math.floor(Number(order.q)||0));if(!add)return;if(B.mine&&B.mine.clan_id!==clanId){console.warn('Clan battle contribution locked to first clan of event');return}const {data,error}=await sb.rpc('add_clan_event_parts_s2',{p_event_id:B.event.id,p_clan_id:clanId,p_parts:add});if(error){console.warn('Clan battle contribution',error);return}B.mine={event_id:B.event.id,clan_id:clanId,parts:Number(data)||((Number(B.mine?.parts)||0)+add)};setTimeout(async()=>{await refreshBattle();window.CNC_GAME_BRIDGE?.render?.()},350)}
async function claimWinnerReward(eventId){
  const item=B.openRewards.find(x=>x.event.id===eventId);if(!item)return;
  const {data,error}=await sb.rpc('claim_clan_event_winner_reward_s2',{p_event_id:eventId});
  if(error){console.warn('Clan winner reward',error);alert('Siegerbelohnung konnte nicht abgeholt werden. Bitte Online-Daten aktualisieren.');return}
  applyPrestige(data?.prestige);await refreshRewards(true);
  alert(data?.prestige_awarded===1?'🏆 Siegerpokal + 1 Prestigepunkt erhalten!':'🏆 Siegerbelohnung bereits abgeholt.');
  window.CNC_GAME_BRIDGE?.render?.();
}
function renderCurrent(){
  if(!B.event)return `<div class="section">⚔️ Aktueller Firmen-Cup</div><div class="card item"><div class="muted">Aktuell läuft kein Firmen-Cup.</div></div>`;
  const target=Number(B.event.target_per_clan)||1,clanId=currentClan(),rank=clanId?B.board.findIndex(x=>x.clan_id===clanId)+1:0,myRow=clanId?B.board.find(x=>x.clan_id===clanId):null,myParts=Number(myRow?.parts)||0,pct=Math.min(100,myParts/target*100);
  const board=B.board.length?B.board.slice(0,10).map((r,i)=>`<div class="onlineRow"><b>${i+1}</b><div><div class="name">${esc(r.clan_name)}</div><div class="desc">${num(r.contributors)} aktive Mitglieder</div></div><div class="score">${num(r.parts)} Teile</div></div>`).join(''):'<div class="muted">Noch keine Firma hat Eventteile geliefert.</div>';
  let note='Tritt einer Firma bei, um am Firmen-Cup teilzunehmen.';if(clanId)note=`Deine Firma: Rang ${rank||'–'} · ${num(myParts)} Teile. Dein persönlicher Beitrag: ${num(B.mine?.parts||0)} Teile.`;if(B.mine&&clanId&&B.mine.clan_id!==clanId)note='Dein Beitrag ist für dieses Event an deine erste Firma gebunden.';
  return `<div class="section">⚔️ Aktueller Firmen-Cup</div><div class="card item communityCard"><div class="row"><div><div class="name">${esc(B.event.name)}</div><div class="desc">${esc(B.event.material)} · ${date(B.event.starts_at)}–${date(B.event.ends_at)} · ${durationText(B.event.starts_at,B.event.ends_at)}</div></div><div class="score">${rank?'#'+rank:'—'}</div></div><div class="notice onlineNotice" style="margin-top:8px"><b>⏱ Noch ${timeLeft(B.event.ends_at)}</b><br>🏆 Belohnung Platz 1: Siegerpokal + ★ 1 Prestigepunkt je beitragendem Mitglied.</div>${clanId?`<div class="progress"><span style="width:${pct}%"></span></div><div class="row"><span class="muted">${num(myParts)} / ${num(target)} Teile</span><span class="muted">${pct.toFixed(1)}%</span></div>`:''}<div class="desc" style="margin-top:8px">${note}<br>Nur abgeschlossene Aufträge aus <b>${esc(B.event.material)}</b> zählen.</div></div><div class="section">Firmen-Cup Rangliste</div><div class="card item">${board}</div>`
}
function renderNext(){
  const e=B.nextEvent;if(!e)return `<div class="section">📅 Nächster Cup</div><div class="card item"><div class="muted">Noch kein weiterer Firmen-Cup geplant.</div></div>`;
  return `<div class="section">📅 Nächster Cup</div><div class="card item"><div class="row"><div><div class="name">${esc(e.name)}</div><div class="desc">${esc(e.material)} · ${date(e.starts_at)}–${date(e.ends_at)} · ${durationText(e.starts_at,e.ends_at)}</div></div><div class="score">in ${timeLeft(e.starts_at)}</div></div><div class="desc">🏆 Platz 1: Siegerpokal + ★ 1 Prestigepunkt je beitragendem Mitglied.</div></div>`
}
function renderOpenRewards(){
  const rows=B.openRewards.map(x=>`<div class="card item"><div class="row"><div><div class="name">🎁 ${esc(x.event.name)}</div><div class="desc">${date(x.event.ends_at)} · Sieger: ${esc(x.winner?.clan_name||'—')} · dein Beitrag ${num(x.mine?.parts||0)} Teile</div></div><div class="score">+1 ★</div></div><button class="btn onlineWide" onclick="CNC_CLAN_BATTLE.claimWinnerReward('${x.event.id}')">🏆 Pokal + 1 Prestigepunkt abholen</button></div>`).join('');
  return `<div class="section">🎁 Offene Belohnungen <span class="sectionHint">${B.openRewards.length}</span></div>${rows?`<div class="list">${rows}</div>`:`<div class="card item"><div class="muted">Keine offenen Firmen-Cup-Belohnungen. Gewonnene Belohnungen verfallen nicht.</div></div>`}`
}
function renderHistory(){
  if(!B.history.length)return `<div class="section">🏆 Cup-Historie</div><div class="card item"><div class="muted">Noch keine abgeschlossenen Firmen-Cups.</div></div>`;
  const rows=B.history.slice(0,8).map(x=>{const mine=x.mine?`Deine Firma #${x.rank||'–'} · ${num(x.mine.parts)} Teile`:'Nicht teilgenommen';const badge=x.claimed?'🏆 gewonnen':x.eligible?'🎁 gewonnen – offen':x.rank?`#${x.rank}`:'—';return `<div class="onlineRow"><span>${badge}</span><div><div class="name">${esc(x.event.name)}</div><div class="desc">${date(x.event.starts_at)}–${date(x.event.ends_at)} · Sieger: ${esc(x.winner?.clan_name||'—')}<br>${mine}</div></div><div class="score">${esc(x.event.material)}</div></div>`}).join('');
  return `<div class="section">🏆 Cup-Historie</div><div class="card item">${rows}</div>`
}
function renderTrophySummary(){return `<div class="section">🏆 Deine Firmen-Cup-Erfolge</div><div class="grid"><div class="card stat"><div class="label">Siegerpokale</div><div class="value">${num(B.trophies)}</div><div class="sub">dauerhaft im Account</div></div><div class="card stat"><div class="label">Cup-Prestige</div><div class="value">+${num(B.trophies)} ★</div><div class="sub">durch abgeholte Siege</div></div></div>`}
function renderBattle(){return `${renderCurrent()}${renderNext()}${renderOpenRewards()}${renderTrophySummary()}${renderHistory()}`}
function patch(){if(!api||api.__clanBattlePatched)return;const baseRender=api.render.bind(api),baseRefresh=api.refresh.bind(api),baseManual=api.manualRefresh?.bind(api),baseRecord=api.recordOrderClaim.bind(api);api.render=()=>{const html=baseRender();return html.replace('<div id="onlineSystems">','<div id="onlineSystems">'+(B.error?'<div class="notice">Firmen-Cup konnte nicht vollständig aktualisiert werden.</div>':'')+renderBattle())};api.refresh=async()=>{await baseRefresh();await refreshAll(false)};api.manualRefresh=async()=>{if(baseManual)await baseManual();await refreshAll(true);window.CNC_GAME_BRIDGE?.render?.()};api.recordOrderClaim=async order=>{await baseRecord(order);await record(order)};api.__clanBattlePatched=true;window.CNC_CLAN_BATTLE={state:B,refresh:()=>refreshAll(true),render:renderBattle,record,claimWinnerReward,renderTrophySummary};}
async function boot(){try{for(let i=0;i<80&&!window.CNC_ONLINE;i++)await new Promise(r=>setTimeout(r,100));api=window.CNC_ONLINE;if(!api)throw new Error('Online-System nicht geladen');await initClient();await refreshAll(true);patch();timer=setInterval(async()=>{await refreshBattle();await refreshRewards(false);if(document.getElementById('onlineSystems'))window.CNC_GAME_BRIDGE?.render?.()},BATTLE_REFRESH_MS);if(document.getElementById('onlineSystems'))window.CNC_GAME_BRIDGE?.render?.()}catch(e){console.error('Clan battle boot',e)}}
boot();
