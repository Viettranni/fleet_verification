"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, ArrowLeft, FileImage, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null)
  const router = useRouter()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingPlate, setPendingPlate] = useState<{ plateNumber: string; imageUrl: string } | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setDetectedPlate(null)
    } else {
      toast.error("Invalid file", {
        description: "Please select a valid image file",
      })
    }
  }

  const processImage = async () => {
    if (!selectedFile || !previewUrl) return

    setIsProcessing(true)

    // Simulate OCR processing
    setTimeout(() => {
      const mockPlates = ["ABC-123", "REK-456", "XYZ-789", "FIN-001", "HEL-999"]
      const randomPlate = mockPlates[Math.floor(Math.random() * mockPlates.length)]

      setDetectedPlate(randomPlate)
      setIsProcessing(false)

      // Check if plate exists in warehouse
      const warehousePlates = JSON.parse(localStorage.getItem("warehousePlates") || "[]")
      const isInWarehouse = warehousePlates.includes(randomPlate)

      if (isInWarehouse) {
        // Auto-save if found in warehouse
        const newPlate = {
          id: Date.now().toString(),
          plateNumber: randomPlate,
          imageUrl: previewUrl,
          timestamp: new Date(),
          status: "matched" as const,
          isInWarehouse: true,
        }

        const existing = JSON.parse(localStorage.getItem("scannedPlates") || "[]")
        const updated = [...existing, newPlate]
        localStorage.setItem("scannedPlates", JSON.stringify(updated))

        toast.success("✓ Plate Found in Warehouse", {
          description: `${randomPlate} automatically added to inventory`,
        })

        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      } else {
        // Show confirmation dialog for plates not in warehouse
        setPendingPlate({ plateNumber: randomPlate, imageUrl: previewUrl })
        setShowConfirmDialog(true)
      }
    }, 2000)
  }

  const handleAddUnmatchedPlate = () => {
    if (!pendingPlate) return

    const newPlate = {
      id: Date.now().toString(),
      plateNumber: pendingPlate.plateNumber,
      imageUrl: pendingPlate.imageUrl,
      timestamp: new Date(),
      status: "unmatched" as const,
      isInWarehouse: false,
    }

    const existing = JSON.parse(localStorage.getItem("scannedPlates") || "[]")
    const updated = [...existing, newPlate]
    localStorage.setItem("scannedPlates", JSON.stringify(updated))

    toast.success("Plate Added", {
      description: `${pendingPlate.plateNumber} added as unmatched plate`,
    })

    setShowConfirmDialog(false)
    setPendingPlate(null)
    router.push("/dashboard")
  }

  const handleSkipPlate = () => {
    toast.info("Plate Skipped", {
      description: `${pendingPlate?.plateNumber} was not added to inventory`,
    })
    setShowConfirmDialog(false)
    setPendingPlate(null)
    setSelectedFile(null)
    setPreviewUrl(null)
    setDetectedPlate(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mr-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Upload Image</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload License Plate Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedFile ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                  <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-lg font-semibold text-gray-900 mb-2">Choose an image file</div>
                  <div className="text-gray-600 mb-4">Select a photo containing a license plate</div>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload">
                    <Button asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Select Image
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={previewUrl! || "/placeholder.svg"}
                    alt="Selected license plate image"
                    className="w-full h-full object-cover"
                  />
                </div>

                {!detectedPlate && !isProcessing && (
                  <Button onClick={processImage} className="w-full" size="lg">
                    Process Image
                  </Button>
                )}

                {isProcessing && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-lg font-semibold">Processing image...</div>
                    <div className="text-gray-600">Detecting license plate number</div>
                  </div>
                )}

                {detectedPlate && (
                  <div className="text-center py-6 space-y-4">
                    <div className="text-lg text-gray-600">Detected License Plate:</div>
                    <div className="text-3xl font-bold font-mono text-blue-600 bg-blue-50 py-3 px-6 rounded-lg inline-block">
                      {detectedPlate}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setSelectedFile(null)
                          setPreviewUrl(null)
                          setDetectedPlate(null)
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Upload Another
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-yellow-500" />
              Plate Not Found in Warehouse
            </AlertDialogTitle>
            <AlertDialogDescription>
              The detected license plate is not in the warehouse. Add it as an unmatched plate or skip it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipPlate}>Skip Plate</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddUnmatchedPlate}>Add Unmatched</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
