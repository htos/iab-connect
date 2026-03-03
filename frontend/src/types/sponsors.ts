export type SponsorStatus = "Prospect" | "Active" | "Paused" | "Ended";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export type SupplierStatus = "Prospect" | "Active" | "Paused" | "Ended";

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

export interface SupplierListDto {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  status: SupplierStatus;
  category: string | null;
  linkCount: number;
}

export interface SupplierDetailDto {
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
  status: SupplierStatus;
  category: string | null;
  notes: string | null;
  contractLinks: ContractLinkDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateSupplierRequest {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  notes?: string;
}

export interface UpdateSupplierRequest {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  notes?: string;
}
