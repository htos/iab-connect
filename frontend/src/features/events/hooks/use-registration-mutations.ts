"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import {
  cancelEventRegistration,
  checkInRegistration,
  confirmEventRegistration,
  markRegistrationAsNoShow,
  promoteFromWaitlist,
  registerForEvent,
  revertRegistrationCancellation,
  revertRegistrationCheckIn,
  revertRegistrationNoShow,
} from "../api/event-registrations-api";
import type { RegisterMemberRequest } from "../types/events.types";

/**
 * Registration mutations (E24-S3): the per-status manager actions
 * (confirm / check-in / no-show / revert-* / cancel), waitlist promote, and the
 * member register flow. Each throws on API error so the caller can surface the
 * error banner (the god-page error behaviour). On success every mutation
 * invalidates this event's registration list + statistics (and, for waitlist-
 * affecting actions, the waitlist), so the page refetches — preserving the
 * god-page's "after an action, reload the data" semantics.
 */
export function useRegistrationMutations(eventId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: eventsKeys.registrations(eventId),
    });
    queryClient.invalidateQueries({
      queryKey: eventsKeys.registrationStatistics(eventId),
    });
    queryClient.invalidateQueries({ queryKey: eventsKeys.waitlist(eventId) });
  };

  const run =
    (
      fn: (
        c: ReturnType<typeof useApiClient>,
        eventId: string,
        registrationId: string
      ) => Promise<{ data: unknown; error: string | null }>
    ) =>
    async (registrationId: string) => {
      const result = await fn(api, eventId, registrationId);
      if (result.error) throw new Error(result.error);
      return result.data;
    };

  const confirm = useMutation({
    mutationFn: run(confirmEventRegistration),
    onSuccess: invalidate,
  });
  const checkIn = useMutation({
    mutationFn: run(checkInRegistration),
    onSuccess: invalidate,
  });
  const noShow = useMutation({
    mutationFn: run(markRegistrationAsNoShow),
    onSuccess: invalidate,
  });
  const revertNoShow = useMutation({
    mutationFn: run(revertRegistrationNoShow),
    onSuccess: invalidate,
  });
  const revertCheckIn = useMutation({
    mutationFn: run(revertRegistrationCheckIn),
    onSuccess: invalidate,
  });
  const revertCancellation = useMutation({
    mutationFn: run(revertRegistrationCancellation),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (vars: { registrationId: string; reason?: string }) => {
      const result = await cancelEventRegistration(
        api,
        eventId,
        vars.registrationId,
        vars.reason
      );
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const promote = useMutation({
    mutationFn: async () => {
      const result = await promoteFromWaitlist(api, eventId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const register = useMutation({
    mutationFn: async (request: RegisterMemberRequest = {}) => {
      const result = await registerForEvent(api, eventId, request);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: eventsKeys.myRegistrations() });
    },
  });

  return {
    confirm,
    checkIn,
    noShow,
    revertNoShow,
    revertCheckIn,
    revertCancellation,
    cancel,
    promote,
    register,
  };
}
