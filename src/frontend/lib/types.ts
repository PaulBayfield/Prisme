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

export interface PredictedCategory extends AssignedCategory {
  confidence: number;
}

// Fixed set of built-in features a user can wire their own categories into
// (see category_use_cases in schema.sql) - not user-editable, unlike
// category names themselves.
export type CategoryUseCase = "income_forecast" | "income_exclude" | "savings";

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
  // Worker-computed, not-yet-resolved category suggestions
  // (src/worker/categorizer.py) - a transaction can have several at once,
  // genuinely multi-label, not "pick one". Consumed (removed from here) the
  // moment one is accepted or rejected, so this is only ever the *pending*
  // set, never a permanent record of what the AI once suggested.
  predictedCategories: PredictedCategory[];
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  color: string | null;
  effectiveColor: string;
}

export type TransactionType = "all" | "income" | "expense";

export interface TransactionFilters {
  categoryIds: number[];
  type: TransactionType;
  accountIds: string[];
  amountMin: number | null;
  amountMax: number | null;
  search: string;
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

export type SavingsGoalPeriod = "once" | "monthly" | "yearly";

// "manual": value comes from manual snapshots in savings_goal_values (period
// is always "once"). "category": a recurring target against categoryId
// (period is "monthly"/"yearly"). "account": tied to accountInternalId's
// current balance, a level rather than a flow, so period is always "once".
export type SavingsGoalSource = "manual" | "category" | "account";

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  notes: string | null;
  period: SavingsGoalPeriod;
  source: SavingsGoalSource;
  // Only set when source is "category" - the category whose categorized
  // transactions (this one plus descendants) count toward the current
  // period's progress.
  categoryId: number | null;
  categoryName: string | null;
  // Only set when source is "account" - the account whose current balance
  // is this goal's progress.
  accountInternalId: string | null;
  accountLabel: string | null;
  // "manual": latest manual snapshot from savings_goal_values.
  // "category": live-computed total for the current period - never stored.
  // "account": that account's current balance - never stored.
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export interface SavingsGoalValuePoint {
  savingsGoalId: number;
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
  id: number;
  status: "pending" | "running" | "success" | "error";
  error: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
