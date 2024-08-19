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

// Функция для проверки, является ли устройство мобильным
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Функция для отображения QR-кода
function showQRCode() {
    const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/paradox_token_bot";
    document.body.innerHTML = `
        <div id="qrCodeContainer">
            <h2>$PARADOX Miner</h2>
            <p>Это приложение доступно только на мобильных устройствах. Отсканируйте QR-код, чтобы открыть бота на вашем телефоне:</p>
            <img src="${qrCodeUrl}" alt="QR Code" id="qrcode">
        </div>
    `;
}

// Функция обновления прогресса загрузки
function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('progress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

// Функция отображения экрана загрузки
function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// Функция скрытия экрана загрузки
function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

// Функция инициализации игры
async function initGame() {
    try {
        showLoadingScreen();
        updateLoadingProgress(10);
        console.log('Loading game data...');
        await loadGame();
        updateLoadingProgress(40);
        console.log('Updating leaderboard...');
        await updateLeaderboard();
        updateLoadingProgress(70);
        console.log('Initializing UI...');
        initUI();
        updateLoadingProgress(90);
        console.log('Checking referral...');
        checkReferral();
        updateLoadingProgress(100);
        console.log('Game initialization complete.');
        setTimeout(hideLoadingScreen, 500);
        initParticles();
    } catch (error) {
        console.error('Error during game initialization:', error);
        showNotification('Произошла ошибка при загрузке игры. Пожалуйста, обновите страницу.');
        hideLoadingScreen();
    }
}

// Функция инициализации пользовательского интерфейса
function initUI() {
    showMainTab();
    updateUI();
    initTabButtons();
}

// Функция инициализации кнопок вкладок
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

// Функция форматирования чисел
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

// Функция загрузки игры
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
        showNotification('Произошла ошибка при загрузке игры. Пожалуйста, попробуйте еще раз.');
    }
}

// Функция сохранения игры в локальное хранилище
function saveGameToLocalStorage() {
    localStorage.setItem('gameState', JSON.stringify(game));
}

// Функция сохранения игры на сервере
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
        showNotification('Не удалось сохранить прогресс. Автоматическая попытка через 5 секунд...');
        setTimeout(() => saveGame(), 5000);
    }
}

// Функция обновления состояния игры
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

// Функция обновления таблицы лидеров
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

// Функция обновления майнинга
function updateMining() {
    const now = Date.now();
    const timePassed = now - game.lastClaimTime;
    
    game.currentMining += (game.miningRate * timePassed) / 1000;
    game.totalMined += (game.miningRate * timePassed) / 1000;
    game.lastClaimTime = now;
    
    console.log('Mining updated:', game.currentMining);
    updateUI();
}

// Функция обновления пользовательского интерфейса
function updateUI() {
    const miningRateElement = document.getElementById('miningRateValue');
    if (miningRateElement) {
        miningRateElement.textContent = game.miningRate.toFixed(3);
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

// Функция отображения главной вкладки
function showMainTab() {
    const content = `
        <div id="miningContainer">
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
        <button id="claimButton">Collect</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    document.getElementById('claimButton').addEventListener('click', claim);
}

// Функция отображения вкладки бустеров
function showBoostersTab() {
    const content = `
        <h2>Boosters</h2>
        <div class="boosters-grid">
            ${Array.from({ length: 10 }, (_, i) => `
                <button id="subscribeButton${i + 1}" class="booster-button">Booster ${i + 1}</button>
            `).join('')}
        </div>
    `;
    document.getElementById('mainContent').innerHTML = content;
    
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`subscribeButton${i}`).addEventListener('click', () => showSubscribeModal(`https://t.me/channel${i}`, i - 1));
    }
}

// Функция отображения вкладки таблицы лидеров
async function showLeaderboardTab() {
    try {
        const response = await fetch('/api/leaderboard');
        if (response.ok) {
            const leaderboardData = await response.json();
            console.log('Leaderboard data received:', leaderboardData);
            updateLeaderboardUI(leaderboardData);
        } else {
            const errorData = await response.json();
            console.error('Failed to fetch leaderboard data:', errorData);
            throw new Error(errorData.error || 'Failed to fetch leaderboard data');
        }
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        document.getElementById('mainContent').innerHTML = `<p>Error loading leaderboard: ${error.message}</p>`;
    }
}

// Функция обновления UI таблицы лидеров
async function updateLeaderboardUI(leaderboardData) {
    let content = `
        <h2>Top Players</h2>
        <div id="leaderboard">
            <table>
                <tr><th>Rank</th><th>Username</th><th>Score</th></tr>
    `;

    leaderboardData.forEach((player, index) => {
        content += `
            <tr>
                <td>${index + 1}</td>
                <td><img src="icon_button/telegram-icon.png" alt="Telegram" class="telegram-icon">${player.username || 'Anonymous'}</td>
                <td>${formatNumber(player.balance)}</td>
            </tr>
        `;
    });

    content += `
            </table>
        </div>
    `;

    try {
        const rankResponse = await fetch(`/api/player-rank/${tg.initDataUnsafe.user.id}`);
        if (rankResponse.ok) {
            const rankData = await rankResponse.json();
            const displayRank = rankData.rank > 100 ? '100+' : rankData.rank;
            content += `<p>Your rank: ${displayRank}</p>`;
        } else {
            throw new Error('Failed to fetch player rank');
        }
    } catch (error) {
        console.error('Error fetching player rank:', error);
        content += `<p>Your rank: N/A</p>`;
    }

    document.getElementById('mainContent').innerHTML = content;
}

// Функция отображения вкладки ежедневных заданий
function showDailyTab() {
    const content = `
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
    `;

    document.getElementById('mainContent').innerHTML = content;
    attachDailyTasksEventListeners();
    updateReferralsList();
}

// Функция прикрепления обработчиков событий к ежедневным заданиям
function attachDailyTasksEventListeners() {
    document.getElementById('dailyBonusButton').addEventListener('click', showDailyBonusModal);
    document.getElementById('inviteFriendButton').addEventListener('click', inviteFriend);
    document.getElementById('submitVideoButton').addEventListener('click', submitVideo);
}

// Функция обновления списка рефералов
function updateReferralsList() {
    const referralsListItems = document.getElementById('referralsListItems');
    if (referralsListItems) {
        referralsListItems.innerHTML = '';
        game.referrals.forEach(referral => {
            const li = document.createElement('li');
            li.textContent = `${referral.username} - ${formatNumber(referral.minedAmount)} coins`;
            referralsListItems.appendChild(li);
        });
    }
}

// Функция загрузки содержимого вкладки
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

// Функция сбора криптовалюты
async function claim() {
    if (game.currentMining < 0.1) {
        showNotification("Not enough crypto to collect. Minimum 0.1");
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
            showNotification("Crypto successfully collected!");
            sendMessageToBot(`User ${tg.initDataUnsafe.user.username} collected ${formatNumber(data.amount)} coins!`);
            await updateLeaderboard();
            await saveGame();
            tg.HapticFeedback.impactOccurred('medium');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to claim mining');
        }
    } catch (error) {
        console.error('Error claiming mining:', error);
        showNotification("An error occurred while collecting crypto. Please try again.");
    }
}

// Функция отображения эффекта сбора
function showClaimEffect() {
    gsap.fromTo("#miningContainer", 
        { scale: 1, opacity: 1 },
        { scale: 1.1, opacity: 0.8, duration: 0.3, yoyo: true, repeat: 1 }
    );
}

// Функция отображения уведомления
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Функция отображения модального окна подписки
async function showSubscribeModal(channelLink, channelIndex) {
    const modalContent = `
        <div class="subscribe-modal">
            <h3>Channel Subscription</h3>
            <p>To get a booster, subscribe to the channel:</p>
            <a href="${channelLink}" target="_blank" class="subscribe-link" id="subscribeLink">Go to Channel</a>
            <button id="checkSubscriptionButton" class="check-subscription" disabled>Check Subscription</button>
        </div>
    `;
    showModal(modalContent);
    document.getElementById('subscribeLink').addEventListener('click', () => {
        document.getElementById('checkSubscriptionButton').disabled = false;
    });
    document.getElementById('checkSubscriptionButton').addEventListener('click', () => checkSubscription(channelIndex));
}

// Функция проверки подписки
async function checkSubscription(channelIndex) {
    try {
        const response = await fetch(`/api/subscribe/${tg.initDataUnsafe.user.id}/${channelIndex}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            if (!game.subscribedChannels.includes(channelIndex)) {
                game.subscribedChannels.push(channelIndex);
                game.miningRate += 0.003;
                showNotification("Booster activated! +0.003 to mining speed");
                updateUI();
                await saveGame();
            } else {
                showNotification("You have already activated this booster.");
            }
        } else {
            throw new Error('Failed to check subscription');
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        showNotification("An error occurred while checking the subscription. Please try again later.");
    }
    hideModal();
}

// Функция получения ежедневного бонуса
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
            
            showNotification(`You received a daily bonus: ${data.bonusAmount} coins!`);
            updateUI();
            await saveGame();
        } else {
            showNotification(data.error || "Failed to get daily bonus. Please try again later.");
        }
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        showNotification("An error occurred while claiming the daily bonus. Please try again later.");
    } finally {
        hideModal();
    }
}

// Функция приглашения друга
function inviteFriend() {
    console.log('inviteFriend function called');
    console.log('tg object:', tg);
    console.log('User:', tg.initDataUnsafe.user);
    
    const referralLink = `https://t.me/paradox_token_bot?start=ref_${tg.initDataUnsafe.user.id}`;
    const shareText = encodeURIComponent(`Join CryptoVerse Miner! Start mining now!`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
    
    window.open(shareUrl, '_blank');
}

// Функция проверки реферала
function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('start');
    if (referralCode && referralCode.startsWith('ref_')) {
        handleReferral(referralCode.slice(4));
    }
}

// Функция обработки реферала
async function handleReferral(referrerId) {
    try {
        const response = await fetch(`/api/referral/${tg.initDataUnsafe.user.id}/${referrerId}`, {
            method: 'POST'
        });
        if (response.ok) {
            showNotification('You have successfully joined using a referral link!');
        } else {
            const data = await response.json();
            console.error('Failed to process referral:', data.error);
        }
    } catch (error) {
        console.error('Error processing referral:', error);
    }
}

// Функция отправки видео
async function submitVideo() {
    const content = `
        <h3>Submit Video</h3>
        <input type="text" id="videoLink" placeholder="Paste video link here">
        <button id="submitVideoLinkButton" class="daily-button">Submit</button>
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
                    showNotification(`Video accepted! You received ${data.reward} coins.`);
                    updateUI();
                    await saveGame();
                    await updateLeaderboard();
                    hideModal();
                } else {
                    const errorData = await response.json();
                    showNotification(errorData.error || "An error occurred while submitting the video.");
                }
            } catch (error) {
                console.error('Error submitting video:', error);
                showNotification("An error occurred while submitting the video. Please try again later.");
            }
        } else {
            showNotification("Please enter a video link.");
        }
    });
}

// Функция отображения модального окна
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

// Функция скрытия модального окна
function hideModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

let lastClickTime = 0;
const clickCooldown = 100; // 100 мс между кликами

// Функция обработки ручного майнинга
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

// Функция отображения эффекта ручного майнинга
function showManualMiningEffect(event) {
    const effect = document.createElement('div');
    effect.className = 'manual-mining-effect';
    effect.textContent = '+0.001';
    effect.style.position = 'absolute';
    effect.style.left = `${event.clientX}px`;
    effect.style.top = `${event.clientY}px`;
    document.body.appendChild(effect);

    effect.addEventListener('animationend', () => {
        document.body.removeChild(effect);
    });
}

// Функция отображения модального окна ежедневного бонуса
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
            <p>Get $SWITCH for daily login,<br>don't miss a day</p>
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

// Функция отправки сообщения боту
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

// Функция инициализации частиц
function initParticles() {
    particlesJS("particles-js", {
        particles: {
            number: { value: 150, density: { enable: true, value_area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 } },
            opacity: { value: 0.5, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
            size: { value: 3, random: true, anim: { enable: true, speed: 3, size_min: 0.1, sync: false } },
            line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 1 },
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

// Обработчик события загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    if (isMobileDevice()) {
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
    } else {
        showQRCode();
    }
});

// Функция обновления состояния игры
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

// Интервал обновления
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

// Функция синхронизации с сервером
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
        showNotification('Failed to synchronize progress. Automatic attempt in 5 seconds...');
        setTimeout(syncWithServer, 5000);
    }
}

// Вызов функции синхронизации каждые 5 минут
setInterval(syncWithServer, 5 * 60 * 1000);

// Функция отладки майнинга
function debugMining() {
    console.log('Current mining:', game.currentMining);
    console.log('Total mined:', game.totalMined);
    console.log('Mining rate:', game.miningRate);
    console.log('Last claim time:', new Date(game.lastClaimTime));
    console.log('Current time:', new Date());
}

// Вызов функции отладки каждые 10 секунд
setInterval(debugMining, 10000);

// Обработчик события перед выгрузкой страницы
window.addEventListener('beforeunload', () => {
    saveGame();
});

console.log('Telegram Web App data:', tg.initDataUnsafe);

// Расширение Telegram Web App
tg.expand();

// Инициализация Telegram Web App
tg.ready();