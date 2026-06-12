// Admin-users slice type surface (E27-S2, DEC-2 = A).
//
// The canonical user DTOs/interfaces live in `lib/api/users.ts` (a token-param
// raw-fetch module). That module is ALSO consumed by the self-service profile
// security page (`getMySessions`/`revokeMySession`) and the wrapped transport
// here, so the definitions STAY in `lib` and this module RE-EXPORTS them as the
// slice's single import surface (`features -> lib` is legal under the E21-S5
// boundary; `lib -> features` is not). Slice components/hooks import user types
// from here, never reaching into `@/lib` directly. This mirrors
// `features/members/types/member.types.ts` (DEC-2/A83).
export type {
  User,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  Role,
  UserSession,
  SessionListResponse,
} from "@/lib/api/users";
