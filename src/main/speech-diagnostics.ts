import type { SpeechDiagnostics } from '../shared/contracts';
import { isObject, uuid, uint, finite } from './protocol';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
export const SPEECH_DIAGNOSTICS_PREFIX='steady-speech-probe:';
export const MAX_DIAGNOSTIC_BYTES=2048;
const fields=['v','session','phase','assets','audioBuffers','audioSeconds','transcriberResults','transcriberFinals','detectorResults','speechResults','silenceResults','acceptedUtterances','errorCode'];
const errorCodes=['microphone-setup-failed','speech-assets-failed','speech-audio-conversion','speech-audio-host-time-unavailable','speech-audio-overrun','speech-audio-allocation','speech-transcriber-failed','speech-detector-failed','speech-analysis-failed','speech-finalization-failed'];
export const isSpeechDiagnosticError=(code:string):boolean=>errorCodes.includes(code);
export function emptySpeechDiagnostics(session:string|null):SpeechDiagnostics{return {v:1,session,phase:'idle',assets:'unknown',audioBuffers:0,audioSeconds:0,transcriberResults:0,transcriberFinals:0,detectorResults:0,speechResults:0,silenceResults:0,acceptedUtterances:0,errorCode:null};}
export function parseSpeechDiagnostics(line:string,session:string|null):SpeechDiagnostics|null {
  if(Buffer.byteLength(line)>MAX_DIAGNOSTIC_BYTES||!line.startsWith(SPEECH_DIAGNOSTICS_PREFIX))return null;
  try{
    const value:unknown=JSON.parse(line.slice(SPEECH_DIAGNOSTICS_PREFIX.length));
    if(!isObject(value)||Object.keys(value).length!==fields.length||fields.some(key=>!(key in value))||value.v!==1||(value.session!==null&&!uuid(value.session))||value.session!==session)return null;
    if(!['idle','permission','checkingAssets','preparing','listening','stopped','error'].includes(value.phase as string)||!['unknown','installing','ready','missing','error'].includes(value.assets as string))return null;
    if(!['audioBuffers','transcriberResults','transcriberFinals','detectorResults','speechResults','silenceResults','acceptedUtterances'].every(key=>uint(value[key]))||!finite(value.audioSeconds)||value.audioSeconds<0||value.audioSeconds>Number.MAX_SAFE_INTEGER)return null;
    if(value.errorCode!==null&&!errorCodes.includes(value.errorCode as string))return null;
    return value as unknown as SpeechDiagnostics;
  }catch{return null;}
}
/** Discards oversized stderr lines before parsing; arbitrary diagnostics stay private. */
export class SpeechDiagnosticDecoder {
  private bytes:number[]=[];private discarding=false;
  push(chunk:Buffer,session:string|null):SpeechDiagnostics[] {
    const result:SpeechDiagnostics[]=[];
    for(const byte of chunk){
      if(byte===10){
        if(!this.discarding){const value=parseSpeechDiagnostics(Buffer.from(this.bytes).toString('utf8'),session);if(value)result.push(value);}
        this.bytes=[];this.discarding=false;
      }else if(!this.discarding){if(this.bytes.length>=MAX_DIAGNOSTIC_BYTES){this.bytes=[];this.discarding=true;}else this.bytes.push(byte);}
    }
    return result;
  }
}

/** Numeric evidence only; unchanged idle snapshots are suppressed and disk use is capped. */
export class SpeechDiagnosticRecorder {
  private last:string|null=null;private trialSession:string|null=null;
  constructor(private filename:string,private maxBytes=1024*1024){}
  write(value:SpeechDiagnostics):void {
    if(value.session!==null)this.trialSession=value.session;
    if(value.session===null&&value.phase==='idle'&&value.assets==='unknown')return;
    const snapshot=JSON.stringify(value);if(snapshot===this.last)return;this.last=snapshot;
    mkdirSync(path.dirname(this.filename),{recursive:true});
    appendFileSync(this.filename,JSON.stringify({...value,trialSession:this.trialSession,observedTimestamp:performance.now()})+'\n');
    if(existsSync(this.filename)&&statSync(this.filename).size>this.maxBytes){const bytes=readFileSync(this.filename);const newline=bytes.indexOf(10,bytes.length-this.maxBytes);writeFileSync(this.filename,newline<0?Buffer.alloc(0):bytes.subarray(newline+1));}
  }
}
