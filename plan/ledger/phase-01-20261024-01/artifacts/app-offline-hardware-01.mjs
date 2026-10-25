// Operator-driven physical-camera test. No fake devices and no automatic camera/input actions.
import { _electron } from '@playwright/test';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const trial=process.argv[2]??'01';if(!/^\d{2}$/.test(trial))throw new Error('Expected two-digit trial number');
const output=fileURLToPath(new URL(`app-offline-hardware-${trial}-result.json`,import.meta.url));
const stop=fileURLToPath(new URL(`app-offline-hardware-${trial}.stop`,import.meta.url));
if(existsSync(output)||existsSync(stop))throw new Error('Trial already exists; preserve it and choose a fresh number');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result={classification:'operator physical camera with app-scoped Chromium offline emulation; host remains online',app:'/private/tmp/steady-phase01-20261024-01/nonvoice/Steady.app',startedAt:new Date().toISOString(),hostNetworkChanged:false,realInputEnabled:false,microphoneActivationRequested:false,automaticCameraActivation:false,offlineApplied:false,observations:[],finalStatus:null,error:null};
let app;
try {
 app=await _electron.launch({executablePath:result.app+'/Contents/MacOS/Steady',env,timeout:20000});
 const panel=await app.firstWindow();
 const deadline=Date.now()+15000;
 while(!(await panel.evaluate(async()=>(await window.steady.status()).nativeClockReady))){if(Date.now()>deadline)throw new Error('Native clock not ready');await new Promise(r=>setTimeout(r,100));}
 const initial=await panel.evaluate(()=>window.steady.status());
 if(initial.realInput||initial.microphoneEnabled)throw new Error('Expected fake input and microphone off');
 await app.context().setOffline(true);
 if(await panel.evaluate(()=>navigator.onLine))throw new Error('Browser did not enter offline mode');
 result.offlineApplied=true;await panel.evaluate(()=>window.steady.openSettings());writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('OFFLINE_READY: Steady browser context offline; host networking unchanged. Operator may open Settings and Start camera manually.');
 let last='';const end=Date.now()+8*60*1000;
 while(Date.now()<end&&app.process().exitCode===null&&!app.process().signalCode&&!existsSync(stop)){
  const settings=app.windows().find(page=>{try{return new URL(page.url()).searchParams.get('view')==='settings';}catch{return false;}});
  if(settings&&!settings.isClosed()){
   const observation=await settings.evaluate(()=>{
    const section=document.querySelector('[aria-labelledby="camera-heading"]');
    const selects=section?.querySelectorAll('select');
    const camera=selects?.[1];const match=section?.querySelector('[role="status"]')?.textContent?.match(/(\d+) frames(?: · (GPU|CPU))?/);
    return {mode:selects?.[0]?.value??null,camera:camera?.selectedOptions?.[0]?.textContent??null,frames:match?Number(match[1]):null,delegate:match?.[2]??null,browserOnline:navigator.onLine};
   }).catch(error=>{if(settings.isClosed())return null;throw error;});
   if(observation===null)continue;
   const key=JSON.stringify(observation);
   if(key!==last){last=key;result.observations.push({...observation,observedAt:new Date().toISOString()});if(result.observations.length>1000)throw new Error('Observation bound exceeded');writeFileSync(output,JSON.stringify(result,null,2)+'\n');}
  }
  await new Promise(r=>setTimeout(r,1000));
 }
 if(app.process().exitCode===null){result.finalStatus=await panel.evaluate(()=>window.steady.status());result.finalStatus={microphoneEnabled:result.finalStatus.microphoneEnabled,realInput:result.finalStatus.realInput,nativeClockReady:result.finalStatus.nativeClockReady};}
}catch(error){result.error=String(error).slice(0,500);console.log('OFFLINE_TEST_ERROR: '+result.error);process.exitCode=1;}
finally{result.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(result,null,2)+'\n');if(app)await app.close().catch(()=>{});}
