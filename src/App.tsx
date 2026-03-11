import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PrimeReactProvider } from 'primereact/api';
import { useEffect, useState } from 'react';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primeicons/primeicons.css';
import './App.css';

// Pages
import WelcomeScreen from './pages/WelcomeScreen';
import CreateUserPage from './pages/CreateUserPage';
import CreateHubPage from './pages/CreateHubPage';
import UpdateHubPage from './pages/UpdateHubPage';
import UpdateProfilePage from './pages/UpdateProfilePage';
import MainPage from './pages/MainPage';
import RoomPage from './pages/RoomPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <PrimeReactProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/auth/signup" element={<CreateUserPage />} />
          <Route
            path="/hub"
            element={
              <ProtectedRoute>
                <MainPage isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
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
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <UpdateProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </PrimeReactProvider>
  );
}

export default App;
