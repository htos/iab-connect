import { FiscalPeriodsContent } from "@/features/finance/components/fiscal-periods-content";

/**
 * Fiscal Periods route (E26-S2). Thin server entry → the slice composition root. REQ-066.
 */
export default function FiscalPeriodsPage() {
  return <FiscalPeriodsContent />;
}
