import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('PASS:',msg)};

const index=read('index.html');
const auth=read('auth-cloud-v3.js');
const updater=read('update-manager-v1.js');
const worker=read('sw-v1.js');
const release=JSON.parse(read('release.json'));
const releaseWorkflow=fs.readFileSync(path.resolve(root,'..','.github','workflows','cnc-empire-release.yml'),'utf8');
const version=index.match(/window\.CNC_RELEASE='([^']+)'/)?.[1];

assert(!!version,'index declares CNC_RELEASE');
assert(version===release.version,'index and release.json versions match');
assert(index.includes('no-cache, no-store, must-revalidate'),'index requests no-cache behavior');
assert(index.includes('update-manager-v1.js?r='+version),'index loads versioned update manager');
assert(auth.includes('CNC_PREPARE_UPDATE'),'cloud save hook exists before forced update');
assert(auth.includes("RELEASE_QUERY=encodeURIComponent(window.CNC_RELEASE"),'dynamic modules use release cache-buster');
assert(updater.includes('CHECK_INTERVAL_MS=60000'),'updater checks every 60 seconds');
assert(updater.includes("document.addEventListener('visibilitychange'"),'updater checks when app returns to foreground');
assert(updater.includes('location.replace'),'updater performs controlled restart');
assert(updater.includes('CNC_PREPARE_UPDATE'),'updater saves before restart');
assert(updater.includes('serviceWorker.register'),'updater installs service worker');
assert(worker.includes("cache:'no-store'"),'service worker bypasses browser HTTP cache');
assert(releaseWorkflow.includes('raw.githack.com/purge'),'play release purges raw.githack');
assert(releaseWorkflow.includes('cnc-empire-play'),'release workflow targets play branch');

if(process.exitCode)process.exit(process.exitCode);
console.log('Update smoke checks complete for '+version+'.');
