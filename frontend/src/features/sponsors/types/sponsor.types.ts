// Sponsor-specific types for the sponsors feature slice (E22-S2).
// Mirrors the E21-S3 type-split pattern: the shared cross-domain `ContractLink*`
// types deliberately stay in `@/types/sponsors` (still imported by the suppliers
// slice), so only the Sponsor-specific types live here.
import type { ContractLinkDto, ContractLinkType } from "@/types/sponsors";

export type SponsorStatus = "Prospect" | "Active" | "Paused" | "Ended";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface SponsorListDto {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  status: SponsorStatus;
  tier: SponsorTier;
  agreementStart: string | null;
  agreementEnd: string | null;
  packageCount: number;
  linkCount: number;
}

export interface PackageDto {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
}

export interface SponsorDetailDto {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  status: SponsorStatus;
  tier: SponsorTier;
  notes: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
  packages: PackageDto[];
  contractLinks: ContractLinkDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateSponsorRequest {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  tier: SponsorTier;
  notes?: string;
  agreementStart?: string;
  agreementEnd?: string;
}

export interface UpdateSponsorRequest {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  tier: SponsorTier;
  notes?: string;
  agreementStart?: string;
  agreementEnd?: string;
}

// Inline package/contract-link CRUD payloads on the detail page (E22-S3).
export interface AddPackageRequest {
  name: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
}

export interface AddLinkRequest {
  linkType: ContractLinkType;
  targetId: string;
  description: string | null;
}
