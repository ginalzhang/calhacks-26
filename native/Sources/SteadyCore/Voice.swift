import Foundation
public enum VoiceGrammar {
 public static let phrases:[String:ActionID] = ["steady pen down":.penDown,"steady pen up":.penUp,"steady pen toggle":.penToggle,"steady click":.click,"steady undo":.undo,"steady redo":.redo,"steady brush":.brush,"steady toggle erase":.toggleErase,"steady bigger":.bigger,"steady smaller":.smaller,"steady pause":.pause,"steady resume":.resume,"steady recenter":.recenter,"steady mark corner":.markCorner,"steady microphone off":.microphoneOff]
 public static func parse(_ text:String)->ActionID? {
  let s=text.lowercased().unicodeScalars.map{CharacterSet.punctuationCharacters.contains($0) ? " " : String($0)}.joined().split(whereSeparator:{$0.isWhitespace}).joined(separator:" ")
  return phrases[s]
 }
}
public struct FinalSpan:Sendable {public var start:Double;public var end:Double;public var text:String;public init(start:Double,end:Double,text:String){self.start=start;self.end=end;self.text=text}}
/// Keeps transcripts only in memory; one acceptance per session/utterance. Never acts on tentative text.
public struct UtteranceAssembler:Sendable {
 public private(set) var session:String?;public private(set) var utterance:UInt64=0
 private var spans:[FinalSpan]=[];private var consumedThrough=0.0
 public init(){}
 public mutating func enable(_ session:String){self.session=session;utterance=0;spans=[];consumedThrough=0}
 public mutating func disable(){session=nil;spans=[]}
 public mutating func add(_ span:FinalSpan,session:String,final:Bool){guard self.session==session,final,span.start>=consumedThrough,span.end>=span.start else{return};spans.removeAll{$0.start==span.start && $0.end==span.end};spans.append(span)}
 public mutating func accept(session:String,through:Double,speechEnd:Double,audioOrigin:Double,now:Double,tooLong:Bool=false)->(number:UInt64,action:ActionID?,reason:String)? {
  guard self.session==session,through>consumedThrough else{return nil};utterance+=1
  let text=spans.filter{$0.start>=consumedThrough && $0.end<=through+0.001}.sorted{$0.start<$1.start}.map(\.text).joined(separator:" ")
  spans.removeAll{$0.end<=through+0.001};consumedThrough=through
  if tooLong{return(utterance,nil,"utterance-too-long")}
  guard now-(audioOrigin+speechEnd*1000)<=1500 else{return(utterance,nil,"late-result-retry")}
  let action=VoiceGrammar.parse(text)
  return(utterance,action,action==nil ? "unrecognized-command" : "finalized")
 }
}
