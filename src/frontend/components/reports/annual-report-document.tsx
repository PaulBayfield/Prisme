import fs from "node:fs";
import path from "node:path";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatCurrency, formatEvolutionDate } from "@/lib/format";
import type { Account, CategorySpendingSlice, MonthlyReportPoint } from "@/lib/types";

// Read once per server process (this file is only ever imported from the
// annual report API route, never bundled for the client) rather than on
// every request.
const LOGO_FULL = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
const LOGO_ICON = fs.readFileSync(path.join(process.cwd(), "public", "logo-icon.png"));

// Intl.NumberFormat("fr-FR", ...) separates thousands with a narrow
// no-break space (U+202F) - not part of the base-14 Helvetica font's
// WinAnsiEncoding, so react-pdf/pdfkit falls back to an unrelated glyph
// (it renders as a stray "/"). Every currency string in this PDF goes
// through this instead of formatCurrency directly, swapping that (and the
// regular no-break space before the currency symbol) for a plain space,
// which Helvetica does have.
function money(amount: number): string {
  return formatCurrency(amount).replace(/[  ]/g, " ");
}

const COLORS = {
  ink: "#1e293b",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  hairline: "#f1f5f9",
  accent: "#6366f1",
};

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, fontFamily: "Helvetica", color: COLORS.ink },
  coverPage: {
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    justifyContent: "space-between",
  },

  header: {
    position: "absolute",
    top: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerBrand: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  headerRight: { fontSize: 9, color: COLORS.muted },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    fontSize: 8,
    color: COLORS.faint,
  },

  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 10 },
  sectionTitleFirst: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 10 },

  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 },
  summaryLabel: { fontSize: 8, color: COLORS.muted, marginBottom: 4 },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden" },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  tableRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    fontFamily: "Helvetica-Bold",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    fontFamily: "Helvetica-Bold",
    color: COLORS.muted,
    fontSize: 8,
  },
  colorDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  rowLabel: { flexDirection: "row", alignItems: "center", flex: 2 },
  cell: { flex: 1, textAlign: "right" },
  cellLabel: { flex: 2 },

  coverLogo: { width: 130, alignSelf: "center", marginBottom: 28 },
  coverTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", textAlign: "center" },
  coverSubtitle: { fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: 6 },
  coverHighlight: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 18,
    alignItems: "center",
    marginBottom: 40,
  },
  coverHighlightLabel: { fontSize: 9, color: COLORS.muted, marginBottom: 4 },
  coverHighlightValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: COLORS.accent },
});

function ReportHeader({ year }: { year: number }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF primitive, not an <img>; it has no alt prop */}
        <Image src={LOGO_ICON} style={{ width: 14, height: 14 }} />
        <Text style={styles.headerBrand}>Prisme</Text>
      </View>
      <Text style={styles.headerRight}>Bilan annuel {year}</Text>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Prisme</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CategoryTable({
  title,
  categories,
  total,
}: {
  title: string;
  categories: CategorySpendingSlice[];
  total: number;
}) {
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  return (
    <View>
      <Text style={styles.sectionTitleFirst}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.cellLabel}>Categorie</Text>
          <Text style={styles.cell}>Montant</Text>
          <Text style={styles.cell}>Part</Text>
        </View>
        {sorted.map((category, index) => (
          <View key={category.name} style={index === sorted.length - 1 ? styles.tableRowLast : styles.tableRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.colorDot, { backgroundColor: category.color }]} />
              <Text>{category.name}</Text>
            </View>
            <Text style={styles.cell}>{money(category.amount)}</Text>
            <Text style={styles.cell}>{total > 0 ? Math.round((category.amount / total) * 100) : 0}%</Text>
          </View>
        ))}
        <View style={styles.tableRowTotal}>
          <Text style={styles.cellLabel}>Total</Text>
          <Text style={styles.cell}>{money(total)}</Text>
          <Text style={styles.cell}>100%</Text>
        </View>
      </View>
    </View>
  );
}

export function AnnualReportDocument({
  year,
  totalIncome,
  totalExpenses,
  totalSavings,
  startBalance,
  endBalance,
  expenseCategories,
  incomeCategories,
  monthlyData,
  accounts,
}: {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  startBalance: number;
  endBalance: number;
  expenseCategories: CategorySpendingSlice[];
  incomeCategories: CategorySpendingSlice[];
  monthlyData: MonthlyReportPoint[];
  accounts: Account[];
}) {
  const balanceChange = endBalance - startBalance;
  const generatedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());

  return (
    <Document title={`Bilan annuel ${year}`} author="Prisme">
      {/* Cover page */}
      <Page size="A4" style={styles.coverPage}>
        <View />
        <View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF primitive, not an <img>; it has no alt prop */}
          <Image src={LOGO_FULL} style={styles.coverLogo} />
          <Text style={styles.coverTitle}>Bilan annuel {year}</Text>
          <Text style={styles.coverSubtitle}>Genere le {generatedAt}</Text>
        </View>
        <View style={styles.coverHighlight}>
          <Text style={styles.coverHighlightLabel}>{"Variation du solde sur l'annee"}</Text>
          <Text style={styles.coverHighlightValue}>
            {balanceChange >= 0 ? "+" : ""}
            {money(balanceChange)}
          </Text>
        </View>
      </Page>

      {/* Summary + accounts */}
      <Page size="A4" style={styles.page}>
        <ReportHeader year={year} />
        <ReportFooter />

        <Text style={styles.sectionTitleFirst}>{"Resume de l'annee"}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Revenus</Text>
            <Text style={styles.summaryValue}>{money(totalIncome)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Depenses</Text>
            <Text style={styles.summaryValue}>{money(totalExpenses)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Epargne</Text>
            <Text style={styles.summaryValue}>{money(totalSavings)}</Text>
          </View>
        </View>

        <View style={[styles.summaryRow, { marginTop: 10 }]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Solde au 1er janvier</Text>
            <Text style={styles.summaryValue}>{money(startBalance)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Solde au 31 decembre</Text>
            <Text style={styles.summaryValue}>{money(endBalance)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Variation</Text>
            <Text style={styles.summaryValue}>
              {balanceChange >= 0 ? "+" : ""}
              {money(balanceChange)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Comptes</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellLabel}>Compte</Text>
            <Text style={styles.cell}>Type</Text>
            <Text style={styles.cell}>Solde actuel</Text>
          </View>
          {accounts.map((account, index) => (
            <View
              key={account.internalId}
              style={index === accounts.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.cellLabel}>{account.label}</Text>
              <Text style={styles.cell}>{account.type === "saving" ? "Epargne" : "Courant"}</Text>
              <Text style={styles.cell}>{money(account.amount)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Monthly evolution */}
      <Page size="A4" style={styles.page}>
        <ReportHeader year={year} />
        <ReportFooter />

        <Text style={styles.sectionTitleFirst}>Evolution mensuelle</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellLabel}>Mois</Text>
            <Text style={styles.cell}>Revenus</Text>
            <Text style={styles.cell}>Depenses</Text>
            <Text style={styles.cell}>Net</Text>
          </View>
          {monthlyData.map((point, index) => {
            const net = point.income - point.expenses;
            return (
              <View key={point.month} style={index === monthlyData.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={styles.cellLabel}>{formatEvolutionDate(point.month, "month")}</Text>
                <Text style={styles.cell}>{money(point.income)}</Text>
                <Text style={styles.cell}>{money(point.expenses)}</Text>
                <Text style={styles.cell}>{money(net)}</Text>
              </View>
            );
          })}
          <View style={styles.tableRowTotal}>
            <Text style={styles.cellLabel}>Total</Text>
            <Text style={styles.cell}>{money(totalIncome)}</Text>
            <Text style={styles.cell}>{money(totalExpenses)}</Text>
            <Text style={styles.cell}>{money(totalIncome - totalExpenses)}</Text>
          </View>
        </View>
      </Page>

      {/* Expenses by category */}
      <Page size="A4" style={styles.page}>
        <ReportHeader year={year} />
        <ReportFooter />
        <CategoryTable title="Depenses par categorie" categories={expenseCategories} total={totalExpenses} />
      </Page>

      {/* Income by category */}
      <Page size="A4" style={styles.page}>
        <ReportHeader year={year} />
        <ReportFooter />
        <CategoryTable title="Revenus par categorie" categories={incomeCategories} total={totalIncome} />
      </Page>
    </Document>
  );
}
