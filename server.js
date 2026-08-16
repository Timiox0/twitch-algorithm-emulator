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
        createdAt
        title
        game {
          id
          name
          displayName
        }
      }
    }
  }`;

  const json = await queryTwitchGQL('StreamMetadata', query, { channelLogin: cleanLogin });
  const userData = json[0]?.data?.user;
  if (!userData) {
    return { isLive: false, error: 'User not found', channel: cleanLogin, timestamp: Date.now() };
  }

  const isLive = !!userData.stream;
  const viewersCount = isLive ? (userData.stream.viewersCount || 0) : 0;
  const title = isLive ? userData.stream.title : '';
  const game = isLive ? (userData.stream.game?.name || userData.stream.game?.displayName || '') : '';
  const startedAt = isLive ? userData.stream.createdAt : null;
  const followersCount = userData.followers?.totalCount || 0;

  let uptimeMinutes = 0;
  if (isLive && startedAt) {
    const diffMs = Date.now() - new Date(startedAt).getTime();
    uptimeMinutes = Math.max(1, Math.round(diffMs / 60000));
  }

  return {
    isLive,
    channel: userData.login,
    displayName: userData.displayName,
    viewersCount,
    title,
    game,
    startedAt,
    uptimeMinutes,
    followersCount,
    timestamp: Date.now()
  };
}

/**
 * Fetches 100 real live streams in category and extracts both Global Top and Local Peer Rivals
 */
async function fetchTwitchCategoryStreams(gameName, targetCCU = 0, currentChannel = '') {
  if (!gameName) return { game: '', streams: [], peerRivals: [] };
  
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const query = `query GetGameStreams100($slug: String!) {
    game(slug: $slug) {
      id
      name
      displayName
      viewersCount
      streams(first: 100, options: { sort: VIEWER_COUNT }) {
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

  const json = await queryTwitchGQL('GetGameStreams100', query, { slug });
  const gameData = json[0]?.data?.game;
  if (!gameData) {
    return { game: gameName, slug, totalCategoryViewers: 0, globalTop: [], peerRivals: [] };
  }

  const allStreams = gameData.streams?.edges?.map(e => ({
    channel: e.node.broadcaster.login,
    displayName: e.node.broadcaster.displayName,
    viewers: e.node.viewersCount,
    title: e.node.title
  })) || [];

  const globalTop = allStreams.slice(0, 10).map((s, idx) => ({ ...s, rank: idx + 1 }));

  // Find real online peer rivals around targetCCU
  const safeChannel = (currentChannel || '').toLowerCase();
  const ccu = Math.max(0, parseInt(targetCCU, 10) || 0);

  const otherStreams = allStreams.filter(s => s.channel.toLowerCase() !== safeChannel);
  
  // Real streamers with CCU >= targetCCU (closest 2 above)
  const higherStreams = otherStreams.filter(s => s.viewers >= ccu).sort((a, b) => a.viewers - b.viewers);
  const rivalsAbove = higherStreams.slice(0, 2).reverse();

  // Real streamers with CCU < targetCCU (closest 2 below)
  const lowerStreams = otherStreams.filter(s => s.viewers < ccu).sort((a, b) => b.viewers - a.viewers);
  const rivalsBelow = lowerStreams.slice(0, 2);

  // Current channel entry
  const currentEntry = {
    channel: currentChannel || 'Ваш Стрим',
    displayName: currentChannel || 'Ваш Стрим',
    viewers: ccu,
    title: 'Текущий прямой эфир',
    isCurrent: true
  };

  let peerRivals = [...rivalsAbove, currentEntry, ...rivalsBelow];
  if (peerRivals.length < 3 && allStreams.length > 0) {
    peerRivals = allStreams.slice(0, 5).map(s => ({
      ...s,
      isCurrent: s.channel.toLowerCase() === safeChannel
    }));
  }

  return {
    game: gameData.displayName || gameData.name || gameName,
    slug,
    totalCategoryViewers: gameData.viewersCount || 0,
    totalStreamsFound: allStreams.length,
    globalTop,
    peerRivals
  };
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  // 1. API Route: /api/twitch/stream?channel=...
  if (pathname === '/api/twitch/stream') {
    const channel = urlObj.searchParams.get('channel');
    if (!channel) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'channel parameter is required' }));
      return;
    }

    try {
      const data = await fetchTwitchStreamInfo(channel);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. API Route: /api/twitch/category?game=...&ccu=...&channel=...
  if (pathname === '/api/twitch/category') {
    const game = urlObj.searchParams.get('game');
    const ccu = urlObj.searchParams.get('ccu') || 0;
    const channel = urlObj.searchParams.get('channel') || '';

    if (!game) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'game parameter is required' }));
      return;
    }

    try {
      const data = await fetchTwitchCategoryStreams(game, ccu, channel);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. Static File Serving
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
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🚀 Twitch Ranking Algorithm Emulator (High-Frequency Real-Time Engine)`);
  console.log(`============================================================`);
  console.log(`\n📊 Панель управления: http://localhost:${PORT}/`);
  console.log(`🎥 OBS Browser Source: http://localhost:${PORT}/overlay.html`);
  console.log(`💡 OBS с каналом:     http://localhost:${PORT}/overlay.html?channel=kiryanyam`);
  console.log(`============================================================\n`);
});
