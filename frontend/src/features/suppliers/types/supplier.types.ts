// Supplier-specific types for the suppliers feature slice (E21-S3 pilot).
// Shared cross-domain types (ContractLink*, Sponsor*) deliberately stay in
// `@/types/sponsors` to avoid a Sponsors ripple (Gate-1 §7 + risk row).
import type { ContractLinkDto, ContractLinkType } from "@/types/sponsors";

export type SupplierStatus = "Prospect" | "Active" | "Paused" | "Ended";

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

// Inline contract-link CRUD payload on the supplier detail page (E22-S4).
export interface AddLinkRequest {
  linkType: ContractLinkType;
  targetId: string;
  description: string | null;
}
