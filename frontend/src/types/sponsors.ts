export type SponsorStatus = "Prospect" | "Active" | "Paused" | "Ended";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export type ContractLinkType = "Document" | "Invoice" | "Event";

// === Sponsor ===

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

export interface PackageDto {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
}

export interface ContractLinkDto {
  id: string;
  linkType: ContractLinkType;
  targetId: string;
  description: string | null;
  createdAt: string;
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

// === Supplier ===
// Supplier-specific types moved to the suppliers feature slice (E21-S3):
// `@/features/suppliers/types/supplier.types`. Shared `ContractLink*` and the
// Sponsor types stay here. The supplier detail/new/edit pages import from the
// feature module.
