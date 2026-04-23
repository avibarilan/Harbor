import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { WsProvider } from './context/WsContext.jsx';
import { SitesProvider } from './context/SitesContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import AppShell from './components/layout/AppShell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SiteDetailPage from './pages/SiteDetailPage.jsx';
import InstanceDetailPage from './pages/InstanceDetailPage.jsx';
import AdoptPage from './pages/AdoptPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<WsProvider><SitesProvider><ToastProvider><AppShell /></ToastProvider></SitesProvider></WsProvider>}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/sites/:id" element={<SiteDetailPage />} />
                <Route path="/instances/:id" element={<InstanceDetailPage />} />
                <Route path="/adopt" element={<AdoptPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
