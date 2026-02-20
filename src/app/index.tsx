
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);
