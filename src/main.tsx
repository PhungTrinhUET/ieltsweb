import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import './styles.css';
import './exam.css';
import './learn.css';
import App from './App';
import { applyTheme, getSettings } from './store';
import { consumeAuthRedirect, startCloud } from './lib/cloud';

applyTheme(getSettings().theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getSettings().theme));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

// Link trong email (đặt lại mật khẩu) mang token trong #… → đọc trước khi HashRouter chạy.
consumeAuthRedirect();
startCloud();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
