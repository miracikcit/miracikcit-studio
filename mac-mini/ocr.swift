// OCR percuma dalam Mac (Apple Vision). Guna: ocr <gambar> → JSON [{t,x,y}] ikut susunan atas ke bawah.
import Foundation
import Vision
import AppKit
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("[]"); exit(1) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.usesLanguageCorrection = true
req.recognitionLanguages = ["en-US", "ms-MY"]
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
var out: [[String: Any]] = []
for o in (req.results ?? []) {
  guard let c = o.topCandidates(1).first else { continue }
  let b = o.boundingBox
  out.append(["t": c.string, "x": Double(b.minX), "y": Double(1 - b.maxY), "h": Double(b.height)])
}
out.sort { ($0["y"] as! Double) < ($1["y"] as! Double) }
print(String(data: try JSONSerialization.data(withJSONObject: out), encoding: .utf8)!)
