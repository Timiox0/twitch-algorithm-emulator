/**
 * Comprehensive Calibration Audit & Verification Script
 */

const FreshSignalModel = require('./js/engine/fsm.js');
const MMoEModel = require('./js/engine/mmoe.js');
const FeatureExtractor = require('./js/engine/feature_extractor.js');
const ViewerSegmentTargeting = require('./js/engine/vst.js');

console.log('🧪 Запуск аудита калибровки формул FSM, MMoE и VST...\n');

const fsm = new FreshSignalModel();
const mmoe = new MMoEModel(4);
const vst = new ViewerSegmentTargeting();
const extractor = new FeatureExtractor();

// Scenario 1: Quiet / Slow Stream (72 CCU, 0.1 msg/s, 2 unique chatters, 0 subs)
const quietFeatures = extractor.extract(
  { isLive: true, viewersCount: 72, uptimeMinutes: 25, followersCount: 1500, game: 'Dead Space 2' },
  { msgPerSec: 0.1, uniqueChatters: 2, dedicatedRatio: 0.40, totalBitsInWindow: 0, recentSubsCount: 0 }
);

const quietSMP = fsm.predict(quietFeatures);
const quietMMoE = mmoe.forward(quietFeatures);
const quietProbs = {
  smp: Math.round(quietSMP * 100),
  lmp: Math.round(quietMMoE.predictions.lmp * 100),
  chat: Math.round(quietMMoE.predictions.chat * 100),
  follow: Math.round(quietMMoE.predictions.follow * 100),
  spend: Math.round(quietMMoE.predictions.spend * 100)
};

console.log('📊 Сценарий 1: Спокойный стрим (72 зрителя, чат 0.1 msg/s, без донатов):');
console.log(`   • FRESH SMP (Hook 1-3m):    ${quietProbs.smp}%`);
console.log(`   • MMoE LMP (Deep Watch):     ${quietProbs.lmp}%`);
console.log(`   • MMoE Chat Density:         ${quietProbs.chat}%`);
console.log(`   • MMoE Follow Retention:     ${quietProbs.follow}%`);
console.log(`   • MMoE Monetization / Spend: ${quietProbs.spend}%`);

// Scenario 2: Active / Hype Stream (150 CCU, 4.5 msg/s, 25 unique chatters, 2 subs, 200 bits)
const hypeExtractor = new FeatureExtractor();
const hypeFeatures = hypeExtractor.extract(
  { isLive: true, viewersCount: 150, uptimeMinutes: 60, followersCount: 5000, game: 'Dota 2' },
  { msgPerSec: 4.5, uniqueChatters: 25, dedicatedRatio: 0.65, totalBitsInWindow: 200, recentSubsCount: 2 }
);

const hypeSMP = fsm.predict(hypeFeatures);
const hypeMMoE = mmoe.forward(hypeFeatures);
const hypeProbs = {
  smp: Math.round(hypeSMP * 100),
  lmp: Math.round(hypeMMoE.predictions.lmp * 100),
  chat: Math.round(hypeMMoE.predictions.chat * 100),
  follow: Math.round(hypeMMoE.predictions.follow * 100),
  spend: Math.round(hypeMMoE.predictions.spend * 100)
};

console.log('\n🔥 Сценарий 2: Хайповый активный стрим (150 зрителей, чат 4.5 msg/s, 2 саба, 200 bits):');
console.log(`   • FRESH SMP (Hook 1-3m):    ${hypeProbs.smp}%`);
console.log(`   • MMoE LMP (Deep Watch):     ${hypeProbs.lmp}%`);
console.log(`   • MMoE Chat Density:         ${hypeProbs.chat}%`);
console.log(`   • MMoE Follow Retention:     ${hypeProbs.follow}%`);
console.log(`   • MMoE Monetization / Spend: ${hypeProbs.spend}%`);
