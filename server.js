const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const state = {
  adminConfig: {
    poolName: 'GolfPoolPro',
    participantCapacity: 24,
    rosterSize: 6,
    cutLineThreshold: 3,
    shotClockSeconds: 60,
    tournamentId: ''
  },
  links: {
    invitationLink: '',
    lobbyLink: ''
  },
  draft: {
    isLive: false,
    currentPick: 0,
    startedAt: null,
    teams: [],
    availableGolfers: [
      'Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', 'Ludvig Aberg',
      'Xander Schauffele', 'Viktor Hovland', 'Collin Morikawa', 'Max Homa',
      'Justin Thomas', 'Patrick Cantlay', 'Tommy Fleetwood', 'Brooks Koepka',
      'Wyndham Clark', 'Hideki Matsuyama', 'Sungjae Im', 'Jordan Spieth',
      'Cameron Young', 'Shane Lowry', 'Min Woo Lee', 'Matt Fitzpatrick'
    ],
    picks: []
  },
  leaderboard: []
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function buildFutureTournaments() {
  const now = new Date();
  const tournaments = [];
  const majors = [
    { name: 'The Masters Tournament', month: 4 },
    { name: 'PGA Championship', month: 5 },
    { name: 'U.S. Open Championship', month: 6 },
    { name: 'The Open Championship', month: 7 }
  ];

  const endYear = now.getFullYear() + 2;
  let idCounter = 1;

  for (let year = now.getFullYear(); year <= endYear; year += 1) {
    majors.forEach((major) => {
      const eventDate = new Date(Date.UTC(year, major.month - 1, 15));
      if (eventDate > now) {
        tournaments.push({
          id: `major-${year}-${major.month}`,
          name: `${major.name} ${year}`,
          startDate: eventDate.toISOString(),
          category: 'Major'
        });
      }
    });

    for (let i = 0; i < 20; i += 1) {
      const eventDate = new Date(Date.UTC(year, i % 12, 4 + (i * 2) % 20));
      if (eventDate > now) {
        tournaments.push({
          id: `tour-${year}-${idCounter}`,
          name: `PGA Tour Event ${idCounter} (${year})`,
          startDate: eventDate.toISOString(),
          category: 'Tour Event'
        });
      }
      idCounter += 1;
    }
  }

  tournaments.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return tournaments;
}

function generateTeams() {
  return Array.from({ length: state.adminConfig.participantCapacity }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    ownerName: `Participant ${index + 1}`,
    golfers: [],
    scoreToPar: 0,
    madeCutCount: 0,
    eligible: true
  }));
}

function initializeDraftIfNeeded() {
  if (state.draft.teams.length === 0) {
    state.draft.teams = generateTeams();
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function recalcLeaderboard() {
  state.leaderboard = state.draft.teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      scoreToPar: team.scoreToPar,
      madeCutCount: team.madeCutCount,
      eligible: team.madeCutCount >= state.adminConfig.cutLineThreshold
    }))
    .sort((a, b) => a.scoreToPar - b.scoreToPar);
}

function updateLiveStats() {
  if (state.draft.teams.length === 0) return;

  state.draft.teams.forEach((team) => {
    if (team.golfers.length > 0) {
      team.scoreToPar += randomInt(-2, 2);
      team.madeCutCount = Math.min(team.golfers.length, Math.max(0, team.madeCutCount + randomInt(-1, 1)));
    }
  });

  recalcLeaderboard();
}

const streamClients = new Set();

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  streamClients.forEach((client) => client.write(data));
}

setInterval(() => {
  updateLiveStats();
  broadcast('leaderboard-update', {
    at: new Date().toISOString(),
    leaderboard: state.leaderboard.slice(0, 10),
    projection: {
      winningScore: state.leaderboard[0]?.scoreToPar ?? 0,
      volatility: randomInt(8, 22)
    }
  });
}, 4000);

function serveStatic(req, res) {
  let requestedPath = req.url === '/' ? '/index.html' : req.url;
  requestedPath = requestedPath.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/tournaments/future' && req.method === 'GET') {
      return sendJson(res, 200, { tournaments: buildFutureTournaments() });
    }

    if (req.url === '/api/admin/config' && req.method === 'POST') {
      const body = await readBody(req);
      state.adminConfig = {
        ...state.adminConfig,
        ...body
      };
      initializeDraftIfNeeded();
      recalcLeaderboard();
      return sendJson(res, 200, { ok: true, config: state.adminConfig });
    }

    if (req.url === '/api/admin/config' && req.method === 'GET') {
      return sendJson(res, 200, { config: state.adminConfig });
    }

    if (req.url === '/api/pool/links' && req.method === 'POST') {
      state.links.invitationLink = `https://golfpoolpro.app/invite/${crypto.randomBytes(10).toString('hex')}`;
      state.links.lobbyLink = `https://golfpoolpro.app/lobby/${crypto.randomBytes(10).toString('hex')}`;
      return sendJson(res, 200, { links: state.links });
    }

    if (req.url === '/api/pool/links' && req.method === 'GET') {
      return sendJson(res, 200, { links: state.links });
    }

    if (req.url === '/api/draft/start' && req.method === 'POST') {
      initializeDraftIfNeeded();
      state.draft.isLive = true;
      state.draft.startedAt = new Date().toISOString();
      state.draft.currentPick = 0;
      return sendJson(res, 200, { draft: state.draft });
    }

    if (req.url === '/api/draft/state' && req.method === 'GET') {
      initializeDraftIfNeeded();
      return sendJson(res, 200, { draft: state.draft });
    }

    if (req.url === '/api/draft/pick' && req.method === 'POST') {
      const body = await readBody(req);
      const { teamId, golferName } = body;

      if (!state.draft.isLive) {
        return sendJson(res, 400, { error: 'Draft has not started' });
      }

      const team = state.draft.teams.find((candidate) => candidate.id === teamId);
      if (!team) {
        return sendJson(res, 404, { error: 'Team not found' });
      }

      if (team.golfers.length >= state.adminConfig.rosterSize) {
        return sendJson(res, 400, { error: 'Team roster is full' });
      }

      const golferIndex = state.draft.availableGolfers.findIndex((name) => name === golferName);
      if (golferIndex === -1) {
        return sendJson(res, 404, { error: 'Golfer unavailable' });
      }

      state.draft.availableGolfers.splice(golferIndex, 1);
      team.golfers.push(golferName);
      team.madeCutCount = Math.min(team.golfers.length, randomInt(0, team.golfers.length));

      state.draft.currentPick += 1;
      state.draft.picks.push({
        pickNumber: state.draft.currentPick,
        teamId,
        golferName,
        pickedAt: new Date().toISOString()
      });

      recalcLeaderboard();
      broadcast('draft-update', {
        at: new Date().toISOString(),
        draft: state.draft
      });

      return sendJson(res, 200, { draft: state.draft });
    }

    if (req.url === '/api/leaderboard' && req.method === 'GET') {
      recalcLeaderboard();
      return sendJson(res, 200, { leaderboard: state.leaderboard });
    }

    if (req.url === '/api/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });

      streamClients.add(res);
      res.write(`event: init\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

      req.on('close', () => {
        streamClients.delete(res);
      });
      return;
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GolfPoolPro running on http://localhost:${PORT}`);
});
