import Foundation

public enum SpeechProbePhase:String,Sendable {case idle,permission,checkingAssets,preparing,listening,stopped,error}
public enum SpeechProbeAssets:String,Sendable {case unknown,installing,ready,missing,error}
public struct SpeechProbeSnapshot:Sendable {
 public var session:String?=nil
 public var phase:SpeechProbePhase = .idle
 public var assets:SpeechProbeAssets = .unknown
 public var audioBuffers:UInt64=0
 public var audioSeconds:Double=0
 public var transcriberResults:UInt64=0
 public var transcriberFinals:UInt64=0
 public var detectorResults:UInt64=0
 public var speechResults:UInt64=0
 public var silenceResults:UInt64=0
 public var acceptedUtterances:UInt64=0
 public var errorCode:String?=nil
 public var json:JSONValue { .object([
  "v":.number(1),"session":session.map(JSONValue.string) ?? .null,"phase":.string(phase.rawValue),"assets":.string(assets.rawValue),
  "audioBuffers":.number(Double(audioBuffers)),"audioSeconds":.number(audioSeconds),"transcriberResults":.number(Double(transcriberResults)),"transcriberFinals":.number(Double(transcriberFinals)),
  "detectorResults":.number(Double(detectorResults)),"speechResults":.number(Double(speechResults)),"silenceResults":.number(Double(silenceResults)),"acceptedUtterances":.number(Double(acceptedUtterances)),"errorCode":errorCode.map(JSONValue.string) ?? .null
 ]) }
}
/// Audio callbacks update bounded counters directly; diagnostics never retain text or audio.
public final class SpeechProbeCounters:@unchecked Sendable {
 private let lock=NSLock();private var token=UUID();private var value=SpeechProbeSnapshot()
 public init(){}
 public var snapshot:SpeechProbeSnapshot {lock.withLock{value}}
 @discardableResult public func begin(session:String)->UUID {lock.withLock{
  let assets=value.assets;token=UUID();value=SpeechProbeSnapshot();value.assets=assets;value.session=session;value.phase = .permission;return token
 }}
 public func stop(){lock.withLock{token=UUID();value.session=nil;if value.phase != .error {value.phase = .stopped}}}
 public func phase(_ phase:SpeechProbePhase,token expected:UUID){lock.withLock{guard token==expected else{return};value.phase=phase}}
 public func assets(_ assets:SpeechProbeAssets){lock.withLock{value.assets=assets}}
 public func error(_ code:String,token expected:UUID?=nil){lock.withLock{guard expected==nil || token==expected else{return};value.phase = .error;value.errorCode=code}}
 public func audio(frames:UInt32,sampleRate:Double,token expected:UUID){lock.withLock{
  guard token==expected,sampleRate.isFinite,sampleRate>0 else{return};value.audioBuffers=min(value.audioBuffers+1,9_007_199_254_740_991);value.audioSeconds=min(value.audioSeconds+Double(frames)/sampleRate,9_007_199_254_740_991)
 }}
 public func transcription(final:Bool,token expected:UUID){lock.withLock{guard token==expected else{return};value.transcriberResults=min(value.transcriberResults+1,9_007_199_254_740_991);if final{value.transcriberFinals=min(value.transcriberFinals+1,9_007_199_254_740_991)}}}
 public func detection(speech:Bool,token expected:UUID){lock.withLock{guard token==expected else{return};value.detectorResults=min(value.detectorResults+1,9_007_199_254_740_991);if speech{value.speechResults=min(value.speechResults+1,9_007_199_254_740_991)}else{value.silenceResults=min(value.silenceResults+1,9_007_199_254_740_991)}}}
 public func accepted(token expected:UUID){lock.withLock{guard token==expected else{return};value.acceptedUtterances=min(value.acceptedUtterances+1,9_007_199_254_740_991)}}
}
