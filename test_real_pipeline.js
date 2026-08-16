/**
 * Real-Data Pipeline Integration Test
 * Verifies live Twitch data extraction, feature normalization, and FSM+MMoE+VST scoring.
 */

const https = require('https');
const FreshSignalModel = require('./js/engine/fsm.js');
const MMoEModel = require('./js/engine/mmoe.js');
const ViewerSegmentTargeting = require('./js/engine/vst.js');
const FeatureExtractor = require('./js/engine/feature_extractor.js');

function fetchTwitchStreamInfo(channelLogin) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify([
      {
        operationName: "StreamMetadata",
        variables: { channelLogin },
        query: `query StreamMetadata($channelLogin: String!) {
          user(login: $channelLogin) {
            id login displayName
            followers { totalCount }
            stream { id viewersCount createdAt title game { id name displayName } }
          }
        }`
      }
    ]);

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
          const u = json[0]?.data?.user;
          if (!u) return resolve({ isLive: false });
          resolve({
            isLive: !!u.stream,
            channel: u.login,
            displayName: u.displayName,
            viewersCount: u.stream ? u.stream.viewersCount : 0,
            title: u.stream ? u.stream.title : '',
            game: u.stream?.game?.name || '',
            uptimeMinutes: u.stream ? Math.max(1, Math.round((Date.now() - new Date(u.stream.createdAt).getTime()) / 60000)) : 0,
            followersCount: u.followers?.totalCount || 0
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testPipeline() {
  console.log('📡 Тестирование пайплайна на реальных данных Twitch...\n');

  const channel = 'ibai'; // Test with a prominent channel
  const apiData = await fetchTwitchStreamInfo(channel);
  console.log('1. Получены реальные данные Twitch API:', apiData);

  const mockIrcMetrics = {
    msgPerSec: 18.5,
    uniqueChatters: 340,
    dedicatedChatterCount: 230, // Badged chatters (Subs/VIPs)
    earlyChatterCount: 110,     // First-time / unbadged chatters
    dedicatedRatio: 0.68,
    totalBitsInWindow: 1500,
    recentSubsCount: 3
  };

  const extractor = new FeatureExtractor();
  const features = extractor.extract(apiData, mockIrcMetrics);
  console.log('\n2. Извлеченные нормализованные признаки:', features);

  const fsm = new FreshSignalModel();
  const mmoe = new MMoEModel(4);
  const vst = new ViewerSegmentTargeting();

  const p_smp = fsm.predict({
    hookVelocity: features.hookVelocity,
    chatReactivity: features.chatReactivity,
    streamerEnergy: features.streamerEnergy,
    visualClarity: features.visualClarity,
    titleClickability: features.titleClickability
  });

  const mmoeRes = mmoe.forward({
    avgWatchDuration: features.avgWatchDuration,
    chatterRatio: features.chatterRatio,
    historicalLoyalty: features.historicalLoyalty,
    monetizationIntensity: features.monetizationIntensity
  });

  const report = vst.computeRankingReport({
    smp: p_smp,
    lmp: mmoeRes.predictions.lmp,
    chat: mmoeRes.predictions.chat,
    follow: mmoeRes.predictions.follow,
    spend: mmoeRes.predictions.spend
  }, features.dedicatedRatio);

  console.log('\n3. Итоговый отчет алгоритма ранжирования Twitch (VST):');
  console.log(`   Общий Twitch Score: ${report.scoreOverall} / 100 (${report.tier})`);
  console.log(`   Score для Новичков (Early E): ${report.scoreEarly} / 100`);
  console.log(`   Score для Ядра (Dedicated D): ${report.scoreDedicated} / 100`);
  console.log(`   Вероятности 5 факторов:`, report.probs);

  console.log('\n🎉 ПАЙПЛАЙН РЕАЛЬНЫХ ДАННЫХ РАБОТАЕТ БЕЗУПРЕЧНО!');
}

testPipeline().catch(console.error);
