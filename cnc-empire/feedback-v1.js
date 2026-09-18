let sb=null,user=null,readState=()=>null;
const S={items:[],isAdmin:false,busy:false,message:'',error:''};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(iso){try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch{return '—'}}
function statusLabel(status){return status==='implemented'?'Umgesetzt':status==='rejected'?'Abgelehnt':'Offen'}
function statusIcon(status){return status==='implemented'?'✅':status==='rejected'?'❌':'🟡'}
function rerender(){window.CNC_GAME_BRIDGE?.render?.()}
function setMessage(text,error=false){S.message=error?'':text;S.error=error?text:''}

function suggestionHtml(item,admin=false){
  const note=item.admin_note?'<div class="feedbackNote">Admin: '+esc(item.admin_note)+'</div>':'';
  let actions='';
  if(admin){
    const done=item.status==='implemented'?'':'<button class="btn mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'implemented\')">✅ Umgesetzt</button>';
    const reject=item.status==='rejected'?'':'<button class="btn danger mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'rejected\')">❌ Ablehnen</button>';
    const reopen=item.status==='open'?'':'<button class="btn secondary mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'open\')">↩ Öffnen</button>';
    actions='<div class="feedbackActions">'+done+reject+reopen+'</div>';
  }
  return '<div class="feedbackEntry">'
    +'<div class="feedbackEntryHead"><div><div class="name">'+esc(item.title)+'</div><div class="muted">'+esc(item.player_name||'Werkstatt')+' · '+date(item.created_at)+'</div></div>'
    +'<span class="feedbackStatus '+esc(item.status)+'">'+statusIcon(item.status)+' '+statusLabel(item.status)+'</span></div>'
    +'<div class="feedbackDescription">'+esc(item.description)+'</div>'+note+actions+'</div>';
}

function render(){
  const own=S.items.filter(x=>x.user_id===user?.id);
  const ownHtml=own.length?own.map(x=>suggestionHtml(x,false)).join(''):'<div class="muted">Du hast noch keinen Vorschlag eingereicht.</div>';
  const msg=S.error?'<div class="feedbackMessage error">'+esc(S.error)+'</div>':S.message?'<div class="feedbackMessage ok">'+esc(S.message)+'</div>':'';
  const form='<div class="section">💡 Verbesserungsvorschläge</div><div class="card item feedbackCard">'
    +'<div class="name">Idee fürs Spiel einreichen</div><div class="desc">Was sollen wir an CNC EMPIRE verbessern oder ergänzen?</div>'
    +'<input id="feedbackTitle" class="field" maxlength="80" placeholder="Kurzer Titel">'
    +'<textarea id="feedbackDescription" class="field feedbackTextArea" maxlength="1200" placeholder="Beschreibe deinen Vorschlag möglichst konkret."></textarea>'
    +'<button class="btn feedbackSubmit" '+(S.busy?'disabled':'')+' onclick="CNC_FEEDBACK.submitFromUI()">Vorschlag senden</button>'+msg+'</div>'
    +'<div class="section">Meine Vorschläge</div><div class="card item feedbackList">'+ownHtml+'</div>';
  if(!S.isAdmin)return '<div id="feedbackSection">'+form+'</div>';
  const allHtml=S.items.length?S.items.map(x=>suggestionHtml(x,true)).join(''):'<div class="muted">Noch keine Spielervorschläge vorhanden.</div>';
  return '<div id="feedbackSection">'+form
    +'<div class="section">🛠️ Vorschläge verwalten</div><div class="card item feedbackList"><div class="feedbackAdminTag">ADMIN · '+S.items.length+' Einträge</div>'+allHtml+'</div></div>';
}

async function refresh(){
  if(!sb||!user)return;
  const [adminRes,itemRes]=await Promise.all([
    sb.from('feedback_admins_s2').select('user_id').eq('user_id',user.id).maybeSingle(),
    sb.from('feedback_suggestions_s2').select('id,user_id,player_name,title,description,status,admin_note,created_at,updated_at').order('created_at',{ascending:false}).limit(200)
  ]);
  if(adminRes.error)throw adminRes.error;
  if(itemRes.error)throw itemRes.error;
  S.isAdmin=!!adminRes.data;
  S.items=Array.isArray(itemRes.data)?itemRes.data:[];
}

async function submitFromUI(){
  if(S.busy)return;
  const title=document.getElementById('feedbackTitle')?.value?.trim()||'';
  const description=document.getElementById('feedbackDescription')?.value?.trim()||'';
  if(title.length<4){setMessage('Der Titel braucht mindestens 4 Zeichen.',true);rerender();return}
  if(description.length<10){setMessage('Beschreibe die Idee bitte mit mindestens 10 Zeichen.',true);rerender();return}
  S.busy=true;setMessage('Vorschlag wird gesendet …');rerender();
  try{
    const state=readState?.()||{};
    const playerName=String(state.name||'Werkstatt').trim().slice(0,30)||'Werkstatt';
    const {error}=await sb.from('feedback_suggestions_s2').insert({user_id:user.id,player_name:playerName,title:title.slice(0,80),description:description.slice(0,1200)});
    if(error)throw error;
    await refresh();
    setMessage('Danke! Dein Vorschlag ist jetzt auf der Liste.');
  }catch(err){
    console.error('CNC feedback submit',err);
    setMessage('Vorschlag konnte nicht gespeichert werden. Bitte erneut versuchen.',true);
  }finally{
    S.busy=false;rerender();
  }
}

async function setStatus(id,status){
  if(!S.isAdmin||S.busy||!['open','implemented','rejected'].includes(status))return;
  let note=null;
  if(status==='rejected'){
    const entered=window.prompt('Optional: Grund für die Ablehnung','');
    if(entered===null)return;
    note=entered.trim().slice(0,300)||null;
  }
  S.busy=true;setMessage('Status wird gespeichert …');rerender();
  try{
    const {error}=await sb.from('feedback_suggestions_s2').update({status,admin_note:status==='rejected'?note:null,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    await refresh();
    setMessage(status==='implemented'?'Vorschlag als umgesetzt markiert.':status==='rejected'?'Vorschlag abgelehnt.':'Vorschlag wieder geöffnet.');
  }catch(err){
    console.error('CNC feedback status',err);
    setMessage('Status konnte nicht geändert werden.',true);
  }finally{
    S.busy=false;rerender();
  }
}

export async function initCncFeedback(ctx){
  sb=ctx.supabase;user=ctx.user;readState=ctx.readState||(()=>null);
  const api={render,refresh,submitFromUI,setStatus,state:S};
  window.CNC_FEEDBACK=api;
  try{await refresh()}catch(err){console.error('CNC feedback load',err);setMessage('Verbesserungsvorschläge konnten nicht geladen werden.',true)}
  return api;
}
