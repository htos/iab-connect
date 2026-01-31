'use client';

/**
 * REQ-020: Event Ticket Component
 * Displays a ticket with QR code for event check-in.
 */

import { useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  MapPin,
  Clock,
  User,
  Users,
  QrCode as QrCodeIcon,
} from 'lucide-react';
import {
  type EventRegistrationDto,
  getRegistrationStatusLabel,
  getRegistrationStatusColor,
} from '@/lib/services/events';

interface EventTicketProps {
  registration: EventRegistrationDto;
  eventTitle: string;
  eventStartDate: string;
  eventEndDate?: string;
  eventLocation?: string;
}

export function EventTicket({
  registration,
  eventTitle,
  eventStartDate,
  eventEndDate,
  eventLocation,
}: EventTicketProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Generate QR code using a simple canvas-based approach
  useEffect(() => {
    if (!registration.qrCodeToken || !qrRef.current) return;

    // Note: In production, use a library like 'qrcode' or 'qrcode.react'
    // This is a placeholder that shows the token
    const container = qrRef.current;
    container.innerHTML = `
      <div class="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center p-4">
        <div class="text-center">
          <p class="text-xs text-gray-500 mb-2">QR-Code Token:</p>
          <p class="text-xs font-mono break-all">${registration.qrCodeToken.substring(0, 32)}...</p>
          <p class="text-xs text-gray-400 mt-2">Verwenden Sie eine QR-Code-Bibliothek</p>
        </div>
      </div>
    `;
  }, [registration.qrCodeToken]);

  const startDate = new Date(eventStartDate);
  const endDate = eventEndDate ? new Date(eventEndDate) : null;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4">
          <Badge variant={getRegistrationStatusColor(registration.status)} className="text-sm">
            {getRegistrationStatusLabel(registration.status)}
          </Badge>
        </div>
        <CardTitle className="text-xl">{eventTitle}</CardTitle>
        <CardDescription>Event-Ticket</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex justify-center" ref={qrRef}>
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
            <QrCodeIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <Separator />

        {/* Participant Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">{registration.participantName}</p>
              <p className="text-sm text-muted-foreground">{registration.participantEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p>
              {registration.numberOfGuests}{' '}
              {registration.numberOfGuests === 1 ? 'Person' : 'Personen'}
            </p>
          </div>
        </div>

        <Separator />

        {/* Event Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p>
              {startDate.toLocaleDateString('de-CH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p>
              {startDate.toLocaleTimeString('de-CH', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {endDate && (
                <>
                  {' - '}
                  {endDate.toLocaleTimeString('de-CH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </p>
          </div>

          {eventLocation && (
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <p>{eventLocation}</p>
            </div>
          )}
        </div>

        {/* Special Requirements */}
        {registration.specialRequirements && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="font-medium mb-1">Besondere Anforderungen:</p>
              <p className="text-muted-foreground">{registration.specialRequirements}</p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Bitte zeigen Sie dieses Ticket beim Check-In vor.</p>
          <p className="mt-1">
            Ticket-ID: {registration.id.substring(0, 8).toUpperCase()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
