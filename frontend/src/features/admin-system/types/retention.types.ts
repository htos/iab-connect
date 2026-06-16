// Retention resource types (E27-S4). Re-exported from the WRAPped transport
// (`retention`) so the slice stays decoupled from the raw lib path.
export type {
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "../api/retention";
