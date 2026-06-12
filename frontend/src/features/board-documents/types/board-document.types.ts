// Board-documents slice type surface (E29-S3).
//
// DEC-3 = A (re-export, the E23-S2 / E24-S2 / E29-S2 pattern): the canonical
// Document DTOs STAY in `@/lib/services/documents` — that module is the shared
// transport seam still consumed by the member-browse slice (E29-S2) and the
// admin document tooling (A62). The E21-S5 ESLint boundary forbids `lib`
// importing from `features`, so we do NOT relocate the definitions; this module
// RE-EXPORTS them as the slice's single import surface (`features -> lib` is
// legal). Slice files import document types from here, never reaching into
// `lib` directly. `DocumentStatus`/`DocumentCategory` are value enums (re-exported
// as values, not `type`-only) since the slice maps `doc.status` literals onto
// the `DocumentStatus` enum (AC-7, no behaviour change).
export { DocumentStatus, DocumentCategory } from "@/lib/services/documents";

export type {
  DocumentDto,
  DocumentDetailDto,
  DocumentVersionDto,
  DocumentFolderDto,
  PagedDocumentsResult,
} from "@/lib/services/documents";
