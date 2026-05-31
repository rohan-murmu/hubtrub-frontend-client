import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PrimeReactProvider } from 'primereact/api';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primeicons/primeicons.css';
import './App.css';

import WelcomeScreen from './pages/WelcomeScreen';
import AuthPage from './pages/AuthPage';
import AuthActionPage from './pages/AuthActionPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import SelectAvatarPage from './pages/SelectAvatarPage';
import CreateHubPage from './pages/CreateHubPage';
import UpdateHubPage from './pages/UpdateHubPage';
import SettingsPage from './pages/SettingsPage';
import MainPage from './pages/MainPage';
import RoomPage from './pages/RoomPage';
import ExplorePage from './pages/ExplorePage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import DeviceCompatibilityGate from './components/DeviceCompatibilityGate/DeviceCompatibilityGate';
import ReviewGate from './components/ReviewPopup/ReviewGate';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <PrimeReactProvider>
      <ThemeProvider>
        <DeviceCompatibilityGate>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<WelcomeScreen />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/action" element={<AuthActionPage />} />
                <Route
                  path="/auth/profile-details"
                  element={
                    <ProtectedRoute allowIncompleteProfile>
                      <CompleteProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auth/select-avatar"
                  element={
                    <ProtectedRoute allowIncompleteProfile>
                      <SelectAvatarPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub"
                  element={
                    <ProtectedRoute>
                      <MainPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub/create"
                  element={
                    <ProtectedRoute>
                      <CreateHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub/:roomId/edit"
                  element={
                    <ProtectedRoute>
                      <UpdateHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub/:roomId"
                  element={
                    <ProtectedRoute>
                      <RoomPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/explore"
                  element={
                    <ProtectedRoute>
                      <ExplorePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <ReviewGate />
            </AuthProvider>
          </BrowserRouter>
        </DeviceCompatibilityGate>
      </ThemeProvider>
    </PrimeReactProvider>
  );
}

export default App;
