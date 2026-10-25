// Operator-directed assisted captures preserve the exact two-second window/hand guard.
import { chromium } from '@playwright/test';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const [step,tag,operatorConfirmation]=process.argv.slice(2);
if(!['neutral','left','right','up','down'].includes(step)||!tag||!/^[a-z0-9-]+$/.test(tag)||!operatorConfirmation)throw new Error('Expected step, unique tag and exact operator confirmation');
const output=fileURLToPath(new URL(`assisted-${tag}.json`,import.meta.url));if(existsSync(output))throw new Error('Preserve prior capture; use fresh tag');
const port=readFileSync('/Users/issacwoo/Library/Application Support/Steady/DevToolsActivePort','utf8').split('\n')[0];
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const panel=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/steady-phase02-20261024-01/operator-v5/Steady.app/')&&new URL(p.url()).searchParams.get('view')==='panel');if(!panel)throw new Error('Verified current operator-v5 missing');
const result={classification:'assisted physical calibration after explicit intended-hand/readiness confirmation; no native input/raw frames',operatorConfirmation,step,startedAt:new Date().toISOString(),outcome:null,error:null};
try{
 if(step==='neutral') await panel.evaluate(async()=>{ if(globalThis.phase02Diagnostics?.setup?.step!=='neutral'){const c=new BroadcastChannel('steady-camera-probe');c.postMessage({type:'calibrate'});await new Promise(r=>setTimeout(r,150));c.close();} });
 await new Promise(r=>setTimeout(r,3000));
 result.outcome=await panel.evaluate(async(step)=>{
  const status=await window.steady.status();const before=structuredClone(globalThis.phase02Diagnostics);
  if(status.realInput||status.microphoneEnabled||status.nativeFault||status.settings?.mode!=='palm'||before.setup?.step!==step||before.setup?.active||before.probe?.mode!=='palm'||!before.probe?.running)throw new Error('Expected ready Palm '+step+'; current step '+before.setup?.step);
  const c=new BroadcastChannel('steady-camera-probe');let confirmationForwarded=false;
  try{
   if(before.probe?.confirmationRequired){c.postMessage({type:'confirmHand'});confirmationForwarded=true;await new Promise(r=>setTimeout(r,200));}
   const ready=globalThis.phase02Diagnostics.probe;
   if(ready?.confirmationRequired||ready?.message!=='valid')return {before,confirmationForwarded,captured:false,reason:'Selected hand not valid after confirmation',after:structuredClone(globalThis.phase02Diagnostics)};
   c.postMessage({type:'capture'});const captureRequestedAt=new Date().toISOString();await new Promise(r=>setTimeout(r,2300));
   const after=structuredClone(globalThis.phase02Diagnostics);
   return {before,confirmationForwarded,captured:true,captureRequestedAt,success:step==='down'?after.setup?.message?.startsWith('Five-position calibration saved'):after.setup?.step!==step,after,status:await window.steady.status()};
  }finally{c.close();}
 },step);
}catch(error){result.error=String(error);}
result.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({step,error:result.error,captured:result.outcome?.captured,success:result.outcome?.success,reason:result.outcome?.reason,message:result.outcome?.after?.setup?.message,nextStep:result.outcome?.after?.setup?.step}));process.exit(result.error?1:0);
