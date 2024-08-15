const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function loadGame(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (result.rows.length > 0) {
    const user = result.rows[0];
    return {
      ...user,
      subscribedChannels: JSON.parse(user.subscribed_channels),
      referrals: JSON.parse(user.referrals)
    };
  } else {
    const newUser = {
      id: userId,
      currentMining: 0,
      balance: 0,
      lastClaimTime: Date.now(),
      lastLoginTime: Date.now(),
      miningRate: 0.001,
      subscribedChannels: [],
      dailyBonusDay: 0,
      lastDailyBonusTime: 0,
      referrals: []
    };
    await query('INSERT INTO users (id, current_mining, balance, last_claim_time, last_login_time, mining_rate, subscribed_channels, daily_bonus_day, last_daily_bonus_time, referrals) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', 
      [newUser.id, newUser.currentMining, newUser.balance, newUser.lastClaimTime, newUser.lastLoginTime, newUser.miningRate, JSON.stringify(newUser.subscribedChannels), newUser.dailyBonusDay, newUser.lastDailyBonusTime, JSON.stringify(newUser.referrals)]);
    return newUser;
  }
}

async function saveGame(userId, gameData) {
  await query('UPDATE users SET current_mining = $1, balance = $2, last_claim_time = $3, last_login_time = $4, mining_rate = $5, subscribed_channels = $6, daily_bonus_day = $7, last_daily_bonus_time = $8, referrals = $9 WHERE id = $10',
    [gameData.currentMining, gameData.balance, gameData.lastClaimTime, gameData.lastLoginTime, gameData.miningRate, JSON.stringify(gameData.subscribedChannels), gameData.dailyBonusDay, gameData.lastDailyBonusTime, JSON.stringify(gameData.referrals), userId]);
}

async function updateLeaderboard(userId, username, balance) {
  await query('INSERT INTO leaderboard (user_id, username, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET username = $2, balance = $3',
    [userId, username, balance]);
}

async function getLeaderboard() {
  const result = await query('SELECT * FROM leaderboard ORDER BY balance DESC LIMIT 10');
  return result.rows;
}

async function getFullLeaderboard() {
  const result = await query('SELECT * FROM leaderboard ORDER BY balance DESC');
  return result.rows;
}

module.exports = { loadGame, saveGame, updateLeaderboard, getLeaderboard, getFullLeaderboard };