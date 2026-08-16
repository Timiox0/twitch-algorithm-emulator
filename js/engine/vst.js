/**
 * Viewer Segment Targeting (VST) & Final Scoring Engine
 * Based on arXiv:2608.04455v1 (Section 4.4, 4.5 & 5.1.3)
 * 
 * Applies inference-time scalarization conditioned on viewer lifecycle segments:
 * - Early (E): New / less active viewers -> Priority on shallow engagement (p_SMP)
 * - Dedicated (D): Highly engaged viewers -> Balanced priority across deep watch (LMP), community (Chat/Follow) and monetization (Spend)
 */

class ViewerSegmentTargeting {
  constructor() {
    // Segment-conditioned weight matrices from paper rationale
    this.segmentWeights = {
      // Early viewers: Needs strong hook to prevent immediate bounce
      E: {
        smp:    0.65, // Hook / first minutes play
        lmp:    0.15, // Long watch
        chat:   0.12, // Community interaction
        follow: 0.06, // Channel follow
        spend:  0.02  // Direct spend
      },
      // Dedicated viewers: Deep bond, high ARPU potential, community core
      D: {
        smp:    0.10, // Routine check-in
        lmp:    0.35, // High watch duration
        chat:   0.25, // Active conversation
        follow: 0.10, // Follow retention
        spend:  0.20  // Subs, bits, gift trains
      }
    };
  }

  /**
   * Calculates segment-specific score
   * @param {string} segment 'E' | 'D'
   * @param {Object} probs { smp, lmp, chat, follow, spend }
   * @returns {number} raw score in [0, 1]
   */
  calculateSegmentScore(segment, probs) {
    const w = this.segmentWeights[segment] || this.segmentWeights.E;
    return (
      (probs.smp || 0) * w.smp +
      (probs.lmp || 0) * w.lmp +
      (probs.chat || 0) * w.chat +
      (probs.follow || 0) * w.follow +
      (probs.spend || 0) * w.spend
    );
  }

  /**
   * Computes full scoring report for the stream
   * @param {Object} probs { smp, lmp, chat, follow, spend }
   * @param {number} dedicatedRatio (ratio of loyal viewers vs new viewers, e.g. 0.45)
   * @returns {Object} full breakdown report
   */
  computeRankingReport(probs, dedicatedRatio = 0.5) {
    const scoreEarlyRaw = this.calculateSegmentScore('E', probs);
    const scoreDedicatedRaw = this.calculateSegmentScore('D', probs);

    // Blended overall score weighted by audience makeup
    const alpha = Math.min(Math.max(dedicatedRatio, 0), 1);
    const scoreOverallRaw = (1 - alpha) * scoreEarlyRaw + alpha * scoreDedicatedRaw;

    // Normalization to 0..100 scale
    const scoreEarly = Math.round(scoreEarlyRaw * 1000) / 10;
    const scoreDedicated = Math.round(scoreDedicatedRaw * 1000) / 10;
    const scoreOverall = Math.round(scoreOverallRaw * 1000) / 10;

    // Recommendation Tier Categorization
    let tier = 'Standard Pool';
    let tierColor = '#60a5fa'; // Blue
    let tierBadge = 'NORMAL';

    if (scoreOverall >= 82) {
      tier = 'Homepage Featured (Viral Peak)';
      tierColor = '#a855f7'; // Purple / Twitch Ultra
      tierBadge = 'PRIME';
    } else if (scoreOverall >= 68) {
      tier = 'Category Top Recommendation';
      tierColor = '#10b981'; // Green
      tierBadge = 'BOOSTED';
    } else if (scoreOverall >= 50) {
      tier = 'Active Recommendation Pool';
      tierColor = '#3b82f6'; // Light Blue
      tierBadge = 'ACTIVE';
    } else {
      tier = 'Cold Start / Low Discovery';
      tierColor = '#f59e0b'; // Amber
      tierBadge = 'COLD';
    }

    return {
      scoreOverall,
      scoreEarly,
      scoreDedicated,
      rawScores: {
        overall: scoreOverallRaw,
        early: scoreEarlyRaw,
        dedicated: scoreDedicatedRaw
      },
      probs: {
        smp: Math.round(probs.smp * 100),
        lmp: Math.round(probs.lmp * 100),
        chat: Math.round(probs.chat * 100),
        follow: Math.round(probs.follow * 100),
        spend: Math.round(probs.spend * 100)
      },
      tier,
      tierColor,
      tierBadge,
      weights: this.segmentWeights
    };
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewerSegmentTargeting;
} else {
  window.ViewerSegmentTargeting = ViewerSegmentTargeting;
}
