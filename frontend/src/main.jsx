import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './contexts/AuthContext.jsx'
import { TokenProvider } from './contexts/TokenContext.jsx'
import App from './App.jsx'
import axios from 'axios'

// Set axios defaults to always send cookies
axios.defaults.withCredentials = true


createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <TokenProvider>
        <App />
      </TokenProvider>
    </AuthProvider>
  </BrowserRouter>
)
