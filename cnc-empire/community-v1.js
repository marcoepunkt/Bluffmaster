let sb=null,user=null;
const S={news:[],polls:[],options:[],votes:[],readNewsIds:[],readPollIds:[],isAdmin:false,busy:false,message:'',error:''};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(iso){try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch{return '—'}}
function rerender(){window.CNC_GAME_BRIDGE?.render?.()}
function setMessage(text,error=false){S.message=error?'':text;S.error=error?text:''}
function messageHtml(){return S.error?'<div class="communityMessage error">'+esc(S.error)+'</div>':S.message?'<div class="communityMessage ok">'+esc(S.message)+'</div>':''}
function unreadNews(){return S.news.filter(n=>n.published!==false&&!S.readNewsIds.includes(n.id))}
function unreadPolls(){return S.polls.filter(p=>p.status==='open'&&!S.readPollIds.includes(p.id))}
function unreadCount(){return unreadNews().length}
function unreadPollCount(){return unreadPolls().length}
function totalUnreadCount(){return unreadCount()+unreadPollCount()}
function renderNewsAlert(){
  const news=unreadCount(),polls=unreadPollCount(),total=news+polls;
  if(!total)return '';
  const bits=[];
  if(news)bits.push(news+' '+(news===1?'neue News':'neue News'));
  if(polls)bits.push(polls+' '+(polls===1?'neue Umfrage':'neue Umfragen'));
  const icon=news?'📢':'📊';
  return '<button class="communityNewsAlert" onclick="G.openCommunityUpdates()"><span class="communityNewsAlertIcon">'+icon+'</span><span class="communityNewsAlertText"><b>'+bits.join(' · ')+'</b><small>Es gibt neue Community-Inhalte. Antippen zum Ansehen.</small></span><span class="communityNewsAlertArrow">›</span></button>';
}

async function refresh(){
  if(!sb||!user)return;
  const [adminRes,newsRes,pollsRes,optionsRes,votesRes,readsRes,pollReadsRes]=await Promise.all([
    sb.from('feedback_admins_s2').select('user_id').eq('user_id',user.id).maybeSingle(),
    sb.from('community_news_s2').select('id,title,body,published,created_at,updated_at,created_by').order('created_at',{ascending:false}).limit(50),
    sb.from('community_polls_s2').select('id,question,status,created_at,updated_at,created_by').order('created_at',{ascending:false}).limit(50),
    sb.from('community_poll_options_s2').select('id,poll_id,label,position').order('position',{ascending:true}).limit(500),
    sb.from('community_poll_votes_s2').select('poll_id,option_id,user_id').limit(10000),
    sb.from('community_news_reads_s2').select('news_id').eq('user_id',user.id).limit(500),
    sb.from('community_poll_reads_s2').select('poll_id').eq('user_id',user.id).limit(500)
  ]);
  for(const result of [adminRes,newsRes,pollsRes,optionsRes,votesRes,readsRes,pollReadsRes])if(result.error)throw result.error;
  S.isAdmin=!!adminRes.data;
  S.news=Array.isArray(newsRes.data)?newsRes.data:[];
  S.polls=Array.isArray(pollsRes.data)?pollsRes.data:[];
  S.options=Array.isArray(optionsRes.data)?optionsRes.data:[];
  S.votes=Array.isArray(votesRes.data)?votesRes.data:[];
  S.readNewsIds=(Array.isArray(readsRes.data)?readsRes.data:[]).map(x=>x.news_id).filter(Boolean);
  S.readPollIds=(Array.isArray(pollReadsRes.data)?pollReadsRes.data:[]).map(x=>x.poll_id).filter(Boolean);
}

function newsItem(n){
  const fresh=!S.readNewsIds.includes(n.id)?'<span class="communityNewTag">NEU</span>':'';
  const admin=S.isAdmin?'<button class="btn danger mini" onclick="CNC_COMMUNITY.deleteNews(\''+esc(n.id)+'\')">Löschen</button>':'';
  return '<article class="communityNewsItem '+(fresh?'unread':'')+'"><div class="communityItemHead"><div><div class="communityNewsTitle"><div class="name">'+esc(n.title)+'</div>'+fresh+'</div><div class="muted">'+date(n.created_at)+'</div></div>'+admin+'</div><div class="communityBody">'+esc(n.body)+'</div></article>';
}

async function markNewsRead(){
  const ids=unreadNews().map(n=>n.id);
  if(!ids.length)return 0;
  const readAt=new Date().toISOString();
  const rows=ids.map(news_id=>({news_id,user_id:user.id,read_at:readAt}));
  const {error}=await sb.from('community_news_reads_s2').upsert(rows,{onConflict:'news_id,user_id'});
  if(error)throw error;
  S.readNewsIds=[...new Set([...S.readNewsIds,...ids])];
  return ids.length;
}

async function openNews(){
  if(!sb||!user)return;
  try{
    await refresh();
    await markNewsRead();
  }catch(err){
    console.error('CNC community read news',err);
    setMessage('Lesestatus der News konnte nicht gespeichert werden.',true);
  }
}

async function markPollsRead(){
  const ids=unreadPolls().map(p=>p.id);
  if(!ids.length)return 0;
  const readAt=new Date().toISOString();
  const rows=ids.map(poll_id=>({poll_id,user_id:user.id,read_at:readAt}));
  const {error}=await sb.from('community_poll_reads_s2').upsert(rows,{onConflict:'poll_id,user_id'});
  if(error)throw error;
  S.readPollIds=[...new Set([...S.readPollIds,...ids])];
  return ids.length;
}

async function openPolls(){
  if(!sb||!user)return;
  try{
    await refresh();
    await markPollsRead();
  }catch(err){
    console.error('CNC community read polls',err);
    setMessage('Lesestatus der Umfragen konnte nicht gespeichert werden.',true);
  }
}

function renderNews(){
  const admin=S.isAdmin?'<div class="card item communityAdminCard"><div class="communityAdminTag">ADMIN · NEWS VERÖFFENTLICHEN</div><input id="communityNewsTitle" class="field" maxlength="100" placeholder="Überschrift"><textarea id="communityNewsBody" class="field communityTextArea" maxlength="3000" placeholder="Neuigkeit oder Ankündigung"></textarea><button class="btn communityWideBtn" '+(S.busy?'disabled':'')+' onclick="CNC_COMMUNITY.publishNewsFromUI()">📢 Veröffentlichen</button></div>':'';
  const list=S.news.length?S.news.map(newsItem).join(''):'<div class="card item"><div class="muted">Noch keine Community-News veröffentlicht.</div></div>';
  return '<div class="section">📢 Community-News</div>'+messageHtml()+admin+'<div class="card item communityList">'+list+'</div>';
}

function pollOptions(poll){
  const opts=S.options.filter(x=>x.poll_id===poll.id).sort((a,b)=>a.position-b.position);
  const votes=S.votes.filter(x=>x.poll_id===poll.id);
  const total=votes.length;
  const mine=votes.find(x=>x.user_id===user?.id)?.option_id||null;
  return opts.map(opt=>{
    const count=votes.filter(v=>v.option_id===opt.id).length;
    const pct=total?Math.round(count/total*100):0;
    const active=mine===opt.id;
    const button=poll.status==='open'
      ?'<button class="communityPollOption '+(active?'active':'')+'" '+(S.busy?'disabled':'')+' onclick="CNC_COMMUNITY.votePoll(\''+esc(poll.id)+'\',\''+esc(opt.id)+'\')"><span>'+esc(opt.label)+'</span><b>'+count+' · '+pct+'%</b></button>'
      :'<div class="communityPollOption closed '+(active?'active':'')+'"><span>'+esc(opt.label)+'</span><b>'+count+' · '+pct+'%</b></div>';
    return button+'<div class="communityPollBar"><span style="width:'+pct+'%"></span></div>';
  }).join('');
}

function pollItem(poll){
  const total=S.votes.filter(x=>x.poll_id===poll.id).length;
  let admin='';
  if(S.isAdmin){
    const statusBtn=poll.status==='open'
      ?'<button class="btn secondary mini" onclick="CNC_COMMUNITY.setPollStatus(\''+esc(poll.id)+'\',\'closed\')">🔒 Schließen</button>'
      :'<button class="btn secondary mini" onclick="CNC_COMMUNITY.setPollStatus(\''+esc(poll.id)+'\',\'open\')">↩ Wieder öffnen</button>';
    admin='<div class="communityPollAdmin">'+statusBtn+'<button class="btn danger mini" onclick="CNC_COMMUNITY.deletePoll(\''+esc(poll.id)+'\')">Löschen</button></div>';
  }
  return '<article class="communityPoll"><div class="communityItemHead"><div><div class="name">'+esc(poll.question)+'</div><div class="muted">'+date(poll.created_at)+' · '+total+' '+(total===1?'Stimme':'Stimmen')+'</div></div><span class="communityPollStatus '+poll.status+'">'+(poll.status==='open'?'🟢 Offen':'🔒 Beendet')+'</span></div><div class="communityPollOptions">'+pollOptions(poll)+'</div>'+admin+'</article>';
}

function renderPolls(){
  const admin=S.isAdmin?'<div class="card item communityAdminCard"><div class="communityAdminTag">ADMIN · UMFRAGE ERSTELLEN</div><input id="communityPollQuestion" class="field" maxlength="180" placeholder="Frage der Umfrage"><textarea id="communityPollOptions" class="field communityTextArea small" maxlength="600" placeholder="Antworten – eine pro Zeile&#10;Ja&#10;Nein"></textarea><div class="desc">2 bis 6 Antwortmöglichkeiten, jeweils eine Zeile.</div><button class="btn communityWideBtn" '+(S.busy?'disabled':'')+' onclick="CNC_COMMUNITY.createPollFromUI()">📊 Umfrage starten</button></div>':'';
  const list=S.polls.length?S.polls.map(pollItem).join(''):'<div class="card item"><div class="muted">Noch keine Community-Umfrage vorhanden.</div></div>';
  return '<div class="section">📊 Community-Umfragen</div>'+messageHtml()+admin+'<div class="card item communityList">'+list+'</div>';
}

async function publishNewsFromUI(){
  if(S.busy||!S.isAdmin)return;
  const title=document.getElementById('communityNewsTitle')?.value?.trim()||'';
  const body=document.getElementById('communityNewsBody')?.value?.trim()||'';
  if(title.length<3){setMessage('Die Überschrift braucht mindestens 3 Zeichen.',true);rerender();return}
  if(body.length<5){setMessage('Die News braucht mindestens 5 Zeichen.',true);rerender();return}
  S.busy=true;setMessage('News wird veröffentlicht …');rerender();
  try{
    const {error}=await sb.from('community_news_s2').insert({title:title.slice(0,100),body:body.slice(0,3000),created_by:user.id,published:true});
    if(error)throw error;
    await refresh();setMessage('News wurde veröffentlicht.');
  }catch(err){console.error('CNC community news',err);setMessage('News konnte nicht veröffentlicht werden.',true)}
  finally{S.busy=false;rerender()}
}

async function deleteNews(id){
  if(!S.isAdmin||S.busy||!confirm('Diese News wirklich löschen?'))return;
  S.busy=true;setMessage('News wird gelöscht …');rerender();
  try{
    const {error}=await sb.from('community_news_s2').delete().eq('id',id);
    if(error)throw error;
    await refresh();setMessage('News wurde gelöscht.');
  }catch(err){console.error('CNC community news delete',err);setMessage('News konnte nicht gelöscht werden.',true)}
  finally{S.busy=false;rerender()}
}

async function createPollFromUI(){
  if(S.busy||!S.isAdmin)return;
  const question=document.getElementById('communityPollQuestion')?.value?.trim()||'';
  const options=String(document.getElementById('communityPollOptions')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,6);
  if(question.length<5){setMessage('Die Umfragefrage braucht mindestens 5 Zeichen.',true);rerender();return}
  if(options.length<2){setMessage('Die Umfrage braucht mindestens 2 Antwortmöglichkeiten.',true);rerender();return}
  S.busy=true;setMessage('Umfrage wird erstellt …');rerender();
  let pollId=null;
  try{
    const pollRes=await sb.from('community_polls_s2').insert({question:question.slice(0,180),status:'open',created_by:user.id}).select('id').single();
    if(pollRes.error)throw pollRes.error;
    pollId=pollRes.data.id;
    const optionRes=await sb.from('community_poll_options_s2').insert(options.map((label,position)=>({poll_id:pollId,label:label.slice(0,120),position})));
    if(optionRes.error)throw optionRes.error;
    const readRes=await sb.from('community_poll_reads_s2').upsert({poll_id:pollId,user_id:user.id,read_at:new Date().toISOString()},{onConflict:'poll_id,user_id'});
    if(readRes.error)throw readRes.error;
    await refresh();setMessage('Umfrage wurde gestartet.');
  }catch(err){
    console.error('CNC community poll create',err);
    if(pollId)try{await sb.from('community_polls_s2').delete().eq('id',pollId)}catch{}
    setMessage('Umfrage konnte nicht erstellt werden.',true);
  }finally{S.busy=false;rerender()}
}

async function votePoll(pollId,optionId){
  if(S.busy||!user)return;
  const poll=S.polls.find(x=>x.id===pollId);
  if(!poll||poll.status!=='open')return;
  const current=S.votes.find(x=>x.poll_id===pollId&&x.user_id===user.id);
  if(current?.option_id===optionId){setMessage('Diese Antwort hast du bereits gewählt.');rerender();return}
  S.busy=true;setMessage(current?'Stimme wird geändert …':'Stimme wird gespeichert …');rerender();
  try{
    const result=current
      ?await sb.from('community_poll_votes_s2').update({option_id:optionId}).eq('poll_id',pollId).eq('user_id',user.id)
      :await sb.from('community_poll_votes_s2').insert({poll_id:pollId,option_id:optionId,user_id:user.id});
    if(result.error)throw result.error;
    await refresh();setMessage('Deine Stimme wurde gespeichert.');
  }catch(err){console.error('CNC community poll vote',err);setMessage('Stimme konnte nicht gespeichert werden.',true)}
  finally{S.busy=false;rerender()}
}

async function setPollStatus(id,status){
  if(!S.isAdmin||S.busy||!['open','closed'].includes(status))return;
  S.busy=true;setMessage('Umfrage wird aktualisiert …');rerender();
  try{
    const {error}=await sb.from('community_polls_s2').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    await refresh();setMessage(status==='closed'?'Umfrage wurde geschlossen.':'Umfrage wurde wieder geöffnet.');
  }catch(err){console.error('CNC community poll status',err);setMessage('Umfragestatus konnte nicht geändert werden.',true)}
  finally{S.busy=false;rerender()}
}

async function deletePoll(id){
  if(!S.isAdmin||S.busy||!confirm('Diese Umfrage samt Stimmen wirklich löschen?'))return;
  S.busy=true;setMessage('Umfrage wird gelöscht …');rerender();
  try{
    const {error}=await sb.from('community_polls_s2').delete().eq('id',id);
    if(error)throw error;
    await refresh();setMessage('Umfrage wurde gelöscht.');
  }catch(err){console.error('CNC community poll delete',err);setMessage('Umfrage konnte nicht gelöscht werden.',true)}
  finally{S.busy=false;rerender()}
}

export async function initCncCommunity(ctx){
  sb=ctx.supabase;user=ctx.user;
  const api={renderNews,renderPolls,renderNewsAlert,unreadCount,unreadPollCount,totalUnreadCount,openNews,markNewsRead,openPolls,markPollsRead,refresh,publishNewsFromUI,deleteNews,createPollFromUI,votePoll,setPollStatus,deletePoll,state:S};
  window.CNC_COMMUNITY=api;
  try{await refresh()}catch(err){console.error('CNC community load',err);setMessage('Community-News und Umfragen konnten nicht geladen werden.',true)}
  return api;
}
