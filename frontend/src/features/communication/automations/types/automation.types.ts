// Automations feature types (E25-S2, DEC-3 = re-export). The DTOs/enums already
// live in the wrapped transport `@/lib/api/automations`; per the E23/E29
// re-export pattern (a `features → lib` import is boundary-legal) we surface them
// from the slice so feature code never reaches across to `@/lib/api/automations`
// for a type. Components/hooks import from here.
export type {
  AutomationStatus,
  AutomationTriggerType,
  ConsentType,
  AutomationExecutionStatus,
  AutomationTriggerDto,
  AutomationListItemDto,
  AutomationDetailDto,
  AutomationExecutionDto,
  RecipientSampleDto,
  RecipientPreviewDto,
  AutomationWriteRequest,
  PreviewRequest,
  RecipientSegmentType,
  PagedResponse,
} from "@/lib/api/automations";

// A member segment as surfaced by the form's segment dropdown (folded from the
// god-page's inline `?pageSize=100` fetch — see `fetchMemberSegments`).
export interface MemberSegmentOption {
  id: string;
  name: string;
}
