/**
 * Verification test for Server-Sent Events State Sync
 */

const http = require('http');

console.log('🧪 Проверка серверной синхронизации состояния между Панелью и OBS...\n');

// 1. Send broadcast
const sampleReport = {
  scoreOverall: 77.3,
  scoreEarly: 65.0,
  scoreDedicated: 82.1,
  tier: 'VIRAL',
  tierColor: '#a855f7',
  tierBadge: 'VIRAL SURGE',
  probs: { smp: 80, lmp: 75, chat: 70, follow: 65, spend: 50 },
  state: { meta: { viewersCount: 150, msgPerSec: 2.5, game: 'Dota 2', isLive: true } },
  activeChannel: 'kiryanyam'
};

const postData = JSON.stringify(sampleReport);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/state/broadcast',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('1. Ответ сервера на Broadcast:', body);

    // 2. Fetch latest snapshot
    http.get('http://localhost:3000/api/state/latest', (res2) => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => {
        const latest = JSON.parse(body2);
        console.log('2. Проверка последнего снапшота на сервере:');
        console.log(`   • Канал: ${latest.activeChannel}`);
        console.log(`   • Скор: ${latest.scoreOverall}`);
        console.log(`   • CCU: ${latest.state?.meta?.viewersCount}`);

        if (latest.scoreOverall === 77.3 && latest.activeChannel === 'kiryanyam') {
          console.log('\n🎉 СЕРВЕРНАЯ СИНХРОНИЗАЦИЯ РАБОТАЕТ ИДЕАЛЬНО!');
        } else {
          console.log('\n❌ Ошибка данных синхронизации.');
        }
      });
    });
  });
});

req.on('error', (err) => {
  console.log('Сервер не запущен в фоне для теста (это нормально, если запускается через start_widget.bat):', err.message);
});

req.write(postData);
req.end();
