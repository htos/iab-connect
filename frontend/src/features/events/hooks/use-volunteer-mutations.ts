"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import {
  cancelVolunteerShift,
  createVolunteerRole,
  createVolunteerShift,
  signUpForVolunteerShift,
  updateVolunteerRole,
  updateVolunteerShift,
  withdrawFromVolunteerShift,
} from "../api/event-volunteers-api";
import type { CreateVolunteerShiftRequest } from "../types/events.types";

/**
 * Volunteer mutations (E24-S3): role create/update, shift create/update/cancel,
 * plus the member-facing self-signup/withdraw (for the section the orchestrator
 * repoints). Each mutation returns the raw `{ data, error, status }` client
 * result (it does NOT throw) so the component reproduces the god-page's
 * `res.data ? success : setError(saveFailed)` branching exactly.
 *
 * Invalidation reproduces the god-page `refreshKey` reload: a successful role
 * create invalidates the roles key; a successful shift create/update/cancel
 * invalidates the shifts key (and roles, since the roster groups by role) —
 * preserving the S1 "roster reloads after a successful mutation" outcome.
 */
export function useVolunteerMutations(eventId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const invalidateRoles = () =>
    queryClient.invalidateQueries({
      queryKey: eventsKeys.volunteerRoles(eventId),
    });
  const invalidateShifts = () => {
    queryClient.invalidateQueries({
      queryKey: eventsKeys.volunteerShifts(eventId),
    });
    queryClient.invalidateQueries({
      queryKey: eventsKeys.volunteerRoles(eventId),
    });
  };

  const createRole = useMutation({
    mutationFn: (request: { name: string; description?: string | null }) =>
      createVolunteerRole(api, eventId, request),
    onSuccess: (res) => {
      if (res.data) invalidateRoles();
    },
  });

  const updateRole = useMutation({
    mutationFn: ({
      roleId,
      request,
    }: {
      roleId: string;
      request: { name: string; description?: string | null; isActive: boolean };
    }) => updateVolunteerRole(api, eventId, roleId, request),
    onSuccess: (res) => {
      if (res.data) invalidateRoles();
    },
  });

  const createShift = useMutation({
    mutationFn: (request: CreateVolunteerShiftRequest) =>
      createVolunteerShift(api, eventId, request),
    onSuccess: (res) => {
      if (res.data) invalidateShifts();
    },
  });

  const updateShift = useMutation({
    mutationFn: ({
      shiftId,
      request,
    }: {
      shiftId: string;
      request: Omit<CreateVolunteerShiftRequest, "roleId">;
    }) => updateVolunteerShift(api, eventId, shiftId, request),
    onSuccess: (res) => {
      if (res.data) invalidateShifts();
    },
  });

  const cancelShift = useMutation({
    mutationFn: ({ shiftId, reason }: { shiftId: string; reason?: string }) =>
      cancelVolunteerShift(api, eventId, shiftId, reason),
    onSuccess: (res) => {
      if (res.data) invalidateShifts();
    },
  });

  const signUp = useMutation({
    mutationFn: ({
      shiftId,
      allowWaitlistFallback,
    }: {
      shiftId: string;
      allowWaitlistFallback?: boolean;
    }) => signUpForVolunteerShift(api, eventId, shiftId, allowWaitlistFallback),
    onSuccess: (res) => {
      if (res.data) invalidateShifts();
    },
  });

  const withdraw = useMutation({
    mutationFn: ({
      shiftId,
      assignmentId,
      reason,
    }: {
      shiftId: string;
      assignmentId: string;
      reason?: string;
    }) =>
      withdrawFromVolunteerShift(api, eventId, shiftId, assignmentId, reason),
    onSuccess: () => invalidateShifts(),
  });

  return {
    createRole,
    updateRole,
    createShift,
    updateShift,
    cancelShift,
    signUp,
    withdraw,
  };
}
