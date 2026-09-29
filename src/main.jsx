import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 🔒 ปิด Console Debug ทั้งหมด ไม่ให้แสดงใน DevTools F12
if (!window.location.search.includes('debug=true')) {
  console.log = function() {};
  console.debug = function() {};
  console.info = function() {};
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
