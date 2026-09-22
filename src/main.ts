import './ui/tokens/design-tokens.css';
import { AppBootstrap } from './app/bootstrap';

// Initialize Phase 0 Foundation
window.addEventListener('DOMContentLoaded', async () => {
  const bootstrap = AppBootstrap.getInstance();
  await bootstrap.init();
});
