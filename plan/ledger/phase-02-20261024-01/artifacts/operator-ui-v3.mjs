// Reversible app UI/diagnostic actions only; camera activation stays with the operator.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const [action,tag]=process.argv.slice(2);
if(!['metadata','baseline','settings','stop'].includes(action)||!tag||!/^[a-z0-9-]+$/.test(tag))throw new Error('Expected safe UI action and unique tag');
const output=fileURLToPath(new URL(`ui-${tag}.json`,import.meta.url));if(existsSync(output))throw new Error('Preserve earlier action record; use a fresh tag');
const port=readFileSync('/Users/issacwoo/Library/Application Support/Steady/DevToolsActivePort','utf8').split('\n')[0];
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const panel=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/steady-phase02-20261024-01/operator-v3/Steady.app/')&&new URL(p.url()).searchParams.get('view')==='panel');
if(!panel)throw new Error('Verified operator-v3 panel not found');
const result=await panel.evaluate(async(action)=>{
 const before=await window.steady.status();if(before.realInput||before.microphoneEnabled)throw new Error('Expected fake input and microphone off');
 if(action==='baseline'){
  if(before.nativeFault)throw new Error('Helper fault requires explicit app restart');
  const c=new BroadcastChannel('steady-camera-probe');c.postMessage({type:'baseline'});setTimeout(()=>c.close(),100);
  await window.steady.closeSettings();await window.steady.collapse(true);
 }
 if(action==='settings'){await window.steady.collapse(false);await window.steady.openSettings();}
 if(action==='stop'){const c=new BroadcastChannel('steady-camera-probe');c.postMessage({type:'stop'});setTimeout(()=>c.close(),100);}
 const after=await window.steady.status();const cameras=action==='metadata'?(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput').map(d=>({deviceId:d.deviceId,label:d.label})):undefined;
 return {before,after,cameras};
},action);
writeFileSync(output,JSON.stringify({classification:'automated reversible app UI/diagnostic action during operator-controlled physical trial; no camera activation/native input',time:new Date().toISOString(),action,...result},null,2)+'\n');
console.log(JSON.stringify({action,mode:result.after.settings?.mode,nativeFault:result.after.nativeFault,nativeClockReady:result.after.nativeClockReady,collapsed:result.after.collapsed}));
// Disconnect only; do not close the operator's app/context.
process.exit(0);
