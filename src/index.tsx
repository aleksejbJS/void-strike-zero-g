import './styles/hazard.css';
import './styles/atompunk-fonts.css';
import './styles/atompunk.css';
import './styles/atompunk-controls.css';
import './styles/atompunk-rust.css';
import './styles/atompunk-screens.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from './store/uiStore';
import { AccountProvider } from './account/AccountProvider';

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
