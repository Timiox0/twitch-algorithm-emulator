/**
 * Session Recorder & Algorithmic Timeline Engine
 * Records continuous timeline snapshots, detects key algorithm events,
 * and calculates post-stream session metrics.
 */

const TIMELINE_STORAGE_KEY = 'twitch_algo_session_timeline_v1';
const EVENTS_STORAGE_KEY = 'twitch_algo_session_events_v1';

class SessionRecorder {
  constructor(options = {}) {
    this.sampleIntervalMs = options.sampleIntervalMs || 5000; // 5 seconds
    this.maxDataPoints = options.maxDataPoints || 6000; // ~8.3 hours of 5s samples

    this.sessionStartTime = Date.now();
    this.lastSampleTime = 0;
    this.timeline = [];
    this.events = [];

    // Rolling window state for event detection
    this.recentScores = [];
    this.recentChatSpeeds = [];

    this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawTimeline = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
        const rawEvents = window.localStorage.getItem(EVENTS_STORAGE_KEY);
        if (rawTimeline) {
          const parsed = JSON.parse(rawTimeline);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.timeline = parsed;
            this.sessionStartTime = parsed[0].timestamp || Date.now();
          }
        }
        if (rawEvents) {
          const parsedEvents = JSON.parse(rawEvents);
          if (Array.isArray(parsedEvents)) {
            this.events = parsedEvents;
          }
        }
      }
    } catch (e) {
      console.warn('Session timeline load error:', e);
    }
  }

  _saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(this.timeline.slice(-1500)));
        window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(this.events.slice(-50)));
      }
    } catch (e) {
      console.warn('Session timeline save error:', e);
    }
  }

  clearSession() {
    this.sessionStartTime = Date.now();
    this.lastSampleTime = 0;
    this.timeline = [];
    this.events = [];
    this.recentScores = [];
    this.recentChatSpeeds = [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
        window.localStorage.removeItem(EVENTS_STORAGE_KEY);
      }
    } catch (e) {}
  }

  /**
   * Records a snapshot from the stream state tick
   */
  recordTick(report) {
    if (!report) return;

    const now = Date.now();
    if (now - this.lastSampleTime < this.sampleIntervalMs) {
      return;
    }
    this.lastSampleTime = now;

    const meta = report.state?.meta || {};
    const probs = report.probs || { smp: 50, lmp: 50, chat: 50, follow: 50, spend: 50 };

    const snapshot = {
      timestamp: now,
      elapsedSec: Math.round((now - this.sessionStartTime) / 1000),
      scoreOverall: report.scoreOverall || 0,
      scoreEarly: report.scoreEarly || 0,
      scoreDedicated: report.scoreDedicated || 0,
      p_smp: probs.smp || 0,
      p_lmp: probs.lmp || 0,
      p_chat: probs.chat || 0,
      p_follow: probs.follow || 0,
      p_spend: probs.spend || 0,
      ccu: meta.viewersCount || 0,
      msgPerSec: Math.round((meta.msgPerSec || 0) * 10) / 10,
      game: meta.game || 'Just Chatting',
      title: meta.title || 'Twitch Live Stream',
      channel: report.activeChannel || 'Channel'
    };

    this.timeline.push(snapshot);
    if (this.timeline.length > this.maxDataPoints) {
      this.timeline.shift();
    }

    // Event Detection
    this._detectEvents(snapshot);

    // Save every 10 samples (50 seconds)
    if (this.timeline.length % 10 === 0) {
      this._saveToStorage();
    }
  }

  _detectEvents(snapshot) {
    this.recentScores.push(snapshot.scoreOverall);
    if (this.recentScores.length > 12) this.recentScores.shift(); // last 1 min

    this.recentChatSpeeds.push(snapshot.msgPerSec);
    if (this.recentChatSpeeds.length > 12) this.recentChatSpeeds.shift();

    const elapsedMin = Math.round(snapshot.elapsedSec / 60);

    // 1. Viral Algorithmic Surge (Score >= 82)
    if (snapshot.scoreOverall >= 82) {
      const alreadyLogged = this.events.some(e => e.type === 'VIRAL_SURGE' && Math.abs(snapshot.timestamp - e.timestamp) < 180000);
      if (!alreadyLogged) {
        this.events.push({
          type: 'VIRAL_SURGE',
          icon: '🚀',
          title: 'Пик вирального охвата',
          desc: `Twitch Score поднялся до ${snapshot.scoreOverall.toFixed(1)}! Алгоритм продвигает стрим в рекомендации.`,
          timestamp: snapshot.timestamp,
          timeFormatted: `${elapsedMin} мин`,
          score: snapshot.scoreOverall,
          ccu: snapshot.ccu
        });
      }
    }

    // 2. Retention Hook Drop (p_SMP < 35% with uptime > 5m)
    if (snapshot.p_smp < 35 && snapshot.elapsedSec > 300) {
      const alreadyLogged = this.events.some(e => e.type === 'RETENTION_DROP' && Math.abs(snapshot.timestamp - e.timestamp) < 300000);
      if (!alreadyLogged) {
        this.events.push({
          type: 'RETENTION_DROP',
          icon: '⚠️',
          title: 'Просадка хука новичков',
          desc: `Скор удержания 1-3 минут (p_SMP) упал до ${snapshot.p_smp}%. Новые зрители закрывают стрим.`,
          timestamp: snapshot.timestamp,
          timeFormatted: `${elapsedMin} мин`,
          score: snapshot.scoreOverall,
          ccu: snapshot.ccu
        });
      }
    }

    // 3. Chat Hype Burst (Chat velocity burst)
    const avgChat = this.recentChatSpeeds.reduce((a, b) => a + b, 0) / this.recentChatSpeeds.length;
    if (snapshot.msgPerSec >= 5.0 && snapshot.msgPerSec >= avgChat * 2.2) {
      const alreadyLogged = this.events.some(e => e.type === 'CHAT_HYPE' && Math.abs(snapshot.timestamp - e.timestamp) < 120000);
      if (!alreadyLogged) {
        this.events.push({
          type: 'CHAT_HYPE',
          icon: '🔥',
          title: 'Всплеск активности чата',
          desc: `Скорость чата разогналась до ${snapshot.msgPerSec} msg/s! MMoE эксперты активизированы.`,
          timestamp: snapshot.timestamp,
          timeFormatted: `${elapsedMin} мин`,
          score: snapshot.scoreOverall,
          ccu: snapshot.ccu
        });
      }
    }

    // 4. Sub / Monetization Spike
    if (snapshot.p_spend >= 75) {
      const alreadyLogged = this.events.some(e => e.type === 'MONETIZATION_SPIKE' && Math.abs(snapshot.timestamp - e.timestamp) < 300000);
      if (!alreadyLogged) {
        this.events.push({
          type: 'MONETIZATION_SPIKE',
          icon: '👑',
          title: 'Пик платной поддержки',
          desc: `Высокая плотность подписок и битов (p_Spend = ${snapshot.p_spend}%).`,
          timestamp: snapshot.timestamp,
          timeFormatted: `${elapsedMin} мин`,
          score: snapshot.scoreOverall,
          ccu: snapshot.ccu
        });
      }
    }
  }

  /**
   * Computes aggregated session summary
   */
  getSummaryStats() {
    if (this.timeline.length === 0) {
      return {
        durationMinutes: 0,
        peakCCU: 0,
        avgCCU: 0,
        avgScore: 0,
        peakScore: 0,
        minScore: 0,
        avgChatSpeed: 0,
        dominantGame: 'Simulation',
        totalEventsCount: 0,
        pointsCount: 0
      };
    }

    let maxCCU = 0;
    let sumCCU = 0;
    let maxScore = 0;
    let minScore = 100;
    let sumScore = 0;
    let sumChat = 0;
    const gameCounts = {};

    for (const pt of this.timeline) {
      if (pt.ccu > maxCCU) maxCCU = pt.ccu;
      sumCCU += pt.ccu;

      if (pt.scoreOverall > maxScore) maxScore = pt.scoreOverall;
      if (pt.scoreOverall < minScore) minScore = pt.scoreOverall;
      sumScore += pt.scoreOverall;

      sumChat += pt.msgPerSec;

      const g = pt.game || 'Just Chatting';
      gameCounts[g] = (gameCounts[g] || 0) + 1;
    }

    const count = this.timeline.length;
    const firstTime = this.timeline[0].timestamp;
    const lastTime = this.timeline[count - 1].timestamp;
    const durationMinutes = Math.max(1, Math.round((lastTime - firstTime) / 60000));

    let dominantGame = 'Just Chatting';
    let maxCount = 0;
    for (const [game, cnt] of Object.entries(gameCounts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantGame = game;
      }
    }

    return {
      durationMinutes,
      peakCCU: maxCCU,
      avgCCU: Math.round(sumCCU / count),
      avgScore: Math.round((sumScore / count) * 10) / 10,
      peakScore: Math.round(maxScore * 10) / 10,
      minScore: Math.round(minScore * 10) / 10,
      avgChatSpeed: Math.round((sumChat / count) * 10) / 10,
      dominantGame,
      totalEventsCount: this.events.length,
      pointsCount: count
    };
  }

  getTimeline() {
    return this.timeline;
  }

  getEvents() {
    return this.events;
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionRecorder;
} else {
  window.SessionRecorder = SessionRecorder;
}
