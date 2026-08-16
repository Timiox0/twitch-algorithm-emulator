/**
 * Streamer Control Center & Algorithm Inspector (High Frequency Real-Time)
 */

class StreamControls {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.stateManager = stateManager;
    this.activeTableTab = 'PEER';

    this._initDOM();
    this._bindEvents();
    this._syncInitialUI();
  }

  _initDOM() {
    this.container.innerHTML = `
      <div class="control-panel">
        <div class="panel-header">
          <div>
            <h2>STREAM CONTROL CENTER</h2>
            <span class="sub-header">Twitch Live Telemetry Engine & Dynamic CCU Tracking</span>
          </div>
          <div class="mode-pill-toggle">
            <button class="mode-toggle-btn" id="modeLiveBtn">🔴 REAL TWITCH LIVE</button>
            <button class="mode-toggle-btn" id="modeSimBtn">🎛️ SIMULATOR</button>
          </div>
        </div>

        <!-- Live Twitch Connect Section -->
        <div class="control-section live-connect-box" id="liveConnectSection">
          <div class="section-label">🌐 ПОДКЛЮЧЕНИЕ К ЖИВОМУ TWITCH КАНАЛУ (GQL + IRC)</div>
          <div class="twitch-input-row">
            <input type="text" id="twitchChannelInput" class="twitch-input" placeholder="Введите имя канала (напр. kiryanyam, ibai, gaules)..." />
            <button id="twitchConnectBtn" class="twitch-btn">Подключить Live</button>
          </div>

          <div class="quick-channels">
            <span class="quick-label">Быстрый выбор:</span>
            <button class="quick-chan-btn" data-channel="kiryanyam">kiryanyam</button>
            <button class="quick-chan-btn" data-channel="ibai">ibai</button>
            <button class="quick-chan-btn" data-channel="gaules">gaules</button>
            <button class="quick-chan-btn" data-channel="tarik">tarik</button>
            <button class="quick-chan-btn" data-channel="shroud">shroud</button>
          </div>

          <!-- Real-Time Dynamic Telemetry Dashboard -->
          <div class="live-telemetry-dashboard" id="liveTelemetryDashboard" style="display: none;">
            <div class="telemetry-card">
              <span class="tc-label">Статус трансляции</span>
              <span class="tc-val" id="tcLiveStatus">🔴 LIVE</span>
            </div>
            <div class="telemetry-card">
              <span class="tc-label">Онлайн (CCU)</span>
              <div class="tc-ccu-row">
                <span class="tc-val" id="tcCcu">0</span>
                <span class="delta-badge" id="tcCcuDelta">--</span>
              </div>
            </div>
            <div class="telemetry-card">
              <span class="tc-label">Скорость чата</span>
              <span class="tc-val" id="tcChatSpeed">0.0 msg/s</span>
            </div>
            <div class="telemetry-card">
              <span class="tc-label">Аптайм стрима</span>
              <span class="tc-val" id="tcUptime">0 мин</span>
            </div>
            <div class="telemetry-card full-width">
              <div class="tc-split-header">
                <span>Состав чата (Байджи):</span>
                <span id="tcBadgeRatioText">50% Dedicated / 50% Early</span>
              </div>
              <div class="badge-ratio-bar">
                <div class="badge-ratio-ded" id="badgeRatioDed" style="width: 50%"></div>
                <div class="badge-ratio-early" id="badgeRatioEarly" style="width: 50%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Realistic Division Competitors Section -->
        <div class="control-section category-competitors-box" id="categoryCompetitorsSection">
          <div class="cat-section-header">
            <div class="section-label">🏆 СОПЕРНИЧЕСТВО В КАТЕГОРИИ & ДИВИЗИОНЫ</div>
            <div class="cat-tab-toggles">
              <button class="cat-tab-btn active" id="tabPeerRivalsBtn">🎯 Мой дивизион (Ближайшие)</button>
              <button class="cat-tab-btn" id="tabGlobalTopBtn">👑 Глобальный топ</button>
            </div>
          </div>

          <!-- League Progression Banner -->
          <div class="league-progress-box" id="leagueProgressBox">
            <div class="lpb-header">
              <span class="lpb-title" id="lpbTitle">🥈 Лига: Growth (100 – 500 CCU)</span>
              <span class="lpb-next" id="lpbNext">Следующая: 🥇 Pro League (500 CCU)</span>
            </div>
            <div class="lpb-track">
              <div class="lpb-fill" id="lpbFill" style="width: 45%"></div>
            </div>
            <div class="lpb-goal" id="lpbGoal">🎯 Ближайшая цель: синхронизация с Twitch...</div>
          </div>

          <div class="cat-table-wrap">
            <table class="cat-table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Канал</th>
                  <th>Онлайн (CCU)</th>
                  <th>Название трансляции</th>
                </tr>
              </thead>
              <tbody id="catTableBody">
                <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Загрузка соперников дивизиона...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Presets Section (Active in Simulator mode) -->
        <div class="control-section" id="presetsSection" style="display: none;">
          <div class="section-label">⚡ СЦЕНАРИИ СИМУЛЯЦИИ (QUICK PRESETS)</div>
          <div class="preset-grid">
            <button class="preset-btn" data-preset="VIRAL_RAID">
              <span class="btn-icon">🔥</span>
              <span class="btn-text">Viral Raid</span>
            </button>
            <button class="preset-btn" data-preset="DEEP_COMMUNITY">
              <span class="btn-icon">👑</span>
              <span class="btn-text">Dedicated Core</span>
            </button>
            <button class="preset-btn" data-preset="AFK_OR_DEAD">
              <span class="btn-icon">💤</span>
              <span class="btn-text">Dead Chat / AFK</span>
            </button>
            <button class="preset-btn active" data-preset="BALANCED_GRIND">
              <span class="btn-icon">⚖️</span>
              <span class="btn-text">Balanced Grind</span>
            </button>
          </div>
        </div>

        <!-- Sliders Grid -->
        <div class="control-grid" id="slidersGrid" style="display: none;">
          <div class="control-col">
            <div class="col-title">
              <span class="tag fresh">FRESH SIGNAL MODEL</span>
              <span>Входные параметры p_SMP</span>
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Hook Velocity (Удержание 1-3 мин):</span>
                <span class="val-badge" id="valHookVelocity">65%</span>
              </div>
              <input type="range" min="0" max="100" value="65" class="slider slider-fresh" id="sliderHookVelocity" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Chat Reactivity (Реакция чата на стримера):</span>
                <span class="val-badge" id="valChatReactivity">60%</span>
              </div>
              <input type="range" min="0" max="100" value="60" class="slider slider-fresh" id="sliderChatReactivity" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Streamer Energy & Action:</span>
                <span class="val-badge" id="valStreamerEnergy">70%</span>
              </div>
              <input type="range" min="0" max="100" value="70" class="slider slider-fresh" id="sliderStreamerEnergy" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Title & Thumbnail Clickability:</span>
                <span class="val-badge" id="valTitleClickability">60%</span>
              </div>
              <input type="range" min="0" max="100" value="60" class="slider slider-fresh" id="sliderTitleClickability" />
            </div>
          </div>

          <div class="control-col">
            <div class="col-title">
              <span class="tag delayed">MMoE COMPONENT</span>
              <span>14-дневные отложенные сигналы</span>
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Avg Watch Duration (LMP):</span>
                <span class="val-badge" id="valAvgWatchDuration">65%</span>
              </div>
              <input type="range" min="0" max="100" value="65" class="slider slider-mmoe" id="sliderAvgWatchDuration" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Chatter / Viewer Ratio:</span>
                <span class="val-badge" id="valChatterRatio">45%</span>
              </div>
              <input type="range" min="0" max="100" value="45" class="slider slider-mmoe" id="sliderChatterRatio" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>14-day Historical Loyalty:</span>
                <span class="val-badge" id="valHistoricalLoyalty">55%</span>
              </div>
              <input type="range" min="0" max="100" value="55" class="slider slider-mmoe" id="sliderHistoricalLoyalty" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Monetization & Bits Intensity:</span>
                <span class="val-badge" id="valMonetizationIntensity">30%</span>
              </div>
              <input type="range" min="0" max="100" value="30" class="slider slider-spend" id="sliderMonetizationIntensity" />
            </div>

            <div class="slider-group">
              <div class="slider-label">
                <span>Состав аудитории (Dedicated vs Early):</span>
                <span class="val-badge" id="valDedicatedRatio">50% Core</span>
              </div>
              <input type="range" min="0" max="100" value="50" class="slider" id="sliderDedicatedRatio" />
            </div>
          </div>
        </div>

        <!-- MMoE Neural Inspector Section -->
        <div class="control-section neural-inspector">
          <div class="section-label">🧠 ИНСПЕКТОР НЕЙРОСЕТИ MMoE (K=4 EXPERTS & GATING)</div>
          <div class="experts-grid" id="expertsGrid"></div>
        </div>
      </div>
    `;
  }

  _syncInitialUI() {
    const isLive = this.stateManager.mode === 'TWITCH_LIVE';
    const channel = this.stateManager.activeChannel;

    const modeLiveBtn = this.container.querySelector('#modeLiveBtn');
    const modeSimBtn = this.container.querySelector('#modeSimBtn');
    const liveConnectSection = this.container.querySelector('#liveConnectSection');
    const categoryCompetitorsSection = this.container.querySelector('#categoryCompetitorsSection');
    const presetsSection = this.container.querySelector('#presetsSection');
    const slidersGrid = this.container.querySelector('#slidersGrid');
    const twitchInput = this.container.querySelector('#twitchChannelInput');
    const twitchBtn = this.container.querySelector('#twitchConnectBtn');

    if (channel) {
      twitchInput.value = channel;
    }

    if (isLive) {
      modeLiveBtn.classList.add('active');
      modeSimBtn.classList.remove('active');
      liveConnectSection.style.display = 'flex';
      categoryCompetitorsSection.style.display = 'flex';
      presetsSection.style.display = 'none';
      slidersGrid.style.display = 'none';
      twitchBtn.textContent = 'Отключить Live';
      twitchBtn.classList.add('connected');
    } else {
      modeSimBtn.classList.add('active');
      modeLiveBtn.classList.remove('active');
      liveConnectSection.style.display = 'none';
      categoryCompetitorsSection.style.display = 'flex';
      presetsSection.style.display = 'flex';
      slidersGrid.style.display = 'grid';
      twitchBtn.textContent = 'Подключить Live';
      twitchBtn.classList.remove('connected');

      this.container.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.preset === this.stateManager.activePreset);
      });
    }

    this._syncSlidersWithState();
  }

  _bindEvents() {
    const modeLiveBtn = this.container.querySelector('#modeLiveBtn');
    const modeSimBtn = this.container.querySelector('#modeSimBtn');
    const liveConnectSection = this.container.querySelector('#liveConnectSection');
    const categoryCompetitorsSection = this.container.querySelector('#categoryCompetitorsSection');
    const presetsSection = this.container.querySelector('#presetsSection');
    const slidersGrid = this.container.querySelector('#slidersGrid');
    const twitchBtn = this.container.querySelector('#twitchConnectBtn');
    const twitchInput = this.container.querySelector('#twitchChannelInput');

    const doConnect = (rawChan) => {
      const chan = (rawChan || twitchInput.value || '').trim().toLowerCase().replace('#', '');
      if (!chan) return;
      twitchInput.value = chan;
      this.stateManager.connectLiveChannel(chan);
      modeLiveBtn.classList.add('active');
      modeSimBtn.classList.remove('active');
      liveConnectSection.style.display = 'flex';
      presetsSection.style.display = 'none';
      slidersGrid.style.display = 'none';
      twitchBtn.textContent = 'Отключить Live';
      twitchBtn.classList.add('connected');

      // Update navbar OBS links dynamically
      document.querySelectorAll('.obs-link-btn').forEach(a => {
        try {
          const url = new URL(a.href, window.location.origin);
          url.searchParams.set('channel', chan);
          a.href = url.pathname + url.search;
        } catch (e) {}
      });
    };

    modeLiveBtn.addEventListener('click', () => {
      const chan = (twitchInput.value || this.stateManager.activeChannel || 'kiryanyam').trim();
      doConnect(chan);
    });

    modeSimBtn.addEventListener('click', () => {
      modeSimBtn.classList.add('active');
      modeLiveBtn.classList.remove('active');
      liveConnectSection.style.display = 'none';
      categoryCompetitorsSection.style.display = 'flex';
      presetsSection.style.display = 'flex';
      slidersGrid.style.display = 'grid';
      this.stateManager.disconnectLiveChannel();
      twitchBtn.textContent = 'Подключить Live';
      twitchBtn.classList.remove('connected');
    });

    const tabPeerRivalsBtn = this.container.querySelector('#tabPeerRivalsBtn');
    const tabGlobalTopBtn = this.container.querySelector('#tabGlobalTopBtn');

    tabPeerRivalsBtn.addEventListener('click', () => {
      tabPeerRivalsBtn.classList.add('active');
      tabGlobalTopBtn.classList.remove('active');
      this.activeTableTab = 'PEER';
      this._updateCategoryTable(this.stateManager.smoothedReport);
    });

    tabGlobalTopBtn.addEventListener('click', () => {
      tabGlobalTopBtn.classList.add('active');
      tabPeerRivalsBtn.classList.remove('active');
      this.activeTableTab = 'GLOBAL';
      this._updateCategoryTable(this.stateManager.smoothedReport);
    });

    this.container.querySelectorAll('.quick-chan-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chan = btn.dataset.channel;
        doConnect(chan);
      });
    });

    twitchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doConnect(twitchInput.value);
      }
    });

    twitchBtn.addEventListener('click', () => {
      const inputChan = (twitchInput.value || '').trim().toLowerCase().replace('#', '');
      if (this.stateManager.mode === 'TWITCH_LIVE' && this.stateManager.activeChannel === inputChan) {
        this.stateManager.disconnectLiveChannel();
        twitchBtn.textContent = 'Подключить Live';
        twitchBtn.classList.remove('connected');
      } else {
        doConnect(inputChan);
      }
    });

    this.container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.stateManager.applyPreset(btn.dataset.preset);
        this._syncSlidersWithState();
      });
    });

    const mapSlider = (id, stateKey, valElemId, formatFn) => {
      const slider = this.container.querySelector(`#${id}`);
      const valElem = this.container.querySelector(`#${valElemId}`);
      if (!slider || !valElem) return;
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        this.stateManager.updateFeature(stateKey, val);
        valElem.textContent = formatFn ? formatFn(val) : `${Math.round(val * 100)}%`;
      });
    };

    mapSlider('sliderHookVelocity', 'hookVelocity', 'valHookVelocity');
    mapSlider('sliderChatReactivity', 'chatReactivity', 'valChatReactivity');
    mapSlider('sliderStreamerEnergy', 'streamerEnergy', 'valStreamerEnergy');
    mapSlider('sliderTitleClickability', 'titleClickability', 'valTitleClickability');
    mapSlider('sliderAvgWatchDuration', 'avgWatchDuration', 'valAvgWatchDuration');
    mapSlider('sliderChatterRatio', 'chatterRatio', 'valChatterRatio');
    mapSlider('sliderHistoricalLoyalty', 'historicalLoyalty', 'valHistoricalLoyalty');
    mapSlider('sliderMonetizationIntensity', 'monetizationIntensity', 'valMonetizationIntensity');
    mapSlider('sliderDedicatedRatio', 'dedicatedRatio', 'valDedicatedRatio', (v) => `${Math.round(v * 100)}% Core`);

    this.stateManager.addListener((report) => {
      this._updateTelemetryDashboard(report);
      this._updateLeagueBanner(report);
      this._updateCategoryTable(report);
      this._updateMMoEInspector(report);
      if (this.stateManager.mode === 'TWITCH_LIVE') {
        this._syncSlidersWithState();
      }
    });
  }

  _updateTelemetryDashboard(report) {
    if (!report) return;
    const isLiveMode = report.mode === 'TWITCH_LIVE';
    const dashboard = this.container.querySelector('#liveTelemetryDashboard');
    const twitchBtn = this.container.querySelector('#twitchConnectBtn');

    if (isLiveMode && dashboard) {
      dashboard.style.display = 'grid';
      twitchBtn.textContent = 'Отключить Live';
      twitchBtn.classList.add('connected');

      const meta = report.state?.meta || {};
      const tcLiveStatus = this.container.querySelector('#tcLiveStatus');
      const tcCcu = this.container.querySelector('#tcCcu');
      const tcCcuDelta = this.container.querySelector('#tcCcuDelta');
      const tcChatSpeed = this.container.querySelector('#tcChatSpeed');
      const tcUptime = this.container.querySelector('#tcUptime');
      const tcBadgeRatioText = this.container.querySelector('#tcBadgeRatioText');
      const badgeRatioDed = this.container.querySelector('#badgeRatioDed');
      const badgeRatioEarly = this.container.querySelector('#badgeRatioEarly');

      tcLiveStatus.textContent = meta.isLive ? '🔴 LIVE' : '⚪ OFFLINE';
      tcLiveStatus.className = meta.isLive ? 'tc-val status-live' : 'tc-val status-offline';
      tcCcu.textContent = meta.viewersCount ? Number(meta.viewersCount).toLocaleString() : '0';

      // Dynamic Delta Indicator
      const delta = meta.ccuDelta || 0;
      if (delta > 0) {
        tcCcuDelta.textContent = `▲ +${delta}`;
        tcCcuDelta.className = 'delta-badge delta-pos';
        tcCcuDelta.style.display = 'inline-block';
      } else if (delta < 0) {
        tcCcuDelta.textContent = `▼ ${delta}`;
        tcCcuDelta.className = 'delta-badge delta-neg';
        tcCcuDelta.style.display = 'inline-block';
      } else {
        tcCcuDelta.textContent = `● stable`;
        tcCcuDelta.className = 'delta-badge delta-neutral';
        tcCcuDelta.style.display = 'inline-block';
      }

      tcChatSpeed.textContent = `${(meta.msgPerSec || 0).toFixed(1)} msg/s`;
      tcUptime.textContent = `${meta.uptimeMinutes || 0} мин`;

      const dedPct = Math.round((report.state?.dedicatedRatio || 0.5) * 100);
      const earlyPct = 100 - dedPct;
      tcBadgeRatioText.textContent = `${dedPct}% Dedicated / ${earlyPct}% Early`;
      badgeRatioDed.style.width = `${dedPct}%`;
      badgeRatioEarly.style.width = `${earlyPct}%`;
    }
  }

  _updateLeagueBanner(report) {
    if (!report || !report.categoryBenchmark) return;
    const cb = report.categoryBenchmark;
    const league = cb.league || { name: 'Growth', icon: '🥈', color: '#94a3b8' };
    const nextLeague = cb.nextLeague;

    const lpbTitle = this.container.querySelector('#lpbTitle');
    const lpbNext = this.container.querySelector('#lpbNext');
    const lpbFill = this.container.querySelector('#lpbFill');
    const lpbGoal = this.container.querySelector('#lpbGoal');

    if (lpbTitle) lpbTitle.textContent = `${league.icon} Лига: ${league.name} (${league.desc.split(' ')[0]} CCU)`;
    if (lpbNext) {
      lpbNext.textContent = nextLeague 
        ? `Следующая: ${nextLeague.icon} ${nextLeague.name} (${nextLeague.minCCU} CCU)`
        : `👑 Максимальная лига`;
    }
    if (lpbFill) {
      lpbFill.style.width = `${cb.leagueProgressPct}%`;
      lpbFill.style.backgroundColor = league.color;
    }
    if (lpbGoal) lpbGoal.textContent = cb.achievableGoalText || '🎯 Держите текущий темп удержания!';
  }

  _updateCategoryTable(report) {
    if (!report || !report.categoryBenchmark) return;
    const cb = report.categoryBenchmark;
    const tbody = this.container.querySelector('#catTableBody');
    if (!tbody) return;

    const currentChannel = (report.activeChannel || 'Ваш Стрим').toLowerCase();

    const streamList = this.activeTableTab === 'PEER'
      ? (cb.peerRivals || [])
      : (cb.globalStreams || []);

    if (streamList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Загрузка данных конкурентов...</td></tr>`;
      return;
    }

    tbody.innerHTML = streamList.map((s, idx) => {
      const isCurrent = s.isCurrent || (s.channel && s.channel.toLowerCase() === currentChannel);
      const rankBadge = idx === 0 ? '🥇 #1' : (idx === 1 ? '🥈 #2' : (idx === 2 ? '🥉 #3' : `#${idx + 1}`));
      return `
        <tr class="${isCurrent ? 'current-stream-row' : ''}">
          <td class="cat-rank-col">${rankBadge}</td>
          <td class="cat-chan-col">
            <strong>${s.displayName}</strong> ${isCurrent ? '<span class="you-badge">(Вы)</span>' : ''}
          </td>
          <td class="cat-ccu-col">${Number(s.viewersCount ?? s.viewers ?? 0).toLocaleString()}</td>
          <td class="cat-title-col" title="${s.title || ''}">${s.title || 'Live Stream'}</td>
        </tr>
      `;
    }).join('');
  }

  _syncSlidersWithState() {
    const s = this.stateManager.state;
    const setVal = (id, valId, val, formatFn) => {
      const slider = this.container.querySelector(`#${id}`);
      const valElem = this.container.querySelector(`#${valId}`);
      if (slider && valElem) {
        slider.value = Math.round(val * 100);
        valElem.textContent = formatFn ? formatFn(val) : `${Math.round(val * 100)}%`;
      }
    };

    setVal('sliderHookVelocity', 'valHookVelocity', s.hookVelocity);
    setVal('sliderChatReactivity', 'valChatReactivity', s.chatReactivity);
    setVal('sliderStreamerEnergy', 'valStreamerEnergy', s.streamerEnergy);
    setVal('sliderTitleClickability', 'valTitleClickability', s.titleClickability);
    setVal('sliderAvgWatchDuration', 'valAvgWatchDuration', s.avgWatchDuration);
    setVal('sliderChatterRatio', 'valChatterRatio', s.chatterRatio);
    setVal('sliderHistoricalLoyalty', 'valHistoricalLoyalty', s.historicalLoyalty);
    setVal('sliderMonetizationIntensity', 'valMonetizationIntensity', s.monetizationIntensity);
    setVal('sliderDedicatedRatio', 'valDedicatedRatio', s.dedicatedRatio, (v) => `${Math.round(v * 100)}% Core`);
  }

  _updateMMoEInspector(report) {
    if (!report || !report.mmoeDetails) return;
    const { expertOutputs, expertProfiles, gating } = report.mmoeDetails;
    const grid = this.container.querySelector('#expertsGrid');
    if (!grid) return;

    grid.innerHTML = expertProfiles.map((p, idx) => {
      const act = Math.round(expertOutputs[idx] * 100);
      return `
        <div class="expert-card">
          <div class="expert-header">
            <span class="expert-title">E${idx}: ${p.name}</span>
            <span class="expert-act">${act}%</span>
          </div>
          <div class="expert-bar">
            <div class="expert-fill" style="width: ${act}%"></div>
          </div>
          <div class="gating-pills">
            <span class="gate-pill">LMP: ${Math.round((gating.lmp[idx] || 0) * 100)}%</span>
            <span class="gate-pill">Chat: ${Math.round((gating.chat[idx] || 0) * 100)}%</span>
            <span class="gate-pill">Follow: ${Math.round((gating.follow[idx] || 0) * 100)}%</span>
            <span class="gate-pill">Spend: ${Math.round((gating.spend[idx] || 0) * 100)}%</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamControls;
} else {
  window.StreamControls = StreamControls;
}
