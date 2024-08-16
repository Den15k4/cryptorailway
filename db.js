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
    const now = Date.now();
    const offlineTime = now - user.last_login_time;
    const maxOfflineTime = 4 * 60 * 60 * 1000;
    const effectiveOfflineTime = Math.min(offlineTime, maxOfflineTime);
    
    user.current_mining = user.total_mined + (user.mining_rate * effectiveOfflineTime) / 1000;
    user.last_login_time = now;

    await query('UPDATE users SET current_mining = $1, last_login_time = $2 WHERE id = $3', 
      [user.current_mining, user.last_login_time, userId]);

    return {
      ...user,
      subscribedChannels: JSON.parse(user.subscribed_channels),
      referrals: JSON.parse(user.referrals)
    };
  } else {
    const newUser = {
      id: userId,
      current_mining: 0,
      total_mined: 0,
      balance: 0,
      last_claim_time: Date.now(),
      last_login_time: Date.now(),
      mining_rate: 0.001,
      subscribed_channels: [],
      daily_bonus_day: 0,
      last_daily_bonus_time: 0,
      referrals: [],
      last_video_submission: 0
    };
    await query('INSERT INTO users (id, current_mining, total_mined, balance, last_claim_time, last_login_time, mining_rate, subscribed_channels, daily_bonus_day, last_daily_bonus_time, referrals, last_video_submission) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', 
      [newUser.id, newUser.current_mining, newUser.total_mined, newUser.balance, newUser.last_claim_time, newUser.last_login_time, newUser.mining_rate, JSON.stringify(newUser.subscribed_channels), newUser.daily_bonus_day, newUser.last_daily_bonus_time, JSON.stringify(newUser.referrals), newUser.last_video_submission]);
    return newUser;
  }
}

async function saveGame(userId, gameData) {
  await query('UPDATE users SET current_mining = $1, total_mined = $1, balance = $2, last_claim_time = $3, last_login_time = $4, mining_rate = $5, subscribed_channels = $6, daily_bonus_day = $7, last_daily_bonus_time = $8, referrals = $9, last_video_submission = $10 WHERE id = $11',
    [gameData.current_mining, gameData.balance, gameData.last_claim_time, gameData.last_login_time, gameData.mining_rate, JSON.stringify(gameData.subscribed_channels), gameData.daily_bonus_day, gameData.last_daily_bonus_time, JSON.stringify(gameData.referrals), gameData.last_video_submission, userId]);
}

async function updateLeaderboard(userId, username, balance) {
  await query('INSERT INTO leaderboard (user_id, username, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET username = $2, balance = $3',
    [userId, username, balance]);
}

async function getLeaderboard() {
  const result = await query('SELECT * FROM leaderboard ORDER BY balance DESC LIMIT 10');
  return result.rows;
}

async function getPlayerRank(userId) {
  const result = await query(`
    SELECT COUNT(*) + 1 as rank
    FROM users
    WHERE balance > (SELECT balance FROM users WHERE id = $1)
  `, [userId]);
  return result.rows[0].rank;
}

async function addReferral(referrerId, referredId, referredUsername) {
  const referrerResult = await query('SELECT referrals FROM users WHERE id = $1', [referrerId]);
  if (referrerResult.rows.length > 0) {
    const referrals = JSON.parse(referrerResult.rows[0].referrals);
    if (!referrals.some(r => r.id === referredId)) {
      referrals.push({ id: referredId, username: referredUsername, minedAmount: 0 });
      await query('UPDATE users SET referrals = $1 WHERE id = $2', [JSON.stringify(referrals), referrerId]);
      return true;
    }
  }
  return false;
}

module.exports = { 
  loadGame, 
  saveGame, 
  updateLeaderboard, 
  getLeaderboard, 
  getPlayerRank,
  addReferral,
  query
};