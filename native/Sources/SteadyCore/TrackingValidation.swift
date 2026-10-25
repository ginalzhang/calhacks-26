import Foundation

/// Shared fixtures are the compatibility authority, including explicit nullable fields.
public enum TrackingValidation {
 private static func exact(_ value: JSONValue, _ required: Set<String>, optional: Set<String> = []) -> [String:JSONValue]? {
  guard let p=value.object, required.isSubset(of:Set(p.keys)), Set(p.keys).isSubset(of:required.union(optional)) else {return nil}; return p
 }
 private static func normalized(_ value:JSONValue?) -> Bool {
  guard let value,let p=exact(value,["x","y"]), let x=p["x"]?.number,let y=p["y"]?.number else{return false};return x.isFinite && y.isFinite && x>=0 && x<=1 && y>=0 && y<=1
 }
 public static func calibration(_ value:JSONValue) -> Bool {
  guard let p=exact(value,["schemaVersion","cameraId","mode","selectedHand","neutral","extents","jitter","gain","smoothing"]),p["schemaVersion"]?.number==1,
    let camera=p["cameraId"]?.string,!camera.isEmpty,camera.utf16.count<=1024, let mode=p["mode"]?.string,["head","palm"].contains(mode),normalized(p["neutral"]),
    let ev=p["extents"],let e=exact(ev,["left","right","up","down"]),let jv=p["jitter"],let j=exact(jv,["x","y"]),let x=j["x"]?.number,let y=j["y"]?.number,x.isFinite,y.isFinite,x>=0,y>=0,
    let gain=p["gain"]?.number,gain.isFinite,gain>=0.5,gain<=3,let smoothing=p["smoothing"]?.number,smoothing.isFinite,smoothing>=0,smoothing<=100 else {return false}
  if mode=="head" {if p["selectedHand"] != .null{return false}} else {guard let hand=p["selectedHand"]?.string,["Left","Right"].contains(hand) else{return false}}
  return ["left","right","up","down"].allSatisfy { direction in
   guard let extent=e[direction]?.number else{return false};return extent.isFinite && extent<=1 && extent>0.01 && extent>3 * (["left","right"].contains(direction) ? x:y)
  }
 }
 public static func sample(_ value:JSONValue) -> Bool {
  guard let p=exact(value,["generation","frameId","captureTimestamp","mode","valid","anchor","qualityReason"],optional:["selectedHand"]),p["generation"]?.uint != nil,p["frameId"]?.uint != nil,
    let time=p["captureTimestamp"]?.number,time.isFinite,time>=0,let mode=p["mode"]?.string,["head","palm"].contains(mode),let valid=p["valid"]?.bool,p["qualityReason"]?.string != nil else{return false}
  if valid {if !normalized(p["anchor"]){return false}} else if p["anchor"] != .null{return false}
  if let hand=p["selectedHand"],hand != .null {guard let label=hand.string,["Left","Right"].contains(label) else{return false}}
  return true
 }
}
