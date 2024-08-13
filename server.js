const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const { loadGame, saveGame, updateLeaderboard, getLeaderboard } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

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

app.post('/send-message', async (req, res) => {
  const { message } = req.body;
  const chatId = req.body.chatId || process.env.ADMIN_CHAT_ID;

  try {
    const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: message
    });
    console.log('Message sent:', response.data);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, message: 'Error sending message', error: error.response ? error.response.data : error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/api/game/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const gameData = await loadGame(userId);
    res.json(gameData);
  } catch (error) {
    console.error('Error loading game:', error);
    res.status(500).json({ error: 'Error loading game data' });
  }
});

app.post('/api/game/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const gameData = req.body;
    await saveGame(userId, gameData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({ error: 'Error saving game data' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Environment variables:');
  console.log('RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
  console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set');
  console.log('ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? 'Set' : 'Not set');
});