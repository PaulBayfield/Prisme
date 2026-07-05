import { CurrencyConverter } from "@/components/currency-converter";

export default function CurrencyExchangePage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <h2 className="text-lg font-semibold">Change de devises</h2>
        <p className="text-sm text-muted-foreground">
          Convertissez un montant entre deux devises au taux du jour (source : Banque centrale européenne).
        </p>
      </div>

      <CurrencyConverter />
    </div>
  );
}
