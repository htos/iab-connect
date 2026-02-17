'use client';

/**
 * REQ-020: QR Code Check-In Component
 * Scanner for event check-in using QR codes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Keyboard,
} from 'lucide-react';
import {
  type EventDto,
  type EventRegistrationDto,
  checkInByQrCode,
  getRegistrationStatusLabel,
} from '@/lib/services/events';

interface EventCheckInProps {
  event: EventDto;
  onCheckIn?: (registration: EventRegistrationDto) => void;
}

interface CheckInResult {
  success: boolean;
  registration?: EventRegistrationDto;
  error?: string;
  timestamp: Date;
}

export function EventCheckIn({ event, onCheckIn }: EventCheckInProps) {
  const [mode, setMode] = useState<'manual' | 'scanner'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Start camera for QR scanning
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setCameraError(null);
      }
    } catch {
      setCameraError('Kamera konnte nicht gestartet werden. Bitte prüfen Sie die Berechtigungen.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Toggle mode: start/stop camera
  useEffect(() => {
    if (mode !== 'scanner') return;

    const currentVideo = videoRef.current;

    // Start camera using .then() to keep setState in callback context
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    }).then((stream) => {
      if (currentVideo) {
        currentVideo.srcObject = stream;
        setCameraActive(true);
        setCameraError(null);
      } else {
        stream.getTracks().forEach((track) => track.stop());
      }
    }).catch(() => {
      setCameraError('Kamera konnte nicht gestartet werden. Bitte prüfen Sie die Berechtigungen.');
    });

    return () => {
      if (currentVideo?.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        currentVideo.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [mode]);

  const processCheckIn = async (qrCodeToken: string) => {
    if (!qrCodeToken || isProcessing) return;

    setIsProcessing(true);
    setLastResult(null);

    const result = await checkInByQrCode(qrCodeToken.trim());

    const checkInResult: CheckInResult = {
      success: result.success,
      registration: result.success ? result.data : undefined,
      error: result.success ? undefined : result.error,
      timestamp: new Date(),
    };

    setLastResult(checkInResult);
    setRecentCheckIns((prev) => [checkInResult, ...prev.slice(0, 9)]);

    if (result.success && onCheckIn) {
      onCheckIn(result.data);
    }

    setManualCode('');
    setIsProcessing(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCheckIn(manualCode);
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={mode === 'manual' ? 'default' : 'outline'}
          onClick={() => setMode('manual')}
        >
          <Keyboard className="h-4 w-4 mr-2" />
          Manuelle Eingabe
        </Button>
        <Button
          variant={mode === 'scanner' ? 'default' : 'outline'}
          onClick={() => setMode('scanner')}
        >
          <Camera className="h-4 w-4 mr-2" />
          QR-Scanner
        </Button>
      </div>

      {/* Manual Entry Mode */}
      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Check-In Code eingeben
            </CardTitle>
            <CardDescription>
              Geben Sie den QR-Code-Token manuell ein.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qrCode">QR-Code Token</Label>
                <Input
                  id="qrCode"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Token eingeben..."
                  autoFocus
                  disabled={isProcessing}
                />
              </div>
              <Button type="submit" disabled={!manualCode || isProcessing} className="w-full">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Einchecken
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Scanner Mode */}
      {mode === 'scanner' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              QR-Code scannen
            </CardTitle>
            <CardDescription>
              Halten Sie den QR-Code vor die Kamera.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cameraError ? (
              <Alert variant="destructive">
                <CameraOff className="h-4 w-4" />
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Hinweis: Die QR-Code-Erkennung erfordert eine JavaScript-Bibliothek wie
              &quot;html5-qrcode&quot;.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Last Result */}
      {lastResult && (
        <Card className={lastResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {lastResult.success ? (
                <CheckCircle className="h-12 w-12 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                {lastResult.success && lastResult.registration ? (
                  <>
                    <p className="text-lg font-semibold">
                      {lastResult.registration.participantName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lastResult.registration.participantEmail}
                    </p>
                    <p className="text-sm">
                      {lastResult.registration.numberOfGuests}{' '}
                      {lastResult.registration.numberOfGuests === 1
                        ? 'Person'
                        : 'Personen'}
                    </p>
                    <Badge variant="default" className="mt-2">
                      {getRegistrationStatusLabel(lastResult.registration.status)}
                    </Badge>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-red-600">
                      Check-In fehlgeschlagen
                    </p>
                    <p className="text-sm text-muted-foreground">{lastResult.error}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Check-Ins */}
      {recentCheckIns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Check-Ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentCheckIns.map((checkIn, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {checkIn.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      {checkIn.registration?.participantName || checkIn.error}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {checkIn.timestamp.toLocaleTimeString('de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
