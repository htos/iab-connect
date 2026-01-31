'use client';

/**
 * REQ-020: My Registrations Component
 * Shows a user's event registrations.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar,
  MapPin,
  Clock,
  QrCode,
  X,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  type EventRegistrationDto,
  getMyRegistrations,
  cancelEventRegistration,
  getRegistrationStatusLabel,
  getRegistrationStatusColor,
} from '@/lib/services/events';

interface MyRegistrationsProps {
  showUpcomingOnly?: boolean;
  limit?: number;
}

export function MyRegistrations({ showUpcomingOnly = true, limit }: MyRegistrationsProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const [registrations, setRegistrations] = useState<EventRegistrationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistrationDto | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadRegistrations = async () => {
    setIsLoading(true);
    setError(null);

    const result = await getMyRegistrations();

    if (result.success) {
      // Filter on client side since API doesn't support filtering
      let data = result.data;
      if (showUpcomingOnly) {
        const now = new Date();
        data = data.filter((r) => {
          if (r.eventStartDate) {
            return new Date(r.eventStartDate) >= now;
          }
          return true;
        });
      }
      if (limit) {
        data = data.slice(0, limit);
      }
      setRegistrations(data);
    } else {
      setError(result.error || t('registration.loadFailed'));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadRegistrations();
  }, [showUpcomingOnly, limit]);

  const handleCancelClick = (registration: EventRegistrationDto) => {
    setSelectedRegistration(registration);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedRegistration) return;

    setCancellingId(selectedRegistration.id);
    setError(null);

    const result = await cancelEventRegistration(
      selectedRegistration.eventId,
      selectedRegistration.id,
      cancelReason || undefined
    );

    setCancellingId(null);
    setCancelDialogOpen(false);

    if (result.success) {
      loadRegistrations();
    } else {
      setError(result.error || t('registration.cancelFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (registrations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {showUpcomingOnly
              ? t('registration.noUpcomingRegistrations')
              : t('registration.noRegistrations')}
          </p>
          <Button asChild className="mt-4">
            <Link href="/events">{t('registration.discoverEvents')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {registrations.map((registration) => (
        <Card key={registration.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  <Link
                    href={`/events/${registration.eventId}`}
                    className="hover:underline"
                  >
                    {registration.eventTitle || 'Event'}
                    <ExternalLink className="inline h-4 w-4 ml-1 opacity-50" />
                  </Link>
                </CardTitle>
                <CardDescription>
                  {registration.numberOfGuests}{' '}
                  {registration.numberOfGuests === 1 ? t('registration.person') : t('registration.persons')}
                </CardDescription>
              </div>
              <Badge variant={getRegistrationStatusColor(registration.status)}>
                {getRegistrationStatusLabel(registration.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Details */}
            {(registration.eventStartDate || registration.eventLocation) && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {registration.eventStartDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(registration.eventStartDate).toLocaleDateString('de-CH', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                )}
                {registration.eventStartDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(registration.eventStartDate).toLocaleTimeString('de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {registration.eventLocation && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {registration.eventLocation}
                  </div>
                )}
              </div>
            )}

            {/* Waitlist Info */}
            {registration.isWaitlisted && registration.waitlistPosition && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  {t('registration.waitlistPosition', { position: registration.waitlistPosition })}
                </AlertDescription>
              </Alert>
            )}

            {/* Special Requirements */}
            {registration.specialRequirements && (
              <p className="text-sm text-muted-foreground">
                <strong>{t('registration.specialRequirements')}:</strong> {registration.specialRequirements}
              </p>
            )}

            {/* QR Code & Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {t('registration.registeredAt')}{' '}
                {new Date(registration.registeredAt).toLocaleDateString('de-CH', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-2">
                {registration.qrCodeToken && registration.isActive && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/events/${registration.eventId}/ticket/${registration.qrCodeToken}`}>
                      <QrCode className="h-4 w-4 mr-2" />
                      {t('registration.ticket')}
                    </Link>
                  </Button>
                )}
                {registration.isActive && (
                  <Dialog open={cancelDialogOpen && selectedRegistration?.id === registration.id} onOpenChange={(open) => {
                    if (!open) setCancelDialogOpen(false);
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(registration)}
                        disabled={cancellingId === registration.id}
                      >
                        {cancellingId === registration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            {t('registration.cancel')}
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('registration.cancelRegistration')}</DialogTitle>
                        <DialogDescription>
                          {t('registration.confirmCancelDescription')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="cancelReason">{t('registration.cancelReason')}</Label>
                          <Textarea
                            id="cancelReason"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder={t('registration.cancelReasonPlaceholder')}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                          {tCommon('cancel')}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleCancelConfirm}
                          disabled={cancellingId !== null}
                        >
                          {cancellingId !== null ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <X className="h-4 w-4 mr-2" />
                          )}
                          {t('registration.cancel')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {limit && registrations.length >= limit && (
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/events/my-registrations">{t('registration.showAllRegistrations')}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
