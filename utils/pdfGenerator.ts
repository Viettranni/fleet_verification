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

  // --- Summary statistics ---
  const matched = scannedPlates.filter((plate) => plate.isInWarehouse)
  const unmatched = scannedPlates.filter((plate) => !plate.isInWarehouse)

  pdf.setFontSize(14)
  pdf.text("Summary:", 20, 70)
  pdf.setFontSize(12)
  pdf.text(`Total Scanned: ${scannedPlates.length}`, 20, 85)
  pdf.text(`Found in Warehouse: ${matched.length}`, 20, 95)
  pdf.text(`Not in Warehouse: ${unmatched.length}`, 20, 105)

  // --- Page 2: Plate List ---
  pdf.addPage()
  pdf.setFontSize(14)
  pdf.text("Plate List:", 20, 20)
  pdf.setFontSize(10)

  let y = 30
  scannedPlates.forEach((plate, i) => {
    if (y > pageHeight - 20) {
      pdf.addPage()
      y = 20
    }

    const status = plate.isInWarehouse ? "✓ In Warehouse" : "✗ Not Found"
    pdf.text(`${i + 1}. ${plate.plate}   (${status})`, 20, y)
    y += 7
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