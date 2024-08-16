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
      referrals: [],
      lastVideoSubmission: 0
    };
    await query('INSERT INTO users (id, current_mining, balance, last_claim_time, last_login_time, mining_rate, subscribed_channels, daily_bonus_day, last_daily_bonus_time, referrals, last_video_submission) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', 
      [newUser.id, newUser.currentMining, newUser.balance, newUser.lastClaimTime, newUser.lastLoginTime, newUser.miningRate, JSON.stringify(newUser.subscribedChannels), newUser.dailyBonusDay, newUser.lastDailyBonusTime, JSON.stringify(newUser.referrals), newUser.lastVideoSubmission]);
    return newUser;
  }
}

async function saveGame(userId, gameData) {
  await query('UPDATE users SET current_mining = $1, balance = $2, last_claim_time = $3, last_login_time = $4, mining_rate = $5, subscribed_channels = $6, daily_bonus_day = $7, last_daily_bonus_time = $8, referrals = $9, last_video_submission = $10 WHERE id = $11',
    [gameData.currentMining, gameData.balance, gameData.lastClaimTime, gameData.lastLoginTime, gameData.miningRate, JSON.stringify(gameData.subscribedChannels), gameData.dailyBonusDay, gameData.lastDailyBonusTime, JSON.stringify(gameData.referrals), gameData.lastVideoSubmission, userId]);
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
  query // Экспортируем query для использования в других модулях при необходимости
};