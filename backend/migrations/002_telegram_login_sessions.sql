CREATE TABLE IF NOT EXISTS telegram_login_sessions (
    token VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'expired')),
    user_id BIGINT REFERENCES users(tg_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telegram_login_sessions_user_id
    ON telegram_login_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_login_sessions_status_expires_at
    ON telegram_login_sessions (status, expires_at);
