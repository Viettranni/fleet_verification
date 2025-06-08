import jsPDF from "jspdf"

interface PlateRecord {
  id: string
  plateNumber: string
  imageUrl: string
  timestamp: Date
  isInWarehouse: boolean
}

export const generatePDFReport = async (scannedPlates: PlateRecord[], warehousePlates: string[]): Promise<Blob> => {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Title page
  pdf.setFontSize(20)
  pdf.text("License Plate Inventory Report", pageWidth / 2, 30, { align: "center" })

  pdf.setFontSize(12)
  const reportDate = new Date().toLocaleDateString()
  pdf.text(`Generated: ${reportDate}`, pageWidth / 2, 45, { align: "center" })

  // Summary statistics
  const matched = scannedPlates.filter((plate) => plate.isInWarehouse)
  const unmatched = scannedPlates.filter((plate) => !plate.isInWarehouse)

  pdf.setFontSize(14)
  pdf.text("Summary:", 20, 70)
  pdf.setFontSize(12)
  pdf.text(`Total Scanned: ${scannedPlates.length}`, 20, 85)
  pdf.text(`Found in Warehouse: ${matched.length}`, 20, 95)
  pdf.text(`Not in Warehouse: ${unmatched.length}`, 20, 105)
  pdf.text(`Warehouse Inventory: ${warehousePlates.length} plates`, 20, 115)

  // Add new page for plates
  pdf.addPage()

  // Grid layout configuration
  const margin = 10
  const gridCols = 3
  const gridRows = 4
  const cellWidth = (pageWidth - margin * 2) / gridCols
  const cellHeight = (pageHeight - margin * 2) / gridRows
  const imageWidth = cellWidth - 6
  const imageHeight = cellHeight - 15

  let currentPage = 1
  let col = 0
  let row = 0

  // Process plates in batches to improve performance
  const batchSize = 20
  for (let i = 0; i < scannedPlates.length; i += batchSize) {
    const batch = scannedPlates.slice(i, i + batchSize)

    for (const plate of batch) {
      // Calculate position
      const x = margin + col * cellWidth
      const y = margin + row * cellHeight

      try {
        // Compress image more aggressively
        const compressedImage = await compressImageForPDF(plate.imageUrl, 300, 1)

        // Add plate number on top of image
        pdf.setFontSize(8)
        pdf.setFont(undefined, "bold")

        // Status indicator with color
        if (plate.isInWarehouse) {
          pdf.setTextColor(0, 128, 0) // Green
          pdf.text(`✓ ${plate.plateNumber}`, x + 3, y + 5)
        } else {
          pdf.setTextColor(255, 0, 0) // Red
          pdf.text(`✗ ${plate.plateNumber}`, x + 3, y + 5)
        }

        pdf.setTextColor(0, 0, 0) // Reset to black

        // Add image below the plate number
        pdf.addImage(compressedImage, "JPEG", x + 3, y + 7, imageWidth, imageHeight)

        // Add tiny timestamp at bottom
        pdf.setFontSize(6)
        const shortDate = new Date(plate.timestamp).toLocaleDateString()
        pdf.text(shortDate, x + 3, y + cellHeight - 3)

        // Move to next position in grid
        col++
        if (col >= gridCols) {
          col = 0
          row++

          if (row >= gridRows) {
            row = 0
            pdf.addPage()
            currentPage++
          }
        }
      } catch (error) {
        console.error("Error adding image to PDF:", error)
        // Continue without image, just add text
        pdf.text(`${plate.plateNumber} - Image error`, x + 3, y + cellHeight / 2)

        // Move to next position
        col++
        if (col >= gridCols) {
          col = 0
          row++

          if (row >= gridRows) {
            row = 0
            pdf.addPage()
            currentPage++
          }
        }
      }
    }
  }

  // Add page numbers
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 25, pageHeight - 10)
  }

  return pdf.output("blob")
}

const compressImageForPDF = (dataUrl: string, maxDimension = 300, quality = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new Error("Canvas context not available"))
        return
      }

      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxDimension) {
          height = height * (maxDimension / width)
          width = maxDimension
        }
      } else {
        if (height > maxDimension) {
          width = width * (maxDimension / height)
          height = maxDimension
        }
      }

      // Round to avoid fractional pixels
      width = Math.round(width)
      height = Math.round(height)

      canvas.width = width
      canvas.height = height

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      ctx.fillStyle = "#FFFFFF"
      ctx.fillRect(0, 0, width, height)

      // Draw the original image source area scaled to canvas size
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height)

      // Contrast enhancement logic remains the same
      try {
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        const truncate = (value: number): number => Math.max(0, Math.min(255, value))
        const contrastFactor = 1.05

        for (let i = 0; i < data.length; i += 4) {
          data[i]     = truncate((data[i] - 128) * contrastFactor + 128)     // Red
          data[i + 1] = truncate((data[i + 1] - 128) * contrastFactor + 128) // Green
          data[i + 2] = truncate((data[i + 2] - 128) * contrastFactor + 128) // Blue
        }

        ctx.putImageData(imageData, 0, 0)
      } catch (e) {
        console.warn("Image enhancement failed, using original")
      }

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
