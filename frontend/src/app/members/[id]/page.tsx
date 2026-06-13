/**
 * Member Detail Page - REQ-016: Mitgliederprofil
 *
 * Thin server entry (E23-S2): the feature-slice refactor moved all behaviour
 * into the `MemberDetail` client composition root
 * (`src/features/members/components/member-detail.tsx`), the single `"use client"`
 * boundary for this route. This file is a server component that just renders it.
 */

import { MemberDetail } from "@/features/members/components/member-detail";

export default function MemberDetailPage() {
  return <MemberDetail />;
}
