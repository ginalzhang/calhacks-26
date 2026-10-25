import Foundation
@preconcurrency import AVFoundation
@preconcurrency import Speech
import CoreMedia
import SteadyCore

/// SDK-26 implementation; no cloud recognizer fallback and no implicit asset downloads.
@MainActor final class SpeechProbe {
 private var engine:AVAudioEngine?;private var analyzer:SpeechAnalyzer?;private var continuation:AsyncStream<AnalyzerInput>.Continuation?
 private var tasks:[Task<Void,Never>]=[];private var session:String?;private var assembler=UtteranceAssembler()
 private var audioOrigin:Double?;private var speechStart:Double?;private var speechEnd:Double?;private var pending:(through:Double,end:Double,tooLong:Bool)?
 private var finalizedThrough=0.0;private var resultWatermark=0.0;private var expiry:Task<Void,Never>?
 private var activation=UUID()
 private let counters=SpeechProbeCounters();private var counterToken=UUID();private var diagnosticTimer:DispatchSourceTimer?
 let output:@Sendable(JSONValue)->Void
 let fault:@Sendable(String)->Void
 init(output:@escaping @Sendable(JSONValue)->Void,fault:@escaping @Sendable(String)->Void,diagnostics:@escaping @Sendable(JSONValue)->Void){
  self.output=output;self.fault=fault
  let counters=self.counters
  let timer=DispatchSource.makeTimerSource(queue:DispatchQueue(label:"org.steady.native.speech-diagnostics",qos:.utility))
  timer.schedule(deadline:.now() + .seconds(1),repeating:.seconds(1));timer.setEventHandler{ @Sendable in diagnostics(counters.snapshot.json)};timer.resume();diagnosticTimer=timer
 }
 private func modules()->(SpeechTranscriber,SpeechDetector){(SpeechTranscriber(locale:Locale(identifier:"en-US"),transcriptionOptions:[],reportingOptions:[.fastResults],attributeOptions:[.audioTimeRange]),SpeechDetector(detectionOptions:.init(sensitivityLevel:.medium),reportResults:true))}
 func install()async throws {
  counters.assets(.installing)
  do{let (t,d)=modules();_ = try await AssetInventory.reserve(locale:Locale(identifier:"en-US"))
   if let request=try await AssetInventory.assetInstallationRequest(supporting:[t,d]){try await request.downloadAndInstall()}
   counters.assets(.ready)
  }catch{counters.assets(.error);counters.error("speech-assets-failed");throw error}
 }
 func set(enabled:Bool,session:String)async throws -> Bool {
  let request=UUID();activation=request
  if enabled{counterToken=counters.begin(session:session)}else{counters.stop()}
  let token=counterToken;await reset()
  guard activation==request else{return false};guard enabled else{return true}
  let mic=await AVCaptureDevice.requestAccess(for:.audio)
  guard activation==request else{return false}
  // TCC invokes this completion on its own queue. Resume only the Sendable
  // continuation here; inheriting MainActor isolation causes a runtime trap.
  let speech=await withCheckedContinuation{c in SFSpeechRecognizer.requestAuthorization{ @Sendable status in c.resume(returning:status)}}
  guard activation==request else{return false}
  guard mic,speech == .authorized else{throw WireError("microphone-or-speech-permission")}
  guard SpeechTranscriber.isAvailable else{throw WireError("speech-unavailable")}
  counters.phase(.checkingAssets,token:token)
  let(t,d)=modules();let assetStatus=await AssetInventory.status(forModules:[t,d]);guard activation==request else{return false};counters.assets(assetStatus == .installed ? .ready : .missing);guard assetStatus == .installed else{throw WireError("install-speech-assets-first")}
  counters.phase(.preparing,token:token)
  let a=SpeechAnalyzer(modules:[t,d]);let selectedFormat=await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith:[t,d]);guard activation==request else{return false};guard let format=selectedFormat else{throw WireError("speech-audio-format")}
  let audio=AVAudioEngine();let input=audio.inputNode;let natural=input.outputFormat(forBus:0)
  guard let converter=AVAudioConverter(from:natural,to:format) else{throw WireError("audio-converter")}
  let stream=AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy:.bufferingNewest(4))
  self.session=session;assembler.enable(session);self.engine=audio;analyzer=a;continuation=stream.continuation;audioOrigin=nil;speechStart=nil;speechEnd=nil;pending=nil;finalizedThrough=0;resultWatermark=0
  // Tap work is bounded; each output buffer is newly allocated and retained by AnalyzerInput.
  let feed=AudioFeed(converter:converter,format:format,continuation:stream.continuation,counters:counters,token:token,originCallback:{[weak self] origin in Task{@MainActor in guard self?.session==session else{return};if self?.audioOrigin==nil{self?.audioOrigin=origin}}},failure:{[weak self] message in Task{@MainActor in guard let self,self.session==session else{return};self.fault(message);await self.stop()}})
  input.installTap(onBus:0,bufferSize:1024,format:natural){ @Sendable buffer,time in feed.consume(buffer,at:time)}
  tasks.append(Task{[weak self] in do {for try await result in t.results {guard let self,self.session==session else{return};self.counters.transcription(final:result.isFinal,token:token);let start=CMTimeGetSeconds(result.range.start),end=CMTimeGetSeconds(CMTimeRangeGetEnd(result.range));if result.isFinal {self.assembler.add(FinalSpan(start:start,end:end,text:String(result.text.characters)),session:session,final:true);self.resultWatermark=max(self.resultWatermark,CMTimeGetSeconds(result.resultsFinalizationTime));self.tryAccept(session:session)}}}catch{if self?.session==session{self?.counters.error("speech-transcriber-failed",token:token);self?.fault("speech-transcriber-failed")}}})
  tasks.append(Task{[weak self] in do {for try await result in d.results {guard let self,self.session==session else{return};self.counters.detection(speech:result.speechDetected,token:token);await self.detect(result,session:session)}}catch{if self?.session==session{self?.counters.error("speech-detector-failed",token:token);self?.fault("speech-detector-failed")}}})
  tasks.append(Task{[weak self] in do {try await a.start(inputSequence:stream.stream)}catch{if self?.session==session{self?.counters.error("speech-analysis-failed",token:token);self?.fault("speech-analysis-failed")}}})
  do{try await a.prepareToAnalyze(in:format)}catch{guard activation==request else{return false};await reset();throw error}
  guard activation==request else{return false};audio.prepare();try audio.start();counters.phase(.listening,token:token);return true
 }
 private func detect(_ r:SpeechDetector.Result,session:String)async {
  guard self.session==session,pending==nil else{return}
  let start=CMTimeGetSeconds(r.range.start),end=CMTimeGetSeconds(CMTimeRangeGetEnd(r.range))
  guard start.isFinite,end.isFinite else{return}
  if r.speechDetected {if speechStart==nil {speechStart=max(start,finalizedThrough)};speechEnd=end}
  guard let first=speechStart,let last=speechEnd else{return}
  let tooLong=end-first>=6
  guard tooLong || (!r.speechDetected && end-last>=0.4) else{return}
  let through=tooLong ? min(end,first+6) : last+0.4
  pending=(through,last,tooLong)
  let delay=max(0,(audioOrigin ?? monotonicMilliseconds())+last*1000+1501-monotonicMilliseconds())
  expiry?.cancel();expiry=Task{[weak self] in
   try? await Task.sleep(for:.milliseconds(delay))
   guard !Task.isCancelled,let self,self.session==session,let boundary=self.pending,boundary.through==through,let origin=self.audioOrigin else{return}
   let now=max(monotonicMilliseconds(),origin+last*1000+1501)
   if let accepted=self.assembler.accept(session:session,through:through,speechEnd:last,audioOrigin:origin,now:now) {
    self.output(.object(["speechSession":.string(session),"utterance":.number(Double(accepted.number)),"actionId":.null,"speechEndTimestamp":.number(origin+last*1000),"acceptedTimestamp":.number(now),"final":.bool(true),"reason":.string("late-result-retry")]))
   }
   self.pending=nil;self.speechStart=nil;self.speechEnd=nil
  }
  do {try await analyzer?.finalize(through:CMTime(seconds:through,preferredTimescale:48000));guard self.session==session else{return};finalizedThrough=through;tryAccept(session:session)}catch{fault("speech-finalization-failed")}
 }
 private func tryAccept(session:String){
  guard self.session==session,let boundary=pending,finalizedThrough>=boundary.through, resultWatermark+0.001>=boundary.through,let origin=audioOrigin else{return}
  let now=monotonicMilliseconds()
  guard let accepted=assembler.accept(session:session,through:boundary.through,speechEnd:boundary.end,audioOrigin:origin,now:now,tooLong:boundary.tooLong) else{return}
  if accepted.action != nil {counters.accepted(token:counterToken)}
  output(.object(["speechSession":.string(session),"utterance":.number(Double(accepted.number)),"actionId":accepted.action.map{.string($0.rawValue)} ?? .null,"speechEndTimestamp":.number(origin+boundary.end*1000),"acceptedTimestamp":.number(now),"final":.bool(true),"reason":.string(accepted.reason)]))
  expiry?.cancel();expiry=nil;pending=nil;speechStart=nil;speechEnd=nil
 }
 func stop()async {
  activation=UUID();counters.stop();await reset()
 }
 func diagnosticError(_ code:String){counters.error(code)}
 private func reset()async {
  session=nil;expiry?.cancel();expiry=nil;assembler.disable();engine?.inputNode.removeTap(onBus:0);engine?.stop();engine=nil;continuation?.finish();continuation=nil
  for task in tasks{task.cancel()};tasks=[];let previous=analyzer;analyzer=nil;pending=nil;await previous?.cancelAndFinishNow()
 }
}
private final class AudioFeed:@unchecked Sendable {
 private let converter:AVAudioConverter;private let format:AVAudioFormat;private let continuation:AsyncStream<AnalyzerInput>.Continuation;private let originCallback:@Sendable(Double)->Void;private let failure:@Sendable(String)->Void
 private var frames:Int64=0;private var origin:Double?
 private let counters:SpeechProbeCounters;private let token:UUID;private var failed=false
 init(converter:AVAudioConverter,format:AVAudioFormat,continuation:AsyncStream<AnalyzerInput>.Continuation,counters:SpeechProbeCounters,token:UUID,originCallback:@escaping @Sendable(Double)->Void,failure:@escaping @Sendable(String)->Void){self.converter=converter;self.format=format;self.continuation=continuation;self.counters=counters;self.token=token;self.originCallback=originCallback;self.failure=failure}
 private func fail(_ code:String){guard !failed else{return};failed=true;counters.error(code,token:token);failure(code)}
 func consume(_ input:AVAudioPCMBuffer,at time:AVAudioTime){
  guard !failed else{return};counters.audio(frames:input.frameLength,sampleRate:input.format.sampleRate,token:token)
  guard let output=AVAudioPCMBuffer(pcmFormat:format,frameCapacity:AVAudioFrameCount(ceil(Double(input.frameLength)*format.sampleRate/input.format.sampleRate)+16)) else{fail("speech-audio-allocation");return}
  var used=false;var error:NSError?
  converter.convert(to:output,error:&error){_,status in if used {status.pointee = .noDataNow;return nil};used=true;status.pointee = .haveData;return input}
  guard error==nil,output.frameLength>0 else{fail("speech-audio-conversion");return}
  guard time.isHostTimeValid else{fail("speech-audio-host-time-unavailable");return}
  if origin==nil{let value=AVAudioTime.seconds(forHostTime:time.hostTime)*1000;origin=value;originCallback(value)}
  if case .dropped = continuation.yield(AnalyzerInput(buffer:output,bufferStartTime:CMTime(value:frames,timescale:CMTimeScale(format.sampleRate)))) {fail("speech-audio-overrun")}
  frames+=Int64(output.frameLength)
 }
}
