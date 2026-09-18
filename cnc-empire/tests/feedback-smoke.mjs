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
assert(feedback.includes("feedback_votes_s2"),'feedback uses vote table');
assert(feedback.includes("toggleVote")&&feedback.includes(".delete().eq('suggestion_id'"),'players can add and remove one vote');
assert(feedback.includes("Beliebte Vorschläge")&&feedback.includes("Alle Vorschläge"),'community suggestion sections exist');
assert(feedback.includes("S.filter")&&feedback.includes("setFilter"),'status filters exist');
assert(feedback.includes("voteCount(b.id)-voteCount(a.id)"),'open suggestions sort by vote count');
assert(feedback.includes("item.status!=='open'"),'closed suggestions cannot be voted in UI');
assert(feedback.includes("'implemented'")&&feedback.includes("'rejected'"),'admin statuses exist');
assert(feedback.includes('submitFromUI')&&feedback.includes('setStatus'),'submit and moderation actions exist');
assert(css.includes('.feedbackVoteBtn.active')&&css.includes('.feedbackFilters'),'vote and filter styles exist');

const compile=feedback.replace(/\bexport\s+(?=async function|function|const|let|class)/g,'').replace(/export\s*\{[^}]*\};?/g,'');
try{new Function(compile);assert(true,'feedback module is syntactically valid')}catch(e){assert(false,'feedback syntax: '+e.message)}

if(process.exitCode)process.exit(process.exitCode);
console.log('Feedback smoke checks complete.');
