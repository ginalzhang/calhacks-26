// Operator-controlled physical cameras. No camera activation or native input by this harness.
import { _electron } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const trial=process.argv[2]??'01'; if(!/^\d{2}$/.test(trial))throw new Error('Use a unique two-digit trial');
const output=fileURLToPath(new URL(`hardware-trial-${trial}.json`,import.meta.url));
const stop=fileURLToPath(new URL(`hardware-trial-${trial}.stop`,import.meta.url));
if(existsSync(output)||existsSync(stop))throw new Error('Preserve prior trial and choose a new number');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result={classification:'manual hardware with operator camera activation; numeric browser observations',app:process.argv[3]??'/private/tmp/steady-phase02-20261024-01/operator/Steady.app',startedAt:new Date().toISOString(),hostNetworkChanged:false,realInputEnabled:false,automaticCameraActivation:false,microphoneActivationRequested:false,observations:[],error:null};
let app;
try {
 app=await _electron.launch({executablePath:result.app+'/Contents/MacOS/Steady',env,timeout:20000});
 const panel=await app.firstWindow();
 await panel.waitForFunction(async()=>Boolean((await window.steady.status()).nativeClockReady),{timeout:15000});
 await panel.evaluate(()=>{
  const root=globalThis;root.phase02Diagnostics={probe:null,setup:null};
  const c=new BroadcastChannel('steady-camera-probe');root.phase02DiagnosticChannel=c;
  c.onmessage=event=>{if(event.data?.type==='report')root.phase02Diagnostics.probe=event.data.report;if(event.data?.type==='setup')root.phase02Diagnostics.setup=event.data.snapshot;};c.postMessage({type:'query'});
 });
 await panel.evaluate(()=>window.steady.openSettings());
 console.log('HARDWARE_READY: new Phase02 app, fake normal input, microphone off; operator may start Head camera.');
 const end=Date.now()+25*60*1000;
 while(Date.now()<end&&!existsSync(stop)&&app.process().exitCode===null&&!app.process().signalCode){
  const observation=await panel.evaluate(async()=>{
   const status=await window.steady.status(), d=globalThis.phase02Diagnostics;
   return {time:new Date().toISOString(),generation:status.generation,cameraId:status.settings?.cameraId,mode:status.settings?.mode,calibrations:status.settings?.calibrations,collapsed:status.collapsed,settingsOpen:status.settingsOpen,canvasConfirmed:status.canvasConfirmed,microphoneEnabled:status.microphoneEnabled,realInput:status.realInput,nativeState:status.native?.state,buttonDown:status.native?.buttonDown,probe:d?.probe,setup:d?.setup};
  });
  if(observation.realInput||observation.microphoneEnabled||observation.buttonDown)throw new Error('Unexpected active input state');
  result.observations.push(observation);writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
}catch(error){result.error=String(error).slice(0,500);console.log('HARDWARE_ERROR: '+result.error);process.exitCode=1;}
finally{result.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(result,null,2)+'\n');if(app)await app.close().catch(()=>{});}
