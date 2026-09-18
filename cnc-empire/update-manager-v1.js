(()=>{
  const CURRENT=String(window.CNC_RELEASE||'unknown');
  const CHECK_INTERVAL_MS=60000;
  let checking=false,updating=false,timer=null;

  function releaseUrl(){return './release.json?check='+Date.now()}
  async function readRelease(){
    const res=await fetch(releaseUrl(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(!res.ok)throw new Error('release '+res.status);
    const data=await res.json();
    if(!data||typeof data.version!=='string'||!data.version)return null;
    return data;
  }
  async function registerWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      await navigator.serviceWorker.register('./sw-v1.js?r='+encodeURIComponent(CURRENT),{scope:'./',updateViaCache:'none'});
    }catch(err){console.warn('CNC updater service worker',err)}
  }
  function styleOverlay(){
    if(document.getElementById('cncUpdateStyle'))return;
    const style=document.createElement('style');style.id='cncUpdateStyle';
    style.textContent='.cncUpdateOverlay{position:fixed;inset:0;z-index:99999;background:#06101df2;display:grid;place-items:center;padding:22px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cncUpdateCard{width:min(100%,460px);background:linear-gradient(180deg,#172b47,#0d1b30);border:1px solid #ffffff24;border-radius:20px;padding:20px;color:#fff;box-shadow:0 24px 70px #000a;text-align:center}.cncUpdateIcon{font-size:42px}.cncUpdateTitle{font-size:22px;font-weight:950;margin-top:8px}.cncUpdateText{font-size:12px;line-height:1.5;color:#b9c9dd;margin:8px 0 16px}.cncUpdateButton{width:100%;min-height:50px;border:0;border-radius:13px;background:linear-gradient(#ffd071,#ff9823);color:#241503;font-weight:950;font-size:15px}.cncUpdateCount{font-size:10px;color:#9fb0c8;margin-top:10px}';
    document.head.appendChild(style);
  }
  async function reloadInto(version){
    if(updating)return;updating=true;
    try{
      const saver=window.CNC_PREPARE_UPDATE;
      if(typeof saver==='function')await Promise.race([Promise.resolve(saver()),new Promise(resolve=>setTimeout(resolve,5000))]);
    }catch(err){console.warn('CNC updater save',err)}
    const url=new URL(location.href);
    url.searchParams.set('release',version);
    url.searchParams.set('reload',Date.now().toString(36));
    location.replace(url.toString());
  }
  function showUpdate(release){
    if(updating||document.getElementById('cncUpdateOverlay'))return;
    styleOverlay();
    const overlay=document.createElement('div');overlay.id='cncUpdateOverlay';overlay.className='cncUpdateOverlay';
    overlay.innerHTML='<div class="cncUpdateCard"><div class="cncUpdateIcon">🔄</div><div class="cncUpdateTitle">Spiel-Update verfügbar</div><div class="cncUpdateText">Dein Spielstand wird gespeichert. Danach startet CNC EMPIRE automatisch mit der neuesten Version.</div><button id="cncUpdateNow" class="cncUpdateButton" type="button">JETZT AKTUALISIEREN</button><div id="cncUpdateCount" class="cncUpdateCount"></div></div>';
    document.body.appendChild(overlay);
    let left=8;
    const count=document.getElementById('cncUpdateCount');
    const draw=()=>{if(count)count.textContent='Automatischer Neustart in '+left+' s'};
    draw();
    document.getElementById('cncUpdateNow')?.addEventListener('click',()=>reloadInto(release.version),{once:true});
    timer=setInterval(()=>{left-=1;draw();if(left<=0){clearInterval(timer);reloadInto(release.version)}},1000);
  }
  async function check(){
    if(checking||updating||!navigator.onLine)return;
    checking=true;
    try{
      const release=await readRelease();
      if(release&&release.version!==CURRENT)showUpdate(release);
    }catch(err){console.warn('CNC updater check',err)}
    finally{checking=false}
  }
  registerWorker();
  check();
  setInterval(check,CHECK_INTERVAL_MS);
  window.addEventListener('online',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
  window.CNC_UPDATE={check,current:CURRENT};
})();