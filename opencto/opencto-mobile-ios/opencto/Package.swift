// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "opencto",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "opencto",
            targets: ["opencto"]
        ),
    ],
    targets: [
        .target(
            name: "opencto",
            path: "Sources/opencto"
        ),
    ]
)
