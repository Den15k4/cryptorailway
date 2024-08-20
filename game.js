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
    document.getElementById('app').style.display = 'flex';
}

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

function initUI() {
    loadTabContent('main');
    updateUI();
    initTabButtons();
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
        showNotification('Произошла ошибка при загрузке игры. Пожалуйста, попробуйте еще раз.');
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
        showNotification('Не удалось сохранить прогресс. Автоматическая попытка через 5 секунд...');
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

function loadTabContent(tab) {
    currentTab = tab;
    const scrollableContent = document.getElementById('scrollableContent');
    scrollableContent.innerHTML = '';

    switch(tab) {
        case 'main':
            scrollableContent.appendChild(createMainTabContent());
            break;
        case 'boosters':
            scrollableContent.appendChild(createBoostersTabContent());
            break;
        case 'leaderboard':
            createLeaderboardTabContent();
            break;
        case 'daily':
            scrollableContent.appendChild(createDailyTabContent());
            break;
    }
}

function createMainTabContent() {
    const content = document.createElement('div');
    content.innerHTML = `
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
    content.querySelector('#claimButton').addEventListener('click', claim);
    return content;
}

function createBoostersTabContent() {
    const content = document.createElement('div');
    content.innerHTML = `
        <h2>Boosters</h2>
        <button id="subscribeButton1" class="booster-button">Subscribe to Channel 1</button>
        <button id="subscribeButton2" class="booster-button">Subscribe to Channel 2</button>
        <button id="subscribeButton3" class="booster-button">Subscribe to Channel 3</button>
    `;
    
    content.querySelector('#subscribeButton1').addEventListener('click', () => showSubscribeModal('https://t.me/never_sol', 0));
    content.querySelector('#subscribeButton2').addEventListener('click', () => showSubscribeModal('https://t.me/channel2', 1));
    content.querySelector('#subscribeButton3').addEventListener('click', () => showSubscribeModal('https://t.me/channel3', 2));
    
    return content;
}

async function createLeaderboardTabContent() {
    const content = document.createElement('div');
    content.innerHTML = '<h2>Топ игроков</h2><div id="leaderboard">Загрузка...</div>';
    document.getElementById('scrollableContent').appendChild(content);

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
        document.getElementById('leaderboard').innerHTML = 'Ошибка при загрузке таблицы лидеров';
    }
}

function createDailyTabContent() {
    const content = document.createElement('div');
    content.innerHTML = `
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
    
    content.querySelector('#dailyBonusButton').addEventListener('click', showDailyBonusModal);
    content.querySelector('#inviteFriendButton').addEventListener('click', inviteFriend);
    content.querySelector('#submitVideoButton').addEventListener('click', submitVideo);
    
    return content;
}

// Остальные функции (claim, showSubscribeModal, checkSubscription, claimDailyBonus, inviteFriend, submitVideo, etc.) остаются без изменений

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    initGame().catch(error => {
        console.error('Failed to initialize game:', error);
        showNotification('Произошла ошибка при загрузке игры. Пожалуйста, обновите страницу.');
    });
    
    const scrollableContent = document.getElementById('scrollableContent');
    scrollableContent.addEventListener('click', (event) => {
        if (event.target.closest('#miningContainer')) {
            handleManualMining(event);
        }
    });
});

// Функции для обновления состояния игры
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
        showNotification('Не удалось синхронизировать прогресс. Автоматическая попытка через 5 секунд...');
        setTimeout(syncWithServer, 5000);
    }
}

// Вызывайте эту функцию периодически, например, каждые 5 минут
setInterval(syncWithServer, 5 * 60 * 1000);

// Функция отладки
function debugMining() {
    console.log('Current mining:', game.currentMining);
    console.log('Total mined:', game.totalMined);
    console.log('Mining rate:', game.miningRate);
    console.log('Last claim time:', new Date(game.lastClaimTime));
    console.log('Current time:', new Date());
}

// Вызовем функцию отладки каждые 10 секунд
setInterval(debugMining, 10000);

// Обработчик события перед закрытием страницы
window.addEventListener('beforeunload', () => {
    saveGame();
});

// Инициализация Telegram Web App
console.log('Telegram Web App data:', tg.initDataUnsafe);
tg.expand();
tg.ready();

// Функция для инициализации частиц
function initParticles() {
    particlesJS("particles-js", {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 } },
            opacity: { value: 0.5, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
            size: { value: 3, random: true, anim: { enable: false, speed: 40, size_min: 0.1, sync: false } },
            line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 1 },
            move: { enable: true, speed: 6, direction: "none", random: false, straight: false, out_mode: "out", bounce: false, attract: { enable: false, rotateX: 600, rotateY: 1200 } }
        },
        interactivity: {
            detect_on: "canvas",
            events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" }, resize: true },
            modes: { grab: { distance: 400, line_linked: { opacity: 1 } }, bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 }, repulse: { distance: 200, duration: 0.4 }, push: { particles_nb: 4 }, remove: { particles_nb: 2 } }
        },
        retina_detect: true
    });
}

// Функция для обновления UI таблицы лидеров
async function updateLeaderboardUI(leaderboardData) {
    let content = `
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
    `;

    try {
        const rankResponse = await fetch(`/api/player-rank/${tg.initDataUnsafe.user.id}`);
        if (rankResponse.ok) {
            const rankData = await rankResponse.json();
            const displayRank = rankData.rank > 100 ? '100+' : rankData.rank;
            content += `<p>Ваше место: ${displayRank}</p>`;
        } else {
            throw new Error('Failed to fetch player rank');
        }
    } catch (error) {
        console.error('Error fetching player rank:', error);
        content += `<p>Ваше место: N/A</p>`;
    }

    document.getElementById('leaderboard').innerHTML = content;
}

// Функция для обновления списка рефералов
function updateReferralsList() {
    const referralsListItems = document.getElementById('referralsListItems');
    if (referralsListItems) {
        referralsListItems.innerHTML = '';
        game.referrals.forEach(referral => {
            const li = document.createElement('li');
            li.textContent = `${referral.username} - ${formatNumber(referral.minedAmount)} монет`;
            referralsListItems.appendChild(li);
        });
    }
}

// Функция для обработки ручного майнинга
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

// Функция для отображения эффекта ручного майнинга
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

// Функция для отображения модального окна ежедневного бонуса
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

// Функция для отправки сообщения боту
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

// Функция для отображения модального окна
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

// Функция для скрытия модального окна
function hideModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// Функция для отображения уведомлений
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Функция для проверки реферала
function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('start');
    if (referralCode && referralCode.startsWith('ref_')) {
        handleReferral(referralCode.slice(4));
    }
}

// Функция для обработки реферала
async function handleReferral(referrerId) {
    try {
        const response = await fetch(`/api/referral/${tg.initDataUnsafe.user.id}/${referrerId}`, {
            method: 'POST'
        });
        if (response.ok) {
            showNotification('Вы успешно присоединились по реферальной ссылке!');
        } else {
            const data = await response.json();
            console.error('Failed to process referral:', data.error);
        }
    } catch (error) {
        console.error('Error processing referral:', error);
    }
}

// Функция для сбора добытой криптовалюты
async function claim() {
    if (game.currentMining < 0.1) {
        showNotification("Недостаточно крипто для сбора. Минимум 0.1");
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
            showNotification("Крипто успешно собрано!");
            sendMessageToBot(`Пользователь ${tg.initDataUnsafe.user.username} собрал ${formatNumber(data.amount)} монет!`);
            await updateLeaderboard();
            await saveGame();
            tg.HapticFeedback.impactOccurred('medium');
        } else {
            throw new Error('Failed to claim mining');
        }
    } catch (error) {
        console.error('Error claiming mining:', error);
        showNotification("Произошла ошибка при сборе крипто. Попробуйте еще раз.");
    }
}

// Функция для отображения эффекта сбора
function showClaimEffect() {
    gsap.fromTo("#miningContainer", 
        { scale: 1, opacity: 1 },
        { scale: 1.1, opacity: 0.8, duration: 0.3, yoyo: true, repeat: 1 }
    );
}

// Экспорт функций и переменных, которые могут понадобиться в других модулях
export {
    initGame,
    updateUI,
    loadTabContent,
    claim,
    showNotification,
    handleManualMining,
    showDailyBonusModal,
    inviteFriend,
    submitVideo,
    game
};