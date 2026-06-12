// Profile slice type surface (E29-S4, DEC-3 = A).
//
// The E21-S5 ESLint boundary forbids `lib` importing from `features`, and the
// canonical DTOs still live in (and are consumed from) `@/lib/api/members`,
// `@/lib/api/privacy`, and `@/lib/api/users` — those modules are shared by other
// surfaces (admin members, privacy, the users/admin sessions views). So the
// canonical definitions STAY in `lib` and this module RE-EXPORTS them as the
// slice's single import surface (`features -> lib` is legal — the E23-S2/E24-S2
// re-export precedent). Slice components import profile types from here, never
// reaching into `lib` directly (AC-6 rule 5 / AC-10).
export type { MemberDto, UpdateOwnProfileRequest } from "@/lib/api/members";
export type { ConsentDto, ChannelPreferenceDto } from "@/lib/api/privacy";
export type { UserSession, SessionListResponse } from "@/lib/api/users";
