import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { SettingsApp } from './SettingsApp';
import './styles/globals.css';

const isSettings =
  window.location.hash.includes('settings') ||
  window.location.search.includes('settings') ||
  window.location.search.includes('view=settings');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isSettings ? <SettingsApp /> : <App />}
  </React.StrictMode>
);
