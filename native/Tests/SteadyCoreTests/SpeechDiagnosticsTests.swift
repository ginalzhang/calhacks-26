import Foundation
import Testing
@testable import SteadyCore

@Test func speechDiagnosticsResetAndRejectOldActivation(){
 let counters=SpeechProbeCounters();counters.assets(.ready);let old=counters.begin(session:"old")
 counters.audio(frames:480,sampleRate:48000,token:old);counters.transcription(final:true,token:old);counters.detection(speech:true,token:old);counters.detection(speech:false,token:old);counters.accepted(token:old)
 #expect(counters.snapshot.audioBuffers==1);#expect(counters.snapshot.audioSeconds==0.01);#expect(counters.snapshot.transcriberFinals==1);#expect(counters.snapshot.detectorResults==2);#expect(counters.snapshot.acceptedUtterances==1)
 let fresh=counters.begin(session:"new");counters.audio(frames:480,sampleRate:48000,token:old);counters.transcription(final:true,token:old);counters.detection(speech:true,token:old);counters.accepted(token:old);counters.error("speech-analysis-failed",token:old)
 #expect(counters.snapshot.session=="new");#expect(counters.snapshot.assets == .ready);#expect(counters.snapshot.phase == .permission);#expect(counters.snapshot.audioBuffers==0);#expect(counters.snapshot.detectorResults==0);#expect(counters.snapshot.errorCode==nil)
 counters.phase(.listening,token:fresh);counters.audio(frames:480,sampleRate:48000,token:fresh);counters.stop();counters.audio(frames:480,sampleRate:48000,token:fresh)
 #expect(counters.snapshot.session==nil);#expect(counters.snapshot.phase == .stopped);#expect(counters.snapshot.audioBuffers==1)
}
@Test func speechDiagnosticsContainOnlyCountersAndStatuses(){
 let counters=SpeechProbeCounters();let token=counters.begin(session:"test");counters.error("speech-audio-overrun",token:token);counters.stop()
 #expect(counters.snapshot.phase == .error);#expect(counters.snapshot.errorCode=="speech-audio-overrun")
 let keys=Set(counters.snapshot.json.object?.keys.map{$0} ?? [])
 #expect(!keys.contains("text"));#expect(!keys.contains("transcript"));#expect(!keys.contains("audio"));#expect(keys.count==13)
}
