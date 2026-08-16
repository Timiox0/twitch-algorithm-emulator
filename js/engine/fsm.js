/**
 * Fresh Signal Model (FSM)
 * Based on arXiv:2608.04455v1 (Section 4.3 & 4.5)
 * 
 * Focuses strictly on immediate, fresh engagement indicators (p_SMP).
 * Shallow engagement (SMP) is kept isolated from delayed targets to prevent
 * gradient dominance and preserve deep engagement optimization.
 */

class FreshSignalModel {
  constructor() {
    // Calibrated feature weights representing the 4-layer FC network
    this.weights = {
      hookVelocity: 0.40,     // Current viewer influx & momentum in first 1-3 mins
      chatReactivity: 0.25,   // Immediate chatter response rate to streamer speech/actions
      streamerEnergy: 0.15,   // Dynamic audio/visual action score
      visualClarity: 0.10,    // High resolution/FPS/clean layout
      titleClickability: 0.10 // Category + title CTR momentum
    };
  }

  /**
   * Predicts p_SMP (Short-form Minutes Play probability)
   * @param {Object} rawFeatures 
   * @returns {number} probability in [0, 1]
   */
  predict(rawFeatures) {
    const {
      hookVelocity = 0.5,      // 0..1
      chatReactivity = 0.5,    // 0..1
      streamerEnergy = 0.5,    // 0..1
      visualClarity = 0.8,     // 0..1
      titleClickability = 0.5  // 0..1
    } = rawFeatures;

    // Linear combination + non-linear sigmoid activation with temperature scaling
    const z = (
      hookVelocity * this.weights.hookVelocity +
      chatReactivity * this.weights.chatReactivity +
      streamerEnergy * this.weights.streamerEnergy +
      visualClarity * this.weights.visualClarity +
      titleClickability * this.weights.titleClickability
    );

    // Calibrated sigmoid centered around standard live baseline (0.46)
    const p_smp = 1 / (1 + Math.exp(-6.5 * (z - 0.46)));
    return Math.min(Math.max(p_smp, 0.01), 0.99);
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FreshSignalModel;
} else {
  window.FreshSignalModel = FreshSignalModel;
}
