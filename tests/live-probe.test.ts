import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { LiveProbe } from '../src/main/live-probe';
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
function harness(){
  const child=Object.assign(new EventEmitter(),{stdin:Object.assign(new EventEmitter(),{write:vi.fn(()=>true),end:vi.fn()}),kill:vi.fn()});
  const release=vi.fn(),complete=vi.fn();const probe=new LiveProbe(child as unknown as ChildProcessWithoutNullStreams,release,complete);
  return {child,release,complete,probe};
}
describe('bounded real-input child lifecycle with fake child',()=>{
  it('cancels before confirmation and never starts input later',async()=>{
    const h=harness();await vi.advanceTimersByTimeAsync(1000);h.probe.cancel();await vi.advanceTimersByTimeAsync(25000);
    expect(h.child.stdin.write).not.toHaveBeenCalled();expect(h.child.stdin.end).toHaveBeenCalledOnce();expect(h.child.kill).toHaveBeenCalledOnce();expect(h.release).toHaveBeenCalledOnce();
  });
  it('confirms once after five seconds then enforces the supervisor deadline',async()=>{
    const h=harness();await vi.advanceTimersByTimeAsync(4999);expect(h.child.stdin.write).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);
    expect(h.child.stdin.write).toHaveBeenCalledWith('CONFIRM_DISPOSABLE_KRITA\n',expect.any(Function));await vi.advanceTimersByTimeAsync(15000);
    expect(h.child.kill).toHaveBeenCalledOnce();expect(h.release).toHaveBeenCalledOnce();expect(h.complete).toHaveBeenCalledWith(expect.stringContaining('20-second'));
  });
  it('releases on failed spawn/pipe and cancels every timer',async()=>{
    const h=harness();h.child.stdin.emit('error',new Error('pipe failed'));h.child.emit('close',1);await vi.advanceTimersByTimeAsync(30000);
    expect(h.release).toHaveBeenCalledOnce();expect(h.child.stdin.write).not.toHaveBeenCalled();expect(h.complete).toHaveBeenCalledWith(expect.stringContaining('pipe failed'));
  });
  it('releases a completed child once without a later confirmation',async()=>{
    const h=harness();h.child.emit('close',0);await vi.advanceTimersByTimeAsync(30000);h.probe.cancel();
    expect(h.release).toHaveBeenCalledOnce();expect(h.child.stdin.write).not.toHaveBeenCalled();expect(h.child.kill).not.toHaveBeenCalled();
  });
});
