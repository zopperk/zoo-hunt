-- Zoo Hunt schema. Timestamps are epoch milliseconds set by the Worker.

CREATE TABLE games (
	id             TEXT PRIMARY KEY,
	code           TEXT NOT NULL UNIQUE,
	name           TEXT NOT NULL,
	status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
	starts_at      INTEGER,
	ends_at        INTEGER,
	default_points INTEGER NOT NULL DEFAULT 150,
	approval_mode  TEXT NOT NULL DEFAULT 'manual' CHECK (approval_mode IN ('manual', 'auto')),
	created_at     INTEGER NOT NULL
);

CREATE TABLE teams (
	id         TEXT PRIMARY KEY,
	game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	name       TEXT NOT NULL,
	color      TEXT NOT NULL DEFAULT 'yellow',
	avatar     TEXT NOT NULL DEFAULT 'monkey',
	created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX teams_game_name ON teams(game_id, lower(name));

CREATE TABLE players (
	id           TEXT PRIMARY KEY,
	game_id      TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	name         TEXT NOT NULL,
	is_leader    INTEGER NOT NULL DEFAULT 0,
	created_at   INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL
);
CREATE INDEX players_team ON players(team_id);

CREATE TABLE clues (
	id         TEXT PRIMARY KEY,
	game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	sort_order INTEGER NOT NULL,
	title      TEXT NOT NULL,
	body       TEXT NOT NULL,
	animal     TEXT NOT NULL DEFAULT '',
	points     INTEGER NOT NULL DEFAULT 150,
	status     TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available')),
	release_at INTEGER,
	map_x      REAL,
	map_y      REAL
);
CREATE INDEX clues_game_order ON clues(game_id, sort_order);

CREATE TABLE submissions (
	id             TEXT PRIMARY KEY,
	game_id        TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	clue_id        TEXT NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
	player_id      TEXT REFERENCES players(id) ON DELETE SET NULL,
	r2_key         TEXT NOT NULL,
	status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
	points_awarded INTEGER NOT NULL DEFAULT 0,
	ai_verdict     TEXT,
	reviewed_by    TEXT,
	reviewed_at    INTEGER,
	created_at     INTEGER NOT NULL
);
CREATE INDEX submissions_game_status ON submissions(game_id, status, created_at);
-- A team may hold at most one non-rejected submission per clue.
CREATE UNIQUE INDEX submissions_active_team_clue ON submissions(team_id, clue_id) WHERE status <> 'rejected';

-- Append-only ledger. Team score == SUM(delta).
CREATE TABLE score_events (
	id         TEXT PRIMARY KEY,
	game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	delta      INTEGER NOT NULL,
	reason     TEXT NOT NULL DEFAULT '',
	source     TEXT NOT NULL CHECK (source IN ('submission', 'adjust', 'bonus', 'hint')),
	ref_id     TEXT,
	created_by TEXT NOT NULL DEFAULT 'host',
	created_at INTEGER NOT NULL
);
CREATE INDEX score_events_team ON score_events(team_id);
CREATE INDEX score_events_game_time ON score_events(game_id, created_at);

CREATE TABLE bonus_challenges (
	id          TEXT PRIMARY KEY,
	game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	title       TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	points      INTEGER NOT NULL DEFAULT 250,
	status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
	r2_key      TEXT,
	created_at  INTEGER NOT NULL
);

CREATE TABLE activity (
	id         TEXT PRIMARY KEY,
	game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	type       TEXT NOT NULL,
	message    TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX activity_game_time ON activity(game_id, created_at);
