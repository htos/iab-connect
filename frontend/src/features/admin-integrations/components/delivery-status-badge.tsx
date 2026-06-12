import { Badge } from "@/components/ui/badge";

// DEC-2 (E27-S5, A77): the delivery status colour moves onto the shared Badge
// primitive. CRUCIALLY the badge TEXT stays the RAW server status string (NOT an
// i18n key) — pinned by S1 (`getByText("Delivered")`/`getByText("Failed")`). Mapping:
//   Delivered → default (success accent), Failed → destructive (red, A86),
//   anything else → secondary (the muted/gray equivalent of the god-page's gray text).
function variantFor(status: string): "default" | "secondary" | "destructive" {
  if (status === "Delivered") return "default";
  if (status === "Failed") return "destructive";
  return "secondary";
}

export function DeliveryStatusBadge({ status }: { status: string }) {
  return <Badge variant={variantFor(status)}>{status}</Badge>;
}
