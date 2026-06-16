import { LedgerAccountsContent } from "@/features/finance/components/ledger-accounts-content";

/**
 * Ledger Accounts route (E26-S2). Thin server entry → the slice composition root.
 */
export default function LedgerAccountsPage() {
  return <LedgerAccountsContent />;
}
