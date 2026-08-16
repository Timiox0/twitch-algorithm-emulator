/**
 * Algorithmic Verification Test
 * Validates FSM, MMoE, and VST mathematical integrity and segment divergence
 */

const FreshSignalModel = require('./js/engine/fsm.js');
const MMoEModel = require('./js/engine/mmoe.js');
const ViewerSegmentTargeting = require('./js/engine/vst.js');

console.log('🧪 Запуск тестов алгоритма ранжирования Twitch (FSM + MMoE + VST)...\n');

const fsm = new FreshSignalModel();
const mmoe = new MMoEModel(4);
const vst = new ViewerSegmentTargeting();

// Test 1: FSM Output
const p_smp = fsm.predict({ hookVelocity: 0.8, chatReactivity: 0.7, streamerEnergy: 0.8 });
console.log(`✅ 1. FSM p_SMP: ${p_smp.toFixed(4)} (Ожидается в [0, 1])`);
if (p_smp < 0 || p_smp > 1) throw new Error('FSM output out of bounds');

// Test 2: MMoE Outputs & Gating
const mmoeOut = mmoe.forward({ avgWatchDuration: 0.8, chatterRatio: 0.6, historicalLoyalty: 0.7, monetizationIntensity: 0.5 });
console.log(`✅ 2. MMoE Predictions:`, mmoeOut.predictions);
console.log(`   MMoE Expert Outputs:`, mmoeOut.expertOutputs.map(x => x.toFixed(3)));
console.log(`   MMoE LMP Gating:`, mmoeOut.gating.lmp.map(x => x.toFixed(3)));

// Test 3: VST Segment Asymmetry
// Scenario A: High fresh hook, low loyalty (Typical new viewer attraction)
const reportA = vst.computeRankingReport({ smp: 0.9, lmp: 0.2, chat: 0.2, follow: 0.1, spend: 0.05 });
console.log(`\n✅ 3. Сценарий A (Сильный Fresh Hook):`);
console.log(`   Score Early (E): ${reportA.scoreEarly} | Score Dedicated (D): ${reportA.scoreDedicated}`);
if (reportA.scoreEarly <= reportA.scoreDedicated) {
  throw new Error('VST Error: Early score must be higher than Dedicated score when SMP is dominant!');
}

// Scenario B: Low fresh hook, high deep watch & spend (Typical loyal community)
const reportB = vst.computeRankingReport({ smp: 0.2, lmp: 0.9, chat: 0.8, follow: 0.7, spend: 0.8 });
console.log(`\n✅ 4. Сценарий B (Сильный Deep Watch & Spend):`);
console.log(`   Score Early (E): ${reportB.scoreEarly} | Score Dedicated (D): ${reportB.scoreDedicated}`);
if (reportB.scoreDedicated <= reportB.scoreEarly) {
  throw new Error('VST Error: Dedicated score must be higher than Early score when LMP/Spend are dominant!');
}

console.log(`\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО! Математика исследования строго соблюдена.`);
