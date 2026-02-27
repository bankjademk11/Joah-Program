import { useState, useCallback, useRef } from "react";
import { ChevronLeft, Info, AlertTriangle, FileImage, Zap } from 'lucide-react';
import JSZip from "jszip";

const formatBytes = (bytes) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Smart Image Compressor (Python Pillow Style)
 * This function takes an image blob, draws it to a canvas 
 * and exports it as a compressed JPEG.
 */
const compressImage = async (blob, quality = 0.5) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Max dimension check (Don't need 4K images in Excel)
      const maxDim = 1500;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // Fill white background for JPEGs (to handle transparent PNGs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (newBlob) => {
          resolve(newBlob || blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
  });
};

export default function ExcelCompressor({ onBack }) {
  const [file, setFile] = useState(null);
  const [options, setOptions] = useState({
    imageQuality: 0.4, // 40% quality (Balanced)
    resizeLarge: true
  });
  const [status, setStatus] = useState(null); // null | 'processing' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const downloadRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (ext !== "xlsx") {
      setErrorMsg("ລະບົບການບີບອັດແບບພິເສດຮອງຮັບສະເພາະໄຟລ໌ .xlsx ເທົ່ານັ້ນ");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus(null);
    setResult(null);
    setErrorMsg("");
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }, []);

  const compress = async () => {
    if (!file) return;
    setStatus("processing");
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      const zip = new JSZip();
      const arrayBuffer = await file.arrayBuffer();

      // Load XLSX as ZIP
      const content = await zip.loadAsync(arrayBuffer);

      // Find images in xl/media/
      const mediaFiles = Object.keys(content.files).filter(path =>
        path.startsWith("xl/media/") &&
        (path.toLowerCase().endsWith(".png") || path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg"))
      );

      setProgress({ current: 0, total: mediaFiles.length });

      if (mediaFiles.length > 0) {
        let count = 0;
        for (const path of mediaFiles) {
          const originalBlob = await content.files[path].async("blob");

          // Only compress if original is > 100KB to save processing time
          if (originalBlob.size > 100 * 1024) {
            const compressedBlob = await compressImage(originalBlob, options.imageQuality);
            // Replace the file in the zip
            zip.file(path, compressedBlob);
          }

          count++;
          setProgress(p => ({ ...p, current: count }));
        }
      }

      // Generate new XLSX with highest compression level
      const finalBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
      });

      const outputName = file.name.replace(/\.[^.]+$/, "") + "_compressed_pro.xlsx";
      const outputSize = finalBlob.size;
      const url = URL.createObjectURL(finalBlob);

      setResult({
        url,
        name: outputName,
        originalSize: file.size,
        outputSize,
        reduction: (((file.size - outputSize) / file.size) * 100).toFixed(1),
        imagesCount: mediaFiles.length
      });
      setStatus("done");
    } catch (e) {
      console.error("Pro Compression Error:", e);
      setErrorMsg("ເກີດຂໍ້ຜິດພາດ: " + e.message);
      setStatus("error");
    }
  };

  const toggleQuality = (val) => setOptions(o => ({ ...o, imageQuality: val }));

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Segoe UI', 'Phetsarath OT', sans-serif" }}>
      {/* Back Button */}
      {onBack && (
        <div style={{ width: "100%", maxWidth: "560px", marginBottom: "16px" }}>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft size={18} /> ກັບຄືນ
          </button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", padding: "40px", maxWidth: "560px", width: "100%", border: "1px solid #f1f5f9" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "80px", height: "80px", background: "linear-gradient(135deg, #0ea5e9, #2563eb)", borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 10px 20px rgba(37, 99, 235, 0.2)" }}>
            <Zap size={40} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Excel Image Compressor</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "14px", fontWeight: 500 }}>
            ບີບອັດຮູບພາບໃນ Excel ດ້ວຍລະບົບ Smart-ZIP (ຄືກັບ Python) 🐍
          </p>
        </div>

        {/* Warning if large */}
        {file && file.size > 150 * 1024 * 1024 && status !== "processing" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "16px", padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.5, fontWeight: 500 }}>
              <b>ຄຳເຕືອນ:</b> ໄຟລ໌ມີຂະໜາດໃຫຍ່ຫຼາຍ ({formatBytes(file.size)}). ລະບົບຈະຕ້ອງໃຊ້ RAM ໃນການປະມວນຜົນຮູບພາບ. ຖ້າເຄື່ອງຄ້າງ, ແນະນຳໃຫ້ໃຊ້ Python script ໃນຄອມພິວເຕີໂດຍກົງ.
            </div>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => status !== "processing" && document.getElementById("fileInput").click()}
          style={{
            border: `2px dashed ${dragging ? "#3b82f6" : file ? "#10b981" : "#e2e8f0"}`,
            borderRadius: "20px",
            padding: "40px 20px",
            textAlign: "center",
            cursor: status === "processing" ? "not-allowed" : "pointer",
            background: dragging ? "#eff6ff" : file ? "#f0fdf4" : "#f8fafc",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            marginBottom: "24px",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <input id="fileInput" type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          {file ? (
            <div className="animate-in fade-in zoom-in duration-300">
              <div style={{ color: "#10b981", marginBottom: "12px" }}><FileImage size={48} className="mx-auto" /></div>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "16px" }}>{file.name}</div>
              <div style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>{formatBytes(file.size)}</div>
              {status !== "processing" && <div style={{ color: "#3b82f6", fontSize: "12px", marginTop: "12px", fontWeight: 700 }}>ຄລິກທີ່ນີ້ເພື່ອປ່ຽນໄຟລ໌</div>}
            </div>
          ) : (
            <div>
              <div style={{ color: "#94a3b8", marginBottom: "16px" }}><FileImage size={56} className="mx-auto" strokeWidth={1.5} /></div>
              <div style={{ fontWeight: 700, color: "#475569", fontSize: "16px" }}>ລາກໄຟລ໌ມາເພີ່ມ ຫຼື ຄລິກເພື່ອເລືອກ</div>
              <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>ຮອງຮັບສະເພາະໄຟລ໌ .xlsx (Excel)</div>
            </div>
          )}
        </div>

        {/* Improved Options */}
        <div style={{ background: "#f8fafc", borderRadius: "20px", padding: "20px", marginBottom: "24px", border: "1px solid #f1f5f9" }}>
          <div style={{ fontWeight: 700, color: "#334155", marginBottom: "16px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Info size={18} className="text-blue-500" /> ຕົວເລືອກການບີບອັດຮູບ
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>ຄຸນນະພາບຮູບພາບ</span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#3b82f6" }}>{Math.round(options.imageQuality * 100)}%</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[0.2, 0.4, 0.7].map((q) => (
                <button
                  key={q}
                  onClick={() => toggleQuality(q)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "12px", border: "2px solid",
                    borderColor: options.imageQuality === q ? "#3b82f6" : "#e2e8f0",
                    background: options.imageQuality === q ? "#eff6ff" : "#fff",
                    color: options.imageQuality === q ? "#2563eb" : "#64748b",
                    fontWeight: 800, fontSize: "12px", transition: "all 0.2s"
                  }}
                >
                  {q === 0.2 ? "ນ້ອຍທີ່ສຸດ" : q === 0.4 ? "ສົມດູນ" : "ຊັດເຈນ"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px", lineHeight: 1.4 }}>
              * ລະບົບຈະຄົ້ນຫາຮູບພາບໃນ Excel ແລະ ບີບອັດໃຫ້ອັດຕະໂນມັດ ໂດຍບໍ່ທຳລາຍຂໍ້ມູນເດີມ.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={compress}
          disabled={!file || status === "processing"}
          style={{
            width: "100%", padding: "16px", borderRadius: "16px", border: "none",
            background: !file || status === "processing" ? "#e2e8f0" : "linear-gradient(135deg, #0ea5e9, #2563eb)",
            color: "#fff",
            fontWeight: 800, fontSize: "16px", cursor: !file || status === "processing" ? "not-allowed" : "pointer",
            transition: "all 0.3s", marginBottom: "16px",
            boxShadow: !file || status === "processing" ? "none" : "0 8px 20px rgba(37, 99, 235, 0.25)"
          }}>
          {status === "processing" ? (
            <div className="flex items-center justify-center gap-3">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              <span>ກຳລັງບີບອັດ ({progress.current}/{progress.total})</span>
            </div>
          ) : "⚡ ເລີ່ມບີບອັດ (Smart Image Compress)"}
        </button>

        {/* Result Card */}
        {status === "done" && result && (
          <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderRadius: "20px", padding: "24px", animation: "in fade-in slide-in-from-bottom duration-500" }}>
            <div style={{ fontWeight: 800, color: "#166534", marginBottom: "16px", fontSize: "17px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              ✨ ບີບອັດສຳເລັດ!
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>ຂະໜາດເດີມ</div>
                <div style={{ fontWeight: 800, color: "#64748b", fontSize: "16px" }}>{formatBytes(result.originalSize)}</div>
              </div>
              <div style={{ fontSize: "24px", color: "#22c55e", alignSelf: "center", flex: 0.5 }}>→</div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>ຂະໜາດໃໝ່</div>
                <div style={{ fontWeight: 800, color: "#15803d", fontSize: "18px" }}>{formatBytes(result.outputSize)}</div>
              </div>
            </div>

            <div style={{ background: "#dcfce7", borderRadius: "12px", padding: "12px", textAlign: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>ພົບຮູບພາບ: {result.imagesCount} ໃບ | ຫຼຸດລົງໄດ້:</div>
              <div style={{ fontWeight: 900, color: "#15803d", fontSize: "28px" }}>{result.reduction}%</div>
            </div>

            <a href={result.url} download={result.name} ref={downloadRef}
              style={{
                display: "block", textAlign: "center", padding: "16px", borderRadius: "12px",
                background: "#16a34a", color: "#fff", fontWeight: 800, textDecoration: "none",
                fontSize: "15px", boxShadow: "0 6px 15px rgba(22, 163, 74, 0.3)"
              }}>
              ⬇️ ດາວໂຫຼດໄຟລ໌ ({formatBytes(result.outputSize)})
            </a>
          </div>
        )}

        {status === "error" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "16px", color: "#b91c1c", fontSize: "14px", fontWeight: 600, textAlign: "center" }}>
            ❌ {errorMsg}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: "#94a3b8", lineHeight: 1.6, fontWeight: 500 }}>
          ປອດໄພ 100%: ຂໍ້ມູນ XML ແລະ ສູດຄຳນວນຈະບໍ່ຖືກແຕະຕ້ອງ <br />
          ລະບົບເຮັດວຽກພາຍໃນບຣາວເຊີ 🔒 ບໍ່ມີການອັບໂຫຼດໄຟລ໌
        </div>
      </div>
    </div>
  );
}
