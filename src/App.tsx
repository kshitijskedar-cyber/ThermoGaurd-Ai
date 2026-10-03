import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThermalDataProvider } from "@/hooks/useThermalData";
import AppLayout from "@/components/layout/AppLayout";
import OverviewPage from "@/pages/OverviewPage";
import ThermalMapPage from "@/pages/ThermalMapPage";
import PlannedPage from "@/pages/PlannedPage";
import InvestigationPage from "@/pages/InvestigationPage";
import HistoryPage from "@/pages/HistoryPage";
import ReportPage from "@/pages/ReportPage";
import AlertsPage from "@/pages/AlertsPage";
import SitesPage from "@/pages/SitesPage";
import FacilityPage from "@/pages/FacilityPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import { AlertProvider } from "@/hooks/useAlerts";
import { ReportProvider } from "@/hooks/useReports";
import StateBlock from "@/components/common/StateBlock";

export default function App() {
  return (
    <ThermalDataProvider>
      <AlertProvider>
      <ReportProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="map" element={<ThermalMapPage />} />
            <Route path="investigation" element={<InvestigationPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="sites" element={<SitesPage />} />
            <Route path="sites/:facilityId" element={<FacilityPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="reports" element={<ReportPage />} />
            <Route path="settings" element={<PlannedPage icon="settings" phase={4} summary="Data-source configuration for demo and live (NASA FIRMS) modes." />} />
            <Route path="*" element={<StateBlock variant="empty" icon="map" title="Page not found" detail="Use the navigation to return to a ThermoGuard screen." />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ReportProvider>
      </AlertProvider>
    </ThermalDataProvider>
  );
}
