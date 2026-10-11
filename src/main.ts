import { mountGruselino } from './ui/game-app.js';
import { setupOfflineApp } from './ui/offline-app.js';

const root = document.getElementById('gruselino-root');
if (root) mountGruselino(root, { version: root.dataset.version ?? '1.0.0.1' });
setupOfflineApp();
