// Topeng subjek (orang / benda utama) percuma dalam Mac (Apple Vision). Guna: subjek <gambar> <keluar.png> [sisi maks]
// Keluar: PNG kelabu kecil (putih = subjek). Cetak JSON {"w":..,"h":..} atau {"none":true} kalau tiada subjek.
import Foundation
import Vision
import CoreImage
let a = CommandLine.arguments
guard a.count >= 3, let ci = CIImage(contentsOf: URL(fileURLWithPath: a[1]), options: [.applyOrientationProperty: true]) else { print("{\"none\":true}"); exit(1) }
let maxSide = a.count > 3 ? (Double(a[3]) ?? 240) : 240
let h = VNImageRequestHandler(ciImage: ci)
let r = VNGenerateForegroundInstanceMaskRequest()
try h.perform([r])
guard let o = r.results?.first, !o.allInstances.isEmpty else { print("{\"none\":true}"); exit(0) }
let pb = try o.generateScaledMaskForImage(forInstances: o.allInstances, from: h)
var m = CIImage(cvPixelBuffer: pb)
let k = maxSide / Double(max(m.extent.width, m.extent.height))
m = m.transformed(by: CGAffineTransform(scaleX: k, y: k))
let ctx = CIContext()
let rect = CGRect(x: 0, y: 0, width: m.extent.width.rounded(), height: m.extent.height.rounded())
guard let png = ctx.pngRepresentation(of: m.cropped(to: rect), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()) else { print("{\"none\":true}"); exit(1) }
try png.write(to: URL(fileURLWithPath: a[2]))
print("{\"w\":\(Int(rect.width)),\"h\":\(Int(rect.height))}")
