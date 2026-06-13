// Dashboard feature types (E30-S4) — REQ-050 dashboard KPI DTOs, relocated verbatim
// from the god-page `app/page.tsx`. The shape mirrors GET /api/v1/reports/dashboard.

export interface MemberTrendItem {
  month: string;
  newMembers: number;
  totalAtEndOfMonth: number;
}

export interface MemberKpis {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  inactiveMembers: number;
  suspendedMembers: number;
  newMembersInPeriod: number;
  monthlyTrend: MemberTrendItem[];
}

export interface EventCategoryBreakdown {
  category: string;
  count: number;
  totalRegistrations: number;
}

export interface EventKpis {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalRegistrations: number;
  totalParticipantsConfirmed: number;
  totalEventRevenue: number;
  byCategory: EventCategoryBreakdown[];
}

export interface FinanceKpis {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  outstandingInvoices: number;
  overdueInvoiceCount: number;
  overdueAmount: number;
  openInvoiceCount: number;
  pendingPayments: number;
  pendingPaymentCount: number;
  pendingExpenseClaims: number;
  pendingExpenseClaimCount: number;
  currentFiscalPeriod: string | null;
  currentPeriodStatus: string | null;
}

export interface DashboardOverview {
  members: MemberKpis;
  events: EventKpis;
  finance: FinanceKpis;
}
