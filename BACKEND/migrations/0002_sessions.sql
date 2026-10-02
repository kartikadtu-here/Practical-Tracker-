CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token_hash
ON sessions(token_hash);

CREATE INDEX idx_sessions_teacher
ON sessions(teacher_id);

CREATE INDEX idx_sessions_expires
ON sessions(expires_at);
