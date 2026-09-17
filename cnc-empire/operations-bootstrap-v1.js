import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const readState=()=>{try{return JSON.parse(localStorage.getItem('cncEmpireMobileV2')||'null')}catch{return null}};

async function config(){
  const text=await fetch('./v3part1.txt?v=9',{cache:'no-store'}).then(r=>r.text());
  const url=text.match(/const API='(https:\/\/[^']+)\/rest\/v1\/player_profiles'/)?.[1];
  const key=text.match(/const APIKEY='([^']+)'/)?.[1];
  if(!url||!key)throw new Error('Operations-Konfiguration fehlt');
  return {url,key};
}

(async()=>{
  try{
    const cfg=await config();
    const supabase=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    let session=null;
    while(!session){
      const result=await supabase.auth.getSession();
      session=result.data?.session||null;
      if(!session)await sleep(400);
    }
    const mod=await import('./operations-v1.js?v=1');
    await mod.initCncOperations({supabase,user:session.user,readState});
    if(document.getElementById('operationsSystems'))window.G?.tab?.('operations');
  }catch(error){
    console.error('CNC operations bootstrap',error);
  }
})();
