#!/usr/bin/env node
import { chromium } from 'playwright';
import {siGithub,siTypescript,siJavascript,siPython,siGo,siRust,siRuby,siSolana,siEthereum,siBitcoin,siReact,siDocker,siKubernetes,siTerraform,siClaude,siNodedotjs,siPostgresql} from 'simple-icons';
import { readFile, writeFile, mkdir, mkdtemp, rm, access }  from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (value, max = 70) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0,max);
const count = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
const fmt = value => count(value).toLocaleString('en-US');
const keys = ['commits','pull_requests','issues','reviews'];
export function sanitize(input, showPrivateNames = false) {
  if(!input || typeof input !== 'object' || !['public','private','all'].includes(input.scope)) throw new Error('Input requires a valid public, private, or all scope.');
  if(!Array.isArray(input.repositories) || input.repositories.some(repo=>!repo || typeof repo.private !== 'boolean')) throw new Error('Repositories must declare boolean private visibility.');
  if((input.repositories ?? []).some(repo => input.scope==='public' ? repo.private === true : input.scope==='private' ? repo.private !== true : false)) throw new Error('Repository visibility conflicts with the declared scope. Recollect data with the intended scope.');
  let privateIndex = 0;
  const repositories = (Array.isArray(input.repositories) ? input.repositories : []).map(repo => ({
    name: repo.private && !showPrivateNames ? `Private project ${++privateIndex}` : text(repo.name),
    private: Boolean(repo.private), ...Object.fromEntries(keys.map(k => [k,count(repo[k])]))
  }));
  return {
    username:text(input.username,39),year:text(input.year,24),as_of:text(input.as_of,32),period:input.period?{start:text(input.period.start,10),end:text(input.period.end,10),actual_end:text(input.period.actual_end,10),label:text(input.period.label,60)}:null,demo:input.demo===true,
    categories:Array.isArray(input.categories)?input.categories.filter(c=>[...keys,'repositories'].includes(c)):[...keys,'repositories'],
    scope:['public','private','all'].includes(input.scope) ? input.scope : 'unspecified',
    metrics:Object.fromEntries(keys.filter(k => Object.hasOwn(input.metrics ?? {},k)).map(k => [k,count(input.metrics[k])])),
    repositories,monthly:Object.fromEntries(Object.entries(input.monthly ?? {}).filter(([k])=>/^\d{4}-\d{2}$/.test(k)).map(([k,v])=>[k,count(v)])),
    // Source notes can contain excluded identities. Use fixed disclosure copy instead.
    notes:['Activity counts describe the selected data, not productivity, impact, or unique features shipped.',
      'GitHub permissions and contribution attribution can limit coverage. Repository rankings reflect captured contributions.',
      ...(input.coverage?.restricted_details_missing ? ['Some private activity was restricted by GitHub permissions and is omitted.'] : []),
      ...(input.coverage?.repository_limit_reached ? ['Repository-level results may be truncated by the GitHub API limit.'] : []),
      ...(input.coverage?.calendar_included === false ? ['The calendar is omitted because it cannot represent this selection accurately.'] : []),
      ...(input.notes?.length ? ['The collection contains coverage notes. Review the local source JSON before drawing conclusions.'] : []),
      ...(repositories.some(r=>r.private) ? [`Private repository names are ${showPrivateNames ? 'visible by explicit request' : 'anonymized'}. Private totals remain sensitive.`] : [])]
  };
}
const brandIcons={github:siGithub,typescript:siTypescript,javascript:siJavascript,python:siPython,go:siGo,rust:siRust,ruby:siRuby,solana:siSolana,ethereum:siEthereum,bitcoin:siBitcoin,react:siReact,docker:siDocker,kubernetes:siKubernetes,terraform:siTerraform,claude:siClaude,nodejs:siNodedotjs,postgresql:siPostgresql};
export function sanitizeInsights(raw, source, {includePrivateInsights=false,showPrivateNames=false,noBranding=false}={}) {
 if(!raw) return null;
 if(raw.schema_version!==1 || !['public','private'].includes(raw.sensitivity)) throw new Error('Insights require schema_version 1 and public/private sensitivity.');
 if(raw.sensitivity==='public' && source.scope!=='public') throw new Error('Public AI insights require a public-scope collection; recollect public data or mark the narrative private.');
 if(raw.sensitivity==='private' && (source.scope==='public' || !includePrivateInsights)) return null;
 const selected=new Map(source.repositories.map((repo,i)=>[`repository:${repo.name}`,{...repo,label:repo.private&&!showPrivateNames?`Private project ${source.repositories.slice(0,i+1).filter(r=>r.private).length}`:repo.name}]));
 const metrics=Object.keys(source.metrics);
 const safeText=(value,max)=>{
  let result=text(value,max);
  for(const [ref,repo] of selected) if(repo.private&&!showPrivateNames) result=result.replace(new RegExp(ref.slice(11).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),repo.label);
  return result;
 };
 const evidence=refs=>{
  if(!Array.isArray(refs)||refs.length===0) throw new Error('Each AI insight and platform needs selected evidence references.');
  return [...new Set(refs)].slice(0,3).map(ref=>{
   if(typeof ref!=='string')throw new Error('Evidence references must be strings.');
   if(ref.startsWith('metrics.')&&metrics.includes(ref.slice(8))) return `${ref.slice(8).replaceAll('_',' ')}: ${fmt(source.metrics[ref.slice(8)])}`;
   if(ref.startsWith('repository:')&&Array.isArray(source.categories)&&!source.categories.includes('repositories')) throw new Error('Repository AI evidence is excluded by category selection.');
   const repo=selected.get(ref);
   if(!repo)throw new Error('AI evidence references data outside the selected collection.');
   if(raw.sensitivity==='public'&&repo.private)throw new Error('Public AI insights cannot cite private repositories.');
   return `${text(repo.label,50)} · ${fmt(keys.reduce((sum,k)=>sum+count(repo[k]),0))} captured events`;
  });
 };
 return {headline:safeText(raw.headline,65),tagline:safeText(raw.tagline,150),archetype:safeText(raw.archetype,65),sensitivity:raw.sensitivity,
  insights:(Array.isArray(raw.insights)?raw.insights:[]).slice(0,3).map(item=>({title:safeText(item.title,65),body:safeText(item.body,340),evidence:evidence(item.evidence)})),
  platforms:noBranding?[]:(Array.isArray(raw.platforms)?raw.platforms:[]).filter(item=>item&&Object.hasOwn(brandIcons,item.id)).slice(0,9).map(item=>({id:item.id,title:brandIcons[item.id].title,evidence:evidence(item.evidence)}))};
}
export function buildHtml(data) {
 const e=escapeHtml;
 const period=data.period?.label || data.year;
 const sourcePeriod=data.period?`${data.period.start} – ${data.period.actual_end || data.period.end}`:`Through ${data.as_of}`;
 const total=Object.values(data.metrics).reduce((a,b)=>a+b,0);
 const ranked=[...data.repositories].sort((a,b)=>keys.reduce((s,k)=>s+b[k]-a[k],0)).slice(0,5);
 const months=Object.entries(data.monthly).sort(([a],[b])=>a.localeCompare(b));
 const yearly=months.length>12;
 const chartValues=yearly?Object.entries(months.reduce((acc,[month,value])=>{const year=month.slice(0,4);acc[year]=(acc[year]||0)+value;return acc;},{})):months;
 const chartPeak=Math.max(1,...chartValues.map(([,value])=>value));
 const peak=months.reduce((a,b)=>b[1]>a[1]?b:a,['',0]);
 const metricLabels={commits:'Commits',pull_requests:'Pull requests',issues:'Issues',reviews:'Reviews'};
 const cards=[
 {tone:'lime',tag:'YOUR YEAR IN CODE',body:`<div class="orb"></div>${data.insights?.headline?`<h1 class="personal-headline">${e(data.insights.headline)}</h1><p class="caption">AI interpretation</p>`:'<h1>Built.<br>Shipped.<br>Repeated.</h1>'}<p class="intro">@${e(data.username)}<br>${e(period)} / GitHub Wrapped</p>${data.insights?.tagline?`<p class="tagline">${e(data.insights.tagline)}</p>`:''}<div class="stamp${data.year.length>4?' range':''}">${e(data.year)}</div>`},
 {tone:'purple',tag:'THE ACTIVITY MIX',body:`<div class="big">${fmt(total)}</div><h2>Recorded<br>contributions.</h2><div class="metrics">${Object.entries(data.metrics).map(([k,v])=>`<div><strong>${fmt(v)}</strong><span>${metricLabels[k]}</span></div>`).join('')}</div><p class="caption">Commits + pull requests + issues + reviews captured in this selection. These events can describe the same work.</p>`},
 ...(data.categories.includes('repositories') ? [{tone:'orange',tag:'WHERE YOU SHOWED UP',body:`<h2>Your project<br>rotation.</h2><ol class="projects">${ranked.map((r,i)=>`<li><b>${String(i+1).padStart(2,'0')}</b><div>${e(r.name)}<small>${fmt(keys.reduce((s,k)=>s+r[k],0))} captured contributions${r.private?' · private':''}</small></div></li>`).join('') || '<li>No repository-level activity captured.</li>'}</ol>`}] : []),
 {tone:'pink',tag:months.length?'YOUR RHYTHM':'THE BIGGER PICTURE',body:months.length?`<h2>${e(peak[0])}<br>hit different.</h2><p class="intro">${fmt(peak[1])} contributions in your busiest captured month.</p><div class="bars">${chartValues.map(([m,n])=>`<div><span style="height:${Math.max(2,n/chartPeak*390)}px"></span><small>${e(yearly?m:m.slice(5))}</small></div>`).join('')}</div><p class="caption">Chart grouped by ${yearly?'calendar year':'month'}. Calendar totals can include contribution types beyond the activity mix. Coverage follows the collector's scope.</p>`:`<h2>More than<br>a green square.</h2><p class="intro">${fmt(data.repositories.length)} projects in this selection.</p><p class="statement">Your graph measures activity.<br>Your work tells the story.</p><p class="caption">Calendar omitted when it cannot faithfully represent the selected repositories or visibility.</p>`},
 ...(data.insights?.archetype ? [{tone:'purple',tag:'YOUR CODING CHARACTER',body:`<p class="ai-label">AI INTERPRETATION</p><h2 class="personal-title">${e(data.insights.archetype)}</h2><p class="intro">${e(data.insights.tagline)}</p><p class="caption">A playful reading of the selected contribution evidence, not a measured personality assessment.</p>`}] : []),
 ...(data.insights?.insights ?? []).map((item,index)=>({tone:['orange','pink','purple'][index],tag:`YOUR STORY / ${index+1}`,body:`<p class="ai-label">AI INTERPRETATION</p><h2 class="personal-title">${e(item.title)}</h2><p class="insight-body">${e(item.body)}</p><div class="proof"><p>SELECTED EVIDENCE</p>${item.evidence.map(ref=>`<div>${e(ref)}</div>`).join('')}</div>`})),
 ...(data.insights?.platforms.length ? [{tone:'lime',tag:'YOUR PLATFORM UNIVERSE',body:`<h2>Your tools.<br>Your orbit.</h2><p class="ai-label">AI-IDENTIFIED FROM SELECTED EVIDENCE</p><div class="brands">${data.insights.platforms.map(item=>`<div><svg viewBox="0 0 24 24" role="img" aria-label="${e(item.title)}"><path d="${brandIcons[item.id].path}"/></svg><strong>${e(item.title)}</strong><small>${e(item.evidence[0])}</small></div>`).join('')}</div><p class="caption">Logos via Simple Icons. Trademarks belong to their owners; no affiliation or endorsement.</p>`}] : []),
 {tone:'blue',tag:'KEEP THE CONTEXT' ,body:`<h2>Made things.<br>Learned things.<br>Next chapter.</h2><ul class="notes">${data.notes.map(n=>`<li>${e(n)}</li>`).join('')}</ul><p class="caption">${data.period?`Selected ${e(data.period.start)} through ${e(data.period.end)}. `:''}Through ${e(data.period?.actual_end || data.as_of)}. Original GitHub Wrapped community project; not affiliated with GitHub or Spotify.</p>`}
 ];
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${data.demo?'DEMO · ':''}${e(period)} GitHub Wrapped · ${e(data.username)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#151515;color:#111;font-family:Arial,Helvetica,sans-serif}.deck{display:grid;gap:32px;justify-content:center;padding:32px}.card{position:relative;width:1080px;height:1920px;overflow:hidden;padding:100px 85px;display:flex;flex-direction:column}.lime{background:#c4fa56}.purple{background:#8a60f5;color:#fff}.orange{background:#ff8945}.pink{background:#f58bc9}.blue{background:#153bea;color:#e0ff8c}.top{font-weight:800;font-size:23px;letter-spacing:4px;display:flex;justify-content:space-between;gap:30px;z-index:1}.scope{font-size:19px;letter-spacing:1px;text-transform:uppercase}.content{position:relative;z-index:1;flex:1;padding-top:130px}h1{font-size:157px;line-height:.88;letter-spacing:-11px;margin:110px 0 70px;font-weight:900}h2{font-size:105px;letter-spacing:-6px;line-height:.98;margin:0 0 65px}.intro{font-size:39px;line-height:1.35;max-width:850px;overflow-wrap:anywhere}.stamp{position:absolute;font-size:290px;letter-spacing:-25px;bottom:20px;font-weight:900;transform:rotate(-9deg)}.stamp.range{font-size:135px;letter-spacing:-10px;bottom:70px}.personal-headline{font-size:130px;line-height:1;letter-spacing:-7px;max-width:900px;overflow-wrap:anywhere;margin-top:40px}.personal-title{font-size:100px;line-height:1.04;overflow-wrap:anywhere}.tagline{font-size:34px;line-height:1.3;max-width:800px}.ai-label{font-size:23px;font-weight:800;letter-spacing:2px;margin:0 0 55px}.insight-body{font-size:43px;line-height:1.4;overflow-wrap:anywhere}.proof{border-top:3px solid currentColor;margin-top:90px;padding-top:35px}.proof p{font-size:20px;font-weight:800;letter-spacing:3px}.proof div{font-size:25px;line-height:1.5;margin-top:20px;overflow-wrap:anywhere}.brands{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;margin-top:60px}.brands>div{border-top:3px solid #111;padding:25px 0}.brands svg{width:75px;height:75px;display:block;fill:currentColor;margin-bottom:15px}.brands strong{font-size:26px;display:block}.brands small{font-size:17px;line-height:1.3;display:block;overflow-wrap:anywhere;margin-top:12px}.orb{position:absolute;width:760px;height:760px;border:110px solid #153bea;border-radius:50%;right:-380px;top:120px;z-index:-1}.big{font-size:210px;font-weight:900;letter-spacing:-15px;margin:0 0 20px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin:80px 0}.metrics strong{display:block;font-size:68px}.metrics span{font-size:28px}.caption{font-size:25px;line-height:1.5;max-width:850px;margin-top:70px}.footer{font-size:21px;letter-spacing:1px;display:flex;justify-content:space-between;gap:20px;z-index:1}.footer small{display:block;font-size:17px;margin-top:8px}.footer>span:first-child{max-width:650px;overflow-wrap:anywhere}.projects{list-style:none;padding:0;margin:100px 0 0}.projects li{display:flex;align-items:center;gap:35px;border-top:3px solid #111;padding:39px 0;font-size:37px;font-weight:800;overflow-wrap:anywhere}.projects b{font-size:30px}.projects small{display:block;font-size:24px;font-weight:400;margin-top:13px}.bars{height:480px;display:flex;gap:10px;align-items:flex-end;margin-top:100px}.bars div{flex:1;min-width:0;text-align:center}.bars span{display:block;background:#153bea;border-radius:40px 40px 0 0;min-width:10px}.bars small{font-size:17px;display:block;margin-top:15px;writing-mode:vertical-rl;transform:rotate(180deg);margin-left:auto;margin-right:auto}.statement{font-size:60px;line-height:1.2;margin-top:140px;font-weight:800}.notes{padding-left:30px;font-size:27px;line-height:1.4}.notes li{padding:14px 0}@page{size:1080px 1920px;margin:0}@media print{body{background:white}.deck{display:block;padding:0}.card{break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.card:last-child{break-after:auto}}@media screen and (max-width:1100px){.deck{transform-origin:top left;zoom:calc(100vw / 1144)}}
</style></head><body><main class="deck" aria-label="GitHub year in review">${cards.map((card,i)=>`<section class="card ${card.tone}" aria-label="Story ${i+1}: ${e(card.tag)}"><header class="top"><span>${data.demo?'DEMO / ':''}${e(card.tag)}</span><span class="scope">${e(data.scope)} scope</span></header><div class="content">${card.body}</div><footer class="footer"><span>@${e(data.username)}<small>${e(sourcePeriod)}</small></span><span>GITHUB WRAPPED / ${String(i+1).padStart(2,'0')}</span></footer></section>`).join('')}</main></body></html>`;
}
export async function render({input,output,formats=['html','png','pdf','mp4'],showPrivateNames=false,insights,includePrivateInsights=false,noBranding=false,noInsights=false}) {
 if(!formats.length || formats.some(f=>!['html','png','pdf','mp4'].includes(f))) throw new Error('Formats must be html,png,pdf,mp4.');
 const source=JSON.parse(await readFile(input,'utf8'));
 const data=sanitize(source,showPrivateNames);
 if(insights&&!noInsights) data.insights=sanitizeInsights(JSON.parse(await readFile(insights,'utf8')),source,{includePrivateInsights,showPrivateNames,noBranding});
 await mkdir(output,{recursive:true,mode:0o700});
 const html=buildHtml(data);
 const cardCount=(html.match(/class="card /g)||[]).length;
 const targets=[...(formats.includes('html')?['wrapped.html']:[]),...(formats.includes('pdf')?['wrapped.pdf']:[]),...(formats.includes('mp4')?['wrapped.mp4']:[]),...(formats.includes('png')?Array.from({length:cardCount},(_,i)=>`card-${String(i+1).padStart(2,'0')}.png`):[])];
 for(const target of targets) {
  try {await access(path.join(output,target));} catch(error) {if(error.code==='ENOENT')continue;throw error;}
  throw new Error(`Output already exists: ${target}. Choose a new output directory.`);
 }
 if(formats.includes('html')) await writeFile(path.join(output,'wrapped.html'),html,{mode:0o600,flag:'wx'});
 if(!formats.some(f=>f!=='html')) return;
 const scratch=await mkdtemp(path.join(tmpdir(),'github-wrapped-'));
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1144,height:1984},deviceScaleFactor:1});
  await page.route('**/*',route=>route.abort());
  await page.setContent(html,{waitUntil:'load'});
  await page.emulateMedia({media:'print'});
  if(formats.includes('pdf')) await page.pdf({path:path.join(output,'wrapped.pdf'),printBackground:true,preferCSSPageSize:true});
  if(formats.includes('png') || formats.includes('mp4')) {
   const cards=page.locator('.card');
   for(let i=0;i<await cards.count();i++) await cards.nth(i).screenshot({path:path.join(scratch,`card-${String(i+1).padStart(2,'0')}.png`)});
   if(formats.includes('png')) {
    for(let i=1;i<=await cards.count();i++) await writeFile(path.join(output,`card-${String(i).padStart(2,'0')}.png`),await readFile(path.join(scratch,`card-${String(i).padStart(2,'0')}.png`)),{mode:0o600,flag:'wx'});
   }
   if(formats.includes('mp4')) {
    const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-n','-framerate','1/4','-i',path.join(scratch,'card-%02d.png'),'-vf',"scale=1120:1990,zoompan=z='min(zoom+0.00025,1.03)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=120:s=1080x1920:fps=30,format=yuv420p",'-c:v','libx264','-preset','fast','-crf','22','-movflags','+faststart',path.resolve(output,'wrapped.mp4')],{encoding:'utf8'});
    if(result.error || result.status!==0) throw new Error(`Video export failed: ${result.error?.message ?? result.stderr}. Install ffmpeg or omit mp4.`);
   }
  }
 } finally {await browser?.close();await rm(scratch,{recursive:true,force:true});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);const options={};
 for(let i=0;i<args.length;i++){const a=args[i];if(a==='--show-private-names')options.showPrivateNames=true;else if(a==='--include-private-insights')options.includePrivateInsights=true;else if(a==='--no-branding')options.noBranding=true;else if(a==='--no-insights')options.noInsights=true;else if(['--input','--output','--formats','--insights'].includes(a)){if(!args[i+1] || args[i+1].startsWith('--'))throw new Error(`Missing value for ${a}`);options[a.slice(2)]=args[++i];}else if(a==='--help'){console.log('node scripts/render.mjs --input data.json --output output-dir [--formats html,png,pdf,mp4] [--show-private-names] [--insights insights.json] [--include-private-insights] [--no-insights] [--no-branding]');process.exit(0);}else throw new Error(`Unknown argument: ${a}`);}
 if(!options.input || !options.output)throw new Error('--input and --output are required');
 if(options.formats)options.formats=options.formats.split(',');
 render(options).then(()=>console.log(`Rendered to ${options.output}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
