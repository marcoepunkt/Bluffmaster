let sb=null,user=null,readState=()=>null;
const S={items:[],reactionCounts:{},myReactions:{},isAdmin:false,busy:false,message:'',error:'',filter:'all'};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(iso){try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch{return '—'}}
function statusLabel(status){return status==='implemented'?'Umgesetzt':status==='rejected'?'Abgelehnt':'Offen'}
function statusIcon(status){return status==='implemented'?'✅':status==='rejected'?'❌':'🟡'}
function rerender(){window.CNC_GAME_BRIDGE?.render?.()}
function setMessage(text,error=false){S.message=error?'':text;S.error=error?text:''}
function counts(id){return S.reactionCounts[id]||{like:0,dislike:0}}
function myReaction(id){return S.myReactions[id]||null}
function score(id){const c=counts(id);return Number(c.like||0)-Number(c.dislike||0)}
function setFilter(filter){if(!['all','open','implemented','rejected'].includes(filter))return;S.filter=filter;rerender()}

function sortedItems(items=S.items){
  const rank={open:0,implemented:1,rejected:2};
  return [...items].sort((a,b)=>{
    const sr=(rank[a.status]??9)-(rank[b.status]??9);
    if(sr)return sr;
    if(a.status==='open'){
      const scoreDiff=score(b.id)-score(a.id);
      if(scoreDiff)return scoreDiff;
      const likeDiff=counts(b.id).like-counts(a.id).like;
      if(likeDiff)return likeDiff;
    }
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });
}

function reactionHtml(item){
  const c=counts(item.id);
  if(item.status!=='open'){
    return '<div class="feedbackReactionsClosed"><span>👍 '+c.like+'</span><span>👎 '+c.dislike+'</span></div>';
  }
  const mine=myReaction(item.id);
  return '<div class="feedbackReactionButtons">'
    +'<button class="feedbackVoteBtn like '+(mine==='like'?'active':'')+'" '+(S.busy?'disabled':'')+' onclick="CNC_FEEDBACK.setReaction(\''+esc(item.id)+'\',\'like\')">👍 Gefällt mir <span>'+c.like+'</span></button>'
    +'<button class="feedbackVoteBtn dislike '+(mine==='dislike'?'active':'')+'" '+(S.busy?'disabled':'')+' onclick="CNC_FEEDBACK.setReaction(\''+esc(item.id)+'\',\'dislike\')">👎 Gefällt mir nicht <span>'+c.dislike+'</span></button>'
    +'</div>';
}

function suggestionHtml(item,admin=false,rank=null){
  const note=item.admin_note?'<div class="feedbackNote">Admin: '+esc(item.admin_note)+'</div>':'';
  const own=item.user_id===user?.id?'<span class="feedbackOwnTag">DEIN VORSCHLAG</span>':'';
  const place=rank?'<span class="feedbackRank">#'+rank+'</span>':'';
  let actions='';
  if(admin){
    const done=item.status==='implemented'?'':'<button class="btn mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'implemented\')">✅ Umgesetzt</button>';
    const reject=item.status==='rejected'?'':'<button class="btn danger mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'rejected\')">❌ Ablehnen</button>';
    const reopen=item.status==='open'?'':'<button class="btn secondary mini" onclick="CNC_FEEDBACK.setStatus(\''+esc(item.id)+'\',\'open\')">↩ Öffnen</button>';
    actions='<div class="feedbackActions">'+done+reject+reopen+'</div>';
  }
  return '<div class="feedbackEntry">'
    +'<div class="feedbackEntryHead"><div class="feedbackTitleBlock"><div class="feedbackTitleLine">'+place+'<div class="name">'+esc(item.title)+'</div>'+own+'</div><div class="muted">'+esc(item.player_name||'Werkstatt')+' · '+date(item.created_at)+'</div></div>'
    +'<span class="feedbackStatus '+esc(item.status)+'">'+statusIcon(item.status)+' '+statusLabel(item.status)+'</span></div>'
    +'<div class="feedbackDescription">'+esc(item.description)+'</div>'
    +'<div class="feedbackEntryFoot">'+reactionHtml(item)+'</div>'+note+actions+'</div>';
}

function filterButtons(){
  const entries=[['all','Alle'],['open','Offen'],['implemented','Umgesetzt'],['rejected','Abgelehnt']];
  return '<div class="feedbackFilters">'+entries.map(([key,label])=>'<button class="feedbackFilter '+(S.filter===key?'active':'')+'" onclick="CNC_FEEDBACK.setFilter(\''+key+'\')">'+label+'</button>').join('')+'</div>';
}

function render(){
  const msg=S.error?'<div class="feedbackMessage error">'+esc(S.error)+'</div>':S.message?'<div class="feedbackMessage ok">'+esc(S.message)+'</div>':'';
  const form='<div class="section">💡 Verbesserungsvorschläge</div><div class="card item feedbackCard">'
    +'<div class="name">Idee fürs Spiel einreichen</div><div class="desc">Dein Vorschlag ist für alle Spieler sichtbar. Die Community kann mit 👍 Gefällt mir oder 👎 Gefällt mir nicht abstimmen.</div>'
    +'<input id="feedbackTitle" class="field" maxlength="80" placeholder="Kurzer Titel">'
    +'<textarea id="feedbackDescription" class="field feedbackTextArea" maxlength="1200" placeholder="Beschreibe deinen Vorschlag möglichst konkret."></textarea>'
    +'<button class="btn feedbackSubmit" '+(S.busy?'disabled':'')+' onclick="CNC_FEEDBACK.submitFromUI()">Vorschlag senden</button>'+msg+'</div>';

  const popular=sortedItems(S.items.filter(x=>x.status==='open')).slice(0,5);
  const popularHtml=popular.length?popular.map((x,i)=>suggestionHtml(x,S.isAdmin,i+1)).join(''):'<div class="muted">Noch keine offenen Community-Vorschläge.</div>';

  const filtered=sortedItems(S.filter==='all'?S.items:S.items.filter(x=>x.status===S.filter));
  const allHtml=filtered.length?filtered.map(x=>suggestionHtml(x,S.isAdmin)).join(''):'<div class="muted">Für diesen Filter gibt es noch keine Vorschläge.</div>';
  const openCount=S.items.filter(x=>x.status==='open').length;

  const admin=S.isAdmin?'<div class="section">🛠️ Admin-Verwaltung</div><div class="card item feedbackAdminInfo"><div class="feedbackAdminTag">ADMIN · '+openCount+' offen · '+S.items.length+' insgesamt</div><div class="desc">Die Status-Buttons stehen direkt an jedem Vorschlag. Nur dein Admin-Konto kann sie verwenden.</div></div>':'';

  return '<div id="feedbackSection">'+form
    +'<div class="section">🔥 Beliebte Vorschläge</div><div class="card item feedbackList">'+popularHtml+'</div>'
    +'<div class="section">📋 Alle Vorschläge</div>'+filterButtons()+'<div class="card item feedbackList">'+allHtml+'</div>'
    +admin+'</div>';
}

async function refresh(){
  if(!sb||!user)return;
  const [adminRes,itemRes,reactionRes]=await Promise.all([
    sb.from('feedback_admins_s2').select('user_id').eq('user_id',user.id).maybeSingle(),
    sb.from('feedback_suggestions_s2').select('id,user_id,player_name,title,description,status,admin_note,created_at,updated_at').limit(300),
    sb.from('feedback_votes_s2').select('suggestion_id,user_id,vote_type').limit(10000)
  ]);
  if(adminRes.error)throw adminRes.error;
  if(itemRes.error)throw itemRes.error;
  if(reactionRes.error)throw reactionRes.error;
  S.isAdmin=!!adminRes.data;
  S.items=Array.isArray(itemRes.data)?itemRes.data:[];
  const reactionCounts={};
  const mine={};
  for(const reaction of (Array.isArray(reactionRes.data)?reactionRes.data:[])){
    if(!reaction?.suggestion_id)continue;
    const type=reaction.vote_type==='dislike'?'dislike':'like';
    if(!reactionCounts[reaction.suggestion_id])reactionCounts[reaction.suggestion_id]={like:0,dislike:0};
    reactionCounts[reaction.suggestion_id][type]+=1;
    if(reaction.user_id===user.id)mine[reaction.suggestion_id]=type;
  }
  S.reactionCounts=reactionCounts;
  S.myReactions=mine;
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
    setMessage('Danke! Dein Vorschlag ist jetzt für die Community sichtbar.');
  }catch(err){
    console.error('CNC feedback submit',err);
    setMessage('Vorschlag konnte nicht gespeichert werden. Bitte erneut versuchen.',true);
  }finally{
    S.busy=false;rerender();
  }
}

async function setReaction(id,type){
  if(S.busy||!user||!['like','dislike'].includes(type))return;
  const item=S.items.find(x=>x.id===id);
  if(!item||item.status!=='open')return;
  const current=myReaction(id);
  S.busy=true;
  setMessage(current===type?'Bewertung wird entfernt …':current?'Bewertung wird geändert …':'Bewertung wird gespeichert …');
  rerender();
  try{
    let result;
    if(current===type){
      result=await sb.from('feedback_votes_s2').delete().eq('suggestion_id',id).eq('user_id',user.id);
    }else if(current){
      result=await sb.from('feedback_votes_s2').update({vote_type:type}).eq('suggestion_id',id).eq('user_id',user.id);
    }else{
      result=await sb.from('feedback_votes_s2').insert({suggestion_id:id,user_id:user.id,vote_type:type});
    }
    if(result.error)throw result.error;
    await refresh();
    const now=myReaction(id);
    setMessage(now==='like'?'Als „Gefällt mir“ gespeichert.':now==='dislike'?'Als „Gefällt mir nicht“ gespeichert.':'Deine Bewertung wurde entfernt.');
  }catch(err){
    console.error('CNC feedback reaction',err);
    setMessage('Bewertung konnte nicht geändert werden. Bitte erneut versuchen.',true);
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
  const api={render,refresh,submitFromUI,setReaction,setStatus,setFilter,state:S};
  window.CNC_FEEDBACK=api;
  try{await refresh()}catch(err){console.error('CNC feedback load',err);setMessage('Verbesserungsvorschläge konnten nicht geladen werden.',true)}
  return api;
}
