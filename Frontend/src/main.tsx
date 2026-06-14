import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { PageLoader } from './components/PageLoader';
import './styles.css';

const savedTheme = localStorage.getItem('jireh.theme');
const initialTheme = savedTheme === 'light' ? 'light' : 'dark-sidebar';
document.documentElement.dataset.theme = initialTheme;
if (savedTheme !== initialTheme) localStorage.setItem('jireh.theme', initialTheme);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then((registration) => registration.update());
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={<PageLoader />}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
