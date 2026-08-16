const https = require('https');

function queryGQL(operationName, query, variables) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify([{ operationName, variables, query }]);
    const req = https.request({
      hostname: 'gql.twitch.tv',
      path: '/gql',
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function debugSchema() {
  const q = `query DirectoryPage_Game($name: String!) {
    game(name: $name) {
      name
      streams(first: 30, options: { sort: VIEWER_COUNT_ASC }) {
        edges {
          node {
            viewersCount
            broadcaster {
              login
              displayName
            }
            title
          }
        }
      }
    }
  }`;
  const res = await queryGQL('DirectoryPage_Game', q, { name: 'Just Chatting' });
  console.log('Response with enum VIEWER_COUNT_ASC:', JSON.stringify(res, null, 2));
}

debugSchema();
