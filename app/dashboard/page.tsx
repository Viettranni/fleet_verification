"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, Upload, FileSpreadsheet, Mail, Trash2, LogOut, Car, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { generatePDFReport, estimatePDFSize } from "@/utils/pdfGenerator"
import { sendReportEmail } from "@/utils/emailService"
import { supabase } from '@/lib/supabaseClient'

interface PlateRecord {
  id: number
  plate: string
  plate_url: string
  created_at: Date
  status: "matched" | "unmatched"
  isInWarehouse: boolean
}


export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [scannedPlates, setScannedPlates] = useState<PlateRecord[]>([])
  const [warehousePlates, setWarehousePlates] = useState<string[]>([])
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const auth = localStorage.getItem("isAuthenticated"); // You can also use Supabase auth here
      if (!auth) {
        router.push("/");
        return;
      }

      setIsAuthenticated(true);

      try {
        const warehouseData = await fetchPlatesInChunks("excel_plates", 30);
        setWarehousePlates(warehouseData.map((item: PlateRecord) => item.plate));
        console.log(warehousePlates)

        const scannedData = await fetchPlatesInChunks("plates", 30);
        setScannedPlates(scannedData);

      } catch (error) {
        console.error("Error loading plates from Supabase:", error);
        toast.error("Failed to load plates from server");
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  // Breaking the code into chunks for it to prevent the timeout error from supabase
  const fetchPlatesInChunks = async (tableName: string, chunkSize = 30) => {
    let allData: PlateRecord[] = [];
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


  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userEmail")
    router.push("/")
  }

  const clearAllData = () => {
    setScannedPlates([])
    localStorage.removeItem("scannedPlates")
    toast.success("Scanned plates cleared", {
      description: "All scanned plates and images have been removed",
    })
  }

  const clearWarehouseData = () => {
    setWarehousePlates([])
    setScannedPlates([])
    localStorage.removeItem("warehousePlates")
    localStorage.removeItem("scannedPlates")
    toast.success("All data cleared", {
      description: "Warehouse inventory and scanned plates have been cleared",
    })
  }

  const generateReport = async () => {
    try {
      setLoading(true)

      // Generate PDF
      const pdfBlob = await generatePDFReport();

      // Download PDF locally
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Optionally send via email
      const userEmail = localStorage.getItem("userEmail")
      if (userEmail) {
        const summary = {
          total: scannedPlates.length,
          matched: scannedPlates.filter((p) => p.isInWarehouse).length,
          unmatched: scannedPlates.filter((p) => !p.isInWarehouse).length,
        }

        await sendReportEmail(pdfBlob, userEmail, summary)

        toast.success("Report Generated & Sent", {
          description: `PDF report emailed to ${userEmail}`,
        })
      }
    } catch (error) {
      console.log("Report error: " + error);
      toast.error("Error generating report", {
        description: "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return <div>Loading...</div>
  }

  const hasWarehouseData = warehousePlates.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">License Plate Inventory</h1>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="text-gray-600">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Warehouse Setup Alert */}
        {!hasWarehouseData && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Setup Required:</strong> Please upload your warehouse inventory Excel file first before capturing
              license plates.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Warehouse Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{warehousePlates.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Scanned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{scannedPlates.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Found in Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {scannedPlates.filter((plate) => plate.isInWarehouse).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Not in Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {scannedPlates.filter((plate) => !plate.isInWarehouse).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Button
            onClick={() => router.push("/excel")}
            className={`h-20 flex-col gap-2 ${hasWarehouseData ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            <FileSpreadsheet className="w-6 h-6" />
            {hasWarehouseData ? "Update Inventory" : "Upload Inventory"}
          </Button>
          <Button
            onClick={() => router.push("/capture")}
            variant={hasWarehouseData ? "default" : "secondary"}
            disabled={!hasWarehouseData}
            className="h-20 flex-col gap-2"
          >
            <Camera className="w-6 h-6" />
            Capture Photo
          </Button>
          <Button
            onClick={() => router.push("/upload")}
            variant={hasWarehouseData ? "outline" : "secondary"}
            disabled={!hasWarehouseData}
            className="h-20 flex-col gap-2"
          >
            <Upload className="w-6 h-6" />
            Upload Image
          </Button>
          <Button
            onClick={generateReport}
            variant="outline"
            disabled={scannedPlates.length === 0 || loading}
            className="h-20 flex-col gap-2"
          >
            {loading ? (
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-1" />
                <span className="text-xs">Generating...</span>
              </div>
            ) : (
              <>
                <Mail className="w-6 h-6" />
                Generate Report
                {scannedPlates.length > 0 && (
                  <span className="text-xs opacity-70">{estimatePDFSize(scannedPlates.length)}</span>
                )}
              </>
            )}
          </Button>
        </div>

        {/* Current Plates Display */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Scanned License Plates</CardTitle>
              <CardDescription>
                {hasWarehouseData
                  ? "Plates automatically compared with warehouse inventory"
                  : "Upload warehouse inventory to enable comparison"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {scannedPlates.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAllData}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Scanned
                </Button>
              )}
              {hasWarehouseData && (
                <Button variant="destructive" size="sm" onClick={clearWarehouseData}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {scannedPlates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {hasWarehouseData
                  ? "No plates scanned yet. Start by capturing or uploading images."
                  : "Upload your warehouse inventory first, then start scanning plates."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scannedPlates.map((plate) => (
                  <div
                    key={plate.id}
                    className={`border rounded-lg p-4 space-y-3 transition-colors ${
                      plate.isInWarehouse ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg font-semibold">{plate.plate}</span>
                      <Badge
                        variant={plate.isInWarehouse ? "default" : "destructive"}
                        className={plate.isInWarehouse ? "bg-green-600" : "bg-red-600"}
                      >
                        {plate.isInWarehouse ? "✓ In Warehouse" : "✗ Not Found"}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{new Date(plate.created_at).toLocaleString()}</div>
                    {plate.plate_url && (
                      <img
                        src={plate.plate_url || "/placeholder.svg"}
                        alt={`License plate ${plate.plate}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
