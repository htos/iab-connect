// Members slice type surface (E23-S2).
//
// AC-8 asks for the Member DTOs/enums to live in the slice. The E21-S5 ESLint
// boundary forbids `lib` importing from `features`, yet the canonical
// definitions in `lib/api/members.ts` are still consumed there (the retained
// duplicate fns — S3), by `lib/api/member-segments.ts` (S4), and by the
// out-of-scope `app/profile` page. So the canonical definitions STAY in
// `lib/api/members.ts` and this module RE-EXPORTS them as the slice's single
// import surface (`features -> lib` is legal). Slice components import member
// types from here, never reaching into `lib` directly — satisfying AC-6 rule 5
// and AC-8's no-breakage intent while respecting the boundary. This is the
// documented S2-DEC-5 inversion of AC-8's literal "move into features".
export { MembershipType, MembershipStatus } from "@/lib/api/members";
export type {
  MemberDto,
  MemberStatisticsDto,
  CreateMemberRequest,
  UpdateMemberRequest,
  GetMembersParams,
  PagedResponse,
} from "@/lib/api/members";
