// Local integration harness. First export a real snapshot with:
// PRTS_LIVE_NETWORK=1 PRTS_RUNTIME_OUTPUT=<absolute runtime.json> cargo test ... live_story_runtime
// Then: node scripts/test-storyplayer-browser.mjs <runtime.json>
// Opens no browser itself. Visit http://localhost:5174/__storyplayer-test.
import { createServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const runtimePath = path.resolve(process.argv[2] || "build/prts-inspect/runtime.json");
const runtime = fs.readFileSync(runtimePath, "utf8");
const csp = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8")).app.security.csp;
const cacheDir = path.resolve("build/prts-inspect/media");
fs.mkdirSync(cacheDir, { recursive: true });
let offline = false;
let failImages = false;
let networkRequests = 0;
let cacheHits = 0;
const html = `<!doctype html><meta charset="utf-8"><title>StoryPlayer integration</title>
<style>body{margin:0;background:#171717;color:#eee;font:14px sans-serif}#controls{padding:8px}button{margin:4px}iframe{width:100%;height:calc(100vh - 170px);border:0}pre{max-height:85px;overflow:auto;white-space:pre-wrap}</style>
<div id="controls"><button id="manifest">Verify full story manifest</button><button id="play">Play online</button><button id="offline">Reopen offline</button><button id="failure">Failure probe</button><button id="dispose">Dispose</button><pre id="report">Ready</pre></div><div id="host"></div>
<script type="module">
import {bootEngineInFrame} from '/src/lib/engineBoot.ts';
import {disposeEngineFrame} from '/src/lib/storyPlayerBoot.ts';
import {getEntries} from '/src/lib/debugLog.ts';
const runtime=await (await fetch('/__runtime')).json();
const report=document.querySelector('#report'),host=document.querySelector('#host');
let frame;
const sample='[Background(image="bg_indoor_1",fadetime=0)]\\n[Character(name="char_002_amiya_1#1",fadetime=0)]\\n[name="阿米娅"] 博士，新版剧情模拟器已经准备好了。\\n[Character(name="char_002_amiya_1#4",fadetime=0)]\\n[name="阿米娅"] 我们出发吧。';
function dispose(){if(frame){disposeEngineFrame(frame);frame.remove();frame=null}}
async function run(mode,offline,fault=false){
try{
await fetch('/__offline?value='+offline+'&fault='+fault);dispose();
frame=document.createElement('iframe');host.appendChild(frame);report.textContent='Booting '+mode+' offline='+offline;
const result=await bootEngineInFrame({iframe:frame,bundle:runtime.bundle,script:mode==='manifest'?runtime.story.script:sample,title:runtime.story.title,mode});
if(mode==='manifest'){
const urls=result.manifest;
if(!urls?.length||urls.some(u=>!u.startsWith('https://')))throw Error('invalid canonical manifest');
await fetch('/__manifest',{method:'POST',body:JSON.stringify(urls)});
report.textContent=JSON.stringify({manifest:urls.length,health:result.health});dispose();
}else report.textContent='Booted; waiting for render';
}catch(e){dispose();report.textContent=e.stack;console.error(e)}
}
document.querySelector('#manifest').onclick=()=>run('manifest',true);
document.querySelector('#play').onclick=()=>run('play',false);
document.querySelector('#offline').onclick=()=>run('play',true);
document.querySelector('#failure').onclick=()=>run('play',true,true);
document.querySelector('#dispose').onclick=()=>{dispose();report.textContent='Disposed'};
setInterval(async()=>{if(frame?.contentWindow?.__arkstageApp){
const p=frame.contentWindow.__arkstageApp.getPlayer();
const stats=await(await fetch('/__stats')).json();
report.textContent=JSON.stringify({state:p?.getState(),canvases:frame.contentDocument.querySelectorAll('canvas').length,...stats,errors:getEntries().filter(e=>e.level==='error').slice(-3)});
}},1000);
</script>`;
const server = await createServer({
  root: path.resolve("frontend"), configFile: false,
  server: { host: "127.0.0.1", port: 5174, strictPort: true, fs: { allow: [process.cwd()] } },
  plugins: [{ name: "storyplayer-test-transport",
    transform(code,id) { if (id.endsWith('/lib/proxy.ts')) return code.replaceAll('"http://prts-cdn.localhost"','`${location.origin}/proxy`').replaceAll('"prts-cdn://localhost"','`${location.origin}/proxy`'); },
    configureServer(server) { server.middlewares.use(async(req,res,next)=>{
      if(req.url==='/__storyplayer-test'){res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',csp);res.end(html);return}
      if(req.url==='/__runtime'){res.setHeader('Content-Type','application/json');res.end(runtime);return}
      if(req.url.startsWith('/__offline?')){const q=new URL(req.url,'http://localhost').searchParams;offline=q.get('value')==='true';failImages=q.get('fault')==='true';res.end('ok');return}
      if(req.url==='/__stats'){res.end(JSON.stringify({offline,networkRequests,cacheHits}));return}
      if(req.url==='/__manifest'){let body='';for await(const chunk of req)body+=chunk;fs.writeFileSync('build/prts-inspect/manifest.json',body);res.end('ok');return}
      if(!req.url.startsWith('/proxy/'))return next();
      const url='https://'+req.url.slice('/proxy/'.length);
      if(failImages && url.endsWith('.png')){res.statusCode=503;res.end('injected missing image');return}
      if(!/^https:\/\/(static|media|torappu)\.prts\.wiki\//.test(url)){res.statusCode=403;res.end();return}
      const key=crypto.createHash('sha256').update(url).digest('hex');const file=path.join(cacheDir,key);
      try{
        if(fs.existsSync(file)){cacheHits++;res.setHeader('Content-Type',fs.readFileSync(file+'.type','utf8'));res.end(fs.readFileSync(file));return}
        if(offline){res.statusCode=503;res.end('offline cache miss: '+url);return}
        networkRequests++;
        const response=await fetch(url,{headers:{Referer:'https://prts.wiki/','User-Agent':'Arkstage/1.1.6 (+https://github.com/djkcyl/arkstage)'}});
        const body=Buffer.from(await response.arrayBuffer());const type=response.headers.get('content-type')||'application/octet-stream';
        if(response.ok){fs.writeFileSync(file,body);fs.writeFileSync(file+'.type',type)}
        res.statusCode=response.status;res.setHeader('Content-Type',type);res.end(body);
      }catch(e){res.statusCode=502;res.end(String(e))}
    }) }
  }]
});
await server.listen();
console.log('StoryPlayer test: http://localhost:5174/__storyplayer-test');
