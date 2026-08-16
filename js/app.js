/**
 * Main Application Glue Script
 * Initializes the Twitch Algorithm State, HUD, Control Center, and Session Analytics
 */

document.addEventListener('DOMContentLoaded', () => {
  const isOverlayOnly = document.body.classList.contains('obs-overlay-mode');

  // Initialize Global Stream State Manager
  const stateManager = new StreamStateManager();

  // 1. Initialize HUD
  const hudContainer = document.getElementById('hudContainer');
  if (hudContainer) {
    const hud = new StreamHUD(hudContainer, {
      isCompact: isOverlayOnly,
      showAdvice: true
    });

    stateManager.addListener((report) => {
      hud.update(report);
    });
  }

  // 2. Initialize Controls (only in full dashboard mode)
  const controlsContainer = document.getElementById('controlsContainer');
  if (controlsContainer && !isOverlayOnly) {
    const controls = new StreamControls(controlsContainer, stateManager);
  }

  // 3. Initialize Session Analytics View
  const analyticsContainer = document.getElementById('analyticsContainer');
  let analyticsView = null;
  if (analyticsContainer && !isOverlayOnly) {
    analyticsView = new SessionAnalyticsView(analyticsContainer, stateManager);
  }

  // 4. Tab Switching in Main Dashboard
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const mainContent = document.getElementById('mainContent');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      if (!mainContent) return;

      if (view === 'analytics') {
        mainContent.style.gridTemplateColumns = '1fr';
        if (hudContainer) hudContainer.style.display = 'none';
        if (controlsContainer) controlsContainer.style.display = 'none';
        if (analyticsContainer) {
          analyticsContainer.style.display = 'flex';
          if (analyticsView) analyticsView._resizeCanvas();
        }
      } else if (view === 'hud-only') {
        mainContent.style.gridTemplateColumns = '1fr';
        if (hudContainer) hudContainer.style.display = 'flex';
        if (controlsContainer) controlsContainer.style.display = 'none';
        if (analyticsContainer) analyticsContainer.style.display = 'none';
      } else if (view === 'controls-only') {
        mainContent.style.gridTemplateColumns = '1fr';
        if (hudContainer) hudContainer.style.display = 'none';
        if (controlsContainer) controlsContainer.style.display = 'flex';
        if (analyticsContainer) analyticsContainer.style.display = 'none';
      } else { // 'split'
        mainContent.style.gridTemplateColumns = '420px 1fr';
        if (hudContainer) hudContainer.style.display = 'flex';
        if (controlsContainer) controlsContainer.style.display = 'flex';
        if (analyticsContainer) analyticsContainer.style.display = 'none';
      }
    });
  });
});
