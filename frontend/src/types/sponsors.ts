// Shared cross-domain contract-link types.
//
// `ContractLinkType` + `ContractLinkDto` deliberately stay in this module: they
// are imported by BOTH the sponsors feature slice
// (`@/features/sponsors/types/sponsor.types`) and the suppliers feature slice
// (`@/features/suppliers/types/supplier.types`). Keeping them here avoids a
// cross-feature import (suppliers → sponsors) and the ripple that would cause.
//
// Sponsor-specific types (SponsorStatus, SponsorTier, SponsorListDto,
// SponsorDetailDto, PackageDto, CreateSponsorRequest, UpdateSponsorRequest) moved
// to the sponsors feature slice in E22-S2 (mirroring the E21-S3 suppliers split).

export type ContractLinkType = "Document" | "Invoice" | "Event";

export interface ContractLinkDto {
  id: string;
  linkType: ContractLinkType;
  targetId: string;
  description: string | null;
  createdAt: string;
}
