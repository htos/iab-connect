'use client';

/**
 * REQ-020: Event Registration Component
 * Allows members and guests to register for events.
 */

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CalendarPlus,
  Users,
  Clock,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  type EventDto,
  type EventRegistrationDto,
  registerForEvent,
  registerForEventPublic,
  cancelEventRegistration,
  getRegistrationStatusLabel,
  getRegistrationStatusColor,
} from '@/lib/services/events';

interface EventRegistrationProps {
  event: EventDto;
  existingRegistration?: EventRegistrationDto | null;
  onRegistrationChange?: () => void;
}

export function EventRegistration({
  event,
  existingRegistration,
  onRegistrationChange,
}: EventRegistrationProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const { data: session } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for guest registration
  const [guestForm, setGuestForm] = useState({
    name: '',
    email: '',
    phone: '',
    numberOfGuests: 1,
    specialRequirements: '',
  });

  // Form state for member registration
  const [memberForm, setMemberForm] = useState({
    numberOfGuests: 1,
    specialRequirements: '',
  });

  const [cancelReason, setCancelReason] = useState('');

  const isRegistrationOpen = event.isRegistrationOpen;
  const isFull =
    event.maxParticipants !== null &&
    event.maxParticipants !== undefined &&
    event.maxParticipants > 0;
  const hasRegistration = existingRegistration && existingRegistration.isActive;

  const handleMemberRegistration = async () => {
    if (!session?.user) {
      setError(t('registration.pleaseLogin'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await registerForEvent(event.id, {
      numberOfGuests: memberForm.numberOfGuests,
      specialRequirements: memberForm.specialRequirements || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(
        result.data.isWaitlisted
          ? t('registration.waitlistSuccess', { position: result.data.waitlistPosition ?? 0 })
          : t('registration.successMessage')
      );
      setIsDialogOpen(false);
      onRegistrationChange?.();
    } else {
      setError(result.error || t('registration.registrationFailed'));
    }
  };

  const handleGuestRegistration = async () => {
    if (!guestForm.name || !guestForm.email) {
      setError(t('registration.nameEmailRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await registerForEventPublic(event.id, {
      name: guestForm.name,
      email: guestForm.email,
      phone: guestForm.phone || undefined,
      numberOfGuests: guestForm.numberOfGuests,
      specialRequirements: guestForm.specialRequirements || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(
        result.data.isWaitlisted
          ? t('registration.waitlistSuccess', { position: result.data.waitlistPosition ?? 0 })
          : t('registration.successWithEmail')
      );
      setIsDialogOpen(false);
      setGuestForm({
        name: '',
        email: '',
        phone: '',
        numberOfGuests: 1,
        specialRequirements: '',
      });
      onRegistrationChange?.();
    } else {
      setError(result.error || t('registration.registrationFailed'));
    }
  };

  const handleCancelRegistration = async () => {
    if (!existingRegistration) return;

    setIsSubmitting(true);
    setError(null);

    const result = await cancelEventRegistration(
      event.id,
      existingRegistration.id,
      cancelReason || undefined
    );

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(t('registration.cancelledMessage'));
      setIsCancelDialogOpen(false);
      setCancelReason('');
      onRegistrationChange?.();
    } else {
      setError(result.error || t('registration.cancelFailed'));
    }
  };

  // If event doesn't require registration
  if (!event.registrationRequired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('registration.participation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t('registration.noRegistrationRequired')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5" />
          {t('registration.registrationTitle')}
        </CardTitle>
        <CardDescription>
          {event.maxParticipants
            ? t('registration.maxParticipants', { count: event.maxParticipants })
            : t('registration.unlimitedParticipants')}
          {event.waitlistEnabled && ` • ${t('registration.waitlistEnabled')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success/Error Messages */}
        {success && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Existing Registration Status */}
        {hasRegistration && existingRegistration && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t('registration.yourRegistration')}</span>
              <Badge variant={getRegistrationStatusColor(existingRegistration.status)}>
                {getRegistrationStatusLabel(existingRegistration.status)}
              </Badge>
            </div>
            {existingRegistration.isWaitlisted && existingRegistration.waitlistPosition && (
              <p className="text-sm text-muted-foreground">
                {t('registration.waitlistPositionShort', { position: existingRegistration.waitlistPosition })}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {existingRegistration.numberOfGuests}{' '}
              {existingRegistration.numberOfGuests === 1 ? t('registration.person') : t('registration.persons')}
            </p>
            {existingRegistration.specialRequirements && (
              <p className="text-sm text-muted-foreground">
                {t('registration.requirements')}: {existingRegistration.specialRequirements}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-1" />
              {t('registration.registeredAt')}{' '}
              {new Date(existingRegistration.registeredAt).toLocaleDateString('de-CH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {/* Cancel Button */}
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full mt-2">
                  <X className="h-4 w-4 mr-2" />
                  {t('registration.cancelRegistration')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('registration.cancelRegistration')}</DialogTitle>
                  <DialogDescription>
                    {t('registration.confirmCancelForEvent', { eventTitle: event.title })}
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
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelDialogOpen(false)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelRegistration}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    {t('registration.cancel')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Registration Button/Form */}
        {!hasRegistration && (
          <>
            {!isRegistrationOpen ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {event.hasEnded
                    ? t('registration.eventEnded')
                    : event.registrationDeadline
                      ? t('registration.deadlineExpired')
                      : t('registration.notPossible')}
                </AlertDescription>
              </Alert>
            ) : (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    {t('registration.registerNow')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('registration.registerForEvent', { eventTitle: event.title })}</DialogTitle>
                    <DialogDescription>
                      {t('registration.fillFormToRegister')}
                    </DialogDescription>
                  </DialogHeader>

                  {session?.user ? (
                    // Member Registration Form
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="numberOfGuests">{t('registration.numberOfPersons')}</Label>
                        <Input
                          id="numberOfGuests"
                          type="number"
                          min={1}
                          max={20}
                          value={memberForm.numberOfGuests}
                          onChange={(e) =>
                            setMemberForm((prev) => ({
                              ...prev,
                              numberOfGuests: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('registration.includingAccompanying')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specialRequirements">
                          {t('registration.specialRequirementsOptional')}
                        </Label>
                        <Textarea
                          id="specialRequirements"
                          value={memberForm.specialRequirements}
                          onChange={(e) =>
                            setMemberForm((prev) => ({
                              ...prev,
                              specialRequirements: e.target.value,
                            }))
                          }
                          placeholder={t('registration.specialRequirementsPlaceholder')}
                        />
                      </div>
                    </div>
                  ) : (
                    // Guest Registration Form
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="guestName">{t('registration.nameRequired')}</Label>
                        <Input
                          id="guestName"
                          value={guestForm.name}
                          onChange={(e) =>
                            setGuestForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder={t('registration.namePlaceholder')}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guestEmail">{t('registration.emailRequired')}</Label>
                        <Input
                          id="guestEmail"
                          type="email"
                          value={guestForm.email}
                          onChange={(e) =>
                            setGuestForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          placeholder={t('registration.emailPlaceholder')}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guestPhone">{t('registration.phoneOptional')}</Label>
                        <Input
                          id="guestPhone"
                          type="tel"
                          value={guestForm.phone}
                          onChange={(e) =>
                            setGuestForm((prev) => ({ ...prev, phone: e.target.value }))
                          }
                          placeholder={t('registration.phonePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guestNumberOfGuests">{t('registration.numberOfPersons')}</Label>
                        <Input
                          id="guestNumberOfGuests"
                          type="number"
                          min={1}
                          max={20}
                          value={guestForm.numberOfGuests}
                          onChange={(e) =>
                            setGuestForm((prev) => ({
                              ...prev,
                              numberOfGuests: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guestSpecialRequirements">
                          {t('registration.specialRequirementsOptional')}
                        </Label>
                        <Textarea
                          id="guestSpecialRequirements"
                          value={guestForm.specialRequirements}
                          onChange={(e) =>
                            setGuestForm((prev) => ({
                              ...prev,
                              specialRequirements: e.target.value,
                            }))
                          }
                          placeholder={t('registration.specialRequirementsPlaceholder')}
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      onClick={
                        session?.user ? handleMemberRegistration : handleGuestRegistration
                      }
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      {t('registration.register')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
