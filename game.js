let tg = window.Telegram.WebApp;

let game = {
    currentMining: 0,
    balance: 0,
    lastClaimTime: Date.now(),
    lastLoginTime: Date.now(),
    miningRate: 0.001,
    subscribedChannels: [],
    dailyBonusDay: 0,
    lastDailyBonusTime: 0,
    referrals: [],
    referralBonus: 5
};

let saveGameTimeout;
let currentTab = 'main';

function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

async function initGame() {
    updateLoadingProgress(10);
    await loadGame();
    updateLoadingProgress(40);
    await updateLeaderboard();
    updateLoadingProgress(70);
    initUI();
    updateLoadingProgress(90);
    checkReferral();
    updateLoadingProgress(100);
    setTimeout(hideLoadingScreen, 500);
}

function initUI() {
    showMainTab();
    updateUI();
}

async function handleReferral(referralCode) {
    try {
        const response = await fetch(`/api/referral/${tg.initDataUnsafe.user.id}/${referralCode}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            game.balance += game.referralBonus;
            showNotification(`Вы получили бонус ${game.referralBonus} монет за нового реферала!`);
            updateUI();
            await updateLeaderboard();
        }
    } catch (error) {
        console.error('Error handling referral:', error);
        showNotification('Ошибка при обработке реферала. Попробуйте позже.');
    }
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
        console.log('Loading game data for user:', tg.initDataUnsafe.user.id);
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}?username=${encodeURIComponent(tg.initDataUnsafe.user.username)}`);
        console.log('Response status:', response.status);
        if (response.ok) {
            const userData = await response.json();
            console.log('Loaded user data:', userData);
            Object.assign(game, userData);
            
            const now = Date.now();
            const offlineTime = now - game.lastLoginTime;
            const maxOfflineTime = 4 * 60 * 60 * 1000;
            if (offlineTime > maxOfflineTime) {
                const excessTime = offlineTime - maxOfflineTime;
                game.lastClaimTime += excessTime;
            }
            game.lastLoginTime = now;
            updateUI();
        } else {
            console.error('Failed to load game data');
            showNotification('Ошибка при загрузке данных. Попробуйте перезагрузить страницу.');
        }
    } catch (error) {
        console.error('Error loading game:', error);
        showNotification('Ошибка при загрузке данных. Попробуйте перезагрузить страницу.');
    }
}

async function saveGame() {
    try {
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(game),
        });
        if (!response.ok) {
            throw new Error('Failed to save game data');
        }
        await updateLeaderboard();
    } catch (error) {
        console.error('Error saving game:', error);
        showNotification('Не удалось сохранить прогресс. Проверьте подключение к интернету.');
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
    const maxOfflineTime = 4 * 60 * 60 * 1000;
    
    const effectiveTimePassed = Math.min(timePassed, maxOfflineTime);
    
    game.currentMining += (game.miningRate * effectiveTimePassed) / 1000;
    game.lastClaimTime = now;
    
    updateUI();
}

function updateUI() {
    const miningRateElement = document.getElementById('miningRateValue');
    if (miningRateElement) {
        miningRateElement.textContent = game.miningRate.toFixed(3);
    }
    
    const currentMiningElement = document.getElementById('currentMining');
    if (currentMiningElement) {
        animateValue(currentMiningElement, parseFloat(currentMiningElement.textContent), game.currentMining, 1000);
    }
    
    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement) {
        balanceElement.textContent = formatNumber(game.balance);
    }
}

function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = start + progress * (end - start);
        element.textContent = formatNumber(currentValue);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function showMainTab() {
    const content = `
        <div id="miningContainer">
            <div id="miningStats">
                <div class="stat">
                    <p>Добыто</p>
                    <h2 id="currentMining">${formatNumber(game.currentMining)}</h2>
                </div>
                <div class="stat">
                    <p>Баланс</p>
                    <h2 id="balanceAmount">${formatNumber(game.balance)}</h2>
                </div>
            </div>
        </div>
        <button id="claimButton">Собрать</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    document.getElementById('claimButton').addEventListener('click', claim);
}

function showBoostersTab() {
    const content = `
        <h2>Ускорители</h2>
        <button id="subscribeButton1" class="booster-button">Подписаться на канал 1</button>
        <button id="subscribeButton2" class="booster-button">Подписаться на канал 2</button>
        <button id="subscribeButton3" class="booster-button">Подписаться на канал 3</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    
    document.getElementById('subscribeButton1').addEventListener('click', () => showSubscribeModal('https://t.me/never_sol', 0));
    document.getElementById('subscribeButton2').addEventListener('click', () => showSubscribeModal('https://t.me/channel2', 1));
    document.getElementById('subscribeButton3').addEventListener('click', () => showSubscribeModal('https://t.me/channel3', 2));
}

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
        document.getElementById('mainContent').innerHTML = `<p>Ошибка при загрузке таблицы лидеров: ${error.message}</p>`;
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
    `;

    const playerRank = leaderboardData.findIndex(player => player.id === tg.initDataUnsafe.user.id) + 1;
    content += `<p>Ваше место: ${playerRank || 'N/A'}</p>`;

    document.getElementById('mainContent').innerHTML = content;
}

function showDailyTab() {
    const content = `
        <h2>Ежедневные задания</h2>
        <div class="daily-tasks">
            <div class="task">
                <h3>Ежедневный бонус</h3>
                <p>Получайте бонус каждый день</p>
                <button id="dailyBonusButton" class="task-button">Забрать бонус</button>
            </div>
            <div class="task">
                <h3>Пригласить друга</h3>
                <p>Получите награду за каждого приглашенного друга</p>
                <button id="inviteFriendButton" class="task-button">Пригласить</button>
            </div>
            <div class="task">
                <h3>Отправить видео</h3>
                <p>Поделитесь видео и получите награду</p>
                <button id="submitVideoButton" class="task-button">Отправить</button>
            </div>
        </div>
    `;

    document.getElementById('mainContent').innerHTML = content;
    attachDailyTasksEventListeners();
}

function attachDailyTasksEventListeners() {
    document.getElementById('dailyBonusButton').addEventListener('click', showDailyBonusModal);
    let tg = window.Telegram.WebApp;

let game = {
    currentMining: 0,
    balance: 0,
    lastClaimTime: Date.now(),
    lastLoginTime: Date.now(),
    miningRate: 0.001,
    subscribedChannels: [],
    dailyBonusDay: 0,
    lastDailyBonusTime: 0,
    referrals: [],
    referralBonus: 5
};

let saveGameTimeout;
let currentTab = 'main';

function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

async function initGame() {
    updateLoadingProgress(10);
    await loadGame();
    updateLoadingProgress(40);
    await updateLeaderboard();
    updateLoadingProgress(70);
    initUI();
    updateLoadingProgress(90);
    checkReferral();
    updateLoadingProgress(100);
    setTimeout(hideLoadingScreen, 500);
}

function initUI() {
    showMainTab();
    updateUI();
}

async function handleReferral(referralCode) {
    try {
        const response = await fetch(`/api/referral/${tg.initDataUnsafe.user.id}/${referralCode}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            game.balance += game.referralBonus;
            showNotification(`Вы получили бонус ${game.referralBonus} монет за нового реферала!`);
            updateUI();
            await updateLeaderboard();
        }
    } catch (error) {
        console.error('Error handling referral:', error);
        showNotification('Ошибка при обработке реферала. Попробуйте позже.');
    }
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
        console.log('Loading game data for user:', tg.initDataUnsafe.user.id);
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}?username=${encodeURIComponent(tg.initDataUnsafe.user.username)}`);
        console.log('Response status:', response.status);
        if (response.ok) {
            const userData = await response.json();
            console.log('Loaded user data:', userData);
            Object.assign(game, userData);
            
            const now = Date.now();
            const offlineTime = now - game.lastLoginTime;
            const maxOfflineTime = 4 * 60 * 60 * 1000;
            if (offlineTime > maxOfflineTime) {
                const excessTime = offlineTime - maxOfflineTime;
                game.lastClaimTime += excessTime;
            }
            game.lastLoginTime = now;
            updateUI();
        } else {
            console.error('Failed to load game data');
            showNotification('Ошибка при загрузке данных. Попробуйте перезагрузить страницу.');
        }
    } catch (error) {
        console.error('Error loading game:', error);
        showNotification('Ошибка при загрузке данных. Попробуйте перезагрузить страницу.');
    }
}

async function saveGame() {
    try {
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(game),
        });
        if (!response.ok) {
            throw new Error('Failed to save game data');
        }
        await updateLeaderboard();
    } catch (error) {
        console.error('Error saving game:', error);
        showNotification('Не удалось сохранить прогресс. Проверьте подключение к интернету.');
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
    const maxOfflineTime = 4 * 60 * 60 * 1000;
    
    const effectiveTimePassed = Math.min(timePassed, maxOfflineTime);
    
    game.currentMining += (game.miningRate * effectiveTimePassed) / 1000;
    game.lastClaimTime = now;
    
    updateUI();
}

function updateUI() {
    const miningRateElement = document.getElementById('miningRateValue');
    if (miningRateElement) {
        miningRateElement.textContent = game.miningRate.toFixed(3);
    }
    
    const currentMiningElement = document.getElementById('currentMining');
    if (currentMiningElement) {
        animateValue(currentMiningElement, parseFloat(currentMiningElement.textContent), game.currentMining, 1000);
    }
    
    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement) {
        balanceElement.textContent = formatNumber(game.balance);
    }
}

function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = start + progress * (end - start);
        element.textContent = formatNumber(currentValue);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function showMainTab() {
    const content = `
        <div id="miningContainer">
            <div id="miningStats">
                <div class="stat">
                    <p>Добыто</p>
                    <h2 id="currentMining">${formatNumber(game.currentMining)}</h2>
                </div>
                <div class="stat">
                    <p>Баланс</p>
                    <h2 id="balanceAmount">${formatNumber(game.balance)}</h2>
                </div>
            </div>
        </div>
        <button id="claimButton">Собрать</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    document.getElementById('claimButton').addEventListener('click', claim);
}

function showBoostersTab() {
    const content = `
        <h2>Ускорители</h2>
        <button id="subscribeButton1" class="booster-button">Подписаться на канал 1</button>
        <button id="subscribeButton2" class="booster-button">Подписаться на канал 2</button>
        <button id="subscribeButton3" class="booster-button">Подписаться на канал 3</button>
    `;
    document.getElementById('mainContent').innerHTML = content;
    
    document.getElementById('subscribeButton1').addEventListener('click', () => showSubscribeModal('https://t.me/never_sol', 0));
    document.getElementById('subscribeButton2').addEventListener('click', () => showSubscribeModal('https://t.me/channel2', 1));
    document.getElementById('subscribeButton3').addEventListener('click', () => showSubscribeModal('https://t.me/channel3', 2));
}

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
        document.getElementById('mainContent').innerHTML = `<p>Ошибка при загрузке таблицы лидеров: ${error.message}</p>`;
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
    `;

    const playerRank = leaderboardData.findIndex(player => player.id === tg.initDataUnsafe.user.id) + 1;
    content += `<p>Ваше место: ${playerRank || 'N/A'}</p>`;

    document.getElementById('mainContent').innerHTML = content;
}

function showDailyTab() {
    const content = `
        <h2>Ежедневные задания</h2>
        <div class="daily-tasks">
            <div class="task">
                <h3>Ежедневный бонус</h3>
                <p>Получайте бонус каждый день</p>
                <button id="dailyBonusButton" class="task-button">Забрать бонус</button>
            </div>
            <div class="task">
                <h3>Пригласить друга</h3>
                <p>Получите награду за каждого приглашенного друга</p>
                <button id="inviteFriendButton" class="task-button">Пригласить</button>
            </div>
            <div class="task">
                <h3>Отправить видео</h3>
                <p>Поделитесь видео и получите награду</p>
                <button id="submitVideoButton" class="task-button">Отправить</button>
            </div>
        </div>
    `;

    document.getElementById('mainContent').innerHTML = content;
    attachDailyTasksEventListeners();
}

function attachDailyTasksEventListeners() {
    document.getElementById('dailyBonusButton').addEventListener('click', showDailyBonusModal);