"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ArrowLeft, FileImage, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { recognizePlate } from "../../utils/plateRecognizer";
import { resizeAndCompressImage } from "../../utils/imageQualityManipulation"
import { supabase } from '@/lib/supabaseClient'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingPlate, setPendingPlate] = useState<{
    plateNumber: string;
    imageUrl: string;
  } | null>(null);

  const router = useRouter();
  const [uploadedPlates, setUploadedPlates] = useState<string[]>([]);

  // ✅ Load warehouse plates on mount (same as camera flow)
  useEffect(() => {
    const fetchPlates = async () => {
      const { data, error } = await supabase
        .from("excel_plates")
        .select("plate");

      if (error) {
        console.error("Error fetching plates:", error);
        return;
      }

      const platesFromDB = data?.map((row) => row.plate) || [];
      setUploadedPlates(platesFromDB);
    };

    fetchPlates();
  }, []);

  // ✅ Handle file input
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      try {
        const compressedBlob = await resizeAndCompressImage(file);
        const compressedFile = new File([compressedBlob], file.name, {
          type: "image/jpeg",
        });
        setSelectedFile(compressedFile);

        const url = URL.createObjectURL(compressedFile);
        setPreviewUrl(url);
        setDetectedPlate(null);
      } catch (error) {
        console.error("HandleFileSelect error: " + error);
        toast.error("Image processing failed");
      }
    } else {
      toast.error("Please select a valid image file");
    }
  };

  // ✅ Process uploaded image
  const processImage = async () => {
    if (!selectedFile || !previewUrl) return;

    setIsProcessing(true);

    // Run recognition
    const plate = await recognizePlate(selectedFile);

    if (!plate) {
      toast.error("Could not detect a valid plate number, please try again");
      setIsProcessing(false);
      return;
    }

    // Format plate like Finnish plates
    const formattedPlate = formatFinnishPlate(plate);
    setDetectedPlate(formattedPlate);

    // Upload image to Supabase storage
    const supaImgUrl = await uploadImage(selectedFile);
    console.log("This is the uploaded image URL: " + supaImgUrl);

    const isInWarehouse = uploadedPlates.includes(formattedPlate);

    if (isInWarehouse) {
      // ✅ Auto-save if found in warehouse
      if (supaImgUrl) {
        savePlate(formattedPlate, supaImgUrl, true, "matched");
      }

      toast.success("✓ Plate Found in Warehouse", {
        description: `${formattedPlate} automatically added to inventory`,
      });

      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } else {
      // Show confirmation dialog for unmatched
      setPendingPlate({ plateNumber: formattedPlate, imageUrl: supaImgUrl || previewUrl });
      setShowConfirmDialog(true);
    }

    setIsProcessing(false);
  };

  // ✅ Add unmatched plate
  const handleAddUnmatchedPlate = () => {
    if (!pendingPlate) return;

    savePlate(pendingPlate.plateNumber, pendingPlate.imageUrl, false, "unmatched");

    toast.success("Plate Added", {
      description: `${pendingPlate.plateNumber} added as unmatched plate`,
    });

    setShowConfirmDialog(false);
    setPendingPlate(null);
    router.push("/upload");
  };

  // ✅ Skip unmatched plate
  const handleSkipPlate = () => {
    toast.info("Plate Skipped", {
      description: `${pendingPlate?.plateNumber} was not added to inventory`,
    });
    setShowConfirmDialog(false);
    setPendingPlate(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDetectedPlate(null);
  };

  // Formatting the plate
  function formatFinnishPlate(plate: string): string {
    // Remove any existing dash and convert to uppercase
    const cleaned = plate.replace(/-/g, "").toUpperCase();

    // Ensure it has at least 3 letters + numbers
    if (cleaned.length > 3) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }

    return cleaned;
  }

  // Saving the plate and image url to supabase to plates table
  async function savePlate(plateNumber: string, imageUrl: string, isInWarehouse: boolean, status: "matched" | "unmatched") {

    const { data, error } = await supabase
      .from('plates')
      .insert([
        { plate: plateNumber, 
          plate_url: imageUrl,
          isInWarehouse: isInWarehouse,
          status: status
        }
      ])

    if (error) console.error(error)
    else console.log('Saved plate:', data)
  }

  // Uploads to the supabase bucket and would return the image url
  async function uploadImage(file: File): Promise<string | null> {
    const fileName = `${Date.now()}-${file.name}`; // unique filename

    const { error } = await supabase.storage
      .from('car_images')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      console.log("There was an error while uploading to Supabase!");
      return null;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('car_images')
      .getPublicUrl(fileName);

    return data.publicUrl; 
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">
              Upload Image
            </h1>
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
                  <div className="text-lg font-semibold text-gray-900 mb-2">
                    Choose an image file
                  </div>
                  <div className="text-gray-600 mb-4">
                    Select a photo containing a license plate
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
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
                    <div className="text-lg font-semibold">
                      Processing image...
                    </div>
                    <div className="text-gray-600">
                      Detecting license plate number
                    </div>
                  </div>
                )}

                {detectedPlate && (
                  <div className="text-center py-6 space-y-4">
                    <div className="text-lg text-gray-600">
                      Detected License Plate:
                    </div>
                    <div className="text-3xl font-bold font-mono text-blue-600 bg-blue-50 py-3 px-6 rounded-lg inline-block">
                      {detectedPlate}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setDetectedPlate(null);
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
              The detected license plate is not in the warehouse. Add it as an
              unmatched plate or skip it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipPlate}>
              Skip Plate
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddUnmatchedPlate}>
              Add Unmatched
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
