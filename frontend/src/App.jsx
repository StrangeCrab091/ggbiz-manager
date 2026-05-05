import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/common/Layout';
import { UserProvider } from './contexts/UserContext';
import DashboardPage from './pages/DashboardPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import LocationsPage from './pages/LocationsPage';
import AutomationPage from './pages/AutomationPage';
import CompetitorPage from './pages/CompetitorPage';
import UserManagementPage from './pages/UserManagementPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TutorialsPage from './pages/TutorialsPage';

function App() {
  return (
    <UserProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reviews" element={<ReviewPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="tutorials" element={<TutorialsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="competitor" element={<CompetitorPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </UserProvider>
  );
}

export default App;
