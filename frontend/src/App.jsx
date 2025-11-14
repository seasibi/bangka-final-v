import AppRoutes from "./routes/AppRoutes"
import './index.css'
import { NotificationProvider } from './contexts/NotificationContext'
import NotificationSidebar from './components/NotificationSidebar'
import useWebSocketNotifications from './hooks/useWebSocketNotifications'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './contexts/AuthContext'

function NotificationWrapper() {
  const { user } = useAuth();
  
  // Only initialize WebSocket connection when user is logged in
  useWebSocketNotifications(user);
  
  return (
    <>
      <AppRoutes />
      {/* Only show notification sidebar when user is logged in */}
      {user && <NotificationSidebar />}
      <Toaster position="bottom-right" />
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <NotificationWrapper />
    </NotificationProvider>
  )
}

export default App
