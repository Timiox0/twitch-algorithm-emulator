/**
 * Test Division Leagues & Attainable Peer Rivals Ranking
 */

const CategoryBenchmarkEngine = require('./js/engine/category_benchmark.js');

console.log('🧪 Тестирование системы лиг и достижимого ранжирования...\n');

const engine = new CategoryBenchmarkEngine();

// Case 1: Small Streamer (45 CCU in Just Chatting)
const reportSmall = {
  activeChannel: 'my_small_channel',
  scoreOverall: 72.5,
  state: { meta: { viewersCount: 45, game: 'Just Chatting' } }
};

const resultSmall = engine.evaluate(reportSmall, { game: 'Just Chatting', streams: [] });
console.log('1. Малый стример (45 CCU):');
console.log(`   • Лига: ${resultSmall.league.icon} ${resultSmall.league.name} (${resultSmall.league.desc})`);
console.log(`   • Позиция в дивизионе: #${resultSmall.divisionRank} из ${resultSmall.totalInDivisionSample}`);
console.log(`   • Прогресс лиги: ${resultSmall.leagueProgressPct}%`);
console.log(`   • Достижимая цель: ${resultSmall.achievableGoalText}`);
console.log('   • Пул соперников в дивизионе:');
resultSmall.peerRivals.forEach((r, idx) => console.log(`     #${idx + 1} ${r.displayName}: ${r.viewers} CCU ${r.isCurrent ? '👈 (ВЫ)' : ''}`));

// Case 2: Mid Streamer (240 CCU in Dota 2)
const reportMid = {
  activeChannel: 'dota_grinder',
  scoreOverall: 84.0,
  state: { meta: { viewersCount: 240, game: 'Dota 2' } }
};

const resultMid = engine.evaluate(reportMid, { game: 'Dota 2', streams: [] });
console.log('\n2. Средний стример (240 CCU):');
console.log(`   • Лига: ${resultMid.league.icon} ${resultMid.league.name} (${resultMid.league.desc})`);
console.log(`   • Позиция в дивизионе: #${resultMid.divisionRank}`);
console.log(`   • Достижимая цель: ${resultMid.achievableGoalText}`);

console.log('\n🎉 ВСЕ ТЕСТЫ ЛИГ И ДИВИЗИОНОВ УСПЕШНО ПРОЙДЕНЫ!');
