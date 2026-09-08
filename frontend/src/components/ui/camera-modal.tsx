"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Check, Crop } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// Helper function to create cropped image
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob | null> {
  const image = new Image();
  image.src = imageSrc;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Set canvas size to the cropped area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      0.9
    );
  });
}

export function CameraModal({ open, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setCapturedImage(null);
      setIsCropping(false);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Failed to access camera. Please try again.");
        }
      }
      setIsStreaming(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // For front camera, flip the image horizontally so it looks natural
    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Reset transform
    context.setTransform(1, 0, 0, 1, 0, 0);

    // Get the image as data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);

    // Stop the camera and go to crop step
    stopCamera();
    setIsCropping(true);
  }, [facingMode, stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setIsCropping(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    startCamera();
  }, [startCamera]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmCapture = useCallback(async () => {
    if (!capturedImage || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(capturedImage, croppedAreaPixels);

      if (croppedBlob) {
        const file = new File([croppedBlob], `camera-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        onClose();
      }
    } catch (err) {
      console.error("Crop error:", err);
    }
  }, [capturedImage, croppedAreaPixels, onCapture, onClose]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setIsCropping(false);
      setError(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [open, startCamera, stopCamera]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (open && !capturedImage && !isCropping) {
      startCamera();
    }
  }, [facingMode, open, capturedImage, isCropping, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-white">
            {isCropping ? "Crop Photo" : "Take Photo"}
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square bg-white">
          {/* Video preview */}
          {!capturedImage && !isCropping && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}

          {/* Crop interface */}
          {isCropping && capturedImage && (
            <Cropper
              image={capturedImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}

          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white p-4">
              <div className="text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-red-700 text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {!isStreaming && !capturedImage && !error && !isCropping && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" />
                <p className="text-gray-500 text-sm">Starting camera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Zoom slider for crop mode */}
        {isCropping && (
          <div className="px-4 py-2 bg-white">
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="text-xs text-gray-400 text-center mt-1">
              Pinch or use slider to zoom
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 flex items-center justify-center gap-4 bg-black">
          {!isCropping ? (
            <>
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Capture button */}
              <button
                onClick={capturePhoto}
                disabled={!isStreaming}
                className="w-16 h-16 rounded-full bg-white border-4 border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors"
              />

              {/* Switch camera button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFacingMode}
                className="text-white hover:bg-white/10"
              >
                <RotateCcw className="w-6 h-6" />
              </Button>
            </>
          ) : (
            <>
              {/* Retake button */}
              <Button
                variant="ghost"
                onClick={retake}
                className="text-white hover:bg-white/10"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>

              {/* Confirm button */}
              <Button
                onClick={confirmCapture}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-5 h-5 mr-2" />
                Save
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
