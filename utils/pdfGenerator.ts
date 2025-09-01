import jsPDF from "jspdf"
import { supabase } from "@/lib/supabaseClient" // adjust path to your client


interface PlateRecord {
  id: number
  plate: string
  plate_url: string
  created_at: Date
  status: "matched" | "unmatched"
  isInWarehouse: boolean
}


export const generatePDFReport = async (): Promise<Blob> => {
  let scannedPlates: PlateRecord[] = [];

  try {
    scannedPlates = await fetchPlatesInChunks("plates", 30);

  if (!scannedPlates || scannedPlates.length === 0) {
    throw new Error("No plate data available");
  }

  scannedPlates.sort((a, b) => a.plate.localeCompare(b.plate));

  console.log("Scanned plates:", scannedPlates);
} catch (error) {
  console.error("Error fetching plates:", error);
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

  let col = 0
  let row = 0

  for (const plate of scannedPlates) {
    const x = margin + col * cellWidth
    const y = margin + row * cellHeight

    try {
      const compressedImage = await compressImageForPDF(plate.plate_url, 300, 1)

      // Load image to get dimensions
      const img = new Image()
      img.src = compressedImage
      await new Promise((resolve) => { img.onload = resolve })

      const imgRatio = img.width / img.height

      // Zoom factor: increase image size slightly
      const zoom = 0.9

      let drawWidth = (cellWidth - 6) * zoom
      let drawHeight = (cellHeight - 15) * zoom

      if (imgRatio > drawWidth / drawHeight) {
        drawHeight = drawWidth / imgRatio
      } else {
        drawWidth = drawHeight * imgRatio
      }

      // Center image inside cell
      const offsetX = x + 3 + (cellWidth - 6 - drawWidth) / 2
      const offsetY = y + 7 + (cellHeight - 15 - drawHeight) / 2

      // Draw plate label
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      if (plate.isInWarehouse) {
        pdf.setTextColor(0, 128, 0)
        pdf.text(`V ${plate.plate}`, x + 3, y + 5)
      } else {
        pdf.setTextColor(255, 0, 0)
        pdf.text(`X ${plate.plate}`, x + 3, y + 5)
      }
      pdf.setTextColor(0, 0, 0)

      // Add image
      pdf.addImage(compressedImage, "JPEG", offsetX, offsetY, drawWidth, drawHeight)

      // Add date at bottom of cell
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
const compressImageForPDF = (dataUrl: string, maxDimension = 400, quality = 1): Promise<string> => {
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

const fetchPlatesInChunks = async (tableName: string, chunkSize = 30) => {
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .range(from, from + chunkSize - 1); // fetch a chunk

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += chunkSize;
        } else {
          hasMore = false; // stop if no more rows
        }
      }

      return allData;
    };