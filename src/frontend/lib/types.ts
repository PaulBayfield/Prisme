export type AccountType = "current" | "saving";

export interface Account {
  internalId: string;
  label: string;
  shortLabel: string;
  type: AccountType;
  iban: string;
  amount: number;
  amountCurrency: string;
  userRole: string;
  holderLabel: string;
  bankCode: string;
  agencyCode: string;
  productType: string;
  accountCreationDate: string;
  bankLabel: string | null;
  status: string | null;
}

export interface AccountBalancePoint {
  accountInternalId: string;
  amount: number;
  amountCurrency: string;
  capturedAt: string;
}

export interface AssignedCategory {
  id: number;
  name: string;
  color: string;
}

export interface Transaction {
  rowId: number;
  id: string;
  accountInternalId: string;
  label: string;
  bookingDateTime: string;
  valueDateTime: string | null;
  amount: number;
  amountCurrency: string;
  isAccounted: boolean;
  movementCodeType: string;
  nature: string;
  categories: AssignedCategory[];
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  color: string | null;
  effectiveColor: string;
}

export interface PendingTransaction {
  id: string;
  accountInternalId: string;
  label: string;
  bookingDateTime: string;
  amount: number;
  amountCurrency: string;
  nature: string;
}

export interface CategorySpendingSlice {
  name: string;
  color: string;
  amount: number;
}

export interface SankeyNodeDatum {
  name: string;
  color: string;
  /** Where the label should be anchored: "leaf" nodes sit at the deepest
   * level and would overflow the chart if labeled like the rest. */
  kind: "source" | "root" | "leaf";
}

export interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

export interface Asset {
  id: number;
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface AssetValuePoint {
  assetId: number;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface Debt {
  id: number;
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface DebtValuePoint {
  debtId: number;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface CashValuePoint {
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface Budget {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  amount: number;
  spent: number;
}

export interface IncomePrediction {
  periodMonth: string;
  predictedAmount: number;
  actualSoFar: number;
  expectedSoFar: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface SyncStatus {
  status: "pending" | "running" | "success" | "error";
  error: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
