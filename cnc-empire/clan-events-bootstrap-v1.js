(async()=>{
  while(!window.CNC_ONLINE) await new Promise(r=>setTimeout(r,400));
  try{await import('./clan-events-v1.js?v=3')}catch(e){console.error('Clan battle loader',e)}
})();
