import jsPDF from "jspdf"
import { supabase } from "@/lib/supabaseClient" // adjust path to your client


export const generatePDFReport = async (): Promise<Blob> => {
  // 1. Fetch data from Supabase
  const { data: scannedPlates, error } = await supabase
    .from("plates")
    .select("*")

  if (error) {
    console.error("Error fetching plates:", error)
    throw error
  }

  if (!scannedPlates || scannedPlates.length === 0) {
    throw new Error("No plate data available")
  }

  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // --- Title Page ---
  pdf.setFontSize(20)
  pdf.text("License Plate Inventory Report", pageWidth / 2, 30, { align: "center" })

  pdf.setFontSize(12)
  const reportDate = new Date().toLocaleDateString()
  pdf.text(`Generated: ${reportDate}`, pageWidth / 2, 45, { align: "center" })



  pdf.setFontSize(14)
  pdf.text("Summary:", 20, 70)
  pdf.setFontSize(12)
  pdf.text(`Total Scanned: ${scannedPlates.length}`, 20, 85)

  // --- Page 2: Plate List ---
  // const plates = [ "ABC-123","DEF-456","GHI-789","JKL-012","MNO-345","PQR-678","STU-901","VWX-234","YZA-567","BCD-890", "EFG-123","HIJ-456","KLM-789","NOP-012","QRS-345","TUV-678","WXY-901","ZAB-234","CDE-567","FGH-890", "IJK-123","LMN-456","OPQ-789","RST-012","UVW-345","XYZ-678","ABC-901","DEF-234","GHI-567","JKL-890", "MNO-123","PQR-456","STU-789","VWX-012","YZA-345","BCD-678","EFG-901","HIJ-234","KLM-567","NOP-890", "QRS-123","TUV-456","WXY-789","ZAB-012","CDE-345","FGH-678","IJK-901","LMN-234","OPQ-567","RST-890", "UVW-123","XYZ-456","ABC-789","DEF-012","GHI-345","JKL-678","MNO-901","PQR-234","STU-567","VWX-890", "YZA-123","BCD-456","EFG-789","HIJ-012","KLM-345","NOP-678","QRS-901","TUV-234","WXY-567","ZAB-890", "CDE-123","FGH-456","IJK-789","LMN-012","OPQ-345","RST-678","UVW-901","XYZ-234","ABC-567","DEF-890", "GHI-123","JKL-456","MNO-789","PQR-012","STU-345","VWX-678","YZA-901","BCD-234","EFG-567","HIJ-890", "KLM-123","NOP-456","QRS-789","TUV-012","WXY-345","ZAB-678","CDE-901","FGH-234","IJK-567","LMN-890", "OPQ-123","RST-456","UVW-789","XYZ-012","ABC-345","DEF-678","GHI-901","JKL-234","MNO-567","PQR-890", "STU-123","VWX-456","YZA-789","BCD-012","EFG-345","HIJ-678","KLM-901","NOP-234","QRS-567","TUV-890", "WXY-123","ZAB-456","CDE-789","FGH-012","IJK-345","LMN-678","OPQ-901","RST-234","UVW-567","XYZ-890", "ABC-123","DEF-456","GHI-789","JKL-012","MNO-345","PQR-678","STU-901","VWX-234","YZA-567","BCD-890", "EFG-123","HIJ-456","KLM-789","NOP-012","QRS-345","TUV-678","WXY-901","ZAB-234","CDE-567","FGH-890", "IJK-123","LMN-456","OPQ-789","RST-012","UVW-345","XYZ-678","ABC-901","DEF-234","GHI-567","JKL-890", "MNO-123","PQR-456","STU-789","VWX-012","YZA-345","BCD-678","EFG-901","HIJ-234","KLM-567","NOP-890", "QRS-123","TUV-456","WXY-789","ZAB-012","CDE-345","FGH-678","IJK-901","LMN-234","OPQ-567","RST-890", "UVW-123","XYZ-456","ABC-789","DEF-012","GHI-345","JKL-678","MNO-901","PQR-234","STU-567","VWX-890", "YZA-123","BCD-456","EFG-789","HIJ-012","KLM-345","NOP-678","QRS-901","TUV-234","WXY-567","ZAB-890", "CDE-123","FGH-456","IJK-789","LMN-012","OPQ-345","RST-678","UVW-901","XYZ-234","ABC-567","DEF-890", "GHI-123","JKL-456","MNO-789","PQR-012","STU-345","VWX-678","YZA-901","BCD-234","EFG-567","HIJ-890", "KLM-123","NOP-456","QRS-789","TUV-012","WXY-345","ZAB-678","CDE-901","FGH-234","IJK-567","LMN-890", "OPQ-123","RST-456","UVW-789","XYZ-012","ABC-345","DEF-678","GHI-901","JKL-234","MNO-567","PQR-890", "STU-123","VWX-456","YZA-789","BCD-012","EFG-345","HIJ-678","KLM-901","NOP-234","QRS-567","TUV-890", "WXY-123","ZAB-456","CDE-789","FGH-012","IJK-345","LMN-678","OPQ-901","RST-234","UVW-567","XYZ-890", "ABC-123","DEF-456","GHI-789","JKL-012","MNO-345","PQR-678","STU-901","VWX-234","YZA-567","BCD-890", "EFG-123","HIJ-456","KLM-789","NOP-012","QRS-345","TUV-678","WXY-901","ZAB-234","CDE-567","FGH-890", "IJK-123","LMN-456","OPQ-789","RST-012","UVW-345","XYZ-678","ABC-901","DEF-234","GHI-567","JKL-890", "MNO-123","PQR-456","STU-789","VWX-012","YZA-345","BCD-678","EFG-901","HIJ-234","KLM-567","NOP-890", "QRS-123","TUV-456","WXY-789","ZAB-012","CDE-345","FGH-678","IJK-901","LMN-234","OPQ-567","RST-890", "UVW-123","XYZ-456","ABC-789","DEF-012","GHI-345","JKL-678","MNO-901","PQR-234","STU-567","VWX-890", "YZA-123","BCD-456","EFG-789","HIJ-012","KLM-345","NOP-678","QRS-901","TUV-234","WXY-567","ZAB-890" ];
  pdf.addPage()
  pdf.setFontSize(14)
  pdf.text("Plate List:", 20, 20)
  pdf.setFontSize(10)

  const margin1 = 20
  const colWidth = 40
  const maxY = pageHeight - 20
  let x = margin1
  let y = 30

    scannedPlates.forEach((plate, i) => {
    const formattedPlate = plate.plate.replace(/^([A-Z]+)(\d+)$/, "$1-$2");
    pdf.text(`${i + 1}. ${formattedPlate}`, x, y)
    y += 7

    if (y > maxY) {
      x += colWidth
      y = 30

      if (x > pageWidth - margin1 - colWidth) {
        pdf.addPage()
        x = margin1
        y = 30
      }
    }
  })



  // --- Image Grid Pages ---
  pdf.addPage()
  const margin = 10
  const gridCols = 3
  const gridRows = 4
  const cellWidth = (pageWidth - margin * 2) / gridCols
  const cellHeight = (pageHeight - margin * 2) / gridRows
  const imageWidth = cellWidth - 6
  const imageHeight = cellHeight - 15

  let col = 0
  let row = 0

  for (const plate of scannedPlates) {
    const x = margin + col * cellWidth
    const y = margin + row * cellHeight

    try {
      const compressedImage = await compressImageForPDF(plate.plate_url, 300, 0.8)

      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")

      if (plate.isInWarehouse) {
        pdf.setTextColor(0, 128, 0)
        pdf.text(`✓ ${plate.plate}`, x + 3, y + 5)
      } else {
        pdf.setTextColor(255, 0, 0)
        pdf.text(`✗ ${plate.plate}`, x + 3, y + 5)
      }

      pdf.setTextColor(0, 0, 0)

      pdf.addImage(compressedImage, "JPEG", x + 3, y + 7, imageWidth, imageHeight)

      pdf.setFontSize(6)
      const shortDate = new Date(plate.created_at).toLocaleDateString()
      pdf.text(shortDate, x + 3, y + cellHeight - 3)
    } catch {
      pdf.text(`${plate.plate} (Image error)`, x + 3, y + cellHeight / 2)
    }

    col++
    if (col >= gridCols) {
      col = 0
      row++
      if (row >= gridRows) {
        row = 0
        pdf.addPage()
      }
    }
  }

  // --- Page numbers ---
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 25, pageHeight - 10)
  }

  return pdf.output("blob")
}

// Image compression helper (same as before)
const compressImageForPDF = (dataUrl: string, maxDimension = 300, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("Canvas not available"))

      let { width, height } = img
      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width
          width = maxDimension
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height
          height = maxDimension
        }
      }

      canvas.width = Math.round(width)
      canvas.height = Math.round(height)

      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = dataUrl
  })
}


// Helper function to estimate PDF size based on number of plates
export const estimatePDFSize = (plateCount: number): string => {
  // Rough estimate: ~60KB per plate + 100KB base size
  const estimatedKB = Math.round(plateCount * 60 + 100)

  if (estimatedKB < 1000) {
    return `~${estimatedKB} KB`
  } else {
    return `~${(estimatedKB / 1024).toFixed(1)} MB`
  }
}