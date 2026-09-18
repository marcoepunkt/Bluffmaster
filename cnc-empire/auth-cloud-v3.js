const GAME_KEY='cncEmpireMobileV2';
const OLD_GAME_KEY='cncEmpireMobileV1';
const OWNER_KEY='cncEmpireCloudOwnerV2';
const SEASON_KEY='cncEmpireSeason';
const CURRENT_SEASON='2';
const SAVE_TABLE='player_saves_s2';
const GAME_PART_VERSION='11';
const CLOUD_INTERVAL_MS=5000;
let supabase=null,session=null,gameLoaded=false,cloudTimer=null,cloudBusy=false,lastUploaded='',onlineSystems=null,operationsSystems=null,feedbackSystems=null;
const $=id=>document.getElementById(id);

function setMessage(text,type='info'){const el=$('authMessage');if(!el)return;el.textContent=text||'';el.dataset.type=type}
function setCloud(text,state=''){const el=$('cloudStatus');if(!el)return;el.textContent=text;el.dataset.state=state}
function friendlyError(err){const msg=String(err?.message||err||'Unbekannter Fehler');if(/invalid login credentials/i.test(msg))return 'E-Mail oder Passwort ist falsch.';if(/email not confirmed/i.test(msg))return 'Bitte bestätige zuerst deine E-Mail-Adresse.';if(/user already registered/i.test(msg))return 'Diese E-Mail-Adresse ist bereits registriert.';if(/password/i.test(msg)&&/characters|length|weak/i.test(msg))return 'Das Passwort ist zu kurz oder zu schwach.';if(/rate limit/i.test(msg))return 'Zu viele Anfragen. Bitte später erneut versuchen.';return msg}
function parseKey(key){try{const raw=localStorage.getItem(key);if(!raw)return null;const state=JSON.parse(raw);return state&&typeof state==='object'?state:null}catch{return null}}
function readLocalState(){for(const key of [GAME_KEY,OLD_GAME_KEY]){const state=parseKey(key);if(state)return {key,state,raw:JSON.stringify(state)}}return null}
function identityOnly(state){if(!state||typeof state!=='object')return {};const out={};if(typeof state.name==='string'&&state.name.trim())out.name=state.name.slice(0,22);if(Array.isArray(state.friendCodes))out.friendCodes=state.friendCodes.slice(0,100);if(Array.isArray(state.friends))out.friends=state.friends.slice(0,100);if(typeof state.friendCode==='string')out.friendCode=state.friendCode;if(typeof state.playerSecret==='string')out.playerSecret=state.playerSecret;if(typeof state.onlineRegistered==='boolean')out.onlineRegistered=state.onlineRegistered;return out}
function writeLocalState(state){localStorage.setItem(GAME_KEY,JSON.stringify(state));localStorage.removeItem(OLD_GAME_KEY)}
function clearLocalGame(){localStorage.removeItem(GAME_KEY);localStorage.removeItem(OLD_GAME_KEY)}
function prepareSeasonLocal(userId){const season=localStorage.getItem(SEASON_KEY);const owner=localStorage.getItem(OWNER_KEY);if(season===CURRENT_SEASON&&owner===userId)return;const legacy=(!owner||owner===userId)?readLocalState():null;const identity=identityOnly(legacy?.state);clearLocalGame();if(Object.keys(identity).length)writeLocalState(identity);localStorage.setItem(SEASON_KEY,CURRENT_SEASON);localStorage.setItem(OWNER_KEY,userId)}

async function readConfig(){
  const text=await fetch('./v3part1.txt?v='+GAME_PART_VERSION,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Spielkonfiguration konnte nicht geladen werden.');return r.text()});
  const url=text.match(/const API='(https:\/\/[^']+)\/rest\/v1\/player_profiles_s2'/)?.[1];
  const key=text.match(/const APIKEY='([^']+)'/)?.[1];
  if(!url||!key)throw new Error('Online-Konfiguration fehlt.');
  return {url,key};
}
async function initSupabase(){const [{createClient},cfg]=await Promise.all([import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm'),readConfig()]);supabase=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
async function fetchCloudSave(userId){const {data,error}=await supabase.from(SAVE_TABLE).select('state,updated_at').eq('user_id',userId).maybeSingle();if(error)throw error;return data||null}
async function uploadState(state){if(!session?.user||cloudBusy||!state||typeof state!=='object')return false;cloudBusy=true;setCloud('Speichert …','busy');try{const raw=JSON.stringify(state);const {error}=await supabase.from(SAVE_TABLE).upsert({user_id:session.user.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;lastUploaded=raw;setCloud('Saison 2 · Cloud gespeichert','ok');return true}catch(err){console.error('CNC cloud save',err);setCloud(navigator.onLine?'Cloud-Fehler':'Offline – lokal','error');return false}finally{cloudBusy=false}}
async function reconcileSave(){prepareSeasonLocal(session.user.id);setCloud('Saison 2 wird geladen …','busy');const cloud=await fetchCloudSave(session.user.id);if(cloud?.state){writeLocalState(cloud.state);lastUploaded=JSON.stringify(cloud.state)}else lastUploaded='';localStorage.setItem(OWNER_KEY,session.user.id);localStorage.setItem(SEASON_KEY,CURRENT_SEASON);setCloud('Saison 2 · Cloud aktiv','ok')}
async function flushCloud(force=false){if(!session?.user)return;const local=readLocalState();if(!local?.state)return;const raw=JSON.stringify(local.state);if(!force&&raw===lastUploaded)return;await uploadState(local.state)}
function startCloudLoop(){if(cloudTimer)clearInterval(cloudTimer);cloudTimer=setInterval(()=>flushCloud(false),CLOUD_INTERVAL_MS)}

function showAccountBar(){const bar=$('accountBar');if(!bar)return;bar.hidden=false;$('accountEmail').textContent=session?.user?.email||'Account'}
function hideAuth(){$('authGate').hidden=true;$('nav').style.display='';showAccountBar()}
function showAuth(){$('authGate').hidden=false;$('nav').style.display='none';$('accountBar').hidden=true;$('root').innerHTML=''}

async function initOnlineSystems(){if(onlineSystems)return onlineSystems;const mod=await import('./online-systems-v1.js?v=1');onlineSystems=await mod.initCncOnline({supabase,user:session.user,readState:()=>readLocalState()?.state||null});return onlineSystems}
async function initOperationsSystems(){if(operationsSystems)return operationsSystems;const mod=await import('./operations-v1.js?v=9');operationsSystems=await mod.initCncOperations({supabase,user:session.user,readState:()=>readLocalState()?.state||null});return operationsSystems}
async function initFeedbackSystems(){if(feedbackSystems)return feedbackSystems;const mod=await import('./feedback-v1.js?v=1');feedbackSystems=await mod.initCncFeedback({supabase,user:session.user,readState:()=>readLocalState()?.state||null});return feedbackSystems}
function installGameHooks(){if(!window.G||window.G.__onlineHooks)return;const originalClaim=window.G.claim;window.G.claim=()=>{const order=readLocalState()?.state?.order;const completed=order&&Number(order.done)>=Number(order.q);originalClaim();if(completed&&order)window.CNC_ONLINE?.recordOrderClaim?.({...order})};window.G.__onlineHooks=true}
async function loadGame(){
  if(gameLoaded)return;
  gameLoaded=true;
  const root=$('root');
  root.innerHTML='<div class="notice">Saison 2 + Online-Systeme werden gestartet …</div>';
  const files=[1,2,3,4,5,6,7].map(n=>'./v3part'+n+'.txt?v='+GAME_PART_VERSION);
  const parts=await Promise.all(files.map(f=>fetch(f,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(f+' '+r.status);return r.text()})));
  new Function(parts.join(''))();
  installGameHooks();
  const now=readLocalState();if(now)lastUploaded='';
  installCloudReset();
  startCloudLoop();
  await flushCloud(true);
}
function installCloudReset(){if(!window.G||window.G.__cloudReset)return;window.G.reset=async()=>{if(!confirm('Saison-2-Spielstand wirklich löschen? Dein Account bleibt bestehen.'))return;setCloud('Löscht …','busy');const {error}=await supabase.from(SAVE_TABLE).delete().eq('user_id',session.user.id);if(error){setCloud('Löschen fehlgeschlagen','error');alert('Cloud-Spielstand konnte nicht gelöscht werden.');return}clearLocalGame();lastUploaded='';localStorage.removeItem(SEASON_KEY);location.reload()};window.G.__cloudReset=true}

async function enterGame(newSession){if(!newSession?.user)return;session=newSession;hideAuth();try{await reconcileSave();await Promise.all([initOnlineSystems(),initOperationsSystems(),initFeedbackSystems()]);await loadGame()}catch(err){console.error('CNC season2 load',err);gameLoaded=false;setCloud('Cloud-Fehler','error');$('root').innerHTML='<div class="notice"><b>Saison 2 konnte nicht geladen werden.</b><br>Bitte Verbindung prüfen und Seite neu laden.</div>'}}
async function login(email,password){setMessage('Anmeldung läuft …');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setMessage('');await enterGame(data.session)}
async function register(email,password){setMessage('Account wird erstellt …');const {data,error}=await supabase.auth.signUp({email,password});if(error)throw error;if(data.session){setMessage('');await enterGame(data.session)}else{setAuthMode('login');setMessage('Registrierung erstellt. Bitte bestätige die E-Mail und melde dich danach an.','success')}}
function setAuthMode(mode){const registerMode=mode==='register';$('authTitle').textContent=registerMode?'Account erstellen':'Anmelden';$('authSubmit').textContent=registerMode?'REGISTRIEREN':'ANMELDEN';$('authSwitch').textContent=registerMode?'ZURÜCK ZUR ANMELDUNG':'NEUEN ACCOUNT REGISTRIEREN';$('authForm').dataset.mode=registerMode?'register':'login';setMessage('')}
function bindUI(){setAuthMode('login');$('authSwitch').addEventListener('click',()=>setAuthMode($('authForm').dataset.mode==='login'?'register':'login'));$('authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('authEmail').value.trim().toLowerCase();const password=$('authPassword').value;if(!email||!email.includes('@'))return setMessage('Bitte eine gültige E-Mail eingeben.','error');if(password.length<8)return setMessage('Passwort: mindestens 8 Zeichen.','error');$('authSubmit').disabled=true;try{if(e.currentTarget.dataset.mode==='register')await register(email,password);else await login(email,password)}catch(err){setMessage(friendlyError(err),'error')}finally{$('authSubmit').disabled=false}});$('logoutBtn').addEventListener('click',async()=>{$('logoutBtn').disabled=true;await flushCloud(true);window.CNC_ONLINE?.stop?.();window.CNC_OPERATIONS?.stop?.();await supabase.auth.signOut();clearLocalGame();localStorage.removeItem(OWNER_KEY);location.reload()})}
async function boot(){bindUI();showAuth();try{await initSupabase();const {data:{session:existing},error}=await supabase.auth.getSession();if(error)throw error;if(existing)await enterGame(existing);supabase.auth.onAuthStateChange((event,nextSession)=>{if(event==='SIGNED_OUT'){session=null}if(event==='SIGNED_IN'&&nextSession&&!gameLoaded)enterGame(nextSession)})}catch(err){console.error('CNC auth boot',err);setMessage('Online-Anmeldung konnte nicht geladen werden. Bitte Internetverbindung prüfen.','error')}window.addEventListener('online',()=>setCloud('Online – synchronisiert','ok'));window.addEventListener('offline',()=>setCloud('Offline – lokal','error'));document.addEventListener('visibilitychange',()=>{if(document.hidden)flushCloud(true)});window.addEventListener('pagehide',()=>{flushCloud(true)})}

boot();