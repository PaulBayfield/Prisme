import "server-only";

import type {
  Account,
  AccountBalancePoint,
  AssignedCategory,
  CashValuePoint,
  CategoryUseCase,
  PendingTransaction,
  PredictedCategory,
  SyncStatus,
  Transaction,
} from "../types";

// Deterministic PRNG (mulberry32) so the demo dataset's shape is stable
// across server restarts - only user mutations (in-memory, see the other
// exported arrays below) are meant to reset when the process restarts, not
// the base dataset itself.
function mulberry32(seed: number) {
  let state = seed;
  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x50722026);
const randInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const randAmount = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;
const pick = <T>(items: T[]): T => items[randInt(0, items.length - 1)];

const now = new Date();

function dateAt(yearsBack: number, monthsBack: number, day: number, hour = 12, minute = 0): Date {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, day, hour, minute);
  d.setFullYear(d.getFullYear() - yearsBack);
  return d;
}

function daysInMonth(monthsBack: number): number {
  return new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0).getDate();
}

// Demo persona: a multi-millionaire with a high income, large cash/savings
// reserves, a real-estate + investment portfolio, and a much higher volume
// of everyday transactions across every account - meant to exercise chart
// rendering, list pagination/virtualization, and large-number formatting,
// not to be a "typical" household budget.
const HISTORY_MONTHS = 24;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CategoryDef {
  id: number;
  parentId: number | null;
  name: string;
  color: string | null;
}

export const categoryDefs: CategoryDef[] = [
  { id: 1, parentId: null, name: "Revenus", color: "#22c55e" },
  { id: 2, parentId: 1, name: "Salaire", color: null },
  { id: 3, parentId: 1, name: "Remboursements", color: null },
  { id: 22, parentId: 1, name: "Dividendes", color: null },
  { id: 23, parentId: 1, name: "Loyers perçus", color: null },
  { id: 4, parentId: null, name: "Logement", color: "#f97316" },
  { id: 5, parentId: 4, name: "Loyer", color: null },
  { id: 6, parentId: 4, name: "Charges", color: null },
  { id: 7, parentId: null, name: "Alimentation", color: "#eab308" },
  { id: 8, parentId: 7, name: "Courses", color: null },
  { id: 9, parentId: 7, name: "Restaurants", color: null },
  { id: 10, parentId: null, name: "Transport", color: "#3b82f6" },
  { id: 11, parentId: 10, name: "Essence", color: null },
  { id: 12, parentId: 10, name: "Transports en commun", color: null },
  { id: 13, parentId: null, name: "Loisirs", color: "#ec4899" },
  { id: 14, parentId: 13, name: "Sorties", color: null },
  { id: 15, parentId: 13, name: "Voyages", color: null },
  { id: 16, parentId: null, name: "Abonnements", color: "#8b5cf6" },
  { id: 17, parentId: 16, name: "Streaming", color: null },
  { id: 18, parentId: 16, name: "Téléphone / Internet", color: null },
  { id: 19, parentId: null, name: "Santé", color: "#14b8a6" },
  { id: 20, parentId: 19, name: "Pharmacie", color: null },
  { id: 21, parentId: null, name: "Épargne", color: "#06b6d4" },
  { id: 24, parentId: null, name: "Shopping", color: "#f43f5e" },
  { id: 25, parentId: 24, name: "Vêtements", color: null },
  { id: 26, parentId: 24, name: "Joaillerie / Luxe", color: null },
];
let nextCategoryId = 27;
export function allocCategoryId(): number {
  return nextCategoryId++;
}

export function findCategory(id: number): CategoryDef | undefined {
  return categoryDefs.find((category) => category.id === id);
}

export function effectiveColorOf(categoryId: number): string {
  let current = findCategory(categoryId);
  while (current) {
    if (current.color) return current.color;
    current = current.parentId !== null ? findCategory(current.parentId) : undefined;
  }
  return "#94a3b8";
}

export function rootOf(categoryId: number): CategoryDef {
  let current = findCategory(categoryId);
  if (!current) throw new Error("Unknown category");
  while (current.parentId !== null) {
    const parent = findCategory(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function childrenMap(): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const category of categoryDefs) {
    if (category.parentId === null) continue;
    const siblings = map.get(category.parentId) ?? [];
    siblings.push(category.id);
    map.set(category.parentId, siblings);
  }
  return map;
}

export function descendantsOf(categoryId: number, childrenOf: Map<number, number[]>): number[] {
  const ids = [categoryId];
  for (const childId of childrenOf.get(categoryId) ?? []) {
    ids.push(...descendantsOf(childId, childrenOf));
  }
  return ids;
}

function assignedCategory(id: number): AssignedCategory {
  const category = findCategory(id);
  return { id, name: category?.name ?? "?", color: effectiveColorOf(id) };
}

// Dividendes/Loyers perçus are deliberately not tagged "income_forecast" -
// they're one-off/variable, not the steady monthly trend that card predicts.
export const categoryUseCases: { useCase: CategoryUseCase; categoryId: number }[] = [
  { useCase: "income_forecast", categoryId: 2 },
  { useCase: "income_exclude", categoryId: 3 },
  { useCase: "savings", categoryId: 21 },
];

const SALAIRE_ID = 2;
const REMBOURSEMENTS_ID = 3;
const DIVIDENDES_ID = 22;
const LOYERS_PERCUS_ID = 23;
const LOYER_ID = 5;
const CHARGES_ID = 6;
const COURSES_ID = 8;
const RESTAURANTS_ID = 9;
const ESSENCE_ID = 11;
const TRANSPORTS_COMMUN_ID = 12;
const SORTIES_ID = 14;
const VOYAGES_ID = 15;
const STREAMING_ID = 17;
const TELEPHONE_ID = 18;
const PHARMACIE_ID = 20;
const EPARGNE_ID = 21;
const VETEMENTS_ID = 25;
const LUXE_ID = 26;

// ---------------------------------------------------------------------------
// Account identifiers (the Account[] objects themselves are built further
// down, once balance history has been replayed from real transactions)
// ---------------------------------------------------------------------------

const ACCOUNT_CC = "demo-cc";
const ACCOUNT_LIVRET_A = "demo-livret-a";
const ACCOUNT_LDDS = "demo-ldds";
const ACCOUNT_PER = "demo-per";

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

let nextRowId = 1;
export const transactions: Transaction[] = [];
export const pendingTransactions: PendingTransaction[] = [];

function addTransaction(
  accountInternalId: string,
  monthsBack: number,
  day: number,
  label: string,
  amount: number,
  categoryIds: number[],
  nature: string,
): void {
  const bookingDateTime = dateAt(0, monthsBack, day, randInt(7, 21), randInt(0, 59));
  if (bookingDateTime > now) return;
  const rowId = nextRowId++;
  transactions.push({
    rowId,
    id: `demo-txn-${rowId}`,
    accountInternalId,
    label,
    bookingDateTime: bookingDateTime.toISOString(),
    valueDateTime: bookingDateTime.toISOString(),
    amount,
    amountCurrency: "EUR",
    isAccounted: true,
    movementCodeType: amount > 0 ? "virement" : "carte",
    nature,
    categories: categoryIds.map(assignedCategory),
    predictedCategories: [],
  });
}

for (let m = HISTORY_MONTHS; m >= 0; m--) {
  const lastDay = m === 0 ? now.getDate() : daysInMonth(m);

  // --- Current account: salary, recurring bills, and high-volume everyday spend ---
  if (lastDay >= 28) {
    addTransaction(ACCOUNT_CC, m, 28, "Salaire", randAmount(16_000, 19_500), [SALAIRE_ID], "virement");
    addTransaction(ACCOUNT_CC, m, 28, "Virement épargne", -randAmount(2_000, 3_200), [EPARGNE_ID], "virement");
  }
  if (m % 3 === 0) {
    addTransaction(ACCOUNT_CC, m, Math.min(15, lastDay), "Dividendes portefeuille", randAmount(30_000, 70_000), [DIVIDENDES_ID], "virement");
  }
  addTransaction(ACCOUNT_CC, m, Math.min(4, lastDay), "Loyers perçus - résidence secondaire", randAmount(3_400, 5_200), [LOYERS_PERCUS_ID], "virement");
  addTransaction(ACCOUNT_CC, m, Math.min(3, lastDay), "Loyer appartement", -randAmount(1_200, 1_450), [LOYER_ID], "prelevement");
  addTransaction(ACCOUNT_CC, m, Math.min(5, lastDay), "Charges copropriété", -randAmount(280, 480), [CHARGES_ID], "prelevement");
  addTransaction(ACCOUNT_CC, m, Math.min(2, lastDay), "Navigo mensuel", -75.2, [TRANSPORTS_COMMUN_ID], "prelevement");
  addTransaction(ACCOUNT_CC, m, Math.min(7, lastDay), "Netflix", -14.99, [STREAMING_ID], "prelevement");
  addTransaction(ACCOUNT_CC, m, Math.min(7, lastDay), "Spotify", -10.99, [STREAMING_ID], "prelevement");
  addTransaction(ACCOUNT_CC, m, Math.min(10, lastDay), "Forfait mobile + internet", -34.99, [TELEPHONE_ID], "prelevement");

  const groceryCount = randInt(10, 18);
  for (let i = 0; i < groceryCount; i++) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Carrefour", "Monoprix", "Lidl", "Franprix", "La Grande Épicerie"]),
      -randAmount(40, 220),
      [COURSES_ID],
      "carte",
    );
  }

  const restaurantCount = randInt(6, 12);
  for (let i = 0; i < restaurantCount; i++) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Le Bistrot", "Sushi Wasabi", "Pizzeria Napoli", "Café de la Place", "L'Atelier Étoilé", "Le Grand Véfour"]),
      -randAmount(35, 280),
      [RESTAURANTS_ID],
      "carte",
    );
  }

  const essenceCount = randInt(2, 4);
  for (let i = 0; i < essenceCount; i++) {
    addTransaction(ACCOUNT_CC, m, randInt(1, lastDay), "Station essence", -randAmount(65, 140), [ESSENCE_ID], "carte");
  }

  const sortiesCount = randInt(3, 6);
  for (let i = 0; i < sortiesCount; i++) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Cinéma", "Concert", "Bar", "Opéra", "Golf"]),
      -randAmount(25, 320),
      [SORTIES_ID],
      "carte",
    );
  }

  if (m % 2 === 0) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Réservation voyage - Maldives", "Hôtel 5 étoiles", "Vol première classe", "Location villa"]),
      -randAmount(900, 4_800),
      [VOYAGES_ID],
      "carte",
    );
  }

  const vetementsCount = randInt(3, 8);
  for (let i = 0; i < vetementsCount; i++) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Boutique Vêtements", "Galeries Lafayette", "Maison de couture"]),
      -randAmount(90, 950),
      [VETEMENTS_ID],
      "carte",
    );
  }

  if (rand() < 0.35) {
    addTransaction(
      ACCOUNT_CC,
      m,
      randInt(1, lastDay),
      pick(["Joaillerie Vendôme", "Horlogerie de luxe", "Maroquinerie"]),
      -randAmount(1_500, 16_000),
      [LUXE_ID],
      "carte",
    );
  }
  if (rand() < 0.3) {
    addTransaction(ACCOUNT_CC, m, randInt(1, lastDay), "Pharmacie", -randAmount(8, 60), [PHARMACIE_ID], "carte");
  }
  if (rand() < 0.2) {
    addTransaction(ACCOUNT_CC, m, randInt(1, lastDay), "Remboursement mutuelle", randAmount(15, 90), [REMBOURSEMENTS_ID], "virement");
  }

  // --- Savings accounts: monthly interest, occasional large top-ups ---
  addTransaction(ACCOUNT_LIVRET_A, m, Math.min(1, lastDay), "Intérêts Livret A", randAmount(150, 420), [EPARGNE_ID], "virement");
  addTransaction(ACCOUNT_LDDS, m, Math.min(1, lastDay), "Intérêts LDDS", randAmount(60, 160), [EPARGNE_ID], "virement");
  if (m % 8 === 0 && m !== 0) {
    addTransaction(ACCOUNT_LIVRET_A, m, randInt(2, lastDay), "Virement complémentaire", randAmount(15_000, 40_000), [EPARGNE_ID], "virement");
  }
  if (m % 10 === 0 && m !== 0) {
    addTransaction(ACCOUNT_LDDS, m, randInt(2, lastDay), "Virement complémentaire", randAmount(8_000, 20_000), [EPARGNE_ID], "virement");
  }
}

// A handful of freshly-imported, not-yet-categorized transactions with
// pending AI suggestions, so the "predicted categories" review UI has
// something to show.
const uncategorized: { label: string; amount: number; predictions: [number, number][] }[] = [
  { label: "Carrefour City", amount: -58.4, predictions: [[COURSES_ID, 0.91]] },
  { label: "Le Petit Café", amount: -12.5, predictions: [[RESTAURANTS_ID, 0.72], [SORTIES_ID, 0.31]] },
  { label: "Total Access", amount: -78.1, predictions: [[ESSENCE_ID, 0.88]] },
  { label: "Boutique Montaigne", amount: -640, predictions: [[VETEMENTS_ID, 0.68], [LUXE_ID, 0.24]] },
];
for (const { label, amount, predictions } of uncategorized) {
  const bookingDateTime = dateAt(0, 0, Math.max(1, now.getDate() - randInt(1, 6)), 10, 15);
  const rowId = nextRowId++;
  transactions.push({
    rowId,
    id: `demo-txn-${rowId}`,
    accountInternalId: ACCOUNT_CC,
    label,
    bookingDateTime: bookingDateTime.toISOString(),
    valueDateTime: bookingDateTime.toISOString(),
    amount,
    amountCurrency: "EUR",
    isAccounted: true,
    movementCodeType: "carte",
    nature: "carte",
    categories: [],
    predictedCategories: predictions.map(
      ([categoryId, confidence]): PredictedCategory => ({ ...assignedCategory(categoryId), confidence }),
    ),
  });
}

// A few pending (not-yet-booked) card transactions dated today.
let nextPendingId = 1;
for (const [label, amount] of [
  ["Amazon.fr", -142.9],
  ["Boulangerie", -8.6],
  ["Restaurant Le Meurice", -310],
] as const) {
  pendingTransactions.push({
    id: `demo-pending-${nextPendingId++}`,
    accountInternalId: ACCOUNT_CC,
    label,
    bookingDateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), randInt(7, 20)).toISOString(),
    amount,
    amountCurrency: "EUR",
    nature: "carte",
  });
}

// ---------------------------------------------------------------------------
// Balance history - each account's true running balance is replayed from
// its own real transaction ledger above (opening balance solved backwards
// from a target ending balance, so the numbers land in "multi-millionaire"
// territory), then sampled onto a snapshot calendar shared by every
// account - like a worker that syncs the whole portfolio a couple of times
// a week, rather than one independent random walk per account. Sharing the
// calendar also means getCombinedBalanceHistory's same-day sum (mirroring
// lib/data.real.ts, which doesn't carry forward missing days) always has a
// snapshot from every account to add up.
// ---------------------------------------------------------------------------

function buildLedger(accountInternalId: string, targetEndingBalance: number): { at: number; amount: number }[] {
  const accountTxns = transactions
    .filter((t) => t.accountInternalId === accountInternalId)
    .slice()
    .sort((a, b) => new Date(a.bookingDateTime).getTime() - new Date(b.bookingDateTime).getTime());

  const netMovement = accountTxns.reduce((sum, t) => sum + t.amount, 0);
  let running = targetEndingBalance - netMovement;

  const openingAt = accountTxns.length
    ? new Date(accountTxns[0].bookingDateTime).getTime() - 24 * 60 * 60 * 1000
    : dateAt(0, HISTORY_MONTHS, 1).getTime();
  const ledger = [{ at: openingAt, amount: running }];
  for (const t of accountTxns) {
    running += t.amount;
    ledger.push({ at: new Date(t.bookingDateTime).getTime(), amount: running });
  }
  return ledger;
}

function buildSnapshotCalendar(): Date[] {
  const days: Date[] = [];
  for (let m = HISTORY_MONTHS; m >= 0; m--) {
    const lastDay = m === 0 ? now.getDate() : daysInMonth(m);
    const pointsInMonth = m === 0 ? Math.max(3, Math.ceil((lastDay / 30) * 9)) : 9;
    for (let p = 0; p < pointsInMonth; p++) {
      const day = Math.max(1, Math.round(((p + 1) / pointsInMonth) * lastDay));
      days.push(dateAt(0, m, day, 6, 0));
    }
  }
  return days;
}
const SNAPSHOT_CALENDAR = buildSnapshotCalendar();

function sampleBalanceHistory(accountInternalId: string, ledger: { at: number; amount: number }[]): AccountBalancePoint[] {
  const points: AccountBalancePoint[] = [];
  let ledgerIndex = 0;
  let current = ledger[0].amount;
  for (const day of SNAPSHOT_CALENDAR) {
    const dayMs = day.getTime();
    if (dayMs < ledger[0].at) continue;
    while (ledgerIndex < ledger.length && ledger[ledgerIndex].at <= dayMs) {
      current = ledger[ledgerIndex].amount;
      ledgerIndex++;
    }
    points.push({
      accountInternalId,
      amount: Math.round(current * 100) / 100,
      amountCurrency: "EUR",
      capturedAt: day.toISOString(),
    });
  }
  const last = ledger[ledger.length - 1];
  const lastAmount = Math.round(last.amount * 100) / 100;
  if (points.length === 0 || points[points.length - 1].amount !== lastAmount) {
    points.push({ accountInternalId, amount: lastAmount, amountCurrency: "EUR", capturedAt: new Date(last.at).toISOString() });
  }
  return points;
}

// PER has no transactions to replay - it's external, "hors agrégation
// bancaire" (no bank sync), so its history is periodic valuations instead
// of a transaction ledger, same idea as the assets/debts series further
// down.
export const balanceHistory: Record<string, AccountBalancePoint[]> = {
  [ACCOUNT_CC]: sampleBalanceHistory(ACCOUNT_CC, buildLedger(ACCOUNT_CC, 260_000)),
  [ACCOUNT_LIVRET_A]: sampleBalanceHistory(ACCOUNT_LIVRET_A, buildLedger(ACCOUNT_LIVRET_A, 480_000)),
  [ACCOUNT_LDDS]: sampleBalanceHistory(ACCOUNT_LDDS, buildLedger(ACCOUNT_LDDS, 185_000)),
  [ACCOUNT_PER]: generateValueSeries(HISTORY_MONTHS, 2, 420_000, 7_900, 4_000).map((v) => ({
    accountInternalId: ACCOUNT_PER,
    amount: v.value,
    amountCurrency: "EUR",
    capturedAt: v.valuedAt,
  })),
};

function latestBalance(accountInternalId: string): AccountBalancePoint {
  const series = balanceHistory[accountInternalId];
  return series[series.length - 1];
}

export const accounts: Account[] = [
  {
    internalId: ACCOUNT_CC,
    label: "Compte courant",
    shortLabel: "CC Principal",
    type: "current",
    iban: "FR76 •••• •••• •••• 4521",
    amount: latestBalance(ACCOUNT_CC).amount,
    amountCurrency: "EUR",
    userRole: "holder",
    holderLabel: "Compte Démo",
    bankCode: "30002",
    agencyCode: "00550",
    productType: "CCHQ",
    accountCreationDate: dateAt(5, 0, 1).toISOString(),
    bankLabel: "Banque Démo",
    status: "active",
  },
  {
    internalId: ACCOUNT_LIVRET_A,
    label: "Livret A",
    shortLabel: "Livret A",
    type: "saving",
    iban: "FR76 •••• •••• •••• 7734",
    amount: latestBalance(ACCOUNT_LIVRET_A).amount,
    amountCurrency: "EUR",
    userRole: "holder",
    holderLabel: "Compte Démo",
    bankCode: "30002",
    agencyCode: "00550",
    productType: "LVA",
    accountCreationDate: dateAt(5, 0, 1).toISOString(),
    bankLabel: "Banque Démo",
    status: "active",
  },
  {
    internalId: ACCOUNT_LDDS,
    label: "LDDS",
    shortLabel: "LDDS",
    type: "saving",
    iban: "FR76 •••• •••• •••• 1098",
    amount: latestBalance(ACCOUNT_LDDS).amount,
    amountCurrency: "EUR",
    userRole: "holder",
    holderLabel: "Compte Démo",
    bankCode: "30002",
    agencyCode: "00550",
    productType: "LDDS",
    accountCreationDate: dateAt(5, 0, 1).toISOString(),
    bankLabel: "Banque Démo",
    status: "active",
  },
  {
    internalId: ACCOUNT_PER,
    label: "PER (Plan d'Épargne Retraite)",
    shortLabel: "PER",
    type: "saving",
    iban: "Compte externe · hors agrégation bancaire",
    amount: latestBalance(ACCOUNT_PER).amount,
    amountCurrency: "EUR",
    userRole: "external",
    holderLabel: "Compte Démo",
    bankCode: "",
    agencyCode: "",
    productType: "PER",
    accountCreationDate: dateAt(4, 0, 1).toISOString(),
    bankLabel: null,
    status: null,
  },
];

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface BudgetDef {
  id: number;
  categoryId: number;
  amount: number;
}
export const budgetDefs: BudgetDef[] = [
  { id: 1, categoryId: COURSES_ID, amount: 1_200 },
  { id: 2, categoryId: RESTAURANTS_ID, amount: 800 },
  { id: 3, categoryId: TRANSPORTS_COMMUN_ID, amount: 150 },
  { id: 4, categoryId: SORTIES_ID, amount: 500 },
  { id: 5, categoryId: 16, amount: 250 },
  { id: 6, categoryId: 24, amount: 2_000 },
];
let nextBudgetId = 7;
export function allocBudgetId(): number {
  return nextBudgetId++;
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export interface SavingsGoalDef {
  id: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  notes: string | null;
  period: "once" | "monthly" | "yearly";
  categoryId: number | null;
  accountInternalId: string | null;
}
export interface SavingsGoalValueDef {
  savingsGoalId: number;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}

export const savingsGoalDefs: SavingsGoalDef[] = [
  {
    id: 1,
    name: "Fonds d'urgence",
    targetAmount: 80_000,
    targetDate: dateAt(0, -6, 1).toISOString(),
    notes: "Un an de dépenses de côté",
    period: "once",
    categoryId: null,
    accountInternalId: null,
  },
  {
    id: 2,
    name: "Épargne mensuelle",
    targetAmount: 3_000,
    targetDate: null,
    notes: null,
    period: "monthly",
    categoryId: EPARGNE_ID,
    accountInternalId: null,
  },
  {
    id: 3,
    name: "Livret A",
    targetAmount: 600_000,
    targetDate: null,
    notes: null,
    period: "once",
    categoryId: null,
    accountInternalId: ACCOUNT_LIVRET_A,
  },
];
let nextSavingsGoalId = 4;
export function allocSavingsGoalId(): number {
  return nextSavingsGoalId++;
}

export const savingsGoalValues: SavingsGoalValueDef[] = [
  { savingsGoalId: 1, value: 35_000, valueCurrency: "EUR", valuedAt: dateAt(0, 6, 1).toISOString() },
  { savingsGoalId: 1, value: 58_000, valueCurrency: "EUR", valuedAt: dateAt(0, 3, 1).toISOString() },
  { savingsGoalId: 1, value: 67_500, valueCurrency: "EUR", valuedAt: dateAt(0, 1, 1).toISOString() },
];

// ---------------------------------------------------------------------------
// Smooth, denser value series for debts/assets (monthly-ish valuations
// rather than 2-3 sparse hand-picked points), walked forward from a
// back-solved starting value so the series lands exactly on the given
// target at "today" - same idea as replayBalanceHistory above, applied to
// things without a transaction ledger to replay.
// ---------------------------------------------------------------------------

function generateValueSeries(
  monthsBack: number,
  stepMonths: number,
  targetEnd: number,
  monthlyDrift: number,
  volatility: number,
): { value: number; valuedAt: string }[] {
  const monthMarks: number[] = [];
  for (let m = monthsBack; m > 0; m -= stepMonths) monthMarks.push(m);
  monthMarks.push(0);

  let value = targetEnd - monthlyDrift * monthsBack;
  return monthMarks.map((m, index) => {
    if (index > 0) {
      value += monthlyDrift * (monthMarks[index - 1] - m) + randAmount(-volatility, volatility);
    }
    const resolved = m === 0 ? targetEnd : Math.max(value, 0);
    return { value: Math.round(resolved * 100) / 100, valuedAt: dateAt(0, m, 5).toISOString() };
  });
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export interface DebtDef {
  id: number;
  name: string;
  type: string;
  notes: string | null;
}
export interface DebtValueDef {
  debtId: number;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}
export const debtDefs: DebtDef[] = [
  { id: 1, name: "Prêt immobilier locatif", type: "loan", notes: "Résidence secondaire" },
  { id: 2, name: "Prêt auto", type: "loan", notes: "Sur 4 ans" },
  { id: 3, name: "Carte de crédit renouvelable", type: "credit_card", notes: null },
];
let nextDebtId = 4;
export function allocDebtId(): number {
  return nextDebtId++;
}
export const debtValues: DebtValueDef[] = [
  ...generateValueSeries(HISTORY_MONTHS, 3, 650_000, -12_500, 3_000).map((v) => ({ debtId: 1, ...v, valueCurrency: "EUR" })),
  ...generateValueSeries(HISTORY_MONTHS, 2, 16_000, -750, 400).map((v) => ({ debtId: 2, ...v, valueCurrency: "EUR" })),
  ...generateValueSeries(HISTORY_MONTHS, 1, 1_150, 0, 600).map((v) => ({ debtId: 3, ...v, valueCurrency: "EUR" })),
];

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface AssetDef {
  id: number;
  name: string;
  type: string;
  notes: string | null;
}
export interface AssetValueDef {
  assetId: number;
  value: number;
  valueCurrency: string;
  valuedAt: string;
}
export const assetDefs: AssetDef[] = [
  { id: 1, name: "Portefeuille actions (PEA)", type: "investment", notes: null },
  { id: 2, name: "Assurance vie", type: "investment", notes: "Fonds euros + UC" },
  { id: 3, name: "Résidence secondaire", type: "real_estate", notes: "Mise en location saisonnière" },
];
let nextAssetId = 4;
export function allocAssetId(): number {
  return nextAssetId++;
}
export const assetValues: AssetValueDef[] = [
  ...generateValueSeries(HISTORY_MONTHS, 1, 1_850_000, 47_900, 60_000).map((v) => ({ assetId: 1, ...v, valueCurrency: "EUR" })),
  ...generateValueSeries(HISTORY_MONTHS, 2, 950_000, 19_600, 8_000).map((v) => ({ assetId: 2, ...v, valueCurrency: "EUR" })),
  ...generateValueSeries(HISTORY_MONTHS, 3, 1_400_000, 14_600, 5_000).map((v) => ({ assetId: 3, ...v, valueCurrency: "EUR" })),
];

// ---------------------------------------------------------------------------
// Cash / vacation vouchers on hand
// ---------------------------------------------------------------------------

export const cashValues: CashValuePoint[] = [
  { value: 320, valueCurrency: "EUR", valuedAt: dateAt(0, 4, 1).toISOString() },
  { value: 480, valueCurrency: "EUR", valuedAt: dateAt(0, 0, 1).toISOString() },
];
export const voucherValues: CashValuePoint[] = [
  { value: 150, valueCurrency: "EUR", valuedAt: dateAt(0, 6, 1).toISOString() },
];

// ---------------------------------------------------------------------------
// Sync status / onboarding / LCL connection
// ---------------------------------------------------------------------------

export const syncRequests: SyncStatus[] = [
  {
    id: 1,
    status: "success",
    error: null,
    requestedAt: dateAt(0, 0, Math.max(1, now.getDate() - 1), 6, 0).toISOString(),
    startedAt: dateAt(0, 0, Math.max(1, now.getDate() - 1), 6, 1).toISOString(),
    finishedAt: dateAt(0, 0, Math.max(1, now.getDate() - 1), 6, 3).toISOString(),
  },
];

export const onboardedAt = dateAt(5, 0, 1).toISOString();
export const hasLclCredentials = true;

// ---------------------------------------------------------------------------
// Income prediction
// ---------------------------------------------------------------------------

export const predictedMonthlyIncome = 17_500;
