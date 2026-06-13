// Events slice type surface (E24-S2).
//
// DEC-3 (type home = MEMBERS pattern): the canonical Event DTOs/enums STAY in
// `../api/events-transport` (still consumed there by the registration/roster/fee/
// volunteer functions S3 owns, plus public pages and other out-of-scope code).
// The E21-S5 ESLint boundary forbids `lib` importing from `features`, so we do
// NOT move the definitions; this module RE-EXPORTS them as the slice's single
// import surface (`features -> lib` is legal). Slice components import event
// types from here, never reaching into `lib` directly.
export {
  EventVisibility,
  EventStatus,
  EventCategory,
  RecurrencePattern,
} from "../api/events-transport";
export type {
  EventDto,
  EventStatistics,
  EventFilterOptions,
  CreateEventRequest,
  UpdateEventRequest,
} from "../api/events-transport";

// Shared pagination shape. The list god-page consumes a server `PagedResponse<T>`
// ({ items, page, pageSize, totalCount, totalPages }); `PagedResult<T>` in
// `@/types/common` is the canonical superset (adds hasNextPage/hasPreviousPage).
export type { PagedResult, PagedResult as PagedResponse } from "@/types/common";

// --- E24-S3 sub-page DTOs (registrations / check-in / volunteers / fees) ---
// Same DEC-3 re-export pattern: canonical defs stay in `../api/events-transport`;
// the slice imports them from here only.

// Registrations
export type {
  EventRegistrationDto,
  EventRegistrationStatistics,
  RegistrationStatus,
  PaymentStatus,
  PagedRegistrationResult,
  RegisterMemberRequest,
  UpdateRegistrationRequest,
} from "../api/events-transport";

// Check-in / roster
export type {
  CheckInResultDto,
  CheckInOutcome,
  CheckInConflictReason,
  EventCheckInRosterDto,
  EventCheckInRosterItemDto,
} from "../api/events-transport";

// Volunteers
export type {
  EventVolunteerRoleDto,
  EventVolunteerShiftDto,
  EventVolunteerAssignmentDto,
  CreateVolunteerShiftRequest,
  VolunteerAssignmentStatus,
} from "../api/events-transport";

// Fees (FEE_CURRENCIES is a runtime const → value re-export)
export { FEE_CURRENCIES } from "../api/events-transport";
export type {
  EventFeeCategoryDto,
  SaveFeeCategoryRequest,
  FeeApplicability,
  FeeCurrency,
} from "../api/events-transport";
