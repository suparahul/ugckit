// The text in each picture, read by the macOS Vision framework. Used by ocr.py when
// tesseract is not installed. One line per picture: <path>\t<text, lines joined by " | ">.
//   swift scripts/character/ocr.swift <picture> [picture ...]
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("\(path)\t"); continue
    }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    let lines = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    print("\(path)\t\(lines.joined(separator: " | "))")
}
