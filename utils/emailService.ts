export const sendReportEmail = async (
  pdfBlob: Blob,
  recipientEmail: string,
  summary: {
    total: number
    matched: number
    unmatched: number
  },
) => {
  // Convert blob to base64 for email attachment
  const base64PDF = await blobToBase64(pdfBlob)

  const emailData = {
    to: recipientEmail,
    subject: `License Plate Inventory Report - ${new Date().toLocaleDateString()}`,
    html: `
      <h2>License Plate Inventory Report</h2>
      <p>Your inventory scan has been completed. Please find the detailed report attached.</p>
      
      <h3>Summary:</h3>
      <ul>
        <li><strong>Total Scanned:</strong> ${summary.total} vehicles</li>
        <li><strong>Found in Warehouse:</strong> ${summary.matched} vehicles</li>
        <li><strong>Not in Warehouse:</strong> ${summary.unmatched} vehicles</li>
      </ul>
      
      <p>The attached PDF contains all captured images and detailed information.</p>
      
      <p><em>Generated on ${new Date().toLocaleString()}</em></p>
    `,
    attachments: [
      {
        filename: `inventory-report-${new Date().toISOString().split("T")[0]}.pdf`,
        content: base64PDF,
        encoding: "base64",
        contentType: "application/pdf",
      },
    ],
  }

  // Send email using your preferred service (SendGrid, Resend, etc.)
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emailData),
  })

  return response.ok
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
