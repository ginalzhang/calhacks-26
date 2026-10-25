import Foundation
import Testing
@testable import SteadyCore

@Test func sharedTrackingFixturesAgreeAcrossLanguages() throws {
 let root=URL(fileURLWithPath:#filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
 let fixture=try JSONDecoder().decode(JSONValue.self,from:Data(contentsOf:root.appendingPathComponent("fixtures/tracking-v1.json")))
 for kind in ["calibration","sample"] {
  let group=try #require(fixture.object?[kind]?.object)
  guard case .array(let positive)=group["positive"],case .array(let negative)=group["negative"] else{throw WireError("fixture-shape")}
  for value in positive {
   #expect(kind=="calibration" ? TrackingValidation.calibration(value):TrackingValidation.sample(value))
   if kind=="calibration" {_ = try value.decode(CalibrationV1.self)} else {_ = try value.decode(TrackingSample.self)}
  }
  for item in negative {
   let value=try #require(item.object?["value"])
   #expect(!(kind=="calibration" ? TrackingValidation.calibration(value):TrackingValidation.sample(value)))
  }
 }
}
