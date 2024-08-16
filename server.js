const express = require('express');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

console.log('Attempting to connect to database with URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const WEBHOOK_URL = `${process.env.RAILWAY_STATIC_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

app.get('/set-webhook', async (req, res) => {
  try {
    console.log('Attempting to set webhook to:', WEBHOOK_URL);
    const response = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
    console.log('Webhook set response:', response.data);
    res.json({
      success: true,
      message: 'Webhook set successfully',
      data: response.data
    });
  } catch (error) {
    console.error('Error setting webhook:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Error setting webhook',
      error: error.response ? error.response.data : error.message
    });
  }
});

app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);
    
    if (message && message.text === '/start') {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: message.chat.id,
        text: 'Добро пожаловать в CryptoVerse Miner!'
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/game/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const userData = result.rows[0];
      const now = Date.now();
      const offlineTime = now - userData.last_login_time;
      const maxOfflineTime = 4 * 60 * 60 * 1000;
      const effectiveOfflineTime = Math.min(offlineTime, maxOfflineTime);
      
      userData.current_mining += (userData.mining_rate * effectiveOfflineTime) / 1000;
      userData.last_login_time = now;

      await pool.query('UPDATE users SET current_mining = $1, last_login_time = $2 WHERE id = $3', 
        [userData.current_mining, userData.last_login_time, userId]);

      res.json(userData);
    } else {
      const newUser = {
        id: userId,
        username: req.query.username,
        current_mining: 0,
        balance: 0,
        last_claim_time: Date.now(),
        last_login_time: Date.now(),
        mining_rate: 0.001,
        subscribed_channels: [],
        daily_bonus_day: 0,
        last_daily_bonus_time: 0,
        referrals: []
      };
      await pool.query(`
        INSERT INTO users (id, username, current_mining, balance, last_claim_time, last_login_time, mining_rate, subscribed_channels, daily_bonus_day, last_daily_bonus_time, referrals)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [newUser.id, newUser.username, newUser.current_mining, newUser.balance, newUser.last_claim_time, newUser.last_login_time, newUser.mining_rate, JSON.stringify(newUser.subscribed_channels), newUser.daily_bonus_day, newUser.last_daily_bonus_time, JSON.stringify(newUser.referrals)]);
      res.json(newUser);
    }
  } catch (error) {
    console.error('Error loading game:', error);
    res.status(500).json({ error: 'Error loading game data' });
  }
});

app.post('/api/game/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const gameData = req.body;
    await pool.query(`
      UPDATE users SET
      current_mining = $1, balance = $2, last_claim_time = $3, last_login_time = $4,
      mining_rate = $5, subscribed_channels = $6, daily_bonus_day = $7,
      last_daily_bonus_time = $8, referrals = $9 WHERE id = $10
    `, [gameData.current_mining, gameData.balance, gameData.last_claim_time, gameData.last_login_time,
        gameData.mining_rate, JSON.stringify(gameData.subscribed_channels), gameData.daily_bonus_day,
        gameData.last_daily_bonus_time, JSON.stringify(gameData.referrals), userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({ error: 'Error saving game data' });
  }
});

app.get('/api/game-state/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const userData = result.rows[0];
      const now = Date.now();
      const offlineTime = now - userData.last_login_time;
      const maxOfflineTime = 4 * 60 * 60 * 1000;
      const effectiveOfflineTime = Math.min(offlineTime, maxOfflineTime);
      
      userData.current_mining += (userData.mining_rate * effectiveOfflineTime) / 1000;
      userData.last_login_time = now;

      await pool.query('UPDATE users SET current_mining = $1, last_login_time = $2 WHERE id = $3', 
        [userData.current_mining, userData.last_login_time, userId]);

      res.json(userData);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: 'Error fetching game state' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    console.log('Fetching leaderboard data');
    const result = await pool.query('SELECT id, username, balance FROM users ORDER BY balance DESC LIMIT 10');
    console.log('Leaderboard data:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Error fetching leaderboard', details: error.message });
  }
});

app.get('/api/player-rank/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE balance > (SELECT balance FROM users WHERE id = $1)
    `, [userId]);
    res.json({ rank: result.rows[0].rank });
  } catch (error) {
    console.error('Error fetching player rank:', error);
    res.status(500).json({ error: 'Error fetching player rank' });
  }
});

app.post('/api/claim/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { amount } = req.body;
    await pool.query('UPDATE users SET balance = balance + $1, current_mining = 0, last_claim_time = $2 WHERE id = $3', [amount, Date.now(), userId]);
    res.json({ success: true, amount });
  } catch (error) {
    console.error('Error claiming mining:', error);
    res.status(500).json({ error: 'Error claiming mining' });
  }
});

app.post('/api/daily-bonus/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      if (!user.last_daily_bonus_time || now - user.last_daily_bonus_time >= oneDayInMs) {
        const newDailyBonusDay = (user.daily_bonus_day % 10) + 1;
        const bonusAmount = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55][newDailyBonusDay - 1];
        await pool.query('UPDATE users SET balance = balance + $1, daily_bonus_day = $2, last_daily_bonus_time = $3 WHERE id = $4', [bonusAmount, newDailyBonusDay, now, userId]);
        res.json({ success: true, bonusAmount, newDailyBonusDay });
      } else {
        const timeLeft = oneDayInMs - (now - user.last_daily_bonus_time);
        res.status(400).json({ error: 'Daily bonus already claimed', timeLeft });
      }
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
    res.status(500).json({ error: 'Error claiming daily bonus' });
  }
});

app.post('/api/referral/:userId/:referralCode', async (req, res) => {
  try {
    const userId = req.params.userId;
    const referralCode = req.params.referralCode;
    const referrerResult = await pool.query('SELECT * FROM users WHERE id = $1', [referralCode]);
    if (referrerResult.rows.length > 0) {
      const referrer = referrerResult.rows[0];
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        if (!referrer.referrals.some(r => r.id === userId)) {
          referrer.referrals.push({ id: userId, username: user.username, minedAmount: 0 });
          await pool.query('UPDATE users SET referrals = $1 WHERE id = $2', [JSON.stringify(referrer.referrals), referralCode]);
          res.json({ success: true });
        } else {
          res.status(400).json({ error: 'User already referred' });
        }
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      res.status(404).json({ error: 'Referrer not found' });
    }
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({ error: 'Error processing referral' });
  }
});

app.post('/api/subscribe/:userId/:channelIndex', async (req, res) => {
  try {
    const userId = req.params.userId;
    const channelIndex = parseInt(req.params.channelIndex);
    const result = await pool.query('SELECT subscribed_channels FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const subscribedChannels = result.rows[0].subscribed_channels || [];
      if (!subscribedChannels.includes(channelIndex)) {
        subscribedChannels.push(channelIndex);
        await pool.query('UPDATE users SET subscribed_channels = $1 WHERE id = $2', [JSON.stringify(subscribedChannels), userId]);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Already subscribed to this channel' });
      }
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error subscribing to channel:', error);
    res.status(500).json({ error: 'Error subscribing to channel' });
  }
});

app.post('/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: process.env.ADMIN_CHAT_ID,
      text: message
    });
    res.json({ success: true, message: 'Message sent to bot' });
  } catch (error) {
    console.error('Error sending message to bot:', error);
    res.status(500).json({ error: 'Error sending message to bot' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Environment variables:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
  console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});