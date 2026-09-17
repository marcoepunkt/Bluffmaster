import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm';

const $=id=>document.getElementById(id);
const baseUrl=location.origin+location.pathname;
let recoveryClient=null;
let recoveryActive=false;

function authMessage(text,type='info'){
  const el=$('authMessage');
  if(!el)return;
  el.textContent=text||'';
  el.dataset.type=type;
}

async function readConfig(){
  const text=await fetch('./v3part1.txt?v=8',{cache:'no-store'}).then(r=>{
    if(!r.ok)throw new Error('Konfiguration konnte nicht geladen werden.');
    return r.text();
  });
  const url=text.match(/const API='(https:\/\/[^']+)\/rest\/v1\/player_profiles'/)?.[1];
  const key=text.match(/const APIKEY='([^']+)'/)?.[1];
  if(!url||!key)throw new Error('Online-Konfiguration fehlt.');
  return {url,key};
}

function installStyles(){
  if($('recoveryStyles'))return;
  const style=document.createElement('style');
  style.id='recoveryStyles';
  style.textContent=`
    .authforgot{width:100%;margin-top:2px;background:transparent;color:#8fbce8;border:0;min-height:40px;font-weight:800}
    .recoveryOverlay{position:fixed;inset:0;z-index:9999;background:#07101eef;display:flex;align-items:center;justify-content:center;padding:18px}
    .recoveryBox{width:min(100%,440px);background:#10223a;border:1px solid #ffffff20;border-radius:18px;padding:18px;color:#fff;box-shadow:0 18px 50px #0008}
    .recoveryBox h2{margin:0 0 6px;font-size:20px}.recoveryBox p{color:#aebdd0;font-size:12px;line-height:1.45}
    .recoveryBox input{display:block;width:100%;box-sizing:border-box;margin:9px 0;background:#081421;border:1px solid #ffffff20;color:#fff;border-radius:12px;padding:13px;font-size:16px}
    .recoveryBox button{width:100%;min-height:44px;border:0;border-radius:12px;font-weight:900;margin-top:8px;background:linear-gradient(#ffd071,#ff9823);color:#241503}
    .recoveryStatus{min-height:18px;margin-top:8px;font-size:12px;color:#cfe8ff}.recoveryStatus[data-type="error"]{color:#ffb3b3}.recoveryStatus[data-type="success"]{color:#7df0bb}
  `;
  document.head.appendChild(style);
}

function showRecoveryPanel(){
  if(recoveryActive)return;
  recoveryActive=true;
  installStyles();
  const overlay=document.createElement('div');
  overlay.className='recoveryOverlay';
  overlay.id='recoveryOverlay';
  overlay.innerHTML=`<div class="recoveryBox"><h2>Neues Passwort festlegen</h2><p>Der Wiederherstellungslink wurde bestätigt. Lege jetzt ein neues Passwort mit mindestens 8 Zeichen fest.</p><form id="recoveryForm"><input id="recoveryPassword1" type="password" minlength="8" autocomplete="new-password" placeholder="Neues Passwort" required><input id="recoveryPassword2" type="password" minlength="8" autocomplete="new-password" placeholder="Passwort wiederholen" required><button id="recoverySubmit" type="submit">PASSWORT SPEICHERN</button><div id="recoveryStatus" class="recoveryStatus" aria-live="polite"></div></form></div>`;
  document.body.appendChild(overlay);
  $('recoveryForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const p1=$('recoveryPassword1').value;
    const p2=$('recoveryPassword2').value;
    const status=$('recoveryStatus');
    if(p1.length<8){status.textContent='Mindestens 8 Zeichen verwenden.';status.dataset.type='error';return;}
    if(p1!==p2){status.textContent='Die Passwörter stimmen nicht überein.';status.dataset.type='error';return;}
    $('recoverySubmit').disabled=true;
    status.textContent='Passwort wird gespeichert …';status.dataset.type='info';
    const {error}=await recoveryClient.auth.updateUser({password:p1});
    if(error){status.textContent=error.message||'Passwort konnte nicht geändert werden.';status.dataset.type='error';$('recoverySubmit').disabled=false;return;}
    status.textContent='Passwort geändert. Du kannst dich jetzt neu anmelden.';status.dataset.type='success';
    await recoveryClient.auth.signOut();
    setTimeout(()=>location.replace(baseUrl+'?password=changed'),900);
  });
}

async function sendReset(){
  const email=String($('authEmail')?.value||'').trim().toLowerCase();
  if(!email||!email.includes('@')){authMessage('Bitte zuerst deine E-Mail-Adresse eingeben.','error');return;}
  const btn=$('forgotPasswordBtn');
  if(btn)btn.disabled=true;
  authMessage('Reset-Link wird gesendet …');
  let {error}=await recoveryClient.auth.resetPasswordForEmail(email,{redirectTo:baseUrl});
  if(error&&/redirect|url/i.test(String(error.message||''))){
    ({error}=await recoveryClient.auth.resetPasswordForEmail(email));
  }
  if(error){authMessage(error.message||'Reset-Mail konnte nicht gesendet werden.','error');if(btn)btn.disabled=false;return;}
  authMessage('Reset-Mail gesendet. Öffne den Link in der E-Mail und lege danach ein neues Passwort fest.','success');
  if(btn)btn.disabled=false;
}

function installForgotButton(){
  if($('forgotPasswordBtn'))return;
  const anchor=$('authSwitch');
  if(!anchor)return;
  const btn=document.createElement('button');
  btn.id='forgotPasswordBtn';
  btn.type='button';
  btn.className='authforgot';
  btn.textContent='Passwort vergessen?';
  btn.addEventListener('click',sendReset);
  anchor.insertAdjacentElement('afterend',btn);
}

async function bootRecovery(){
  installStyles();
  installForgotButton();
  try{
    const cfg=await readConfig();
    recoveryClient=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'cnc-empire-recovery-v1'}});
    const hinted=location.hash.includes('type=recovery')||location.search.includes('type=recovery');
    recoveryClient.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'&&session)showRecoveryPanel();
    });
    if(hinted){
      const {data:{session}}=await recoveryClient.auth.getSession();
      if(session)showRecoveryPanel();
    }
  }catch(err){
    console.error('CNC recovery init',err);
    const btn=$('forgotPasswordBtn');
    if(btn)btn.disabled=true;
  }
}

bootRecovery();
