/**
 * High-Performance OBS HUD Renderer (60 FPS)
 * Displays Real-Time Twitch Multi-Objective Algorithm Score,
 * Realistic Division Leagues, Attainable Goals, 5-Factor breakdown, and Segment Target Scores.
 */

class StreamHUD {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.isCompact = options.isCompact || false;
    this.showAdvice = options.showAdvice !== false;

    this.activeSegmentView = 'ALL'; // 'ALL', 'E', 'D'

    this._initDOM();
  }

  _initDOM() {
    this.container.innerHTML = `
      <div class="hud-card ${this.isCompact ? 'compact' : ''}" id="hudCard">
        <!-- Header -->
        <div class="hud-header">
          <div class="brand">
            <div class="twitch-pulse" id="hudPulse"></div>
            <span class="brand-title" id="hudBrandTitle">TWITCH ALGO RANKING</span>
          </div>
          <div class="tier-badge" id="tierBadge">ACTIVE</div>
        </div>

        <!-- Live Channel Telemetry Strip -->
        <div class="telemetry-strip" id="telemetryStrip">
          <div class="tele-item">
            <span class="tele-icon" id="teleLiveDot">🔴</span>
            <span class="tele-text" id="teleChannelName">Simulation</span>
          </div>
          <div class="tele-item">
            <span class="tele-label">CCU:</span>
            <span class="tele-val" id="teleCcu">--</span>
          </div>
          <div class="tele-item">
            <span class="tele-label">Game:</span>
            <span class="tele-val tele-game" id="teleGame">--</span>
          </div>
          <div class="tele-item">
            <span class="tele-label">Chat:</span>
            <span class="tele-val" id="teleMsgSec">--</span>
          </div>
        </div>

        <!-- Main Score Gauge -->
        <div class="score-display">
          <div class="gauge-container">
            <svg viewBox="0 0 160 160" class="gauge-svg">
              <circle class="gauge-bg" cx="80" cy="80" r="70"></circle>
              <circle class="gauge-fill" id="gaugeFill" cx="80" cy="80" r="70"></circle>
            </svg>
            <div class="gauge-text">
              <div class="score-val" id="scoreVal">--</div>
              <div class="score-label">TWITCH SCORE</div>
            </div>
          </div>

          <!-- Segment Tabs -->
          <div class="segment-breakdown">
            <div class="segment-pill active" data-segment="ALL">
              <span class="seg-name">Overall Score</span>
              <span class="seg-score" id="segOverallScore">--</span>
            </div>
            <div class="segment-pill" data-segment="E">
              <span class="seg-name">Early (E - Новички)</span>
              <span class="seg-score" id="segEarlyScore">--</span>
            </div>
            <div class="segment-pill" data-segment="D">
              <span class="seg-name">Dedicated (D - Ядро)</span>
              <span class="seg-score" id="segDedicatedScore">--</span>
            </div>
          </div>
        </div>

        <!-- Realistic Division Benchmark Card -->
        <div class="category-benchmark-card" id="catBenchmarkCard">
          <div class="cat-bm-header">
            <div class="cat-bm-title">
              <span class="cat-icon" id="catLeagueIcon">🥈</span>
              <span id="catDivisionRank">#3 в Лиге Growth (100–500 CCU)</span>
            </div>
            <span class="cat-tier-badge" id="catLeagueBadge">GROWTH</span>
          </div>
          
          <div class="cat-bm-bar-track">
            <div class="cat-bm-bar-fill" id="catLeagueProgress" style="width: 50%"></div>
          </div>

          <div class="cat-bm-meta">
            <span id="catGoalText">🎯 Ближайшая цель: +12 CCU до обгона #2</span>
            <span id="catEfficiencyText">⚡ Эфф.: 85%</span>
          </div>
        </div>

        <!-- 5-Factor Signal Breakdown -->
        <div class="factors-section">
          <div class="section-title">
            <span>5-FACTOR DECOMPOSITION (FSM + MMoE)</span>
            <span class="window-tag">14d Delayed Window</span>
          </div>

          <div class="factor-row" id="rowSmp">
            <div class="factor-meta">
              <span class="factor-name">
                <span class="tag fresh">FRESH</span> SMP (Hook 1-3m)
              </span>
              <span class="factor-pct" id="pctSmp">0%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill fresh" id="barSmp" style="width: 0%"></div>
            </div>
          </div>

          <div class="factor-row" id="rowLmp">
            <div class="factor-meta">
              <span class="factor-name">
                <span class="tag delayed">MMoE</span> LMP (Deep Watch)
              </span>
              <span class="factor-pct" id="pctLmp">0%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill mmoe" id="barLmp" style="width: 0%"></div>
            </div>
          </div>

          <div class="factor-row" id="rowChat">
            <div class="factor-meta">
              <span class="factor-name">
                <span class="tag delayed">MMoE</span> Chat Density
              </span>
              <span class="factor-pct" id="pctChat">0%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill mmoe" id="barChat" style="width: 0%"></div>
            </div>
          </div>

          <div class="factor-row" id="rowFollow">
            <div class="factor-meta">
              <span class="factor-name">
                <span class="tag delayed">MMoE</span> Follow Retention
              </span>
              <span class="factor-pct" id="pctFollow">0%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill mmoe" id="barFollow" style="width: 0%"></div>
            </div>
          </div>

          <div class="factor-row" id="rowSpend">
            <div class="factor-meta">
              <span class="factor-name">
                <span class="tag delayed">MMoE</span> Monetization / ARPU
              </span>
              <span class="factor-pct" id="pctSpend">0%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill spend" id="barSpend" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- Live Advice / Actionable Insights -->
        ${this.showAdvice ? `
          <div class="advice-box" id="adviceBox">
            <div class="advice-icon" id="adviceIcon">💡</div>
            <div class="advice-content" id="adviceText">
              Анализ потока данных Twitch в реальном времени...
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Add segment pill listeners
    this.container.querySelectorAll('.segment-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.container.querySelectorAll('.segment-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeSegmentView = pill.dataset.segment;
      });
    });

    // Cache elements
    this.dom = {
      hudCard: this.container.querySelector('#hudCard'),
      tierBadge: this.container.querySelector('#tierBadge'),
      scoreVal: this.container.querySelector('#scoreVal'),
      gaugeFill: this.container.querySelector('#gaugeFill'),
      segOverallScore: this.container.querySelector('#segOverallScore'),
      segEarlyScore: this.container.querySelector('#segEarlyScore'),
      segDedicatedScore: this.container.querySelector('#segDedicatedScore'),
      teleLiveDot: this.container.querySelector('#teleLiveDot'),
      teleChannelName: this.container.querySelector('#teleChannelName'),
      teleCcu: this.container.querySelector('#teleCcu'),
      teleGame: this.container.querySelector('#teleGame'),
      teleMsgSec: this.container.querySelector('#teleMsgSec'),
      catLeagueIcon: this.container.querySelector('#catLeagueIcon'),
      catDivisionRank: this.container.querySelector('#catDivisionRank'),
      catLeagueBadge: this.container.querySelector('#catLeagueBadge'),
      catLeagueProgress: this.container.querySelector('#catLeagueProgress'),
      catGoalText: this.container.querySelector('#catGoalText'),
      catEfficiencyText: this.container.querySelector('#catEfficiencyText'),
      pctSmp: this.container.querySelector('#pctSmp'),
      barSmp: this.container.querySelector('#barSmp'),
      pctLmp: this.container.querySelector('#pctLmp'),
      barLmp: this.container.querySelector('#barLmp'),
      pctChat: this.container.querySelector('#pctChat'),
      barChat: this.container.querySelector('#barChat'),
      pctFollow: this.container.querySelector('#pctFollow'),
      barFollow: this.container.querySelector('#barFollow'),
      pctSpend: this.container.querySelector('#pctSpend'),
      barSpend: this.container.querySelector('#barSpend'),
      adviceIcon: this.container.querySelector('#adviceIcon'),
      adviceText: this.container.querySelector('#adviceText')
    };

    this.gaugeCircumference = 2 * Math.PI * 70;
    this.dom.gaugeFill.style.strokeDasharray = `${this.gaugeCircumference}`;
    this.dom.gaugeFill.style.strokeDashoffset = `${this.gaugeCircumference}`;
  }

  /**
   * Updates HUD with smoothed report from StreamStateManager
   */
  update(report) {
    if (!report) return;

    // 1. Telemetry Strip Update
    const isRealLive = report.mode === 'TWITCH_LIVE';
    const meta = report.state?.meta || {};

    if (isRealLive) {
      this.dom.teleLiveDot.textContent = meta.isLive ? '🔴' : '⚪';
      this.dom.teleChannelName.textContent = report.activeChannel || 'Live Channel';
      const deltaStr = meta.ccuDelta > 0 ? ` (+${meta.ccuDelta})` : (meta.ccuDelta < 0 ? ` (${meta.ccuDelta})` : '');
      this.dom.teleCcu.textContent = `${meta.viewersCount ? Number(meta.viewersCount).toLocaleString() : '0'}${deltaStr}`;
      this.dom.teleGame.textContent = meta.game || 'Just Chatting';
      this.dom.teleMsgSec.textContent = `${(meta.msgPerSec || 0).toFixed(1)}/s`;
    } else {
      this.dom.teleLiveDot.textContent = '🎛️';
      this.dom.teleChannelName.textContent = 'Simulation';
      this.dom.teleCcu.textContent = meta.viewersCount ? `${meta.viewersCount}` : '340';
      this.dom.teleGame.textContent = meta.game || 'Simulated';
      this.dom.teleMsgSec.textContent = `${(meta.msgPerSec || 2.4).toFixed(1)}/s`;
    }

    // 2. Score selection based on segment tab
    let displayScore = report.scoreOverall;
    if (this.activeSegmentView === 'E') displayScore = report.scoreEarly;
    if (this.activeSegmentView === 'D') displayScore = report.scoreDedicated;

    this.dom.scoreVal.textContent = displayScore.toFixed(1);
    this.dom.segOverallScore.textContent = report.scoreOverall.toFixed(1);
    this.dom.segEarlyScore.textContent = report.scoreEarly.toFixed(1);
    this.dom.segDedicatedScore.textContent = report.scoreDedicated.toFixed(1);

    // 3. Gauge Offset
    const offset = this.gaugeCircumference - (displayScore / 100) * this.gaugeCircumference;
    this.dom.gaugeFill.style.strokeDashoffset = offset;
    this.dom.gaugeFill.style.stroke = report.tierColor;

    // 4. Badge
    this.dom.tierBadge.textContent = report.tierBadge;
    this.dom.tierBadge.style.borderColor = report.tierColor;
    this.dom.tierBadge.style.color = report.tierColor;

    // 5. Realistic Division Benchmark Update
    if (report.categoryBenchmark) {
      const cb = report.categoryBenchmark;
      const league = cb.league || { name: 'Growth', icon: '🥈', color: '#94a3b8' };

      this.dom.catLeagueIcon.textContent = league.icon;
      this.dom.catDivisionRank.textContent = `#${cb.divisionRank} в Лиге ${league.name} (${league.desc.split(' ')[0]} CCU)`;
      this.dom.catLeagueBadge.textContent = league.name.toUpperCase();
      this.dom.catLeagueBadge.style.borderColor = league.color;
      this.dom.catLeagueBadge.style.color = league.color;
      
      this.dom.catLeagueProgress.style.width = `${cb.leagueProgressPct}%`;
      this.dom.catLeagueProgress.style.backgroundColor = league.color;
      
      this.dom.catGoalText.textContent = cb.achievableGoalText || `🎯 Прогресс лиги: ${cb.leagueProgressPct}%`;
      this.dom.catEfficiencyText.textContent = `⚡ Эфф.: ${cb.efficiencyIndex}%`;
    }

    // 6. Update 5 Factor bars
    const updateBar = (pctElem, barElem, val) => {
      pctElem.textContent = `${val}%`;
      barElem.style.width = `${val}%`;
    };

    updateBar(this.dom.pctSmp, this.dom.barSmp, report.probs.smp);
    updateBar(this.dom.pctLmp, this.dom.barLmp, report.probs.lmp);
    updateBar(this.dom.pctChat, this.dom.barChat, report.probs.chat);
    updateBar(this.dom.pctFollow, this.dom.barFollow, report.probs.follow);
    updateBar(this.dom.pctSpend, this.dom.barSpend, report.probs.spend);

    // 7. Update Advice
    if (this.showAdvice && report.advice && report.advice.length > 0) {
      const topAdvice = report.advice[0];
      this.dom.adviceIcon.textContent = topAdvice.icon;
      this.dom.adviceText.textContent = topAdvice.text;
    }
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamHUD;
} else {
  window.StreamHUD = StreamHUD;
}
