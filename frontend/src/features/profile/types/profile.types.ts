// Profile slice type surface. The shared DTOs were relocated out of `@/lib` in
// E31-S1: the member DTOs → `@/types/members` (DEC-2), the Keycloak-session types
// → `@/types/identity` (DEC-2), and the consent/channel DTOs into this slice's own
// `api/privacy-consent.ts` transport. This module re-exports them as the slice's
// single import surface; slice components import profile types from here.
export type { MemberDto, UpdateOwnProfileRequest } from "@/types/members";
export type { ConsentDto, ChannelPreferenceDto } from "../api/privacy-consent";
export type { UserSession, SessionListResponse } from "@/types/identity";
