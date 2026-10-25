// Pure verification of retained semantic-control evidence. Never connects to an app/device.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const steps=['neutral','left','right','up','down'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const normalized=p=>p&&Object.keys(p).sort().join(',')==='x,y'&&['x','y'].every(k=>finite(p[k])&&p[k]>=0&&p[k]<=1);
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function calibrationValid(c){
 if(!c||Object.keys(c).sort().join(',')!=='cameraId,extents,gain,jitter,mode,neutral,schemaVersion,selectedHand,smoothing'||c.schemaVersion!==1||typeof c.cameraId!=='string'||!c.cameraId.length||c.cameraId.length>1024||!['head','palm'].includes(c.mode)||!normalized(c.neutral)||!c.jitter||Object.keys(c.jitter).sort().join(',')!=='x,y'||!['x','y'].every(k=>finite(c.jitter[k])&&c.jitter[k]>=0)||!finite(c.gain)||c.gain<.5||c.gain>3||!finite(c.smoothing)||c.smoothing<0||c.smoothing>100||!c.extents||Object.keys(c.extents).sort().join(',')!=='down,left,right,up')return false;
 if(c.mode==='head'?c.selectedHand!==null:!['Left','Right'].includes(c.selectedHand))return false;
 return ['left','right','up','down'].every(k=>finite(c.extents[k])&&c.extents[k]>.01&&c.extents[k]<=1&&c.extents[k]>3*c.jitter[['left','right'].includes(k)?'x':'y']);
}
export function verifyResponse(record,context={}){
 const failures=[];const check=(condition,message)=>{if(!condition)failures.push(message);};
 const req=record.request??{},o=record.outcome??{},b=o.before??{},a=o.after??{},s=o.status??{};
 check(['start','begin','capture','recenter','baseline','settings','stop','confirm','metadata'].includes(req.action),'unknown semantic action');
 check(!record.error,'action record has error');
 check(s.realInput===false&&s.microphoneEnabled===false&&s.native?.buttonDown===false&&s.canvasConfirmed===false,'expected fake input/mic off/pen up/unconfirmed canvas');
 check(!s.nativeFault&&s.nativeClockReady===true&&s.native?.state==='PAUSED'&&s.native.generation===s.generation,'helper/clock/state/generation unhealthy');
 if(['start','capture','recenter','confirm'].includes(req.action))check(typeof req.operatorConfirmation==='string'&&req.operatorConfirmation.length>0,'operator confirmation missing');
 const p=a.probe??{},old=b.probe??{},settings=s.settings??{};
 if(req.action==='start'){
  check(['head','palm'].includes(req.mode)&&['MacBook','Samsung'].includes(req.camera),'unknown requested mode/camera');
  check(p.running===true&&p.mode===req.mode&&settings.mode===req.mode&&p.cameraId===settings.cameraId&&p.frames>0,'new camera/model not established');
 }else if(['capture','recenter','confirm','baseline'].includes(req.action)){
  check(old.running===true&&p.running===true&&old.mode===p.mode&&p.mode===settings.mode,'active/selected mode mismatch');
  check(old.cameraId===p.cameraId&&p.cameraId===settings.cameraId&&typeof p.cameraId==='string'&&p.cameraId.length>0,'active/selected camera mismatch');
  check(!context.cameraId||p.cameraId===context.cameraId,'camera differs from prior verified operation');
  check(!context.mode||p.mode===context.mode,'mode differs from prior verified operation');
  if(p.mode==='palm')check(['Left','Right'].includes(old.selectedHand)&&p.selectedHand===old.selectedHand&&(!context.hand||p.selectedHand===context.hand),'selected label changed/missing');
  if(['capture','recenter','confirm'].includes(req.action)){
   check(p.frames>old.frames&&p.validFrames>old.validFrames,'no fresh valid worker progress');
   check(p.confirmationRequired===false,'hand still requires confirmation');
   if(old.confirmationRequired)check(o.confirmationForwarded===true,'required explicit confirmation was not forwarded');
  }
 }
 let counts=null;
 if(req.action==='capture'||req.action==='recenter'){
  check(new Date(record.finishedAt)-new Date(record.startedAt)>=2000,'record duration shorter than capture window');
  const expression=req.action==='recenter'?/^Recenter saved \((\d+)\/(\d+) valid frames\)/:req.step==='down'?/^Five-position calibration saved \((\d+)\/(\d+) valid frames\)/:/^Captured (\d+)\/(\d+) valid frames\./;
  const match=a.setup?.message?.match(expression);check(Boolean(match),'no new successful capture/save message');
  if(match){counts={valid:Number(match[1]),total:Number(match[2])};check(counts.valid>=40&&counts.total>=counts.valid&&counts.valid/counts.total>=.8,'40 sample/80% gate failed');check(p.validFrames-old.validFrames>=counts.valid&&p.frames-old.frames>=counts.total,'capture counts exceed actual worker progress');}
  check(a.setup?.active===false,'capture still active');
  if(req.action==='capture'){
   const index=steps.indexOf(req.step);check(index>=0&&b.setup?.step===req.step&&b.setup?.calibrating===true&&!b.setup.active,'before step/state mismatch');
   check(!context.nextStep||req.step===context.nextStep,'verified capture sequence out of order');
   check(a.setup?.step===(steps[index+1]??null)&&a.setup?.calibrating===(req.step!=='down'),'exact next step/state not reached');
  }
  const saving=req.action==='recenter'||req.step==='down';
  check(Number.isSafeInteger(context.generation),'prior verified generation required');
  check(s.generation===context.generation+(saving?1:0),'generation changed unexpectedly or no new save');
  if(saving){
   const c=a.setup?.calibration;check(calibrationValid(c),'saved calibration invalid');
   check(c?.cameraId===p.cameraId&&c?.mode===p.mode&&c?.selectedHand===(p.mode==='palm'?p.selectedHand:null),'saved calibration context mismatch');
   check(settings.calibrations?.some(x=>same(x,c)),'new calibration not in persisted settings');
   if(req.action==='recenter')check(b.setup?.calibration&&['left','right','up','down'].every(k=>b.setup.calibration.extents[k]===c?.extents?.[k])&&a.setup.recentering===false,'recenter extents/state mismatch');
  }
 }
 if(req.action==='begin')check(a.setup?.step==='neutral'&&a.setup?.calibrating===true&&a.setup?.active===false,'new calibration session not established');
 if(req.action==='stop')check(a.probe?.running===false&&a.probe?.frames===0,'camera did not stop');
 if(req.action==='settings')check(s.settingsOpen===true&&s.collapsed===false,'settings not shown');
 if(req.action==='confirm')check(o.confirmationForwarded===true&&old.confirmationRequired===true,'no new explicit loss confirmation established');
 if(req.action==='baseline'){
  check(calibrationValid(b.setup?.calibration)&&b.setup.calibration.cameraId===settings.cameraId&&b.setup.calibration.mode===settings.mode,'baseline lacks applicable saved calibration');
  check(!b.setup.active&&!b.setup.calibrating,'baseline began during capture');
  check(a.setup?.baseline==='warmup'&&s.collapsed===true&&s.settingsOpen===false,'new baseline/warmup/background not established');
  check(s.generation===context.generation,'baseline context changed');
 }
 const verified=failures.length===0;
 const next=verified?{...context,generation:s.generation,cameraId:settings.cameraId,mode:settings.mode,hand:p.selectedHand??context.hand,nextStep:req.action==='capture'?(steps[steps.indexOf(req.step)+1]??null):['start','begin'].includes(req.action)?'neutral':context.nextStep}:context;
 return {verified,action:req.action,step:req.step??null,counts,failures,nextContext:next,harnessSuccessAdvisory:o.success};
}
function loadRecords(directory){return readdirSync(directory).filter(n=>/^response-.*\.json$/.test(n)).sort().map(name=>({name,record:JSON.parse(readFileSync(path.join(directory,name),'utf8'))}));}
function verifyAll(rows){let context={};return rows.map(({name,record})=>{const proof=verifyResponse(record,context);if(proof.verified)context=proof.nextContext;return {file:name,...proof};});}
const args=process.argv.slice(2);
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main&&args[0]==='--self-test'){
 const rows=loadRecords(args[1]).slice(0,4),positive=verifyAll(rows);assert.equal(rows.length,4);assert.deepEqual(rows.map(x=>x.record.request.step??x.record.request.action),['start','neutral','left','right']);assert(positive.every(p=>p.verified));
 const fixtures=JSON.parse(readFileSync(new URL('../../../../fixtures/tracking-v1.json',import.meta.url),'utf8'));
 for(const c of fixtures.calibration.positive)assert(calibrationValid(c));for(const c of fixtures.calibration.negative)assert(!calibrationValid(c.value));
 const source=rows.find(x=>x.record.request.action==='capture').record,context=positive[0].nextContext;
 const mutations=[r=>{r.outcome.after.setup.step=null;},r=>{r.outcome.after.probe.mode='head';},r=>{r.outcome.after.probe.cameraId='other';},r=>{r.outcome.after.probe.selectedHand='Right';},r=>{r.outcome.after.probe.frames=r.outcome.before.probe.frames;},r=>{r.outcome.after.setup.message='Captured 39/39 valid frames.';},r=>{r.outcome.after.setup.message='Captured 40/51 valid frames.';},r=>{r.outcome.status.generation++;},r=>{r.outcome.status.native.state='DRAWING';},r=>{r.error='failed';},r=>{r.request.step='right';},r=>{r.request.action='recenter';r.outcome.after.setup.message='Recenter saved (57/57 valid frames).';},r=>{r.request.action='baseline';r.outcome.after.setup.baseline='idle';}];
 for(const mutate of mutations){const record=structuredClone(source);mutate(record);assert(!verifyResponse(record,context).verified);}
 console.log(JSON.stringify({classification:'automated pure metadata verifier self-test; no app/device connection',positiveRecords:positive.length,negativeMutations:mutations.length,sharedCalibrationFixtures:'pass',result:'pass'}));
}else if(main&&args[0]){
 const proofs=verifyAll(loadRecords(args[0]));console.log(JSON.stringify({classification:'pure external verification of immutable operator-control evidence; harness success advisory only',proofs},null,2));if(proofs.some(p=>!p.verified))process.exitCode=1;
}
