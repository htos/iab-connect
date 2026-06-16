import { z } from "zod";
import { SegmentType } from "../types/member-segment.types";

/**
 * Segment new/edit form schema — the E22 RHF+Zod sub-recipe applied to Member
 * Segments (E23-S4). Behaviour-preserving (A79): only `name` was HTML5-`required`
 * on the god-pages, so only `name` gets `.min(1, "form.required")`; description /
 * color stay optional plain strings; NO new constraints are introduced. The
 * criteria builder (status/type/memberSince/city/country) is local form state in
 * `segment-form.tsx`, NOT part of this schema (it serialises to `criteriaJson`).
 * `segmentType` is in the schema (defaulted, valid enum) — rendered editable in
 * create mode, read-only in edit; `isActive` is edit-only.
 */
export const segmentFormSchema = z.object({
  name: z.string().trim().min(1, "form.required"),
  description: z.string(),
  segmentType: z.nativeEnum(SegmentType),
  color: z.string(),
  isActive: z.boolean(),
});

export type SegmentFormValues = z.infer<typeof segmentFormSchema>;
