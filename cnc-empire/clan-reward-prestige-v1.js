(async()=>{
  for(let i=0;i<100&&!window.CNC_CLAN_BATTLE;i++)await new Promise(r=>setTimeout(r,100));
  const battle=window.CNC_CLAN_BATTLE;if(!battle)return;

  async function readConfig(){
    const text=await fetch('./v3part1.txt?v=7',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Konfiguration fehlt');return r.text()});
    const url=text.match(/const API='(https:\/\/[^']+)\/rest\/v1\/player_profiles'/)?.[1];
    const key=text.match(/const APIKEY='([^']+)'/)?.[1];
    if(!url||!key)throw new Error('Online-Konfiguration fehlt');return {url,key};
  }

  const [{createClient},cfg]=await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm'),
    readConfig()
  ]);
  const sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  function applyPrestige(value){
    const prestige=Math.max(0,Math.floor(Number(value)||0));
    const st=window.CNC_GAME_BRIDGE?.getState?.();
    if(!st)return;
    if(prestige>Math.max(0,Math.floor(Number(st.prestige)||0))){
      st.prestige=prestige;
      window.CNC_GAME_BRIDGE?.save?.();
    }
  }

  battle.claimWinnerReward=async()=>{
    const R=battle.state?.reward;
    if(!R?.event||!R?.mine||!R.eligible||R.claimed)return;
    const {data,error}=await sb.rpc('claim_clan_event_winner_reward_s2',{p_event_id:R.event.id});
    if(error){
      console.warn('Clan winner reward',error);
      alert('Siegerbelohnung konnte nicht abgeholt werden. Bitte Online-Daten aktualisieren.');
      return;
    }
    applyPrestige(data?.prestige);
    await battle.refresh?.();
    alert(data?.prestige_awarded===1?'🏆 Siegerpokal + 1 Prestigepunkt erhalten!':'🏆 Siegerbelohnung bereits abgeholt.');
    window.G?.tab?.('online');
  };

  function relabel(){
    document.querySelectorAll('button[onclick="CNC_CLAN_BATTLE.claimWinnerReward()"]')
      .forEach(b=>b.textContent='🏆 Pokal + 1 Prestigepunkt abholen');
    document.querySelectorAll('.onlineNotice').forEach(el=>{
      if(el.textContent.includes('Siegerpokal bereits erhalten.'))el.textContent='🏆 Siegerpokal + 1 Prestigepunkt bereits erhalten.';
      if(el.textContent.includes('Deine Firma hat Platz 1 erreicht')&&!el.textContent.includes('Prestigepunkt'))el.innerHTML+=' <b>Belohnung: +1 Prestigepunkt.</b>';
    });
  }
  const observer=new MutationObserver(relabel);observer.observe(document.documentElement,{childList:true,subtree:true});relabel();
})().catch(e=>console.error('Clan prestige reward patch',e));
