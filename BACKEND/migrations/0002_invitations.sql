CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,

    FOREIGN KEY (created_by)
        REFERENCES teachers(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_invitations_token
ON invitations(token_hash);

CREATE INDEX idx_invitations_email
ON invitations(email);
