// Documents slice type surface (E29-S2).
//
// DEC-3 (type home = MEMBERS/EVENTS re-export pattern): the canonical Document
// DTOs STAY in `documents` — that module is the shared transport
// seam still consumed by the board page (E29-S3) and the admin document tooling.
// The E21-S5 ESLint boundary forbids `lib` importing from `features`, so we do
// NOT relocate the definitions; this module RE-EXPORTS them as the slice's
// single import surface (`features -> lib` is legal). Slice files import
// document types from here, never reaching into `lib` directly.
export type {
  DocumentDto,
  DocumentFolderDto,
  PagedDocumentsResult,
} from "@/types/documents";
