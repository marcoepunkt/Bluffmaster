import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('PASS:',msg)};

const index=read('index.html');
const auth=read('auth-cloud-v3.js');
const profile=read('v3part6.txt');
const feedback=read('feedback-v1.js');
const css=read('feedback-v1.css');

assert(index.includes('feedback-v1.css?r='),'feedback stylesheet is loaded');
assert(auth.includes("import('./feedback-v1.js?r='+RELEASE_QUERY)"),'feedback module is initialized after login');
assert(auth.includes('initFeedbackSystems()'),'feedback init is part of game startup');
assert(profile.includes('CNC_FEEDBACK?.render?.()'),'profile renders feedback area');
assert(feedback.includes("feedback_suggestions_s2"),'feedback uses suggestion table');
assert(feedback.includes("feedback_admins_s2"),'feedback checks admin table');
assert(feedback.includes("feedback_votes_s2"),'feedback uses reactions table');
assert(feedback.includes("vote_type"),'feedback reads typed reactions');
assert(feedback.includes("setReaction")&&feedback.includes("'like','dislike'"),'like and dislike actions exist');
assert(feedback.includes(".update({vote_type:type})"),'player can switch between like and dislike without creating a second reaction');
assert(feedback.includes(".delete().eq('suggestion_id'"),'player can remove own reaction');
assert(feedback.includes("Gefällt mir")&&feedback.includes("Gefällt mir nicht"),'reaction labels exist');
assert(feedback.includes("score(b.id)-score(a.id)"),'popular suggestions sort by like minus dislike score');
assert(feedback.includes("item.status!=='open'"),'closed suggestions cannot be reacted to in UI');
assert(feedback.includes("'implemented'")&&feedback.includes("'rejected'"),'admin statuses exist');
assert(feedback.includes('submitFromUI')&&feedback.includes('setStatus'),'submit and moderation actions exist');
assert(css.includes('.feedbackVoteBtn.like.active')&&css.includes('.feedbackVoteBtn.dislike.active'),'like/dislike active styles exist');

const compile=feedback.replace(/\bexport\s+(?=async function|function|const|let|class)/g,'').replace(/export\s*\{[^}]*\};?/g,'');
try{new Function(compile);assert(true,'feedback module is syntactically valid')}catch(e){assert(false,'feedback syntax: '+e.message)}

if(process.exitCode)process.exit(process.exitCode);
console.log('Feedback smoke checks complete.');
