"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Camera,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  X,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { dataURLToFile } from "@/utils/dataUrlToFile";
import { recognizePlate } from "@/utils/plateRecognizer";
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
import { Badge } from "@/components/ui/badge";

interface CapturedPlate {
  id: string;
  plateNumber: string;
  imageUrl: string;
  timestamp: Date;
  isInWarehouse: boolean;
}

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const router = useRouter();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingPlate, setPendingPlate] = useState<{
    plateNumber: string;
    imageUrl: string;
  } | null>(null);
  const [recentCaptures, setRecentCaptures] = useState<CapturedPlate[]>([]);
  const [uploadedPlates, setUploadedPlates] = useState<string[]>([]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Loads the plates now when the component mounts
  useEffect(() => {
    const fetchPlates = async () => {
      const { data, error } = await supabase
        .from("plates")
        .select("plate"); // fetch only the plate column

      if (error) {
        console.error("Error fetching plates:", error);
        return;
      }

      // Extract plate strings from the returned data
      const platesFromDB = data?.map((row) => row.plate) || [];
      setUploadedPlates(platesFromDB);
    };

    fetchPlates();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast.error("Camera Error", {
        description: "Unable to access camera. Please check permissions.",
      });
    }
  };

  const stopCamera = (currentStream?: MediaStream) => {
    const mediaStream = currentStream || stream;
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  // Calls this function when the User hits the capture button
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setCapturedImage(imageDataUrl);
      const file = dataURLToFile(imageDataUrl, "car_plate");
      processImage(file, imageDataUrl); // Pass imageDataUrl directly
    }
  };

  // After capturing the picture it would be passed into processing the picture
  const processImage = async (file: File, imageDataUrl: string) => {
    setIsProcessing(true);

    // Recognize plate would give back the plate number
    const plate = await recognizePlate(file);

    // If the plate was not recognized
    if (!plate) {
      toast.error("Could not detect a valid plate number, please try again");
      setIsProcessing(false);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      retakePhoto();
      return;
    }

    // After the plate was checked to be valid we would set the detected plate and upload the image file to supabase bucket and also table as key pair
    setDetectedPlate(formatFinnishPlate(plate));
    const supaImgUrl = await uploadImage(file);

    // Checks if supabase returns string and not null
    

    console.log("This is the captured image URL: " + supaImgUrl)


    // TODO: CHECK the upload logic also to match
    // TODO: Make sure that the generate report works correctly
    // TODO: Does clear all and clear scanned work correctly?
    // TODO: Dashboard is not fetching the numbers correctly


    // Would check if the plate is in User's uploaded excel, returns true or false
    const isInWarehouse = uploadedPlates.includes(plate);

    if (isInWarehouse) {
      // Auto-save if found in warehouse
      const newPlate = {
        id: Date.now().toString(),
        plate: plate,
        plate_url: imageDataUrl, // Use the passed imageDataUrl
        created_At: new Date(),
        status: "matched" as const,
        isInWarehouse: true,
      };

      if (supaImgUrl) {
        savePlate(plate, supaImgUrl, true, "matched");
      } else {
        console.error("Upload failed, cannot save plate");
      }

      // setRecentCaptures((prev) => [
      //   {
      //     id: newPlate.id,
      //     plateNumber: newPlate.plate,
      //     imageUrl: newPlate.plate_url,
      //     timestamp: newPlate.created_At,
      //     isInWarehouse: true,
      //   },
      //   ...prev.slice(0, 4),
      // ]);

      // const existing = JSON.parse(
      //   localStorage.getItem("scannedPlates") || "[]"
      // );
      // const updated = [...existing, newPlate];
      // localStorage.setItem("scannedPlates", JSON.stringify(updated));

      toast.success("✓ Plate Found in Warehouse", {
        description: `${plate} automatically added to inventory`,
      });

      setTimeout(() => {
        setCapturedImage(null);
        setDetectedPlate(null);
        startCamera();
      }, 800);
    } else {
      // Show confirmation dialog for plates not in warehouse
      setPendingPlate({ plateNumber: plate, imageUrl: imageDataUrl }); // Use the passed imageDataUrl
      setShowConfirmDialog(true);
    }

    setIsProcessing(false);
  };

  const handleAddUnmatchedPlate = () => {
    if (!pendingPlate) return;

    const newPlate = {
      id: Date.now().toString(),
      plate: pendingPlate.plateNumber,
      plate_url: pendingPlate.imageUrl,
      created_at: new Date(),
      status: "unmatched" as const,
      isInWarehouse: false,
    };

    // Add to supabase
    savePlate(pendingPlate.plateNumber, pendingPlate.imageUrl, false, "unmatched")

    // Add to recent captures
    setRecentCaptures((prev) => [
      {
        id: newPlate.id,
        plateNumber: newPlate.plate,
        imageUrl: newPlate.plate_url,
        timestamp: newPlate.created_at,
        isInWarehouse: false,
      },
      ...prev.slice(0, 4),
    ]);

    toast.success("Plate Added", {
      description: `${pendingPlate.plateNumber} added as unmatched plate`,
    });

    setShowConfirmDialog(false);
    setPendingPlate(null);

    // Reset for next capture but keep camera on
    setCapturedImage(null);
    setDetectedPlate(null);
    startCamera();
  };

  const handleSkipPlate = () => {
    toast.info("Plate Skipped", {
      description: `${pendingPlate?.plateNumber} was not added to inventory`,
    });
    setShowConfirmDialog(false);
    setPendingPlate(null);

    // Reset for next capture but keep camera on
    setCapturedImage(null);
    setDetectedPlate(null);
    startCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setDetectedPlate(null);
    setIsProcessing(false);
    startCamera();
  };

  const exitCapture = async () => {
    if (stream) {
      stopCamera(stream);
    }
    await router.push("/dashboard");
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // This section is for SUPABASE --------------------

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

  function formatFinnishPlate(plate: string): string {
    // Remove any existing dash and convert to uppercase
    const cleaned = plate.replace(/-/g, "").toUpperCase();

    // Ensure it has at least 3 letters + numbers
    if (cleaned.length > 3) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }

    return cleaned;
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={exitCapture} className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Continuous Capture
              </h1>
            </div>
            <Button variant="destructive" size="sm" onClick={exitCapture}>
              <X className="w-4 h-4 mr-2" />
              Exit Capture
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Camera Capture
              </CardTitle>
              <CardDescription>
                Camera stays on for continuous scanning. Capture multiple plates
                without exiting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!capturedImage ? (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 rounded-lg flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="text-lg font-semibold mb-2">
                          Position license plate here
                        </div>
                        <div className="text-sm opacity-75">
                          Make sure the plate is clearly visible
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={capturePhoto}
                    className="w-full h-12"
                    size="lg"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capture Photo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={capturedImage || "/placeholder.svg"}
                      alt="Captured license plate"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {isProcessing ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <div className="text-lg font-semibold">
                        Processing image...
                      </div>
                      <div className="text-gray-600">
                        Detecting license plate number
                      </div>
                    </div>
                  ) : detectedPlate ? (
                    <div className="text-center py-6 space-y-4">
                      <div className="text-lg text-gray-600">
                        Detected License Plate:
                      </div>
                      <div className="text-3xl font-bold font-mono text-blue-600 bg-blue-50 py-3 px-6 rounded-lg inline-block">
                        {detectedPlate}
                      </div>
                      <Button
                        onClick={retakePhoto}
                        variant="outline"
                        className="w-full"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retake Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-lg font-semibold text-red-600 mb-2">
                        No plate detected
                      </div>
                      <div className="text-gray-600 mb-4">
                        Please try again with a clearer image
                      </div>
                      <Button onClick={retakePhoto} variant="outline">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retake Photo
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Captures */}
          {recentCaptures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Recent Captures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentCaptures.map((plate) => (
                    <div
                      key={plate.id}
                      className={`flex items-center gap-3 p-2 rounded-md ${
                        plate.isInWarehouse ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={plate.imageUrl || "/placeholder.svg"}
                          alt={`License plate ${plate.plateNumber}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <div className="font-mono font-medium">
                          {plate.plateNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(plate.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`flex-shrink-0 ${
                          plate.isInWarehouse
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {plate.isInWarehouse ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <X className="w-3 h-3 mr-1" />
                        )}
                        {plate.isInWarehouse ? "Match" : "No Match"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              Vehicle Not Found in Warehouse
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>
                The license plate{" "}
                <strong className="font-mono text-lg">
                  {pendingPlate?.plateNumber}
                </strong>{" "}
                was not found in your warehouse inventory.
              </div>
              <div>
                Would you like to add it to your current list anyway, or skip
                this plate?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipPlate}>
              Skip Plate
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddUnmatchedPlate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add to List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
