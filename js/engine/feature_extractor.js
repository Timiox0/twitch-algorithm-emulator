/**
 * Real-Time Feature Extractor
 * Converts raw Twitch telemetry (CCU, Uptime, Chat Velocity, Badges, Subs)
 * into calibrated [0, 1] inputs for FSM, MMoE, and VST.
 */

class FeatureExtractor {
  constructor() {
    this.ccuHistory = []; // { timestamp, ccu }
    this.historyWindowMs = 20 * 60 * 1000; // 20 mins
    this.peakCCU = 0;
    this.lastFollowerCount = null;
    this.followerVelocity = 0.5; // Baseline
  }

  /**
   * Records a new CCU snapshot
   */
  recordCCU(ccu) {
    const now = Date.now();
    this.ccuHistory.push({ timestamp: now, ccu });
    if (ccu > this.peakCCU) this.peakCCU = ccu;

    // Clean old CCU records
    const cutoff = now - this.historyWindowMs;
    this.ccuHistory = this.ccuHistory.filter(item => item.timestamp > cutoff);
  }

  /**
   * Computes normalized features from live Twitch API + IRC metrics
   * @param {Object} apiData - { isLive, viewersCount, uptimeMinutes, followersCount, game, title }
   * @param {Object} ircMetrics - { msgPerSec, uniqueChatters, dedicatedRatio, totalBitsInWindow, recentSubsCount }
   * @returns {Object} normalized features for FSM/MMoE + meta
   */
  extract(apiData = {}, ircMetrics = {}) {
    const ccu = apiData.viewersCount || 0;
    this.recordCCU(ccu);

    const now = Date.now();
    const uptime = apiData.uptimeMinutes || 1;
    const followers = apiData.followersCount || 0;

    // 1. Calculate CCU momentum (Delta over last 2-5 minutes)
    const fiveMinAgo = now - (5 * 60 * 1000);
    const pastRecord = this.ccuHistory.find(item => item.timestamp >= fiveMinAgo) || this.ccuHistory[0];
    const pastCCU = pastRecord ? pastRecord.ccu : ccu;
    
    // Growth ratio: 1.0 is stable, >1.0 is influx, <1.0 is drop
    const ccuGrowthRatio = pastCCU > 0 ? ccu / pastCCU : 1.0;

    // 2. Chat velocity normalization (Strict piecewise & logarithmic response)
    const msgPerSec = ircMetrics.msgPerSec || 0;
    // 0.1 msg/s -> 0.03, 1.0 msg/s -> 0.28, 5.0 msg/s -> 0.68, 15+ msg/s -> 0.95+
    const chatDensityNormalized = Math.min(
      0.5 * Math.min(msgPerSec / 6.0, 1.0) + 0.5 * (Math.log10(msgPerSec + 1) / 1.6),
      1.0
    );

    // 3. Unique chatters ratio to total CCU
    const uniqueChatters = ircMetrics.uniqueChatters || 0;
    const chatterViewerRatio = ccu > 0 
      ? Math.min(uniqueChatters / Math.max(ccu * 0.35, 4), 1.0)
      : Math.min(uniqueChatters / 15, 1.0);

    const chatterRatio = Math.min(Math.max(chatterViewerRatio, 0.02), 0.98);
    const chatReactivity = Math.min(Math.max(chatDensityNormalized, 0.02), 0.98);

    // 4. Hook Velocity (p_SMP driver)
    // Combines audience momentum + chat density + new chatter arrival
    let hookVelocity = 0.45;
    if (apiData.isLive) {
      const growthScore = Math.min(Math.max((ccuGrowthRatio - 0.7) / 0.6, 0.1), 0.95);
      hookVelocity = 0.50 * growthScore + 0.35 * chatDensityNormalized + 0.15 * chatterRatio;
    }

    // 5. Avg Watch Duration (LMP driver)
    // Calibrated: builds with uptime and audience interaction
    let avgWatchDuration = 0.45;
    if (apiData.isLive) {
      const uptimeCurve = Math.min(Math.sqrt(uptime / 120), 1.0); // 0 at start, 0.5 at 30 min, 1.0 at 2 hours
      const retentionRatio = this.peakCCU > 0 ? Math.min(ccu / Math.max(this.peakCCU * 0.9, 1), 1.0) : 0.6;
      const engagementFactor = 0.6 * chatDensityNormalized + 0.4 * chatterRatio;
      avgWatchDuration = 0.40 * retentionRatio + 0.35 * (0.20 + 0.80 * uptimeCurve) + 0.25 * engagementFactor;
    }

    // 6. Historical Loyalty (Community depth)
    const badgeDedicatedRatio = ircMetrics.dedicatedRatio !== undefined ? ircMetrics.dedicatedRatio : 0.40;
    const followerScore = Math.min(Math.log10(Math.max(followers, 10)) / 6, 1.0); // 1M followers -> 1.0
    const historicalLoyalty = 0.70 * badgeDedicatedRatio + 0.30 * followerScore;

    // 7. Monetization Intensity (p_Spend driver)
    const recentSubs = ircMetrics.recentSubsCount || 0;
    const recentBits = ircMetrics.totalBitsInWindow || 0;
    let monetizationIntensity = 0.05; // Clean low baseline when no donations
    if (recentSubs > 0 || recentBits > 0) {
      const subScore = Math.min(recentSubs * 0.35, 0.7);
      const bitsScore = Math.min(recentBits / 1500, 0.5);
      monetizationIntensity = Math.min(0.20 + subScore + bitsScore, 0.98);
    }

    // 8. Audience Dedicated Ratio (VST E vs D Split)
    const dedicatedRatio = Math.min(Math.max(badgeDedicatedRatio, 0.15), 0.85);

    return {
      // Inputs for FSM
      hookVelocity: Math.min(Math.max(hookVelocity, 0.02), 0.98),
      chatReactivity,
      streamerEnergy: Math.min(Math.max(chatDensityNormalized * 0.7 + 0.25, 0.05), 0.95),
      visualClarity: 0.90, // Standard HD/FHD stream
      titleClickability: Math.min(0.45 + 0.5 * (apiData.isLive ? 0.3 : 0), 0.95),

      // Inputs for MMoE
      avgWatchDuration: Math.min(Math.max(avgWatchDuration, 0.05), 0.98),
      chatterRatio,
      historicalLoyalty: Math.min(Math.max(historicalLoyalty, 0.05), 0.98),
      monetizationIntensity: Math.min(Math.max(monetizationIntensity, 0.02), 0.98),

      // Audience Split for VST
      dedicatedRatio,

      // Live Telemetry Meta
      meta: {
        isLive: !!apiData.isLive,
        viewersCount: ccu,
        uptimeMinutes: uptime,
        game: apiData.game || 'Just Chatting',
        title: apiData.title || '',
        followersCount: followers,
        msgPerSec: ircMetrics.msgPerSec || 0,
        uniqueChatters: ircMetrics.uniqueChatters || 0,
        dedicatedChatters: ircMetrics.dedicatedChatterCount || 0,
        earlyChatters: ircMetrics.earlyChatterCount || 0,
        recentSubsCount: recentSubs,
        totalBitsInWindow: recentBits
      }
    };
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeatureExtractor;
} else {
  window.FeatureExtractor = FeatureExtractor;
}
