if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import ConfigToolApp from './config-tool/App.tsx'
import SimplePasswordGate from './components/SimplePasswordGate'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SimplePasswordGate><App /></SimplePasswordGate>} />
        <Route path="/config/*" element={<ConfigToolApp />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
