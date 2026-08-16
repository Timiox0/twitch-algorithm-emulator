const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Reusable HTTPS agent with keep-alive for sub-50ms Twitch GQL requests
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  keepAliveMsecs: 30000
});

// Central Real-Time State Hub (Single Source of Truth for OBS and Dashboard)
let globalServerReport = null;
let sseClients = [];

function broadcastReportToSse(report) {
  globalServerReport = report;
  const payload = `data: ${JSON.stringify(report)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch (e) {
      sseClients.splice(i, 1);
    }
  }
}

/**
 * Helper to execute Twitch GQL queries with keep-alive
 */
function queryTwitchGQL(operationName, query, variables) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify([{ operationName, variables, query }]);
    const req = https.request({
      hostname: 'gql.twitch.tv',
      path: `/gql?_t=${Date.now()}`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Twitch GQL Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Fetches real-time Twitch stream metadata via Twitch GQL
 */
async function fetchTwitchStreamInfo(channelLogin) {
  const cleanLogin = channelLogin.toLowerCase().replace('#', '').trim();
  const query = `query StreamMetadata($channelLogin: String!) {
    user(login: $channelLogin) {
      id
      login
      displayName
      followers {
        totalCount
      }
      stream {
        id
        viewersCount
        type
        game {
          id
          name
        }
        title
        createdAt
      }
    }
  }`;

  const gqlRes = await queryTwitchGQL('StreamMetadata', query, { channelLogin: cleanLogin });
  const user = gqlRes?.[0]?.data?.user;

  if (!user) {
    return {
      channel: cleanLogin,
      isLive: false,
      viewersCount: 0,
      followersCount: 0,
      game: 'Just Chatting',
      title: 'Channel not found or offline',
      uptimeMinutes: 0
    };
  }

  const stream = user.stream;
  const isLive = Boolean(stream && stream.type === 'live');

  let uptimeMinutes = 0;
  if (isLive && stream.createdAt) {
    const started = new Date(stream.createdAt).getTime();
    uptimeMinutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
  }

  return {
    channel: user.login,
    displayName: user.displayName,
    isLive: isLive,
    viewersCount: isLive ? stream.viewersCount : 0,
    followersCount: user.followers?.totalCount || 0,
    game: stream?.game?.name || 'Just Chatting',
    title: stream?.title || (isLive ? 'Live Stream' : 'Offline'),
    uptimeMinutes: uptimeMinutes
  };
}

/**
 * Generates calibrated Division Rivals when category page has only giant streams
 */
function generateDivisionBracket(gameName, userCCU, currentChannel) {
  const baseCCU = Math.max(1, Number(userCCU) || 15);
  const sampleNames = ['vibe_stream', 'nexus_play', 'cyber_cast', 'chill_station', 'shadow_live', 'pixel_pro', 'aurora_gaming'];
  
  // Deltas around user CCU
  const deltas = [+12, +7, +3, -4, -8, -13];
  const list = [];

  // Add higher rivals
  deltas.filter(d => d > 0).forEach((d, idx) => {
    const ccu = Math.max(1, baseCCU + d);
    list.push({
      channel: sampleNames[idx] || `rival_${idx + 1}`,
      displayName: (sampleNames[idx] || `rival_${idx + 1}`).replace('_', ' ').toUpperCase(),
      viewersCount: ccu,
      viewers: ccu,
      title: `${gameName} grind & community`,
      game: gameName
    });
  });

  // Add User
  list.push({
    channel: currentChannel || 'you',
    displayName: currentChannel || 'Ваш Стрим',
    viewersCount: baseCCU,
    viewers: baseCCU,
    title: 'Ваша трансляция',
    game: gameName,
    isCurrent: true
  });

  // Add lower rivals
  deltas.filter(d => d < 0).forEach((d, idx) => {
    const ccu = Math.max(1, baseCCU + d);
    list.push({
      channel: sampleNames[idx + 3] || `rival_${idx + 4}`,
      displayName: (sampleNames[idx + 3] || `rival_${idx + 4}`).replace('_', ' ').toUpperCase(),
      viewersCount: ccu,
      viewers: ccu,
      title: `${gameName} stream`,
      game: gameName
    });
  });

  list.sort((a, b) => (b.viewersCount || 0) - (a.viewersCount || 0));
  return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

/**
 * Fetches real active streams in a category with realistic weight-class matchmaking
 */
async function fetchTwitchCategoryStreams(gameName, targetCCU = 0, currentChannel = '') {
  const query = `query CategoryStreams($game: String!) {
    game(name: $game) {
      id
      name
      viewersCount
      streams(first: 100) {
        edges {
          node {
            id
            viewersCount
            broadcaster {
              id
              login
              displayName
            }
            title
            game {
              name
            }
          }
        }
      }
    }
  }`;

  const gqlRes = await queryTwitchGQL('CategoryStreams', query, { game: gameName });
  const gameData = gqlRes?.[0]?.data?.game;

  if (!gameData || !gameData.streams || !gameData.streams.edges) {
    return {
      game: gameName,
      totalCategoryViewers: 0,
      streamsCount: 0,
      globalTop: [],
      peerRivals: generateDivisionBracket(gameName, targetCCU, currentChannel)
    };
  }

  const allStreams = gameData.streams.edges.map((edge, index) => {
    const s = edge.node;
    return {
      rank: index + 1,
      channel: s.broadcaster?.login || '',
      displayName: s.broadcaster?.displayName || s.broadcaster?.login || '',
      viewersCount: s.viewersCount || 0,
      viewers: s.viewersCount || 0,
      title: s.title || '',
      game: s.game?.name || gameName
    };
  });

  const globalTop = allStreams.slice(0, 10);
  let userRank = allStreams.findIndex(s => s.channel.toLowerCase() === currentChannel.toLowerCase()) + 1;
  const numCCU = Number(targetCCU) || 0;

  let peerRivals = [];

  if (userRank > 0) {
    // User is in the top 100 list! Slice real neighbors
    const startIdx = Math.max(0, userRank - 4);
    peerRivals = allStreams.slice(startIdx, startIdx + 8);
  } else if (numCCU > 0) {
    // Find streams close to user CCU (within realistic 2x range)
    const closestIdx = allStreams.findIndex(s => s.viewersCount <= numCCU);
    
    if (closestIdx !== -1) {
      const startIdx = Math.max(0, closestIdx - 4);
      peerRivals = allStreams.slice(startIdx, startIdx + 8);
    } else {
      // If lowest stream on page 1 is > 2x the user's CCU, generate realistic division bracket
      const lowestCCU = allStreams[allStreams.length - 1]?.viewersCount || 1000;
      if (lowestCCU > Math.max(numCCU * 2.5, 120)) {
        peerRivals = generateDivisionBracket(gameName, numCCU, currentChannel);
      } else {
        peerRivals = allStreams.slice(-8);
      }
    }
  } else {
    peerRivals = allStreams.slice(-8);
  }

  // Ensure current streamer is included in peer rivals list
  const userInList = peerRivals.some(s => s.channel.toLowerCase() === currentChannel.toLowerCase());
  if (!userInList && currentChannel) {
    peerRivals.push({
      rank: userRank > 0 ? userRank : (allStreams.length > 0 ? allStreams.length + 1 : 1),
      channel: currentChannel,
      displayName: currentChannel,
      viewersCount: numCCU,
      viewers: numCCU,
      title: 'Ваша трансляция',
      game: gameName,
      isCurrent: true
    });
    peerRivals.sort((a, b) => (b.viewersCount || 0) - (a.viewersCount || 0));
  }

  return {
    game: gameData.name || gameName,
    totalCategoryViewers: gameData.viewersCount || 0,
    streamsCount: allStreams.length,
    globalTop,
    peerRivals
  };
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. API Route: Server-Sent Events (SSE) for Real-Time OBS & Dashboard Sync
  if (pathname === '/api/state/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });

    res.write(': connected\n\n');
    if (globalServerReport) {
      res.write(`data: ${JSON.stringify(globalServerReport)}\n\n`);
    }

    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // 2. API Route: POST Broadcast State Report from Master Dashboard
  if (pathname === '/api/state/broadcast' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const report = JSON.parse(body);
        broadcastReportToSse(report);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', sseClientsCount: sseClients.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. API Route: GET Latest State Snapshot
  if (pathname === '/api/state/latest') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(globalServerReport || {}));
    return;
  }

  // 4. API Route: /api/twitch/stream?channel=...
  if (pathname === '/api/twitch/stream') {
    const channel = urlObj.searchParams.get('channel');
    if (!channel) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'channel parameter is required' }));
      return;
    }

    try {
      const data = await fetchTwitchStreamInfo(channel);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. API Route: /api/twitch/category?game=...&ccu=...&channel=...
  if (pathname === '/api/twitch/category') {
    const game = urlObj.searchParams.get('game');
    const ccu = urlObj.searchParams.get('ccu') || 0;
    const channel = urlObj.searchParams.get('channel') || '';

    if (!game) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'game parameter is required' }));
      return;
    }

    try {
      const data = await fetchTwitchCategoryStreams(game, ccu, channel);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6. Static File Serving
  let filePath = path.join(__dirname, pathname);
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType
      });
      res.end(content);
    }
  });
});

// Periodic keep-alive for all active SSE listeners (OBS Browser Sources)
setInterval(() => {
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(': keepalive\n\n');
    } catch (e) {
      sseClients.splice(i, 1);
    }
  }
}, 15000);

let retryAttempted = false;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !retryAttempted) {
    retryAttempted = true;
    console.log(`\n⚠️ Порт ${PORT} занят предыдущим процессом. Автоматически освобождаем порт...`);
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
      }
      setTimeout(() => {
        try {
          server.close();
        } catch (e) {}
        server.listen(PORT);
      }, 600);
    } catch (e) {
      console.error(`\n❌ Не удалось автоматически освободить порт. Попробуйте еще раз.\n`);
    }
  } else {
    console.error(`\n❌ Ошибка сервера:`, err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🚀 Twitch Ranking Algorithm Emulator (Real-Time State Sync Engine)`);
  console.log(`============================================================`);
  console.log(`\n📊 Панель управления: http://localhost:${PORT}/`);
  console.log(`🎥 OBS Browser Source: http://localhost:${PORT}/overlay.html`);
  console.log(`⭕ Только круг Score: http://localhost:${PORT}/overlay.html?layout=circle`);
  console.log(`📏 Мини-бар для OBS:   http://localhost:${PORT}/overlay.html?layout=mini`);
  console.log(`============================================================\n`);
});
