let tg = window.Telegram.WebApp;

let game = {
    currentMining: 0,
    totalMined: 0,
    balance: 0,
    lastClaimTime: Date.now(),
    lastLoginTime: Date.now(),
    miningRate: 0.001,
    subscribedChannels: [],
    dailyBonusDay: 0,
    lastDailyBonusTime: 0,
    referrals: [],
    referralBonus: 5,
    lastVideoSubmission: 0
};

let saveGameTimeout;
let currentTab = 'main';
let referralCode = null;

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showQRCode() {
    const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/paradox_token_bot/paradox";
    document.body.innerHTML = `
        <div id="qrCodeContainer">
            <h2>$PARADOX Miner</h2>
            <p>This app is only available on mobile devices. Scan the QR code to open the bot on your phone:</p>
            <img src="${qrCodeUrl}" alt="QR Code" id="qrcode">
        </div>
    `;
}

if (!isMobileDevice()) {
    showQRCode();
} else {
    // Initialize your app here
    initGame();
}

function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('progress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

async function initGame() {
    try {
        showLoadingScreen();
        updateLoadingProgress(10);
        console.log('Loading game data...');
        await loadGame();
        updateLoadingProgress(40);
        
        // Проверяем и обрабатываем реферальный код здесь
        if (referralCode) {
            console.log('Обработка реферального кода:', referralCode);
            await handleReferral(referralCode);
        }
        
        console.log('Updating leaderboard...');
        await updateLeaderboard();
        updateLoadingProgress(70);
        console.log('Initializing UI...');
        initUI();
        updateLoadingProgress(90);
        updateLoadingProgress(100);
        console.log('Game initialization complete.');
        setTimeout(hideLoadingScreen, 500);
        initParticles();
    } catch (error) {
        console.error('Error during game initialization:', error);
        showNotification('Error. Please Refresh app');
        hideLoadingScreen();
    }
}

function initUI() {
    updateMiningRateDisplay();
    showMainTab();
    initTabButtons();
}

function updateMiningRateDisplay() {
    document.getElementById('miningRateValue').textContent = game.miningRate.toFixed(3);
}

function initTabButtons() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tab = button.getAttribute('data-tab');
            loadTabContent(tab);
        });
    });
}

function enableScrolling() {
    const mainContent = document.getElementById('mainContent');
    mainContent.style.overflowY = 'auto';
    mainContent.style.maxHeight = 'calc(100vh - 60px)'; // Высота экрана минус высота нижней панели
}

function formatNumber(num) {
    if (num === null || isNaN(num)) {
        return '0.000';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(3);
}

async function loadGame() {
    try {
        const savedGame = localStorage.getItem('gameState');
        if (savedGame) {
            const parsedGame = JSON.parse(savedGame);
            const now = Date.now();
            const offlineTime = now - parsedGame.lastLoginTime;
            const maxOfflineTime = 4 * 60 * 60 * 1000; // 4 часа
            const effectiveOfflineTime = Math.min(offlineTime, maxOfflineTime);
            
            parsedGame.currentMining += (parsedGame.miningRate * effectiveOfflineTime) / 1000;
            parsedGame.lastLoginTime = now;
            parsedGame.lastClaimTime = now;
            
            Object.assign(game, parsedGame);
        }
        
        console.log('Loading game data for user:', tg.initDataUnsafe.user.id);
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}?username=${encodeURIComponent(tg.initDataUnsafe.user.username)}`);
        console.log('Response status:', response.status);
        if (response.ok) {
            const userData = await response.json();
            console.log('Loaded user data:', userData);
            Object.assign(game, userData, {
                currentMining: Math.max(game.currentMining, userData.current_mining),
                lastClaimTime: Date.now(),
                lastLoginTime: Date.now()
            });
            
            console.log('Current mining after loading:', game.currentMining);
            saveGameToLocalStorage();
            updateUI();
        } else {
            console.error('Failed to load game data. Status:', response.status);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            throw new Error('Failed to load game data');
        }
    } catch (error) {
        console.error('Error loading game:', error);
        showNotification('Error. Please try again.');
    }
}

function saveGameToLocalStorage() {
    localStorage.setItem('gameState', JSON.stringify(game));
}

async function saveGame() {
    try {
        const gameData = {
            current_mining: game.currentMining,
            total_mined: game.totalMined,
            balance: game.balance,
            last_claim_time: game.lastClaimTime,
            last_login_time: game.lastLoginTime,
            mining_rate: game.miningRate,
            subscribed_channels: game.subscribedChannels,
            daily_bonus_day: game.dailyBonusDay,
            last_daily_bonus_time: game.lastDailyBonusTime,
            username: tg.initDataUnsafe.user.username,
            last_video_submission: game.lastVideoSubmission
        };
        
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(gameData),
        });
        if (!response.ok) {
            throw new Error('Failed to save game data');
        }
        console.log('Game saved successfully');
        saveGameToLocalStorage();
    } catch (error) {
        console.error('Error saving game:', error);
        showNotification('Loading...');
        setTimeout(() => saveGame(), 5000);
    }
}

async function fetchGameState() {
    try {
        const response = await fetch(`/api/game-state/${tg.initDataUnsafe.user.id}`);
        if (response.ok) {
            const data = await response.json();
            Object.assign(game, data);
            updateUI();
            saveGameToLocalStorage();
        } else {
            throw new Error('Failed to fetch game state');
        }
    } catch (error) {
        console.error('Error fetching game state:', error);
    }
}

async function updateLeaderboard() {
    if (currentTab === 'leaderboard') {
        try {
            const response = await fetch('/api/leaderboard');
            if (response.ok) {
                const leaderboardData = await response.json();
                updateLeaderboardUI(leaderboardData);
            } else {
                console.error('Failed to fetch leaderboard data');
            }
        } catch (error) {
            console.error('Error updating leaderboard:', error);
        }
    }
}

function updateMining() {
    const now = Date.now();
    const timePassed = now - game.lastClaimTime;
    
    game.currentMining += (game.miningRate * timePassed) / 1000;
    game.totalMined += (game.miningRate * timePassed) / 1000;
    game.lastClaimTime = now;
    
    console.log('Mining updated:', game.currentMining);
    updateUI();
}

function updateUI() {
    const miningRateValueElement = document.getElementById('miningRateValue');
    if (miningRateValueElement) {
        miningRateValueElement.textContent = game.miningRate.toFixed(3);
    }

    const currentMiningElement = document.getElementById('currentMining');
    if (currentMiningElement) {
        currentMiningElement.textContent = formatNumber(game.currentMining);
    }

    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement) {
        balanceElement.textContent = formatNumber(game.balance);
    }
}

function showMainTab() {
    const content = `
      <div id="miningContainer" style="margin-top: 20px;">
        <div id="miningStats">
          <div class="stat">
            <p>Mined</p>
            <h2 id="currentMining">${formatNumber(game.currentMining)}</h2>
          </div>
          <div class="stat">
            <p>Balance</p>
            <h2 id="balanceAmount">${formatNumber(game.balance)}</h2>
          </div>
        </div>
      </div>
      <button id="claimButton">CLAIM</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    document.getElementById('claimButton').addEventListener('click', claim);
}

function showBoostersTab() {
    const channels = [
        { name: "Channel 1", link: "https://t.me/edulidcom" },
        { name: "Channel 2", link: "https://t.me/channel2" },
        { name: "Channel 3", link: "https://t.me/channel3" },
        // Добавляйте новые каналы здесь
    ];

    let content = `
      <h2>Boosters</h2>
      <div class="booster-container">
    `;
    
    channels.forEach((channel, index) => {
        content += `<button id="subscribeButton${index}" class="booster-button">Subscribe to ${channel.name}</button>`;
    });
    
    content += `</div>`;
    
    document.getElementById('mainContent').innerHTML = content;
    
    channels.forEach((channel, index) => {
        document.getElementById(`subscribeButton${index}`).addEventListener('click', () => showSubscribeModal(channel.link, index));
    });
}

async function showLeaderboardTab() {
    try {
      const response = await fetch('/api/leaderboard');
      if (response.ok) {
        const leaderboardData = await response.json();
        updateLeaderboardUI(leaderboardData);
      } else {
        throw new Error('Failed to fetch leaderboard data');
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      document.getElementById('mainContent').innerHTML = `<p>Error loading leaderboard: ${error.message}</p>`;
    }
}

function updateLeaderboardUI(leaderboardData) {
    let content = `
      <h2>Топ игроков</h2>
      <div id="leaderboard">
        <table>
          <tr><th>Место</th><th>Ник</th><th>Счет</th></tr>
    `;
  
    leaderboardData.forEach((player, index) => {
      content += `
        <tr>
          <td>${index + 1}</td>
          <td><img src="icon_button/telegram-icon.png" alt="Telegram" class="telegram-icon">${player.username || 'Аноним'}</td>
          <td>${formatNumber(player.balance)}</td>
        </tr>
      `;
    });
  
    content += `
        </table>
      </div>
      <p id="playerRank">Loading your rank...</p>
    `;
  
    document.getElementById('mainContent').innerHTML = content;
  
    // Добавляем запрос на получение ранга игрока
    fetch(`/api/player-rank/${tg.initDataUnsafe.user.id}`)
      .then(response => response.json())
      .then(data => {
        document.getElementById('playerRank').textContent = `Ваше место: ${data.rank > 100 ? '100+' : data.rank}`;
      })
      .catch(error => {
        console.error('Error fetching player rank:', error);
        document.getElementById('playerRank').textContent = 'Error loading your rank';
      });
}

function showDailyTab() {
    const content = `
    <div style="margin-top: 10px;">
      <h2>Daily Tasks</h2>
      <div class="daily-tasks">
        <div class="task">
          <h3>Daily Bonus</h3>
          <p>Get a bonus every day</p>
          <button id="dailyBonusButton" class="task-button">Claim Bonus</button>
        </div>
        <div class="task">
          <h3>Invite a Friend</h3>
          <p>Get a reward for each invited friend</p>
          <button id="inviteFriendButton" class="task-button">Invite</button>
        </div>
        <div class="task">
          <h3>Submit Video</h3>
          <p>Share a video and get a reward</p>
          <button id="submitVideoButton" class="task-button">Submit</button>
        </div>
      </div>
      <div id="referralsList">
        <h3>Invited Friends:</h3>
        <ul id="referralsListItems"></ul>
      </div>
      <div style="height: 100px;"></div>
    </div>
    `;
  
    document.getElementById('mainContent').innerHTML = content;
    attachDailyTasksEventListeners();
    updateReferralsList();
}

function attachDailyTasksEventListeners() {
    document.getElementById('dailyBonusButton').addEventListener('click', showDailyBonusModal);
    document.getElementById('inviteFriendButton').addEventListener('click', inviteFriend);
    document.getElementById('submitVideoButton').addEventListener('click', submitVideo);
}

function updateReferralsList() {
    const referralsListItems = document.getElementById('referralsListItems');
    if (referralsListItems) {
        referralsListItems.innerHTML = '';
        if (game.referrals.length === 0) {
            referralsListItems.innerHTML = '<li>You don\'t have referrals</li>';
        } else {
            game.referrals.forEach(referral => {
                const li = document.createElement('li');
                li.textContent = `${referral.username || 'Anonymous'} - ${formatNumber(referral.minedAmount)} tokens`;
                referralsListItems.appendChild(li);
            });
        }
    }
}

function loadTabContent(tab) {
    currentTab = tab;
    switch(tab) {
        case 'main':
            showMainTab();
            break;
        case 'boosters':
            showBoostersTab();
            break;
        case 'leaderboard':
            showLeaderboardTab();
            break;
        case 'daily':
            showDailyTab();
            break;
    }
}

async function claim() {
    if (game.currentMining < 0.1) {
        showNotification("Minimum 0.1 for claim");
        return;
    }
    try {
        const response = await fetch(`/api/claim/${tg.initDataUnsafe.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: game.currentMining }),
        });
        
        if (response.ok) {
            const data = await response.json();
            game.balance += game.currentMining;
            game.totalMined += game.currentMining;
            game.currentMining = 0;
            game.lastClaimTime = Date.now();
            
            updateUI();
            showClaimEffect();
            showNotification("Successful claim");
            sendMessageToBot(`Miner ${tg.initDataUnsafe.user.username} claimed ${formatNumber(data.amount)} tokens!`);
            await updateLeaderboard();
            await saveGame();
            tg.HapticFeedback.impactOccurred('medium');
        } else {
            throw new Error('Failed to claim mining');
        }
    } catch (error) {
        console.error('Error claiming mining:', error);
        showNotification("Error: try again!");
    }
}

function showClaimEffect() {
    gsap.fromTo("#miningContainer", 
        { scale: 1, opacity: 1 },
        { scale: 1.1, opacity: 0.8, duration: 0.3, yoyo: true, repeat: 1 }
    );
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

async function showSubscribeModal(channelLink, channelIndex) {
    const modalContent = `
        <div class="subscribe-modal">
            <h3>Подписка на канал</h3>
            <p>For update hashrate - you need subscribe for channel!</p>
            <a href="${channelLink}" target="_blank" class="subscribe-link" id="subscribeLink">Go to channel</a>
            <button id="checkSubscriptionButton" class="check-subscription" disabled>Check Subscribe</button>
        </div>
    `;
    showModal(modalContent);
    document.getElementById('subscribeLink').addEventListener('click', () => {
        document.getElementById('checkSubscriptionButton').disabled = false;
    });
    document.getElementById('checkSubscriptionButton').addEventListener('click', () => checkSubscription(channelIndex));
}

async function checkSubscription(channelIndex) {
    try {
        const response = await fetch(`/api/subscribe/${tg.initDataUnsafe.user.id}/${channelIndex}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            if (!game.subscribedChannels.includes(channelIndex)) {
                game.subscribedChannels.push(channelIndex);
                game.miningRate += 0.001;
                showNotification("Booster active - You have +0.001 for hashrate!");
                updateUI();
                await saveGame();
            } else {
                showNotification("You have already activated this boost");
            }
        } else {
            throw new Error('Failed to check subscription');
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        showNotification("Error checking subscription, try again later");
    }
    hideModal();
}

async function claimDailyBonus() {
    try {
        const response = await fetch(`/api/daily-bonus/${tg.initDataUnsafe.user.id}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (response.ok) {
            game.balance += data.bonusAmount;
            game.dailyBonusDay = data.newDailyBonusDay;
            game.lastDailyBonusTime = Date.now();
            
            localStorage.setItem('lastDailyBonusTime', Date.now().toString());
            
            showNotification(`You received a daily bonus: ${data.bonusAmount} tokens!`);
            updateUI();
            await saveGame();
        } else {
            showNotification(data.error || "Failed to receive daily bonus. Please try again later.");
        }
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        showNotification("Failed to receive daily bonus. Please try again later.");
    } finally {
        hideModal();
    }
}

function inviteFriend() {
    console.log('inviteFriend function called');
    console.log('tg object:', tg);
    console.log('User:', tg.initDataUnsafe.user);
    
    const referralLink = `https://t.me/paradox_token_bot/paradox?start=ref_${tg.initDataUnsafe.user.id}`;
    const shareText = encodeURIComponent(`Welcome to mining $PRDX!`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
    
    window.open(shareUrl, '_blank');
}

function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    if (startParam && startParam.startsWith('ref_')) {
        referralCode = startParam.slice(4);
        console.log('Найден реферальный код:', referralCode);
    }
}

async function handleReferral(referrerId) {
    try {
        // Проверяем, что referrerId не совпадает с ID текущего пользователя
        if (referrerId === tg.initDataUnsafe.user.id) {
            console.log('Пользователь пытается использовать собственную реферальную ссылку');
            return;
        }

        const response = await fetch(`/api/referral/${tg.initDataUnsafe.user.id}/${referrerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: tg.initDataUnsafe.user.username
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Обновляем данные текущего пользователя
                game.miningRate += 0.001; // Увеличиваем скорость майнинга
                showNotification('Вы успешно присоединились по реферальной ссылке! Ваша скорость майнинга увеличена.');
                updateUI();
                await saveGame();
            } else {
                console.log('Реферальный код уже использован или произошла ошибка');
            }
        } else {
            const errorData = await response.json();
            console.error('Не удалось обработать реферальную ссылку:', errorData.error);
        }
    } catch (error) {
        console.error('Ошибка при обработке реферальной ссылки:', error);
    }
}

async function submitVideo() {
    const content = `
        <h3>Отправить видео</h3>
        <input type="text" id="videoLink" placeholder="Insert video link">
        <button id="submitVideoLinkButton" class="daily-button">Send</button>
    `;
    showModal(content);
    document.getElementById('submitVideoLinkButton').addEventListener('click', async () => {
        const videoLink = document.getElementById('videoLink').value;
        if (videoLink) {
            try {
                const response = await fetch(`/api/submit-video/${tg.initDataUnsafe.user.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ videoLink }),
                });
                if (response.ok) {
                    const data = await response.json();
                    game.balance += data.reward;
                    game.lastVideoSubmission = Date.now();
                    showNotification(`Video accepted! You got ${data.reward} tokens`);
                    updateUI();
                    await saveGame();
                    await updateLeaderboard();
                    hideModal();
                } else {
                    const errorData = await response.json();
                    showNotification(errorData.error || "An error occurred while sending the video.");
                }
            } catch (error) {
                console.error('Error submitting video:', error);
                showNotification("An error occurred while sending the video. Try again later");
            }
        } else {
            showNotification("Please insert link to video");
        }
    });
}

function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            ${content}
            <button class="close-modal">×</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.close-modal').addEventListener('click', hideModal);
}

function hideModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

let lastClickTime = 0;
const clickCooldown = 100; // 100 мс между кликами

function handleManualMining(event) {
    const now = Date.now();
    if (now - lastClickTime >= clickCooldown) {
        lastClickTime = now;
        game.currentMining += 0.001;
        game.totalMined += 0.001;
        updateUI();
        showManualMiningEffect(event);
        saveGame();
    }
}

function showManualMiningEffect(event) {
    const effect = document.createElement('div');
    effect.className = 'manual-mining-effect';
    effect.textContent = '+0.001';
    effect.style.position = 'absolute';
    effect.style.left = `${event.clientX}px`;
    effect.style.top = `${event.clientY}px`;
    document.body.appendChild(effect);

    gsap.to(effect, {
        opacity: 0,
        y: -20,
        duration: 1,
        onComplete: () => effect.remove()
    });
}

function showDailyBonusModal() {
    const bonusAmounts = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    const currentDay = (game.dailyBonusDay % 10) + 1;

    let daysHtml = '';
    for (let i = 1; i <= 10; i++) {
        const isCurrentDay = i === currentDay;
        const isPastDay = i < currentDay;
        const dayClass = isCurrentDay ? 'current-day' : (isPastDay ? 'past-day' : '');
        const textColor = isPastDay ? 'color: black;' : '';
        daysHtml += `
            <div class="day-box ${dayClass}">
                <div class="day-number" style="${textColor}">Day ${i}</div>
                <div class="coin-icon"></div>
                <div class="bonus-amount" style="${textColor}">${bonusAmounts[i-1]}</div>
            </div>
        `;
    }

    const modalContent = `
        <div class="daily-bonus-container">
            <div class="bonus-icon">🎁</div>
            <h2>Daily Boost</h2>
            <p>Get $PRDX for daily login,<br>don't miss a day</p>
            <div class="days-grid">
                ${daysHtml}
            </div>
            <button id="claimDailyBonus" class="claim-button" ${currentDay > 10 ? 'disabled' : ''}>
                ${currentDay > 10 ? 'Come back tomorrow' : 'Claim Bonus'}
            </button>
        </div>
    `;

    showModal(modalContent);
    document.getElementById('claimDailyBonus').addEventListener('click', claimDailyBonus);
}

async function sendMessageToBot(message) {
    try {
        const response = await fetch('/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const result = await response.json();
        console.log(result.message);
    } catch (error) {
        console.error('Error sending message to bot:', error);
    }
}

function initParticles() {
    particlesJS("particles-js", {
        particles: {
            number: { value: 150, density: { enable: true, value_area: 800 } },
            color: { value: "#8774e1" },
            shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 } },
            opacity: { value: 0.8, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
            size: { value: 5, random: true, anim: { enable: true, speed: 3, size_min: 0.1, sync: false } },
            line_linked: { enable: true, distance: 150, color: "#8774e1", opacity: 0.6, width: 1.5 },
            move: { enable: true, speed: 6, direction: "none", random: true, straight: false, out_mode: "out", bounce: false, attract: { enable: false, rotateX: 600, rotateY: 1200 } }
        },
        interactivity: {
            detect_on: "canvas",
            events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" }, resize: true },
            modes: { grab: { distance: 400, line_linked: { opacity: 1 } }, bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 }, repulse: { distance: 200, duration: 0.4 }, push: { particles_nb: 4 }, remove: { particles_nb: 2 } }
        },
        retina_detect: true
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    checkReferral(); // Добавляем эту строку перед initGame
    initGame().catch(error => {
        console.error('Failed to initialize game:', error);
        showNotification('An error occurred while loading the game. Please refresh the page.');
    });
    document.body.addEventListener('click', (event) => {
        if (event.target.closest('#miningContainer')) {
            handleManualMining(event);
        }
    });
    
    initTabButtons();
});

function updateGameState() {
    updateMining();
    saveGameToLocalStorage();
    updateUI();
}

// Оптимизированное сохранение игры
let lastSaveTime = 0;
const saveInterval = 30000; // 30 секунд

function smartSaveGame() {
    const now = Date.now();
    if (now - lastSaveTime >= saveInterval) {
        saveGame();
        lastSaveTime = now;
    }
}

// Измените интервал обновления
setInterval(() => {
    updateGameState();
    smartSaveGame();
}, 1000);

// Оптимизированное обновление состояния игры
let lastUpdateTime = 0;
const updateInterval = 30000; // 30 секунд

async function smartFetchGameState() {
    const now = Date.now();
    if (now - lastUpdateTime >= updateInterval) {
        await fetchGameState();
        lastUpdateTime = now;
    }
}

setInterval(smartFetchGameState, 1000);

async function syncWithServer() {
    try {
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(game),
        });
        if (!response.ok) {
            throw new Error('Failed to sync game data');
        }
        console.log('Game synced successfully');
    } catch (error) {
        console.error('Error syncing game:', error);
        showNotification('Loading...');
        setTimeout(syncWithServer, 5000);
    }
}

// Вызывайте эту функцию периодически, например, каждые 5 минут
setInterval(syncWithServer, 5 * 60 * 1000);

function debugMining() {
    console.log('Current mining:', game.currentMining);
    console.log('Total mined:', game.totalMined);
    console.log('Mining rate:', game.miningRate);
    console.log('Last claim time:', new Date(game.lastClaimTime));
    console.log('Current time:', new Date());
}

// Вызовем функцию отладки каждые 10 секунд
setInterval(debugMining, 10000);

window.addEventListener('beforeunload', () => {
    saveGame();
});

console.log('Telegram Web App data:', tg.initDataUnsafe);

tg.expand();

// Инициализация Telegram Web App
tg.ready();