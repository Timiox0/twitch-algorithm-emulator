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

    // 2. Chat velocity normalization (using logarithmic scaling for stream sizes)
    const msgPerSec = ircMetrics.msgPerSec || 0;
    const chatDensityNormalized = Math.min(Math.log10(msgPerSec + 1) / 1.6, 1.0); // 0 msg/s -> 0, 10 msg/s -> ~0.65, 40+ msg/s -> 1.0

    // 3. Unique chatters ratio to total CCU
    const uniqueChatters = ircMetrics.uniqueChatters || 0;
    const chatterViewerRatio = ccu > 0 
      ? Math.min((uniqueChatters * 4) / Math.max(ccu, 10), 1.0)
      : Math.min(uniqueChatters / 20, 1.0);

    // 4. Hook Velocity (p_SMP driver)
    // Combines audience momentum + chat density + new chatter arrival
    let hookVelocity = 0.5;
    if (apiData.isLive) {
      const growthScore = Math.min(Math.max((ccuGrowthRatio - 0.7) / 0.6, 0.1), 0.95);
      hookVelocity = 0.55 * growthScore + 0.35 * chatDensityNormalized + 0.10 * chatterViewerRatio;
    }

    // 5. Avg Watch Duration (LMP driver)
    // High retention (CCU close to peak) + stable uptime
    let avgWatchDuration = 0.5;
    if (apiData.isLive && this.peakCCU > 0) {
      const retentionRatio = Math.min(ccu / Math.max(this.peakCCU * 0.85, 1), 1.0);
      const uptimeFactor = Math.min(uptime / 60, 1.0); // Ramps up over first hour
      avgWatchDuration = 0.65 * retentionRatio + 0.35 * (0.4 + 0.6 * uptimeFactor);
    }

    // 6. Chatter Ratio & Chat Reactivity
    const chatReactivity = Math.min(0.3 + 0.7 * chatDensityNormalized, 0.98);
    const chatterRatio = Math.min(Math.max(chatterViewerRatio, 0.1), 0.95);

    // 7. Historical Loyalty (Community depth)
    // Driven by dedicated badges ratio + follower base size
    const badgeDedicatedRatio = ircMetrics.dedicatedRatio !== undefined ? ircMetrics.dedicatedRatio : 0.50;
    const followerScore = Math.min(Math.log10(Math.max(followers, 10)) / 6, 1.0); // 1M followers -> 1.0
    const historicalLoyalty = 0.60 * badgeDedicatedRatio + 0.40 * followerScore;

    // 8. Monetization Intensity (p_Spend driver)
    const recentSubs = ircMetrics.recentSubsCount || 0;
    const recentBits = ircMetrics.totalBitsInWindow || 0;
    let monetizationIntensity = 0.15; // Baseline
    if (recentSubs > 0 || recentBits > 0) {
      const subScore = Math.min(recentSubs * 0.25, 0.6);
      const bitsScore = Math.min(recentBits / 2000, 0.4);
      monetizationIntensity = Math.min(0.20 + subScore + bitsScore, 0.98);
    }

    // 9. Audience Dedicated Ratio (VST E vs D Split)
    const dedicatedRatio = Math.min(Math.max(badgeDedicatedRatio, 0.15), 0.85);

    return {
      // Inputs for FSM
      hookVelocity: Math.min(Math.max(hookVelocity, 0.05), 0.98),
      chatReactivity: Math.min(Math.max(chatReactivity, 0.05), 0.98),
      streamerEnergy: Math.min(Math.max(chatDensityNormalized * 0.8 + 0.2, 0.1), 0.95),
      visualClarity: 0.90, // Standard HD/FHD stream
      titleClickability: Math.min(0.5 + 0.5 * (apiData.isLive ? 0.3 : 0), 0.95),

      // Inputs for MMoE
      avgWatchDuration: Math.min(Math.max(avgWatchDuration, 0.05), 0.98),
      chatterRatio: Math.min(Math.max(chatterRatio, 0.05), 0.98),
      historicalLoyalty: Math.min(Math.max(historicalLoyalty, 0.05), 0.98),
      monetizationIntensity: Math.min(Math.max(monetizationIntensity, 0.05), 0.98),

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
        earlyChatters: ircMetrics.earlyChatterCount || 0
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
