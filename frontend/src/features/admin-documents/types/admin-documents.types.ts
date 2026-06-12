// Admin-documents slice type surface (E27-S6).
//
// A83 / DEC-1=A (re-export, do NOT relocate): the canonical folder/permission
// DTOs STAY in `@/lib/services/documents` — that module is the SHARED transport
// seam consumed by the member `features/documents` slice (A62). The E21-S5
// ESLint boundary forbids `lib` importing from `features`, and a `features ->
// features` import is also forbidden, so we do NOT move the definitions here;
// this module RE-EXPORTS them as the slice's single import surface
// (`features -> lib` is legal). Slice files import these types from here, never
// reaching into `lib` directly.
export type {
  DocumentFolderDto,
  FolderPermissionDto,
  CreateFolderRequest,
  UpdateFolderRequest,
  SetFolderPermissionsRequest,
  PermissionEntry,
} from "@/lib/services/documents";

export {
  DocumentAccessRole,
  DocumentPermissionType,
} from "@/lib/services/documents";

// Register (public signup) types — A83: `features -> lib` re-export of the
// public raw-fetch transport's request/response/error shapes.
export type {
  RegisterRequest,
  RegisterResponse,
  ApiError as RegistrationApiError,
} from "@/lib/api/registration";
