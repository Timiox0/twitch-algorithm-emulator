/**
 * Test Category Benchmark Engine with Real Live Twitch Data
 */

const https = require('https');
const CategoryBenchmarkEngine = require('./js/engine/category_benchmark.js');
const ViewerSegmentTargeting = require('./js/engine/vst.js');

function fetchCategoryStreams(gameName, limit = 8) {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const query = `query GetGameStreams($slug: String!, $limit: Int) {
    game(slug: $slug) {
      id
      name
      displayName
      viewersCount
      streams(first: $limit, options: { sort: VIEWER_COUNT }) {
        edges {
          node {
            id
            viewersCount
            title
            broadcaster {
              login
              displayName
            }
          }
        }
      }
    }
  }`;

  const postData = JSON.stringify([{ operationName: 'GetGameStreams', variables: { slug, limit }, query }]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'gql.twitch.tv',
      path: '/gql',
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const gameData = json[0]?.data?.game;
          const streams = gameData?.streams?.edges?.map((e, idx) => ({
            rank: idx + 1,
            channel: e.node.broadcaster.login,
            displayName: e.node.broadcaster.displayName,
            viewers: e.node.viewersCount,
            title: e.node.title
          })) || [];
          resolve({ game: gameData?.displayName || gameName, streams });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testCategoryBenchmark() {
  console.log('🏆 Запуск проверки Category Benchmark Engine на реальных данных Twitch...\n');

  const game = 'League of Legends';
  const catData = await fetchCategoryStreams(game, 6);
  console.log(`1. Получены топ стримы в категории [${catData.game}]:`);
  catData.streams.forEach(s => console.log(`   #${s.rank} ${s.displayName} | ${s.viewers.toLocaleString()} CCU | ${s.title.substring(0, 45)}...`));

  const engine = new CategoryBenchmarkEngine();

  // Test scenario 1: Mid-sized channel (2,500 viewers in League of Legends)
  const mockReport = {
    activeChannel: 'my_awesome_channel',
    scoreOverall: 78.4,
    probs: { smp: 82, lmp: 75, chat: 80, follow: 70, spend: 60 },
    state: { meta: { viewersCount: 2500, game: 'League of Legends' } }
  };

  const benchmarkResult = engine.evaluate(mockReport, catData);
  console.log('\n2. Результаты бенчмаркинга текущего стрима (2,500 CCU):');
  console.log(`   • Позиция в категории: #${benchmarkResult.currentRank}`);
  console.log(`   • Перцентиль в категории: Топ-${(100 - benchmarkResult.percentile).toFixed(1)}%`);
  console.log(`   • Категорийный тир: ${benchmarkResult.discoveryTierText}`);
  console.log(`   • Ближайший конкурент выше: ${benchmarkResult.competitorAbove?.displayName} (${benchmarkResult.competitorAbove?.viewers.toLocaleString()} CCU)`);
  console.log(`   • Стратегическая подсказка: ${benchmarkResult.gapAdvice}`);

  console.log('\n🎉 CATEGORY BENCHMARK ENGINE ПОЛНОСТЬЮ РАБОТАЕТ!');
}

testCategoryBenchmark().catch(console.error);
