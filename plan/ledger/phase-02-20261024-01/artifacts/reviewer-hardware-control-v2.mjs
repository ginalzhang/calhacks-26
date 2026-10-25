// One persistent Playwright connection; only operator-directed semantic app controls.
import { _electron } from '@playwright/test';
import { verifyResponse } from './reviewer-evidence-verifier.mjs';
import { existsSync,readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const trial=process.argv[2]??'05';if(!/^\d{2}$/.test(trial))throw new Error('Unique two-digit trial required');
const root=fileURLToPath(new URL('.',import.meta.url)),output=root+`hardware-trial-${trial}.json`,stop=root+`hardware-trial-${trial}.stop`,commands=root+`control-trial-${trial}/`;
if(existsSync(output)||existsSync(stop))throw new Error('Preserve previous trial');mkdirSync(commands,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result={classification:'operator physical cameras with one persistent numeric observer/control connection',app:'/private/tmp/steady-phase02-20261024-01/operator-v5/Steady.app',startedAt:new Date().toISOString(),automaticCameraActivation:false,realInputEnabled:false,microphoneActivationRequested:false,observations:[],actions:[],error:null};
let app,child,panel;
const processed=new Set();let verificationContext={};
async function snapshot(){return panel.evaluate(async()=>{const s=await window.steady.status(),d=globalThis.phase02Diagnostics;return {time:new Date().toISOString(),generation:s.generation,cameraId:s.settings?.cameraId,mode:s.settings?.mode,calibrations:s.settings?.calibrations,collapsed:s.collapsed,settingsOpen:s.settingsOpen,canvasConfirmed:s.canvasConfirmed,microphoneEnabled:s.microphoneEnabled,realInput:s.realInput,nativeState:s.native?.state,nativeGeneration:s.native?.generation,nativeLatestValidFrame:s.native?.latestValidFrame,nativeReason:s.native?.reason,nativeForeground:s.native?.foregroundTarget,nativeClockReady:s.nativeClockReady,nativeFault:s.nativeFault??null,fault:s.fault,buttonDown:s.native?.buttonDown,probe:d?.probe,setup:d?.setup};});}
async function act(request){
 const allowed=['start','begin','capture','recenter','baseline','settings','stop','confirm','metadata'];
 if(!allowed.includes(request.action))throw new Error('Unknown semantic action');
 if(['start','capture','recenter','confirm'].includes(request.action)&&!(typeof request.operatorConfirmation==='string'&&request.operatorConfirmation.length>0&&request.operatorConfirmation.length<=500))throw new Error('Explicit operator readiness/hand confirmation required');
 if(request.action==='capture'&&!['neutral','left','right','up','down'].includes(request.step))throw new Error('Invalid capture step');
 if(request.action==='start'&&(!['head','palm'].includes(request.mode)||!['MacBook','Samsung'].includes(request.camera)))throw new Error('Invalid camera/mode selection');
 // Validate the active source before any neutral auto-begin side effect.
 if(['capture','recenter','confirm'].includes(request.action)){
  const current=await snapshot();
  if(current.mode!=='palm'||current.probe?.mode!=='palm'||!current.probe.running||current.probe.cameraId!==current.cameraId)throw new Error('Expected matching active/selected Palm camera');
  if(verificationContext.cameraId&&current.cameraId!==verificationContext.cameraId)throw new Error('Camera changed from verified context');
 }
 if(request.action==='capture'&&request.step==='neutral')await panel.evaluate(async()=>{if(globalThis.phase02Diagnostics?.setup?.step!=='neutral'){const c=new BroadcastChannel('steady-camera-probe');c.postMessage({type:'calibrate'});await new Promise(r=>setTimeout(r,150));c.close();}});
 if(['capture','recenter','confirm'].includes(request.action))await new Promise(r=>setTimeout(r,3000));
 return panel.evaluate(async(req)=>{
  const before=structuredClone(globalThis.phase02Diagnostics),initial=await window.steady.status();
  if(initial.realInput||initial.microphoneEnabled||initial.native?.buttonDown)throw new Error('Expected fake input, mic off and pen up');
  if(initial.nativeFault&&!['stop','settings','metadata'].includes(req.action))throw new Error('Native helper fault requires explicit restart');
  const c=new BroadcastChannel('steady-camera-probe');let confirmationForwarded=false;
  try{
   if(req.action==='start'){
    const camera=(await navigator.mediaDevices.enumerateDevices()).find(d=>d.kind==='videoinput'&&d.label.includes(req.camera));if(!camera)throw new Error('Requested camera unavailable');
    c.postMessage({type:'stop'});await window.steady.selectCamera(camera.deviceId,req.mode);c.postMessage({type:'start',cameraId:camera.deviceId,mode:req.mode});await new Promise(r=>setTimeout(r,1000));
   }
   if(req.action==='begin'){c.postMessage({type:'calibrate'});await new Promise(r=>setTimeout(r,150));}
   if(['capture','recenter','confirm'].includes(req.action)){
    if(!before.probe?.running||before.probe?.mode!=='palm'||initial.settings?.mode!=='palm'||before.probe.cameraId!==initial.settings.cameraId)throw new Error('Expected matching active/selected Palm camera');
    if(req.action==='capture'&&(before.setup?.step!==req.step||before.setup?.active))throw new Error('Capture step mismatch: '+before.setup?.step);
    const progressFrame=globalThis.phase02Diagnostics.probe?.frames;await new Promise(r=>setTimeout(r,150));
    if(!(globalThis.phase02Diagnostics.probe?.frames>progressFrame))return {success:false,reason:'No fresh tracking progress; capture not requested',before,after:structuredClone(globalThis.phase02Diagnostics),status:await window.steady.status()};
    if(globalThis.phase02Diagnostics.probe?.confirmationRequired){c.postMessage({type:'confirmHand'});confirmationForwarded=true;await new Promise(r=>setTimeout(r,200));}
    const ready=globalThis.phase02Diagnostics.probe,current=await window.steady.status();
    if(current.generation!==initial.generation||current.settings?.cameraId!==initial.settings?.cameraId||current.settings?.mode!==initial.settings?.mode||ready?.cameraId!==before.probe.cameraId||ready?.mode!==before.probe.mode||ready?.selectedHand!==before.probe.selectedHand)throw new Error('Capture/confirmation context changed');
    if(ready?.confirmationRequired||ready?.message!=='valid')return {success:false,reason:'Selected hand not valid after confirmation',confirmationForwarded,before,after:structuredClone(globalThis.phase02Diagnostics),status:await window.steady.status()};
    if(req.action==='capture'){c.postMessage({type:'capture'});await new Promise(r=>setTimeout(r,2400));}
    if(req.action==='recenter'){c.postMessage({type:'recenter'});await new Promise(r=>setTimeout(r,2400));}
   }
   if(req.action==='baseline'){c.postMessage({type:'baseline'});await new Promise(r=>setTimeout(r,100));await window.steady.closeSettings();await window.steady.collapse(true);}
   if(req.action==='settings'){await window.steady.collapse(false);await window.steady.openSettings();}
   if(req.action==='stop'){c.postMessage({type:'stop'});await new Promise(r=>setTimeout(r,100));}
   const after=structuredClone(globalThis.phase02Diagnostics),status=await window.steady.status();
   let success=true;if(req.action==='capture')success=req.step==='down'?after.setup?.message?.startsWith('Five-position calibration saved')&&after.setup?.step===null&&status.generation===initial.generation+1:after.setup?.step===({neutral:'left',left:'right',right:'up',up:'down'})[req.step]&&after.setup?.message?.startsWith('Captured ')&&status.generation===initial.generation;
   if(req.action==='recenter')success=status.generation===initial.generation+1&&after.setup?.message?.startsWith('Recenter saved')&&JSON.stringify(before.setup?.calibration?.extents)===JSON.stringify(after.setup?.calibration?.extents);
   if(req.action==='baseline')success=after.setup?.baseline==='warmup'&&status.collapsed===true&&status.settingsOpen===false;
   if(req.action==='start')success=after.probe?.running===true&&after.probe?.mode===req.mode&&after.probe?.cameraId===status.settings?.cameraId&&after.probe?.frames>0;
   const cameras=req.action==='metadata'?(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput').map(d=>({deviceId:d.deviceId,label:d.label})):undefined;
   return {success,confirmationForwarded,before,after,status,cameras};
  }finally{c.close();}
 },request);
}
try{
 app=await _electron.launch({executablePath:result.app+'/Contents/MacOS/Steady',env,timeout:20000});child=app.process();panel=await app.firstWindow();
 await panel.waitForFunction(async()=>Boolean((await window.steady.status()).nativeClockReady),{timeout:15000});
 await panel.evaluate(()=>{globalThis.phase02Diagnostics={probe:null,setup:null};const c=new BroadcastChannel('steady-camera-probe');globalThis.phase02DiagnosticChannel=c;c.onmessage=e=>{if(e.data?.type==='report')globalThis.phase02Diagnostics.probe=e.data.report;if(e.data?.type==='setup')globalThis.phase02Diagnostics.setup=e.data.snapshot;};c.postMessage({type:'query'});});
 await panel.evaluate(()=>window.steady.openSettings());console.log('HARDWARE_CONTROL_READY: no automatic camera start; explicit operator commands only.');
 while(!existsSync(stop)&&child.exitCode===null&&!child.signalCode){
  for(const file of readdirSync(commands).filter(n=>/^request-[a-z0-9-]+\.json$/.test(n)).sort()){
   if(processed.has(file))continue;processed.add(file);const response=commands+file.replace('request-','response-');if(existsSync(response))continue;
   const record={classification:'operator-directed assisted semantic control; no raw camera/native desktop input',request:null,startedAt:new Date().toISOString(),outcome:null,error:null};
   try{record.request=JSON.parse(readFileSync(commands+file,'utf8'));record.outcome=await act(record.request);}catch(error){record.error=String(error).slice(0,1000);}
   record.finishedAt=new Date().toISOString();record.externalProof=verifyResponse(record,verificationContext);if(record.externalProof.verified)verificationContext=record.externalProof.nextContext;writeFileSync(response,JSON.stringify(record,null,2)+'\n');result.actions.push({request:file,response:response.split('/').pop(),finishedAt:record.finishedAt,error:record.error});
  }
  try{const observation=await snapshot();if(observation.realInput||observation.microphoneEnabled||observation.buttonDown)throw new Error('Unexpected active input');result.observations.push(observation);}catch(error){if(child.exitCode!==null||child.signalCode){result.appExit={code:child.exitCode,signal:child.signalCode};break;}throw error;}
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');await new Promise(r=>setTimeout(r,1000));
 }
}catch(error){if(child?.exitCode===0){result.appExit={code:0};}else{result.error=String(error).slice(0,1000);console.log('CONTROL_ERROR: '+result.error);process.exitCode=1;}}
finally{result.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(result,null,2)+'\n');if(app&&child?.exitCode===null)await app.close().catch(()=>{});}
