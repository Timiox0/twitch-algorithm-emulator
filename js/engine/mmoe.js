/**
 * Multi-gate Mixture-of-Experts (MMoE) Model Component
 * Based on arXiv:2608.04455v1 (Section 4.5 & 5.1.2)
 * 
 * Jointly models 4 correlated deep and delayed targets:
 * - LMP (Long-form Minutes Play: watch time >= tau_l)
 * - Chat (Chatting in community within 14-day delayed window)
 * - Follow (Channel follows within 14-day delayed window)
 * - Spend (Subs, bits, gift subs within 14-day delayed window)
 * 
 * Includes K=4 experts with task-specific softmax gating networks.
 */

class MMoEModel {
  constructor(numExperts = 4) {
    this.numExperts = numExperts;
    this.tasks = ['lmp', 'chat', 'follow', 'spend'];

    // Specialized Expert Focus Profiles (Learned representations)
    this.expertProfiles = [
      { name: 'Content Immersion', lmpW: 0.70, chatW: 0.10, followW: 0.10, spendW: 0.10 },
      { name: 'Community Bonding', lmpW: 0.15, chatW: 0.60, followW: 0.15, spendW: 0.10 },
      { name: 'Creator Loyalty',   lmpW: 0.20, chatW: 0.15, followW: 0.50, spendW: 0.15 },
      { name: 'Hype & Monetization', lmpW: 0.05, chatW: 0.15, followW: 0.10, spendW: 0.70 }
    ];

    // Task-specific gating weights over input feature dimensions
    this.gateWeights = {
      lmp:    [0.55, 0.15, 0.20, 0.10],
      chat:   [0.10, 0.65, 0.15, 0.10],
      follow: [0.15, 0.20, 0.55, 0.10],
      spend:  [0.05, 0.10, 0.15, 0.70]
    };
  }

  /**
   * Softmax normalization
   */
  _softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  }

  /**
   * Evaluates the 4 experts based on streaming signals
   * @param {Object} features 
   */
  _evaluateExperts(features) {
    const {
      avgWatchDuration = 0.5,     // 0..1
      chatterRatio = 0.3,         // 0..1 (chat messages / active viewers)
      chatReactivity = 0.3,       // 0..1 (normalized velocity)
      historicalLoyalty = 0.4,    // 0..1 (14-day aggregated community score)
      monetizationIntensity = 0.05, // 0..1 (bits, sub trains)
      hookVelocity = 0.5
    } = features;

    // Expert 0 Activation (Content Immersion - Watch Duration)
    const e0 = 0.75 * avgWatchDuration + 0.25 * (1 - Math.abs(chatterRatio - 0.25));

    // Expert 1 Activation (Community Bonding - Real Chat Rate & Chatter Ratio)
    const activeChatScore = 0.55 * chatterRatio + 0.45 * (chatReactivity || 0.02);
    const e1 = 0.85 * activeChatScore + 0.15 * historicalLoyalty;

    // Expert 2 Activation (Creator Loyalty - Community depth & follow velocity)
    const e2 = 0.50 * historicalLoyalty + 0.30 * (chatterRatio + hookVelocity) / 2 + 0.20 * avgWatchDuration;

    // Expert 3 Activation (Hype & Monetization - strictly dependent on actual monetization)
    const e3 = 0.90 * monetizationIntensity + 0.10 * (chatterRatio * historicalLoyalty);

    return [
      Math.min(Math.max(e0, 0.01), 0.99),
      Math.min(Math.max(e1, 0.01), 0.99),
      Math.min(Math.max(e2, 0.01), 0.99),
      Math.min(Math.max(e3, 0.01), 0.99)
    ];
  }

  /**
   * Forward pass through MMoE
   * @param {Object} features 
   * @returns {Object} { predictions: {lmp, chat, follow, spend}, gating: {...}, expertOutputs: [...] }
   */
  forward(features) {
    const expertOutputs = this._evaluateExperts(features);
    const gatingDistributions = {};
    const predictions = {};

    // Dynamic gating computation conditioned on feature states
    for (const task of this.tasks) {
      const baseWeights = this.gateWeights[task];
      
      // Feature modulation on gate logits
      const logits = baseWeights.map((w, idx) => {
        let boost = 0;
        if (task === 'lmp' && idx === 0) boost += (features.avgWatchDuration || 0.5) * 1.2;
        if (task === 'chat' && idx === 1) boost += (features.chatterRatio || 0.1) * 1.5;
        if (task === 'follow' && idx === 2) boost += (features.historicalLoyalty || 0.4) * 0.9;
        if (task === 'spend' && idx === 3) boost += (features.monetizationIntensity || 0.05) * 2.0;
        return (w * 2.5) + boost;
      });

      const gates = this._softmax(logits);
      gatingDistributions[task] = gates;

      // Mixture aggregation: sum_k(g_k * E_k)
      let taskMixture = 0;
      for (let k = 0; k < this.numExperts; k++) {
        taskMixture += gates[k] * expertOutputs[k];
      }

      // Task tower non-linear output
      let prob;
      if (task === 'lmp') {
        prob = 1 / (1 + Math.exp(-6.5 * (taskMixture - 0.48)));
      } else if (task === 'chat') {
        prob = 1 / (1 + Math.exp(-7.5 * (taskMixture - 0.42)));
      } else if (task === 'follow') {
        prob = 1 / (1 + Math.exp(-6.5 * (taskMixture - 0.45)));
      } else { // spend (strict threshold requiring real monetary activity)
        prob = 1 / (1 + Math.exp(-8.5 * (taskMixture - 0.48)));
      }

      predictions[task] = Math.min(Math.max(prob, 0.01), 0.99);
    }

    return {
      predictions,
      gating: gatingDistributions,
      expertOutputs,
      expertProfiles: this.expertProfiles
    };
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MMoEModel;
} else {
  window.MMoEModel = MMoEModel;
}
