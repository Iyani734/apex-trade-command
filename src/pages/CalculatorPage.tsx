import CalculatorPage from '@/features/calculator/CalculatorPage';
import { useTradingStore } from '@/store/tradingStore';

export default function CalculatorRoute() {
  const active = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));
  return (
    <CalculatorPage
      activeAccount={
        active
          ? { balance: active.balance, equity: active.equity, leverage: active.leverage }
          : undefined
      }
    />
  );
}
