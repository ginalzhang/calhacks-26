import type { ChildProcessWithoutNullStreams } from 'node:child_process';

/** Owns the countdown and cancellation of the separate opt-in real-input child. */
export class LiveProbe {
  private confirm: ReturnType<typeof setTimeout>;
  private deadline: ReturnType<typeof setTimeout>;
  private finished = false;
  constructor(private child: ChildProcessWithoutNullStreams, private release:()=>void, private complete:(message:string)=>void) {
    this.confirm=setTimeout(()=>{
      if(!this.finished)child.stdin.write('CONFIRM_DISPOSABLE_KRITA\n',error=>{if(error)this.cancel(String(error));});
    },5000);
    this.deadline=setTimeout(()=>this.cancel('Native probe exceeded 20-second supervisor bound'),20000);
    child.stdin.on('error',error=>this.cancel(String(error)));
    child.on('error',error=>this.cancel(String(error)));
    child.on('close',code=>this.finish(`Native probe exited (${code}); inspect disposable document and record movement/release.`));
  }
  cancel(message='Native probe cancelled; input released'):void {
    this.finish(message,true);
  }
  private finish(message:string,terminate=false):void {
    if(this.finished)return;this.finished=true;
    // Invalidate timers and cut fresh samples off before spawning the fallback
    // release process. The child independently handles this EOF within10ms.
    clearTimeout(this.confirm);clearTimeout(this.deadline);
    if(terminate){this.child.stdin.end();this.child.kill();}
    this.release();this.complete(message);
  }
}
