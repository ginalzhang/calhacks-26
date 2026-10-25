import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/protocol-v1.json';
import { ClockSync, LineDecoder, validRequest } from '../src/main/protocol';

describe('shared protocol fixtures',()=>{
  it('accepts every positive request',()=>{for(const item of fixtures.positive)expect(validRequest(item)).toBe(true);});
  it('rejects every negative request',()=>{for(const item of fixtures.negative){let value;try{value=JSON.parse(item.line);}catch{value=null;}expect(validRequest(value),item.name).toBe(false);}});
  it('frames split UTF-8 and coalesced lines',()=>{
    const decoder=new LineDecoder();const input=Buffer.from('{"text":"é"}\n{"v":1}\n');
    const split=input.indexOf(0xc3)+1;expect(decoder.push(input.subarray(0,split))).toEqual([]);
    expect(decoder.push(input.subarray(split))).toEqual([{text:'é'},{v:1}]);
  });
  it('rejects invalid UTF-8 and oversized unterminated frames',()=>{
    expect(()=>new LineDecoder().push(Buffer.from([0xff,10]))).toThrow();
    expect(()=>new LineDecoder().push(Buffer.alloc(16385,32))).toThrow('oversized');
  });
});
describe('clock synchronization',()=>{
  it('requires eight trips and selects smallest RTT',()=>{
    const sync=new ClockSync();expect(()=>sync.choose([],100)).toThrow();
    sync.choose(Array.from({length:8},(_,i)=>({sent:i*10,received:i*10+(i===3?2:10),native:i*10+101})),100);
    expect(sync.offset).toBe(100);expect(sync.convert(200,100)).toBe(300);
  });
  it('rejects uncertain and expired clocks',()=>{
    const sync=new ClockSync();expect(()=>sync.convert(1,0)).toThrow();
    sync.choose(Array.from({length:8},()=>({sent:0,received:22,native:100})),0);expect(()=>sync.convert(1,0)).toThrow();
    sync.choose(Array.from({length:8},()=>({sent:0,received:2,native:100})),0);expect(()=>sync.convert(1,30001)).toThrow();
  });
});
