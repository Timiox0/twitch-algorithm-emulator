/**
 * Session Analytics & Interactive Timeline View
 * Renders 60 FPS Canvas cardiogram, key events timeline,
 * session summary cards, and exports infographic PNG posters.
 */

class SessionAnalyticsView {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.stateManager = stateManager;
    this.recorder = stateManager.sessionRecorder;

    // Active layer toggles
    this.layers = {
      score: true,
      ccu: true,
      chat: true,
      smp: false
    };

    this.hoverPoint = null;
    this.isHovering = false;

    this._initDOM();
    this._bindEvents();
    this._startRenderLoop();
  }

  _initDOM() {
    this.container.innerHTML = `
      <div class="analytics-panel">
        <div class="analytics-header">
          <div>
            <h2>SESSION ANALYTICS & TIMELINE</h2>
            <span class="sub-header">Поминутная кардиограмма алгоритма Twitch и отчет сессии</span>
          </div>
          <div class="analytics-actions">
            <button class="action-btn btn-export-png" id="btnExportPng">📸 Экспорт постера (PNG)</button>
            <button class="action-btn" id="btnExportJson">📥 JSON</button>
            <button class="action-btn btn-danger" id="btnClearHistory">🔄 Сброс</button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-icon">⏱️</span>
            <div class="kpi-content">
              <span class="kpi-label">Длительность</span>
              <span class="kpi-val" id="kpiDuration">0 мин</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">👥</span>
            <div class="kpi-content">
              <span class="kpi-label">Пиковый CCU</span>
              <span class="kpi-val" id="kpiPeakCcu">0</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">🎯</span>
            <div class="kpi-content">
              <span class="kpi-label">Средний Score</span>
              <span class="kpi-val" id="kpiAvgScore">0.0</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">💬</span>
            <div class="kpi-content">
              <span class="kpi-label">Темп чата</span>
              <span class="kpi-val" id="kpiAvgChat">0.0 msg/s</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">🎮</span>
            <div class="kpi-content">
              <span class="kpi-label">Категория</span>
              <span class="kpi-val kpi-game" id="kpiGame">Just Chatting</span>
            </div>
          </div>
        </div>

        <!-- Interactive Canvas Timeline Section -->
        <div class="timeline-section">
          <div class="timeline-controls">
            <span class="tc-title">📊 КАРДИОГРАММА АЛГОРИТМА TWITCH</span>
            <div class="layer-toggles">
              <label class="layer-pill pill-purple">
                <input type="checkbox" id="toggleScore" checked />
                <span>Twitch Score (0-100)</span>
              </label>
              <label class="layer-pill pill-cyan">
                <input type="checkbox" id="toggleCcu" checked />
                <span>Онлайн (CCU)</span>
              </label>
              <label class="layer-pill pill-emerald">
                <input type="checkbox" id="toggleChat" checked />
                <span>Скорость чата (msg/s)</span>
              </label>
              <label class="layer-pill pill-gold">
                <input type="checkbox" id="toggleSmp" />
                <span>Fresh Hook (p_SMP)</span>
              </label>
            </div>
          </div>

          <div class="canvas-wrap" id="canvasWrap">
            <canvas id="timelineCanvas"></canvas>
            <div class="chart-tooltip" id="chartTooltip" style="display: none;"></div>
          </div>
        </div>

        <!-- Events Feed Section -->
        <div class="events-section">
          <div class="section-label">⚡ ХРОНОЛОГИЯ КЛЮЧЕВЫХ СОБЫТИЙ СТРИМА</div>
          <div class="events-list" id="eventsList">
            <div class="empty-events">События фиксируются в реальном времени...</div>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#timelineCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvasWrap = this.container.querySelector('#canvasWrap');
    this.tooltip = this.container.querySelector('#chartTooltip');

    this._resizeCanvas();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resizeCanvas());

    // Layer toggles
    const bindToggle = (id, key) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('change', (e) => {
          this.layers[key] = e.target.checked;
        });
      }
    };

    bindToggle('toggleScore', 'score');
    bindToggle('toggleCcu', 'ccu');
    bindToggle('toggleChat', 'chat');
    bindToggle('toggleSmp', 'smp');

    // Canvas Scrubbing
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const timeline = this.recorder.getTimeline();

      if (timeline.length < 2) return;

      const pct = Math.min(Math.max(mouseX / rect.width, 0), 1);
      const idx = Math.min(Math.floor(pct * timeline.length), timeline.length - 1);
      const pt = timeline[idx];

      this.hoverPoint = { pt, x: mouseX, y: e.clientY - rect.top };
      this.isHovering = true;
      this._updateTooltip(pt, e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.hoverPoint = null;
      this.tooltip.style.display = 'none';
    });

    // Action buttons
    this.container.querySelector('#btnExportPng').addEventListener('click', () => this.exportInfographicPNG());
    this.container.querySelector('#btnExportJson').addEventListener('click', () => this.exportJSON());
    this.container.querySelector('#btnClearHistory').addEventListener('click', () => {
      if (confirm('Очистить историю текущей сессии?')) {
        this.recorder.clearSession();
        this._updateEventsList();
      }
    });
  }

  _resizeCanvas() {
    if (!this.canvas || !this.canvasWrap) return;
    const rect = this.canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = 320 * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `320px`;
    this.ctx.scale(dpr, dpr);
  }

  _updateTooltip(pt, clientX, clientY) {
    const min = Math.floor(pt.elapsedSec / 60);
    const sec = pt.elapsedSec % 60;
    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    this.tooltip.innerHTML = `
      <div class="tt-time">⏱️ Таймкод: <strong>${timeStr}</strong> (${pt.game})</div>
      <div class="tt-row"><span class="tt-dot purple"></span> Twitch Score: <strong>${pt.scoreOverall.toFixed(1)}/100</strong></div>
      <div class="tt-row"><span class="tt-dot cyan"></span> Онлайн (CCU): <strong>${pt.ccu.toLocaleString()}</strong></div>
      <div class="tt-row"><span class="tt-dot emerald"></span> Скорость чата: <strong>${pt.msgPerSec} msg/s</strong></div>
      <div class="tt-row"><span class="tt-dot gold"></span> Fresh Hook (SMP): <strong>${pt.p_smp}%</strong></div>
    `;

    const wrapRect = this.canvasWrap.getBoundingClientRect();
    let left = clientX - wrapRect.left + 15;
    let top = clientY - wrapRect.top - 20;

    if (left + 220 > wrapRect.width) left = left - 240;
    if (top < 10) top = 10;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.display = 'block';
  }

  _startRenderLoop() {
    const render = () => {
      this._drawTimeline();
      this._updateKPICards();
      this._updateEventsList();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  _updateKPICards() {
    const stats = this.recorder.getSummaryStats();
    const setTxt = (id, val) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.textContent = val;
    };

    setTxt('kpiDuration', `${stats.durationMinutes} мин`);
    setTxt('kpiPeakCcu', stats.peakCCU.toLocaleString());
    setTxt('kpiAvgScore', `${stats.avgScore.toFixed(1)}`);
    setTxt('kpiAvgChat', `${stats.avgChatSpeed.toFixed(1)} msg/s`);
    setTxt('kpiGame', stats.dominantGame);
  }

  _updateEventsList() {
    const events = this.recorder.getEvents();
    const container = this.container.querySelector('#eventsList');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `<div class="empty-events">События стрима (пики скора, хайп в чате) фиксируются на лету...</div>`;
      return;
    }

    container.innerHTML = [...events].reverse().slice(0, 8).map(ev => `
      <div class="event-item event-${ev.type.toLowerCase()}">
        <span class="event-icon">${ev.icon}</span>
        <div class="event-body">
          <div class="event-head">
            <span class="event-title">${ev.title}</span>
            <span class="event-time">${ev.timeFormatted}</span>
          </div>
          <div class="event-desc">${ev.desc}</div>
        </div>
      </div>
    `).join('');
  }

  _drawTimeline() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = 320;

    ctx.clearRect(0, 0, w, h);

    const timeline = this.recorder.getTimeline();
    if (timeline.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Сбор первых точек сессии стрима...', w / 2, h / 2);
      return;
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 20}`, 32, y + 3);
    }

    // Calculate maximums for normalization
    let maxCCU = Math.max(...timeline.map(p => p.ccu), 10);
    let maxChat = Math.max(...timeline.map(p => p.msgPerSec), 5);

    const getX = (idx) => 40 + (idx / (timeline.length - 1)) * (w - 60);

    // 1. Draw Layer: Fresh Hook (p_SMP)
    if (this.layers.smp) {
      this._drawLine(ctx, timeline, getX, (p) => h - (p.p_smp / 100) * (h - 40) - 20, '#fbbf24', 'rgba(251, 191, 36, 0.1)');
    }

    // 2. Draw Layer: Chat Speed (msg/s)
    if (this.layers.chat) {
      this._drawLine(ctx, timeline, getX, (p) => h - (p.msgPerSec / maxChat) * (h - 40) - 20, '#34d399', 'rgba(52, 211, 153, 0.1)');
    }

    // 3. Draw Layer: CCU
    if (this.layers.ccu) {
      this._drawLine(ctx, timeline, getX, (p) => h - (p.ccu / maxCCU) * (h - 40) - 20, '#38bdf8', 'rgba(56, 189, 248, 0.12)');
    }

    // 4. Draw Layer: Twitch Score (0-100)
    if (this.layers.score) {
      this._drawLine(ctx, timeline, getX, (p) => h - (p.scoreOverall / 100) * (h - 40) - 20, '#9146ff', 'rgba(145, 70, 255, 0.25)', 3);
    }

    // 5. Draw Event Markers on timeline
    const events = this.recorder.getEvents();
    for (const ev of events) {
      const idx = timeline.findIndex(p => Math.abs(p.timestamp - ev.timestamp) < 6000);
      if (idx !== -1) {
        const ex = getX(idx);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ex, 20);
        ctx.lineTo(ex, h - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ev.icon, ex, 18);
      }
    }

    // 6. Draw Hover Crosshair
    if (this.isHovering && this.hoverPoint) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.hoverPoint.x, 15);
      ctx.lineTo(this.hoverPoint.x, h - 15);
      ctx.stroke();
    }
  }

  _drawLine(ctx, timeline, getX, getY, color, fillGradient, lineWidth = 2) {
    const h = 320;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    timeline.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    if (fillGradient) {
      ctx.lineTo(getX(timeline.length - 1), h - 20);
      ctx.lineTo(getX(0), h - 20);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }
  }

  /**
   * Generates a high-res 1200x675 PNG Infographic Card
   */
  exportInfographicPNG() {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 1200;
    offCanvas.height = 675;
    const octx = offCanvas.getContext('2d');

    const stats = this.recorder.getSummaryStats();
    const channel = this.stateManager.activeChannel || 'Twitch Streamer';

    // Background Gradient
    const bgGrad = octx.createLinearGradient(0, 0, 1200, 675);
    bgGrad.addColorStop(0, '#0b0e14');
    bgGrad.addColorStop(1, '#111827');
    octx.fillStyle = bgGrad;
    octx.fillRect(0, 0, 1200, 675);

    // Decorative Borders
    octx.strokeStyle = 'rgba(145, 70, 255, 0.3)';
    octx.lineWidth = 3;
    octx.strokeRect(20, 20, 1160, 635);

    // Header
    octx.fillStyle = '#9146ff';
    octx.font = 'bold 28px Inter, sans-serif';
    octx.fillText(`TWITCH ALGORITHM SESSION REPORT • @${channel.toUpperCase()}`, 50, 70);

    octx.fillStyle = '#94a3b8';
    octx.font = '16px Inter, sans-serif';
    octx.fillText(`Категория: ${stats.dominantGame} | Длительность: ${stats.durationMinutes} мин | Дата: ${new Date().toLocaleDateString()}`, 50, 100);

    // KPI Cards on Card
    const drawKpi = (x, y, label, val, color) => {
      octx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      octx.fillRect(x, y, 250, 90);
      octx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      octx.strokeRect(x, y, 250, 90);

      octx.fillStyle = '#94a3b8';
      octx.font = '14px Inter, sans-serif';
      octx.fillText(label, x + 20, y + 35);

      octx.fillStyle = color;
      octx.font = 'bold 30px JetBrains Mono, monospace';
      octx.fillText(val, x + 20, y + 72);
    };

    drawKpi(50, 130, 'ПИКОВЫЙ CCU', `${stats.peakCCU.toLocaleString()}`, '#38bdf8');
    drawKpi(330, 130, 'СРЕДНИЙ ALGO SCORE', `${stats.avgScore}/100`, '#9146ff');
    drawKpi(610, 130, 'ТЕМП ЧАТА', `${stats.avgChatSpeed} msg/s`, '#34d399');
    drawKpi(890, 130, 'КЛЮЧЕВЫЕ СОБЫТИЯ', `${stats.totalEventsCount}`, '#fbbf24');

    // Draw Main Mini-Chart
    const timeline = this.recorder.getTimeline();
    if (timeline.length >= 2) {
      octx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      octx.fillRect(50, 250, 1100, 360);
      octx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      octx.strokeRect(50, 250, 1100, 360);

      const getOX = (idx) => 70 + (idx / (timeline.length - 1)) * 1060;
      const getOY = (score) => 580 - (score / 100) * 300;

      // Draw Score Curve
      octx.lineWidth = 4;
      octx.strokeStyle = '#9146ff';
      octx.beginPath();
      timeline.forEach((p, idx) => {
        const x = getOX(idx);
        const y = getOY(p.scoreOverall);
        if (idx === 0) octx.moveTo(x, y);
        else octx.lineTo(x, y);
      });
      octx.stroke();
    }

    // Download trigger
    const link = document.createElement('a');
    link.download = `twitch_algo_report_${channel}_${Date.now()}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  }

  exportJSON() {
    const data = {
      channel: this.stateManager.activeChannel,
      stats: this.recorder.getSummaryStats(),
      events: this.recorder.getEvents(),
      timeline: this.recorder.getTimeline()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `twitch_session_${Date.now()}.json`;
    link.href = url;
    link.click();
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionAnalyticsView;
} else {
  window.SessionAnalyticsView = SessionAnalyticsView;
}
