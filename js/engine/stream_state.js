/**
 * Stream State Manager & Algorithm Coordinator (High-Frequency Real-Time Engine)
 * Polls Twitch GQL every 2.0s with dynamic delta tracking and instant updates.
 */

const STORAGE_KEY = 'twitch_algo_session_v1';

class StreamStateManager {
  constructor() {
    this.fsm = new FreshSignalModel();
    this.mmoe = new MMoEModel(4);
    this.vst = new ViewerSegmentTargeting();
    this.featureExtractor = new FeatureExtractor();
    this.categoryEngine = new CategoryBenchmarkEngine();
    this.sessionRecorder = new SessionRecorder();

    this.mode = 'SIMULATOR';
    this.activeChannel = '';
    this.activePreset = 'BALANCED_GRIND';

    this.liveApiData = null;
    this.liveCategoryData = null;
    this.liveIrcConnector = null;
    this.apiPollInterval = null;
    this.categoryPollCounter = 0;

    // Rolling CCU history for dynamic delta tracking
    this.ccuHistory = [];
    this.currentCcuDelta = 0;

    this.state = {
      hookVelocity: 0.60,
      chatReactivity: 0.55,
      streamerEnergy: 0.65,
      visualClarity: 0.90,
      titleClickability: 0.60,

      avgWatchDuration: 0.60,
      chatterRatio: 0.40,
      historicalLoyalty: 0.50,
      monetizationIntensity: 0.35,

      dedicatedRatio: 0.50,

      meta: {
        isLive: false,
        viewersCount: 0,
        ccuDelta: 0,
        uptimeMinutes: 0,
        game: 'Just Chatting',
        title: 'Twitch Stream',
        followersCount: 0,
        msgPerSec: 0.0,
        uniqueChatters: 0,
        lastUpdated: Date.now()
      }
    };

    this.smoothedReport = null;
    this.listeners = [];

    this._restoreSession();

    // Auto update loop (runs at 10Hz)
    this.intervalId = setInterval(() => this._tick(), 100);
  }

  _restoreSession() {
    try {
      let urlChannel = '';
      let urlMode = '';
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        urlChannel = params.get('channel') || '';
        urlMode = params.get('mode') || '';
      }

      let savedData = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          savedData = JSON.parse(raw);
        }
      }

      const channelToUse = (urlChannel || savedData?.channel || '').toLowerCase().replace('#', '').trim();
      const modeToUse = urlMode ? (urlMode === 'live' ? 'TWITCH_LIVE' : 'SIMULATOR') : (savedData?.mode || (channelToUse ? 'TWITCH_LIVE' : 'SIMULATOR'));
      this.activePreset = savedData?.preset || 'BALANCED_GRIND';

      if (modeToUse === 'TWITCH_LIVE' && channelToUse) {
        this.connectLiveChannel(channelToUse);
      } else {
        this.applyPreset(this.activePreset);
      }
    } catch (e) {
      console.warn('Session restore error:', e);
      this.applyPreset('BALANCED_GRIND');
    }
  }

  _saveSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const payload = {
          channel: this.activeChannel,
          mode: this.mode,
          preset: this.activePreset
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }

      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        if (this.mode === 'TWITCH_LIVE' && this.activeChannel) {
          url.searchParams.set('channel', this.activeChannel);
          url.searchParams.set('mode', 'live');
        } else {
          url.searchParams.delete('channel');
          url.searchParams.set('mode', 'simulator');
        }
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      console.warn('Session save error:', e);
    }
  }

  addListener(fn) {
    this.listeners.push(fn);
  }

  setMode(mode) {
    this.mode = mode;
    this._saveSession();
    this._notify();
  }

  updateFeature(key, val) {
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = Math.min(Math.max(val, 0), 1);
    }
  }

  updateState(partial) {
    Object.assign(this.state, partial);
  }

  connectLiveChannel(channelName) {
    if (!channelName) return;
    this.activeChannel = channelName.toLowerCase().replace('#', '').trim();
    this.mode = 'TWITCH_LIVE';
    this.ccuHistory = [];

    this._saveSession();

    if (this.liveIrcConnector) {
      this.liveIrcConnector.disconnect();
    }

    this.liveIrcConnector = new TwitchLiveConnector((evt) => {
      this._onIrcEvent(evt);
    });
    this.liveIrcConnector.connect(this.activeChannel);

    // Initial immediate fetch
    this._fetchLiveMetadata();

    // High frequency 2000ms polling for live CCU
    if (this.apiPollInterval) clearInterval(this.apiPollInterval);
    this.apiPollInterval = setInterval(() => this._fetchLiveMetadata(), 2000);
  }

  disconnectLiveChannel() {
    this.mode = 'SIMULATOR';
    if (this.liveIrcConnector) {
      this.liveIrcConnector.disconnect();
      this.liveIrcConnector = null;
    }
    if (this.apiPollInterval) {
      clearInterval(this.apiPollInterval);
      this.apiPollInterval = null;
    }
    this.activeChannel = '';
    this.liveCategoryData = null;
    this.ccuHistory = [];
    this._saveSession();
  }

  async _fetchLiveMetadata() {
    if (!this.activeChannel) return;
    try {
      const res = await fetch(`/api/twitch/stream?channel=${encodeURIComponent(this.activeChannel)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        this.liveApiData = data;

        // Dynamic CCU Delta Tracking
        const currentCCU = data.isLive ? (data.viewersCount || 0) : 0;
        const now = Date.now();
        this.ccuHistory.push({ time: now, ccu: currentCCU });
        // Keep last 60 seconds
        this.ccuHistory = this.ccuHistory.filter(h => now - h.time <= 60000);

        if (this.ccuHistory.length > 1) {
          const oldest = this.ccuHistory[0];
          this.currentCcuDelta = currentCCU - oldest.ccu;
        } else {
          this.currentCcuDelta = 0;
        }

        this._recomputeLiveFeatures();

        // Refresh category peers every 3rd poll (every 6 seconds)
        this.categoryPollCounter++;
        if (data.game && this.categoryPollCounter % 3 === 0) {
          this._fetchCategoryData(data.game, currentCCU);
        }
      }
    } catch (e) {
      console.warn('Live API fetch warning:', e);
    }
  }

  async _fetchCategoryData(gameName, ccu = 0) {
    try {
      const chan = this.activeChannel || '';
      const res = await fetch(`/api/twitch/category?game=${encodeURIComponent(gameName)}&ccu=${ccu}&channel=${encodeURIComponent(chan)}&_t=${Date.now()}`);
      if (res.ok) {
        this.liveCategoryData = await res.json();
      }
    } catch (e) {
      console.warn('Category fetch error:', e);
    }
  }

  _onIrcEvent(evt) {
    this._recomputeLiveFeatures();
  }

  _recomputeLiveFeatures() {
    if (this.mode !== 'TWITCH_LIVE') return;

    const ircMetrics = this.liveIrcConnector ? this.liveIrcConnector.getMetrics() : {};
    const extracted = this.featureExtractor.extract(this.liveApiData || {}, ircMetrics);

    this.state.hookVelocity = extracted.hookVelocity;
    this.state.chatReactivity = extracted.chatReactivity;
    this.state.streamerEnergy = extracted.streamerEnergy;
    this.state.visualClarity = extracted.visualClarity;
    this.state.titleClickability = extracted.titleClickability;
    this.state.avgWatchDuration = extracted.avgWatchDuration;
    this.state.chatterRatio = extracted.chatterRatio;
    this.state.historicalLoyalty = extracted.historicalLoyalty;
    this.state.monetizationIntensity = extracted.monetizationIntensity;
    this.state.dedicatedRatio = extracted.dedicatedRatio;
    
    // Attach live delta and timestamp
    this.state.meta = {
      ...extracted.meta,
      ccuDelta: this.currentCcuDelta,
      lastUpdated: Date.now()
    };
  }

  applyPreset(presetName) {
    this.mode = 'SIMULATOR';
    this.activePreset = presetName;
    this._saveSession();

    switch (presetName) {
      case 'VIRAL_RAID':
        this.updateState({
          hookVelocity: 0.95,
          chatReactivity: 0.90,
          streamerEnergy: 0.95,
          titleClickability: 0.85,
          avgWatchDuration: 0.75,
          chatterRatio: 0.80,
          historicalLoyalty: 0.40,
          monetizationIntensity: 0.85,
          dedicatedRatio: 0.25,
          meta: {
            isLive: true,
            viewersCount: 2850,
            ccuDelta: 140,
            uptimeMinutes: 75,
            game: 'Just Chatting',
            title: '🔥 BIG RAID INCOMING! Sub train hype',
            followersCount: 85000,
            msgPerSec: 14.8,
            uniqueChatters: 420
          }
        });
        break;

      case 'DEEP_COMMUNITY':
        this.updateState({
          hookVelocity: 0.40,
          chatReactivity: 0.70,
          streamerEnergy: 0.50,
          titleClickability: 0.45,
          avgWatchDuration: 0.90,
          chatterRatio: 0.65,
          historicalLoyalty: 0.85,
          monetizationIntensity: 0.60,
          dedicatedRatio: 0.85,
          meta: {
            isLive: true,
            viewersCount: 620,
            ccuDelta: 12,
            uptimeMinutes: 180,
            game: 'Retro Gaming / Chill',
            title: 'Late Night Chill Community Hangout',
            followersCount: 32000,
            msgPerSec: 4.2,
            uniqueChatters: 180
          }
        });
        break;

      case 'AFK_OR_DEAD':
        this.updateState({
          hookVelocity: 0.15,
          chatReactivity: 0.10,
          streamerEnergy: 0.20,
          titleClickability: 0.30,
          avgWatchDuration: 0.25,
          chatterRatio: 0.08,
          historicalLoyalty: 0.30,
          monetizationIntensity: 0.05,
          dedicatedRatio: 0.50,
          meta: {
            isLive: true,
            viewersCount: 85,
            ccuDelta: -8,
            uptimeMinutes: 240,
            game: 'BRB / AFK Screen',
            title: 'AFK / Eating lunch (back in 10)',
            followersCount: 5000,
            msgPerSec: 0.2,
            uniqueChatters: 6
          }
        });
        break;

      case 'BALANCED_GRIND':
      default:
        this.updateState({
          hookVelocity: 0.60,
          chatReactivity: 0.55,
          streamerEnergy: 0.65,
          titleClickability: 0.60,
          avgWatchDuration: 0.60,
          chatterRatio: 0.40,
          historicalLoyalty: 0.50,
          monetizationIntensity: 0.35,
          dedicatedRatio: 0.50,
          meta: {
            isLive: true,
            viewersCount: 450,
            ccuDelta: 5,
            uptimeMinutes: 90,
            game: 'Valorant',
            title: 'Ranked Grind to Radiant | Chat deciding picks',
            followersCount: 22000,
            msgPerSec: 3.5,
            uniqueChatters: 95
          }
        });
        break;
    }
  }

  _generateActionableAdvice(report, fsmProb, mmoeResult, catBenchmark) {
    const tips = [];

    if (catBenchmark && catBenchmark.achievableGoalText) {
      tips.push({
        severity: 'category',
        icon: '🎯',
        text: catBenchmark.achievableGoalText
      });
    }

    if (report.scoreEarly < 50) {
      tips.push({
        severity: 'warning',
        icon: '⚠️',
        text: 'Скор для новичков (Early) просел. Усильте хук первых 2 минут (геймплей/вопрос в чат) для роста p_SMP.'
      });
    }

    if (mmoeResult.predictions.chat > 0.70 && fsmProb > 0.65) {
      tips.push({
        severity: 'success',
        icon: '🔥',
        text: 'Высокая плотность чата разогнала MMoE-экспертов! Стрим в активной фазе рекомендательного охвата.'
      });
    }

    if (mmoeResult.predictions.lmp < 0.40 && (this.state.meta.uptimeMinutes || 0) > 15) {
      tips.push({
        severity: 'warning',
        icon: '⏱️',
        text: 'Падает длительность удержания (LMP). Повысьте динамику или смените тему.'
      });
    }

    if (tips.length === 0) {
      tips.push({
        severity: 'normal',
        icon: '✅',
        text: 'Алгоритмические метрики стабильны. Баланс свежих и отложенных сигналов соблюден.'
      });
    }

    return tips;
  }

  _tick() {
    // 1. Run Fresh Signal Model
    const p_smp = this.fsm.predict({
      hookVelocity: this.state.hookVelocity,
      chatReactivity: this.state.chatReactivity,
      streamerEnergy: this.state.streamerEnergy,
      visualClarity: this.state.visualClarity,
      titleClickability: this.state.titleClickability
    });

    // 2. Run MMoE Model
    const mmoeResult = this.mmoe.forward({
      avgWatchDuration: this.state.avgWatchDuration,
      chatterRatio: this.state.chatterRatio,
      historicalLoyalty: this.state.historicalLoyalty,
      monetizationIntensity: this.state.monetizationIntensity
    });

    // 3. Combine in Viewer Segment Targeting
    const allProbs = {
      smp: p_smp,
      lmp: mmoeResult.predictions.lmp,
      chat: mmoeResult.predictions.chat,
      follow: mmoeResult.predictions.follow,
      spend: mmoeResult.predictions.spend
    };

    const rankingReport = this.vst.computeRankingReport(allProbs, this.state.dedicatedRatio);
    rankingReport.mmoeDetails = mmoeResult;
    rankingReport.state = { ...this.state };
    rankingReport.mode = this.mode;
    rankingReport.activeChannel = this.activeChannel;

    // 4. Calculate Category Benchmark
    const catBenchmark = this.categoryEngine.evaluate(rankingReport, this.liveCategoryData);
    rankingReport.categoryBenchmark = catBenchmark;
    rankingReport.advice = this._generateActionableAdvice(rankingReport, p_smp, mmoeResult, catBenchmark);

    // Smooth lerp
    if (!this.smoothedReport) {
      this.smoothedReport = rankingReport;
    } else {
      const lerp = (a, b, t) => a + (b - a) * t;
      this.smoothedReport.scoreOverall = Math.round(lerp(this.smoothedReport.scoreOverall, rankingReport.scoreOverall, 0.2) * 10) / 10;
      this.smoothedReport.scoreEarly = Math.round(lerp(this.smoothedReport.scoreEarly, rankingReport.scoreEarly, 0.2) * 10) / 10;
      this.smoothedReport.scoreDedicated = Math.round(lerp(this.smoothedReport.scoreDedicated, rankingReport.scoreDedicated, 0.2) * 10) / 10;
      this.smoothedReport.tier = rankingReport.tier;
      this.smoothedReport.tierColor = rankingReport.tierColor;
      this.smoothedReport.tierBadge = rankingReport.tierBadge;
      this.smoothedReport.probs = rankingReport.probs;
      this.smoothedReport.advice = rankingReport.advice;
      this.smoothedReport.mmoeDetails = rankingReport.mmoeDetails;
      this.smoothedReport.state = rankingReport.state;
      this.smoothedReport.mode = rankingReport.mode;
      this.smoothedReport.activeChannel = rankingReport.activeChannel;
      this.smoothedReport.categoryBenchmark = rankingReport.categoryBenchmark;
    }

    // Record timeline snapshot
    this.sessionRecorder.recordTick(this.smoothedReport);

    this._notify();
  }

  _notify() {
    for (const fn of this.listeners) {
      fn(this.smoothedReport);
    }

    // Broadcast to Central Server Hub for instant zero-latency OBS sync
    const now = Date.now();
    if (this.smoothedReport && (now - (this._lastBroadcastTime || 0) > 200)) {
      this._lastBroadcastTime = now;
      if (typeof fetch !== 'undefined') {
        fetch('/api/state/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.smoothedReport)
        }).catch(() => {});
      }
    }
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamStateManager;
} else {
  window.StreamStateManager = StreamStateManager;
}
