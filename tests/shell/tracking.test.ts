import { describe, expect, it } from 'vitest';
import { extractAnchor, FrameGate, FrameProgress, initializeDelegate } from '../../src/renderer/tracking';

describe('camera feasibility probe', () => {
  it('uses nose landmark one and mirrors once', () => {
    expect(extractAnchor('head', [[{ x: 0, y: 0 }, { x: 0.2, y: 0.7 }]])).toEqual({ valid: true, anchor: { x: 0.8, y: 0.7 }, reason: 'valid' });
  });
  it('uses palm centroid and rejects multiple hands', () => {
    const points = Array.from({ length: 21 }, () => ({ x: 0.25, y: 0.6 }));
    expect(extractAnchor('palm', [points]).anchor).toEqual({ x: 0.75, y: 0.6 });
    expect(extractAnchor('palm', [points, points]).valid).toBe(false);
    expect(extractAnchor('palm', []).valid).toBe(false);
  });
  it('rejects incomplete and nonfinite detector output', () => {
    expect(extractAnchor('head', [[{ x: 0, y: 0 }]]).valid).toBe(false);
    expect(extractAnchor('head', [[{ x: 0, y: 0 }, { x: NaN, y: 0.5 }]]).valid).toBe(false);
  });
  it('allows one frame until completion', () => {
    const gate = new FrameGate();
    expect(gate.acquire()).toBe(true);
    expect(gate.acquire()).toBe(false);
    gate.release();
    expect(gate.acquire()).toBe(true);
  });
  it('never refreshes capture time by polling a cached video frame',()=>{
    const frames=new FrameProgress();expect(frames.take()).toBeNull();frames.receive(1,1000,980);expect(frames.take()).toBe(980);
    frames.receive(1,2000,1980);expect(frames.take()).toBeNull();frames.receive(0.5,2100);expect(frames.take()).toBeNull();
    frames.receive(2,2200,2180);expect(frames.take()).toBe(2180);expect(frames.take()).toBeNull();
  });
  it('uses original frame receipt time when capture metadata is unavailable or future-dated',()=>{
    const frames=new FrameProgress();frames.receive(1,1000);expect(frames.take()).toBe(1000);frames.receive(2,1100,1200);expect(frames.take()).toBe(1100);
  });
  it('tries GPU first then exactly one CPU initialization', async () => {
    const attempts: string[] = [];
    const result = await initializeDelegate(async delegate => { attempts.push(delegate); if (delegate === 'GPU') throw new Error('GPU unavailable'); return 'detector'; });
    expect(attempts).toEqual(['GPU', 'CPU']);
    expect(result.delegate).toBe('CPU');
  });
  it('does not retry if CPU initialization also fails', async () => {
    const attempts: string[] = [];
    await expect(initializeDelegate(async delegate => { attempts.push(delegate); throw new Error('unavailable'); })).rejects.toThrow('unavailable');
    expect(attempts).toEqual(['GPU', 'CPU']);
  });
});
