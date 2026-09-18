import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('PASS:',msg)};

const index=read('index.html');
const auth=read('auth-cloud-v3.js');
const core=read('v3part6.txt')+read('v3part7.txt');
const community=read('community-v1.js');
const css=read('community-v1.css');

assert(index.includes('community-v1.css?r='),'community stylesheet is loaded');
assert(auth.includes("import('./community-v1.js?r='+RELEASE_QUERY)"),'community module is initialized after login');
assert(auth.includes('initCommunitySystems()'),'community init is part of game startup');
assert(core.includes('CNC_COMMUNITY?.renderNews?.()'),'News subtab renders community module');
assert(core.includes('CNC_COMMUNITY?.renderPolls?.()'),'Polls subtab renders community module');
assert(community.includes("community_news_s2"),'community module uses news table');
assert(community.includes("community_polls_s2"),'community module uses polls table');
assert(community.includes("community_poll_options_s2"),'community module uses poll options table');
assert(community.includes("community_poll_votes_s2"),'community module uses poll votes table');
assert(community.includes("community_news_reads_s2"),'community module stores per-player news read state');
assert(community.includes('renderNewsAlert')&&community.includes('unreadCount'),'unread News notification API exists');
assert(community.includes('markNewsRead')&&community.includes('openNews'),'opening News marks visible News as read');
assert(community.includes('publishNewsFromUI')&&community.includes('deleteNews'),'admin news actions exist');
assert(community.includes('createPollFromUI')&&community.includes('setPollStatus')&&community.includes('deletePoll'),'admin poll actions exist');
assert(community.includes('votePoll')&&community.includes('.update({option_id:optionId})'),'players can vote and switch poll choice');
assert(community.includes("feedback_admins_s2"),'existing admin membership protects admin UI');
assert(css.includes('.communityPollOption.active')&&css.includes('.communityAdminCard'),'community admin and poll styles exist');
assert(css.includes('.communityNavBadge')&&css.includes('.communityNewsAlert'),'News badge and workshop alert styles exist');
assert(core.includes('communitySubBadge'),'News subtab shows unread badge');
assert(core.includes('communityNavBadge'),'main Community tab shows unread badge');
assert(read('v3part5.txt').includes('renderNewsAlert'),'Workshop renders unread News alert');

const compile=community.replace(/\bexport\s+(?=async function|function|const|let|class)/g,'').replace(/export\s*\{[^}]*\};?/g,'');
try{new Function(compile);assert(true,'community module is syntactically valid')}catch(e){assert(false,'community syntax: '+e.message)}

if(process.exitCode)process.exit(process.exitCode);
console.log('Community smoke checks complete.');
