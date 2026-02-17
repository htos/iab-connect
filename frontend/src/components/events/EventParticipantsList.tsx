'use client';

/**
 * REQ-020: Event Participants List Component
 * Admin view for managing event registrations.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  UserX,
  Search,
  Download,
  RefreshCw,
  QrCode,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  type EventDto,
  type EventRegistrationDto,
  type EventRegistrationStatistics,
  type RegistrationStatus,
  getEventRegistrations,
  getEventRegistrationStatistics,
  confirmEventRegistration,
  cancelEventRegistration,
  checkInRegistration,
  markRegistrationAsNoShow,
  promoteFromWaitlist,
  getRegistrationStatusLabel,
  getRegistrationStatusColor,
} from '@/lib/services/events';

interface EventParticipantsListProps {
  event: EventDto;
}

export function EventParticipantsList({ event }: EventParticipantsListProps) {
  const [registrations, setRegistrations] = useState<EventRegistrationDto[]>([]);
  const [statistics, setStatistics] = useState<EventRegistrationStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [registrationsResult, statsResult] = await Promise.all([
      getEventRegistrations(event.id, {
        status: statusFilter !== 'all' ? (statusFilter as RegistrationStatus) : undefined,
        searchTerm: searchQuery || undefined,
        pageSize: 100,
      }),
      getEventRegistrationStatistics(event.id),
    ]);

    if (registrationsResult.success) {
      setRegistrations(registrationsResult.data.items);
    } else {
      setError(registrationsResult.error || 'Fehler beim Laden der Anmeldungen.');
    }

    if (statsResult.success) {
      setStatistics(statsResult.data);
    }

    setIsLoading(false);
  }, [event.id, statusFilter, searchQuery]);

  const refreshData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    loadData();
  }, [loadData]);

  useEffect(() => {
    Promise.all([
      getEventRegistrations(event.id, {
        status: statusFilter !== 'all' ? (statusFilter as RegistrationStatus) : undefined,
        searchTerm: searchQuery || undefined,
        pageSize: 100,
      }),
      getEventRegistrationStatistics(event.id),
    ]).then(([registrationsResult, statsResult]) => {
      if (registrationsResult.success) {
        setRegistrations(registrationsResult.data.items);
      } else {
        setError(registrationsResult.error || 'Fehler beim Laden der Anmeldungen.');
      }

      if (statsResult.success) {
        setStatistics(statsResult.data);
      }

      setIsLoading(false);
    });
  }, [event.id, statusFilter, searchQuery]);

  const handleAction = async (
    registrationId: string,
    action: 'confirm' | 'cancel' | 'checkin' | 'noshow' | 'promote'
  ) => {
    setActionLoading(registrationId);
    setError(null);

    let result;
    switch (action) {
      case 'confirm':
        result = await confirmEventRegistration(event.id, registrationId);
        break;
      case 'cancel':
        result = await cancelEventRegistration(event.id, registrationId, 'Administrativ storniert');
        break;
      case 'checkin':
        result = await checkInRegistration(event.id, registrationId);
        break;
      case 'noshow':
        result = await markRegistrationAsNoShow(event.id, registrationId);
        break;
      case 'promote':
        result = await promoteFromWaitlist(event.id);
        break;
    }

    setActionLoading(null);

    if (result.success) {
      refreshData();
    } else {
      setError(result.error || 'Aktion fehlgeschlagen.');
    }
  };

  const exportParticipants = () => {
    const headers = ['Name', 'E-Mail', 'Telefon', 'Personen', 'Status', 'Angemeldet am'];
    const csvContent = [
      headers.join(','),
      ...registrations.map((r) =>
        [
          `"${r.participantName || '-'}"`,
          `"${r.participantEmail || '-'}"`,
          `"${r.participantPhone || '-'}"`,
          r.numberOfGuests,
          getRegistrationStatusLabel(r.status),
          new Date(r.registeredAt).toLocaleString('de-CH'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `teilnehmer_${event.id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teilnehmer
            </CardTitle>
            <CardDescription>
              Verwaltung der Event-Anmeldungen
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
            <Button variant="outline" size="sm" onClick={exportParticipants}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{statistics.totalRegistrations}</p>
              <p className="text-xs text-muted-foreground">Anmeldungen</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {statistics.confirmedCount}
              </p>
              <p className="text-xs text-muted-foreground">Bestaetigt</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {statistics.checkedInCount}
              </p>
              <p className="text-xs text-muted-foreground">Eingecheckt</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {statistics.waitlistedCount}
              </p>
              <p className="text-xs text-muted-foreground">Warteliste</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{statistics.totalParticipants}</p>
              <p className="text-xs text-muted-foreground">Personen gesamt</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen nach Name oder E-Mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="Pending">Ausstehend</SelectItem>
              <SelectItem value="Confirmed">Bestaetigt</SelectItem>
              <SelectItem value="CheckedIn">Eingecheckt</SelectItem>
              <SelectItem value="Waitlisted">Warteliste</SelectItem>
              <SelectItem value="Cancelled">Storniert</SelectItem>
              <SelectItem value="NoShow">No-Show</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Anmeldungen gefunden.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teilnehmer</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead className="text-center">Personen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Angemeldet</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{registration.participantName || '-'}</p>
                        {registration.userId && (
                          <p className="text-xs text-muted-foreground">Mitglied</p>
                        )}
                        {registration.isWaitlisted && registration.waitlistPosition && (
                          <p className="text-xs text-yellow-600">
                            Warteliste #{registration.waitlistPosition}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{registration.participantEmail || '-'}</p>
                        {registration.participantPhone && (
                          <p className="text-muted-foreground">
                            {registration.participantPhone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{registration.numberOfGuests}</TableCell>
                    <TableCell>
                      <Badge variant={getRegistrationStatusColor(registration.status)}>
                        {getRegistrationStatusLabel(registration.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>
                          {new Date(registration.registeredAt).toLocaleDateString('de-CH')}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(registration.registeredAt).toLocaleTimeString('de-CH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === registration.id}
                          >
                            {actionLoading === registration.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {registration.status === 'Pending' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(registration.id, 'confirm')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Bestaetigen
                            </DropdownMenuItem>
                          )}
                          {registration.status === 'Confirmed' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(registration.id, 'checkin')}
                            >
                              <QrCode className="h-4 w-4 mr-2 text-blue-600" />
                              Einchecken
                            </DropdownMenuItem>
                          )}
                          {registration.status === 'Waitlisted' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(registration.id, 'promote')}
                            >
                              <Clock className="h-4 w-4 mr-2 text-yellow-600" />
                              Von Warteliste befoerdern
                            </DropdownMenuItem>
                          )}
                          {registration.status === 'Confirmed' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(registration.id, 'noshow')}
                            >
                              <UserX className="h-4 w-4 mr-2 text-orange-600" />
                              Als No-Show markieren
                            </DropdownMenuItem>
                          )}
                          {registration.isActive && (
                            <DropdownMenuItem
                              onClick={() => handleAction(registration.id, 'cancel')}
                              className="text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Stornieren
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
