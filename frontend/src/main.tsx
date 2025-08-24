import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.tsx'
import './index.css'

// Suprimir mensagens desnecessárias do console
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  // Suprimir mensagem do React DevTools
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Download the React DevTools')) {
    return;
  }
  // Suprimir mensagens do Vite
  if (args[0] && typeof args[0] === 'string' && (args[0].includes('[vite]') || args[0].includes('connected'))) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

console.warn = (...args) => {
  // Suprimir warnings específicos se necessário
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Download the React DevTools')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
