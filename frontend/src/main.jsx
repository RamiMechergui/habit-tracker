import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { HabitProvider } from './Store.jsx'

import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HabitProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HabitProvider>
  </React.StrictMode>,
)
