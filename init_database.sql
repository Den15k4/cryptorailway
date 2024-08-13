-- Создание таблицы users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    current_mining FLOAT DEFAULT 0,
    balance FLOAT DEFAULT 0,
    last_claim_time BIGINT,
    last_login_time BIGINT,
    mining_rate FLOAT DEFAULT 0.001,
    subscribed_channels JSONB DEFAULT '[]',
    daily_bonus_day INTEGER DEFAULT 0,
    last_daily_bonus_time BIGINT,
    referrals JSONB DEFAULT '[]'
);

-- Создание таблицы leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    balance FLOAT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Создание индекса для ускорения запросов к таблице leaderboard
CREATE INDEX IF NOT EXISTS leaderboard_balance_idx ON leaderboard (balance DESC);