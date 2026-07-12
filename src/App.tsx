import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardPage from "@/pages/DashboardPage";
import TradesPage from "@/pages/TradesPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import JournalPage from "@/pages/JournalPage";
import StrategyDetailPage from "@/pages/StrategyDetailPage";
import CopyPage from "@/pages/CopyPage";
import AccountsPage from "@/pages/AccountsPage";
import CommandsPage from "@/pages/CommandsPage";
import SettingsPage from "@/pages/SettingsPage";
import ConnectPage from "@/pages/ConnectPage";
import AlertsPage from "@/pages/AlertsPage";
import SharePage from "@/pages/SharePage";
import LoginPage from "@/pages/LoginPage";
import CalendarPage from "@/pages/CalendarPage";
import NewsPage from "@/features/news/NewsPage";
import PricingPage from "@/pages/PricingPage";
import CalculatorPage from "@/pages/CalculatorPage";
import DataExportPage from "@/pages/DataExportPage";
import CurrencyStrengthPage from "@/features/strength/CurrencyStrengthPage";
// Plan & Goals and Correlation are hidden for now.
// import TradingPlanPage from "@/features/plan/TradingPlanPage";
// import CorrelationMatrixPage from "@/features/correlation/CorrelationMatrixPage";
import SentimentDashboardPage from "@/features/sentiment/SentimentDashboardPage";
import SupportPage from "@/pages/SupportPage";
import SupportAdminPage from "@/pages/SupportAdminPage";
import NotFound from "@/pages/NotFound";
import { ConfirmDialogHost } from "@/components/ConfirmDialog";
import { PromptDialogHost } from "@/components/PromptDialog";
import { RequireAuth } from "@/lib/auth";

const queryClient = new QueryClient();

const RedirectToDashboard = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: "/dashboard", search: location.search }} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConfirmDialogHost />
      <PromptDialogHost />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RedirectToDashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/share/:token" element={<SharePage />} />

          <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/strategy/:strategy/:setup" element={<StrategyDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/copy" element={<CopyPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/commands" element={<CommandsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
            <Route path="/data" element={<DataExportPage />} />

            <Route path="/strength" element={<CurrencyStrengthPage />} />
            {/* <Route path="/plan" element={<TradingPlanPage />} /> */}
            {/* <Route path="/correlation" element={<CorrelationMatrixPage />} /> */}
            <Route path="/sentiment" element={<SentimentDashboardPage />} />

            <Route path="/support" element={<SupportPage />} />
            <Route path="/support/:ticketId" element={<SupportPage />} />
            <Route path="/support-admin" element={<SupportAdminPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
