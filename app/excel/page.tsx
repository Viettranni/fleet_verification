"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileSpreadsheet, ArrowLeft, Upload, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from "xlsx";

export default function ExcelUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedPlates, setUploadedPlates] = useState<string[]>([])
  const router = useRouter()

  // Checking if the file is valid
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.type.includes("spreadsheet") || file.name.endsWith(".xlsx") || file.name.endsWith(".csv"))) {
      setSelectedFile(file)
      setUploadedPlates([])
    } else {
      toast.error("Invalid file", {
        description: "Please select a valid Excel or CSV file",
      })
    }
  }

  const processExcelFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<{ plate?: string }>(worksheet, { header: 1 });

      const extractedPlates: string[] = jsonData
        .flat()
        .filter((item): item is string => typeof item === "string");

      const existingPlates: string[] = JSON.parse(
        localStorage.getItem("warehousePlates") || "[]"
      );

      const uniqueNewPlates = extractedPlates.filter(
        (plate) => !existingPlates.includes(plate)
      );

      // Save each plate to Supabase
      await Promise.all(uniqueNewPlates.map(plate => savePlateToSupabase(plate)));

      const merged = [...existingPlates, ...uniqueNewPlates];
      setUploadedPlates(merged);
      localStorage.setItem("warehousePlates", JSON.stringify(merged));

      setIsProcessing(false);

      toast.success("Excel file processed", {
        description: `${uniqueNewPlates.length} new plates added (${merged.length} total)`,
      });
    };

    reader.onerror = () => {
      setIsProcessing(false);
      toast.error("Failed to read file");
    };

    reader.readAsArrayBuffer(selectedFile);
  };


  const goToDashboard = () => {
    router.push("/dashboard")
  }

  // Supabase section
  async function savePlateToSupabase(plate: string, imageUrl?: string) {
    const { data, error } = await supabase
      .from("excel_plates")
      .insert([{ plate }]);

    if (error) {
      console.error("Error saving plate:", error);
      return false;
    }
    return true;
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
            <h1 className="text-xl font-semibold text-gray-900">Upload Warehouse Inventory</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Warehouse Inventory (Required First Step)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {uploadedPlates.length === 0 ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-lg font-semibold text-gray-900 mb-2">Upload warehouse inventory first</div>
                  <div className="text-gray-600 mb-4">
                    This step is required before you can start capturing license plates
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label htmlFor="excel-upload">
                    <Button asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Select File
                      </span>
                    </Button>
                  </label>
                </div>

                {selectedFile && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-blue-900">{selectedFile.name}</div>
                        <div className="text-sm text-blue-700">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <Button
                        onClick={processExcelFile}
                        disabled={isProcessing}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </div>
                        ) : (
                          "Process File"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">File processed successfully!</span>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-lg font-semibold text-green-900 mb-2">✓ Warehouse Inventory Ready!</div>
                  <div className="text-green-700 mb-4">
                    You can now start capturing license plates. They will be automatically compared with this inventory.
                  </div>

                  <div className="max-h-40 overflow-y-auto bg-white rounded border p-3">
                    <div className="grid grid-cols-3 gap-2 text-sm font-mono">
                      {uploadedPlates.slice(0, 12).map((plate, index) => (
                        <div key={index} className="bg-gray-100 px-2 py-1 rounded text-center">
                          {plate}
                        </div>
                      ))}
                      {uploadedPlates.length > 12 && (
                        <div className="bg-gray-200 px-2 py-1 rounded text-center text-gray-600">
                          +{uploadedPlates.length - 12} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button onClick={goToDashboard} className="w-full" size="lg">
                  Start Capturing Plates
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
