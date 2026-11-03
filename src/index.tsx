import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from './store/uiStore';
import { AccountProvider } from './account/AccountProvider';
import './styles/hazard.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <UIProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </UIProvider>
  </React.StrictMode>
);
