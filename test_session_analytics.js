/**
 * Verification Test for Session Recorder & Algorithmic Event Detection
 */

const SessionRecorder = require('./js/engine/session_recorder.js');

console.log('🧪 Тестирование SessionRecorder и детектора алгоритмических событий...\n');

const recorder = new SessionRecorder({ sampleIntervalMs: 100 }); // Fast sample interval for test

const startTime = Date.now() - 3600 * 1000; // 1 hour ago
recorder.sessionStartTime = startTime;

// Phase 1: Warmup (0 - 15 min)
for (let i = 0; i < 15; i++) {
  recorder.recordTick({
    scoreOverall: 58.0 + Math.random() * 4,
    probs: { smp: 60, lmp: 55, chat: 50, follow: 45, spend: 30 },
    state: { meta: { viewersCount: 45 + i * 2, msgPerSec: 1.2, game: 'Dota 2', title: 'Ranked Warmup' } },
    activeChannel: 'test_streamer'
  });
  recorder.lastSampleTime = 0;
}

// Phase 2: Chat Hype & Viral Spike (15 - 35 min)
for (let i = 0; i < 20; i++) {
  recorder.recordTick({
    scoreOverall: 84.5 + Math.random() * 3,
    probs: { smp: 88, lmp: 80, chat: 92, follow: 75, spend: 60 },
    state: { meta: { viewersCount: 280 + i * 15, msgPerSec: 8.5, game: 'Dota 2', title: '🔥 INSANE COMEBACK!' } },
    activeChannel: 'test_streamer'
  });
  recorder.lastSampleTime = 0;
}

// Phase 3: AFK / Retention Drop (35 - 45 min)
for (let i = 0; i < 10; i++) {
  recorder.recordTick({
    scoreOverall: 38.0,
    probs: { smp: 22, lmp: 30, chat: 15, follow: 20, spend: 10 },
    state: { meta: { viewersCount: 190 - i * 5, msgPerSec: 0.3, game: 'Dota 2', title: 'AFK / Eating' } },
    activeChannel: 'test_streamer'
  });
  recorder.lastSampleTime = 0;
}

// Phase 4: Big Sub Train / Monetization Spike (45 - 60 min)
for (let i = 0; i < 15; i++) {
  recorder.recordTick({
    scoreOverall: 76.0,
    probs: { smp: 70, lmp: 75, chat: 65, follow: 70, spend: 85 },
    state: { meta: { viewersCount: 220, msgPerSec: 3.8, game: 'Dota 2', title: 'Sub Train Hype' } },
    activeChannel: 'test_streamer'
  });
  recorder.lastSampleTime = 0;
}

// Check Results
const timeline = recorder.getTimeline();
const events = recorder.getEvents();
const stats = recorder.getSummaryStats();

console.log(`1. Всего зафиксировано точек: ${timeline.length}`);
console.log(`2. Статистика сессии:`);
console.log(`   • Длительность: ${stats.durationMinutes} мин`);
console.log(`   • Пиковый CCU: ${stats.peakCCU} зрителей`);
console.log(`   • Средний CCU: ${stats.avgCCU} зрителей`);
console.log(`   • Средний Twitch Score: ${stats.avgScore}/100 (Пик: ${stats.peakScore})`);
console.log(`   • Скорость чата: ${stats.avgChatSpeed} msg/s`);
console.log(`   • Основная игра: ${stats.dominantGame}`);

console.log(`\n3. Зафиксированные ключевые события (${events.length}):`);
events.forEach((ev, idx) => {
  console.log(`   ${ev.icon} #${idx + 1} [${ev.timeFormatted}] ${ev.title}: ${ev.desc}`);
});

if (events.length >= 3 && stats.peakCCU >= 500 && stats.peakScore >= 80) {
  console.log('\n🎉 ВСЕ ТЕСТЫ SESSION RECORDER & EVENT DETECTOR ПРОЙДЕНЫ УСПЕШНО!');
} else {
  console.log('\n⚠️ Проверка завершена с предупреждениями.');
}
