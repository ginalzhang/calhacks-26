import { describe, expect, it } from 'vitest';
import { emptySpeechDiagnostics, MAX_DIAGNOSTIC_BYTES, parseSpeechDiagnostics, SpeechDiagnosticDecoder, SpeechDiagnosticRecorder, SPEECH_DIAGNOSTICS_PREFIX } from '../src/main/speech-diagnostics';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const session='00000000-0000-4000-8000-000000000001';
const line=(value:unknown)=>SPEECH_DIAGNOSTICS_PREFIX+JSON.stringify(value);
describe('bounded speech diagnostics allowlist',()=>{
  it('accepts numeric-only counters for the active session and independent idle/assets state',()=>{
    expect(parseSpeechDiagnostics(line(emptySpeechDiagnostics(session)),session)?.audioBuffers).toBe(0);
    expect(parseSpeechDiagnostics(line({...emptySpeechDiagnostics(null),assets:'installing'}),null)?.assets).toBe('installing');
  });
  it('discards stale sessions, nonfinite/negative counters, unknown fields and diagnostic text',()=>{
    const value=emptySpeechDiagnostics(session);
    expect(parseSpeechDiagnostics(line(value),null)).toBeNull();expect(parseSpeechDiagnostics(line(value),'00000000-0000-4000-8000-000000000002')).toBeNull();
    for(const change of [{audioBuffers:-1},{audioSeconds:Infinity},{phase:'recording'},{transcript:'not retained'},{errorCode:'recognized-phrase'}])expect(parseSpeechDiagnostics(line({...value,...change}),session)).toBeNull();
    expect(parseSpeechDiagnostics('arbitrary stderr',session)).toBeNull();
  });
  it('frames fragments, bounds oversized lines and recovers at newline',()=>{
    const decoder=new SpeechDiagnosticDecoder();const bytes=Buffer.from(line(emptySpeechDiagnostics(session))+'\n');
    expect(decoder.push(bytes.subarray(0,10),session)).toEqual([]);expect(decoder.push(bytes.subarray(10),session)).toHaveLength(1);
    expect(decoder.push(Buffer.alloc(MAX_DIAGNOSTIC_BYTES*4,65),session)).toEqual([]);
    expect(decoder.push(Buffer.concat([Buffer.from('\n'),bytes]),session)).toHaveLength(1);
  });
  it('rejects a fragmented old-session line after activation changes',()=>{
    const decoder=new SpeechDiagnosticDecoder();const bytes=Buffer.from(line(emptySpeechDiagnostics(session))+'\n');
    decoder.push(bytes.subarray(0,100),session);expect(decoder.push(bytes.subarray(100),null)).toEqual([]);
  });
  it('retains stopped counters associated with the trial and bounds numeric evidence',()=>{
    const directory=mkdtempSync(path.join(os.tmpdir(),'steady-speech-diagnostics-'));const filename=path.join(directory,'speech-diagnostics.jsonl');
    try{
      const recorder=new SpeechDiagnosticRecorder(filename,4096);const base=emptySpeechDiagnostics(session);
      for(let index=0;index<40;index++)recorder.write({...base,phase:'listening',audioBuffers:index,audioSeconds:index/10});
      const stopped={...base,session:null,phase:'stopped' as const,audioBuffers:40,audioSeconds:4};recorder.write(stopped);recorder.write(stopped);
      expect(statSync(filename).size).toBeLessThanOrEqual(4096);const rows=readFileSync(filename,'utf8').trim().split('\n').map(line=>JSON.parse(line));
      expect(rows.at(-1)).toMatchObject({phase:'stopped',audioBuffers:40,audioSeconds:4,trialSession:session});expect(rows.filter(row=>row.phase==='stopped')).toHaveLength(1);
      expect(rows.every(row=>!('text' in row)&&!('transcript' in row))).toBe(true);
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
});
