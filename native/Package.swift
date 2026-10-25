// swift-tools-version: 6.4
import PackageDescription
let package = Package(name: "SteadyNative", platforms: [.macOS("26.0")], products: [.executable(name: "SteadyNative", targets: ["SteadyNative"])], targets: [.target(name: "SteadyCore"), .executableTarget(name: "SteadyNative", dependencies: ["SteadyCore"]), .testTarget(name: "SteadyCoreTests", dependencies: ["SteadyCore"])])
