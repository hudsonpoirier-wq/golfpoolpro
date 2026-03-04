const elements = {
  configForm: document.getElementById('config-form'),
  configStatus: document.getElementById('config-status'),
  tournamentSelect: document.getElementById('tournament-select'),
  generateLinksButton: document.getElementById('generate-links'),
  invitationLink: document.getElementById('invitation-link'),
  lobbyLink: document.getElementById('lobby-link'),
  startDraftButton: document.getElementById('start-draft'),
  shotClock: document.getElementById('shot-clock'),
  draftOrder: document.getElementById('draft-order'),
  availableGolfers: document.getElementById('available-golfers'),
  leaderboardBody: document.getElementById('leaderboard-body'),
  winningProjection: document.getElementById('winning-projection'),
  volatility: document.getElementById('volatility')
};

let localState = {
  config: null,
  draft: null,
  shotClockTimer: null,
  shotClockValue: 0
};

function setStatus(text) {
  elements.configStatus.textContent = text;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function renderTournaments(tournaments) {
  elements.tournamentSelect.innerHTML = '';
  tournaments.forEach((tournament) => {
    const option = document.createElement('option');
    option.value = tournament.id;
    option.textContent = `${tournament.name} (${formatDate(tournament.startDate)})`;
    elements.tournamentSelect.appendChild(option);
  });
}

function renderDraft() {
  if (!localState.draft) return;

  elements.draftOrder.innerHTML = '';
  localState.draft.teams.slice(0, 20).forEach((team, index) => {
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${team.name} (${team.golfers.length} picks)`;
    elements.draftOrder.appendChild(item);
  });

  elements.availableGolfers.innerHTML = '';
  localState.draft.availableGolfers.forEach((golfer) => {
    const item = document.createElement('li');
    item.textContent = golfer;
    item.title = 'Click to assign this golfer to Team 1 (demo action)';
    item.addEventListener('click', () => makePick(golfer));
    elements.availableGolfers.appendChild(item);
  });
}

function renderLeaderboard(leaderboard) {
  elements.leaderboardBody.innerHTML = '';
  leaderboard.slice(0, 10).forEach((team) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${team.teamName}</td>
      <td>${team.scoreToPar > 0 ? `+${team.scoreToPar}` : team.scoreToPar}</td>
      <td>${team.eligible ? 'Yes' : 'No'}</td>
    `;
    elements.leaderboardBody.appendChild(row);
  });
}

function startLocalShotClock(seconds) {
  clearInterval(localState.shotClockTimer);
  localState.shotClockValue = seconds;
  elements.shotClock.textContent = `${seconds}s`;

  localState.shotClockTimer = setInterval(() => {
    localState.shotClockValue -= 1;
    if (localState.shotClockValue <= 0) {
      localState.shotClockValue = seconds;
    }
    elements.shotClock.textContent = `${localState.shotClockValue}s`;
  }, 1000);
}

async function loadConfig() {
  const { config } = await fetchJson('/api/admin/config');
  localState.config = config;

  elements.configForm.participantCapacity.value = config.participantCapacity;
  elements.configForm.rosterSize.value = config.rosterSize;
  elements.configForm.cutLineThreshold.value = config.cutLineThreshold;
  elements.configForm.shotClockSeconds.value = config.shotClockSeconds;
}

async function loadTournaments() {
  const { tournaments } = await fetchJson('/api/tournaments/future');
  renderTournaments(tournaments);
  if (localState.config?.tournamentId) {
    elements.tournamentSelect.value = localState.config.tournamentId;
  }
}

async function loadDraft() {
  const { draft } = await fetchJson('/api/draft/state');
  localState.draft = draft;
  renderDraft();
}

async function loadLeaderboard() {
  const { leaderboard } = await fetchJson('/api/leaderboard');
  renderLeaderboard(leaderboard);
}

async function saveConfig(event) {
  event.preventDefault();
  const formData = new FormData(elements.configForm);

  const payload = {
    participantCapacity: Number(formData.get('participantCapacity')),
    rosterSize: Number(formData.get('rosterSize')),
    cutLineThreshold: Number(formData.get('cutLineThreshold')),
    shotClockSeconds: Number(formData.get('shotClockSeconds')),
    tournamentId: String(formData.get('tournamentId'))
  };

  const result = await fetchJson('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  localState.config = result.config;
  startLocalShotClock(localState.config.shotClockSeconds);
  setStatus('Configuration saved.');
}

async function generateLinks() {
  const { links } = await fetchJson('/api/pool/links', { method: 'POST' });
  elements.invitationLink.textContent = links.invitationLink;
  elements.lobbyLink.textContent = links.lobbyLink;
}

async function startDraft() {
  const { draft } = await fetchJson('/api/draft/start', { method: 'POST' });
  localState.draft = draft;
  renderDraft();
  startLocalShotClock(localState.config?.shotClockSeconds || 60);
}

async function makePick(golferName) {
  if (!localState.draft?.isLive) return;

  try {
    const { draft } = await fetchJson('/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: 'team-1', golferName })
    });
    localState.draft = draft;
    renderDraft();
  } catch (error) {
    setStatus(error.message);
  }
}

function bindEvents() {
  elements.configForm.addEventListener('submit', (event) => {
    saveConfig(event).catch((error) => setStatus(error.message));
  });

  elements.generateLinksButton.addEventListener('click', () => {
    generateLinks().catch((error) => setStatus(error.message));
  });

  elements.startDraftButton.addEventListener('click', () => {
    startDraft().catch((error) => setStatus(error.message));
  });
}

function connectLiveStream() {
  const source = new EventSource('/api/stream');

  source.addEventListener('leaderboard-update', (event) => {
    const payload = JSON.parse(event.data);
    renderLeaderboard(payload.leaderboard);
    elements.winningProjection.textContent = payload.projection.winningScore;
    elements.volatility.textContent = `${payload.projection.volatility}%`;
  });

  source.addEventListener('draft-update', (event) => {
    const payload = JSON.parse(event.data);
    localState.draft = payload.draft;
    renderDraft();
  });
}

async function init() {
  bindEvents();
  await loadConfig();
  await loadTournaments();
  await loadDraft();
  await loadLeaderboard();
  startLocalShotClock(localState.config.shotClockSeconds);
  connectLiveStream();
}

init().catch((error) => {
  setStatus(error.message);
});
