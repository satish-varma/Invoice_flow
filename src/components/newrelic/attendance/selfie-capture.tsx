'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, MapPin, AlertCircle, SwitchCamera } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface SelfieCaptureProps {
  onCapture: (base64DataUri: string, coordinates: Coordinates | null) => void;
  onCancel: () => void;
  title?: string;
}

export function SelfieCapture({ onCapture, onCancel, title = 'Take a Selfie' }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<'camera' | 'preview'>('camera');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [geoStatus, setGeoStatus] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading');
  const [camError, setCamError] = useState<string | null>(null);

  /* ── Geolocation ── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGeoStatus('ok');
      },
      (err) => {
        setGeoStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  /* ── Camera ── */
  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    setCamError(null);

    // Stop any existing tracks first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Cross-browser & legacy compatibility helper
    const getMediaDevices = () => {
      if (typeof navigator.mediaDevices !== 'undefined' && typeof navigator.mediaDevices.getUserMedia === 'function') {
        return navigator.mediaDevices;
      }
      // Legacy WebKit / Moz polyfill
      const legacyGetUserMedia =
        (navigator as any).getUserMedia ||
        (navigator as any).webkitGetUserMedia ||
        (navigator as any).mozGetUserMedia ||
        (navigator as any).msGetUserMedia;

      if (legacyGetUserMedia) {
        return {
          getUserMedia: (constraints: MediaStreamConstraints) =>
            new Promise<MediaStream>((resolve, reject) => {
              legacyGetUserMedia.call(navigator, constraints, resolve, reject);
            }),
        } as MediaDevices;
      }
      return null;
    };

    const mediaDevices = getMediaDevices();

    if (!mediaDevices) {
      const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost';
      if (isHttp) {
        setCamError('Camera requires HTTPS or localhost. Please access via HTTPS or use the Take Photo button below.');
      } else {
        setCamError('Live camera not supported on this browser. Use the Take Photo button below.');
      }
      return;
    }

    try {
      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      console.warn('Camera error:', e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCamError('Camera permission denied. Please allow camera access in browser settings.');
      } else {
        setCamError(e.message || 'Could not access live camera. You can use the Take Photo button below.');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const toggleCameraFacing = () => {
    triggerHaptic('light');
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  /* ── Native File / Camera Input Fallback (works on HTTP, older Safari, iOS & Android) ── */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNativePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCapturedUri(result);
        stopCamera();
        setPhase('preview');
      }
    };
    reader.readAsDataURL(file);
  };

  /* ── Capture ── */
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      // Mirror the image (selfie style)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const dataUri = canvas.toDataURL('image/jpeg', 0.85);
    triggerHaptic('medium');
    setCapturedUri(dataUri);
    stopCamera();
    setPhase('preview');
  };

  const handleRetake = () => {
    triggerHaptic('light');
    setCapturedUri(null);
    setPhase('camera');
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    triggerHaptic('success');
    if (capturedUri) onCapture(capturedUri, coordinates);
  };

  const handleCancel = () => {
    triggerHaptic('light');
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#3b2fc9]" />
            <span className="font-semibold text-gray-800 text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'camera' && !camError && (
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-[#3b2fc9] transition-colors"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
            )}
            <button onClick={handleCancel} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hidden native camera/file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={facingMode === 'user' ? 'user' : 'environment'}
          className="hidden"
          onChange={handleNativePhotoUpload}
        />

        {/* Camera / Preview Area */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          {phase === 'camera' && (
            <>
              {camError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-5">
                  <AlertCircle className="h-10 w-10 text-amber-400" />
                  <p className="text-xs text-center text-gray-300 leading-relaxed max-w-xs">{camError}</p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 text-xs bg-[#3b2fc9] hover:bg-[#3b2fc9]/90 text-white font-medium px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-2.5 rounded-xl font-medium"
                    >
                      Retry Live Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                  {/* Floating Flip Button in Viewfinder */}
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-all shadow-md active:scale-90"
                    title="Flip camera"
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
          {phase === 'preview' && capturedUri && (
            <img src={capturedUri} alt="Selfie preview" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Geo badge */}
        <div className="px-4 py-2 flex items-center gap-1.5 text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {geoStatus === 'loading' && <span className="text-gray-400">Fetching location…</span>}
          {geoStatus === 'ok' && coordinates && (
            <span className="text-emerald-600 font-medium">
              {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
              {coordinates.accuracy !== undefined && ` (±${coordinates.accuracy}m)`}
            </span>
          )}
          {geoStatus === 'denied' && <span className="text-amber-600">Location permission denied — attendance will be recorded without GPS</span>}
          {geoStatus === 'error' && <span className="text-gray-400">Location unavailable</span>}
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 flex gap-3">
          {phase === 'camera' && (
            <>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              {camError ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 rounded-xl bg-[#3b2fc9] text-white text-sm font-medium hover:bg-[#3b2fc9]/90 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera className="h-4 w-4" />
                  Take Photo
                </button>
              ) : (
                <button
                  onClick={handleCapture}
                  className="flex-1 py-2.5 rounded-xl bg-[#3b2fc9] text-white text-sm font-medium hover:bg-[#3b2fc9]/90 flex items-center justify-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Capture
                </button>
              )}
            </>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={handleRetake}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Use Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
