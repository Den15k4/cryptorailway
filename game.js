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

async function initGame() {
    await loadGame();
    await updateLeaderboard();
    initUI();
    checkReferral();
}

function initUI() {
    showMainTab();
    updateUI();
}

async function handleReferral(referralCode) {
    try {
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || game;

        if (!userData.referrals.includes(referralCode)) {
            userData.referrals.push(referralCode);
            userData.balance += game.referralBonus;
            await userRef.update(userData);
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
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) {
            Object.assign(game, snapshot.val());
        } else {
            await userRef.set(game);
        }
        
        const now = Date.now();
        const offlineTime = now - game.lastLoginTime;
        const maxOfflineTime = 4 * 60 * 60 * 1000;
        if (offlineTime > maxOfflineTime) {
            const excessTime = offlineTime - maxOfflineTime;
            game.lastClaimTime += excessTime;
        }
        game.lastLoginTime = now;
        updateUI();
    } catch (error) {
        console.error('Ошибка при загрузке игры:', error);
        showNotification('Ошибка при загрузке данных. Попробуйте перезагрузить страницу.');
    }
}

async function saveGame() {
    try {
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        await userRef.update(game);
        await updateLeaderboard();
    } catch (error) {
        console.error('Ошибка при сохранении игры:', error);
        showNotification('Не удалось сохранить прогресс. Проверьте подключение к интернету.');
    }
}

async function updateLeaderboard() {
    const leaderboardRef = firebase.database().ref('leaderboard');
    const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
    
    try {
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            const leaderboardEntry = {
                telegramId: tg.initDataUnsafe.user.id,
                username: tg.initDataUnsafe.user.username || 'Аноним',
                balance: userData.balance
            };
            
            await leaderboardRef.child(tg.initDataUnsafe.user.id).set(leaderboardEntry);
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
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
        const leaderboardRef = firebase.database().ref('leaderboard');
        const snapshot = await leaderboardRef.orderByChild('balance').once('value');
        const leaderboardData = [];
        snapshot.forEach((childSnapshot) => {
            leaderboardData.unshift(childSnapshot.val());
        });

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
                    <td><img src="icon_button/telegram-icon.png" alt="Telegram" class="telegram-icon">${player.username}</td>
                    <td>${formatNumber(player.balance)}</td>
                </tr>
            `;
        });

        const playerRank = leaderboardData.findIndex(player => player.telegramId === tg.initDataUnsafe.user.id) + 1;

        content += `
                </table>
            </div>
            <p>Ваше место: ${playerRank || 'N/A'}</p>
        `;

        document.getElementById('mainContent').innerHTML = content;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        document.getElementById('mainContent').innerHTML = '<p>Ошибка при загрузке таблицы лидеров</p>';
    }
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
    document.getElementById('inviteFriendButton').addEventListener('click', inviteFriend);
    document.getElementById('submitVideoButton').addEventListener('click', submitVideo);
}

function loadTabContent(tab) {
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
        showNotification("Недостаточно крипто для сбора. Минимум 0.1");
        return;
    }
    try {
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        userData.balance += game.currentMining;
        userData.currentMining = 0;
        userData.lastClaimTime = Date.now();
        
        await userRef.update(userData);
        
        Object.assign(game, userData);
        updateUI();
        showClaimEffect();
        showNotification("Крипто успешно собрано!");
        sendMessageToBot(`Пользователь ${tg.initDataUnsafe.user.username} собрал ${formatNumber(game.currentMining)} монет!`);
        await updateLeaderboard();
    } catch (error) {
        console.error('Error claiming mining:', error);
        showNotification("Произошла ошибка при сборе крипто. Попробуйте еще раз.");
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
            <p>Для получения ускорителя, подпишитесь на канал:</p>
            <a href="${channelLink}" target="_blank" class="subscribe-link" id="subscribeLink">Перейти на канал</a>
            <button id="checkSubscriptionButton" class="check-subscription" disabled>Проверить подписку</button>
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
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (!userData.subscribedChannels.includes(channelIndex)) {
            userData.subscribedChannels.push(channelIndex);
            userData.miningRate += 0.003;
            await userRef.update(userData);
            Object.assign(game, userData);
            showNotification("Ускоритель активирован! +0.003 к скорости добычи");
            updateUI();
        } else {
            showNotification("Вы уже активировали этот ускоритель.");
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        showNotification("Произошла ошибка при проверке подписки. Попробуйте позже.");
    }
    hideModal();
}

async function claimDailyBonus() {
    try {
        const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        const now = Date.now();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        
        if (now - userData.lastDailyBonusTime > oneDayInMs) {
            userData.dailyBonusDay = (userData.dailyBonusDay % 10) + 1;
            const bonusAmount = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55][userData.dailyBonusDay - 1];
            
            userData.balance += bonusAmount;
            userData.lastDailyBonusTime = now;
            
            await userRef.update(userData);
            Object.assign(game, userData);
            
            showNotification(`Вы получили ежедневный бонус: ${bonusAmount} монет!`);
            updateUI();
            await updateLeaderboard();
        } else {
            showNotification("Вы уже забрали сегодняшний бонус. Приходите завтра!");
        }
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        showNotification("Произошла ошибка при получении ежедневного бонуса. Попробуйте позже.");
    }
    hideModal();
}

function inviteFriend() {
    const referralLink = `https://t.me/your_bot?start=ref_${tg.initDataUnsafe.user.id}`;
    navigator.clipboard.writeText(referralLink).then(() => {
        showNotification("Реферальная ссылка скопирована в буфер обмена!");
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
        showNotification("Не удалось скопировать ссылку. Попробуйте еще раз.");
    });
}

function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('start');
    if (referralCode && referralCode.startsWith('ref_')) {
        handleReferral(referralCode.slice(4));
    }
}

async function submitVideo() {
    const content = `
        <h3>Отправить видео</h3>
        <input type="text" id="videoLink" placeholder="Вставьте ссылку на видео">
        <button id="submitVideoLinkButton" class="daily-button">Отправить</button>
    `;
    showModal(content);
    document.getElementById('submitVideoLinkButton').addEventListener('click', async () => {
        const videoLink = document.getElementById('videoLink').value;
        if (videoLink) {
            try {
                const userRef = firebase.database().ref(`users/${tg.initDataUnsafe.user.id}`);
                const snapshot = await userRef.once('value');
                const userData = snapshot.val();
                
                const reward = 5; // Фиксированная награда за видео
                userData.balance += reward;
                
                await userRef.update(userData);
                Object.assign(game, userData);
                
                showNotification(`Видео принято! Вы получили ${reward} монет.`);
                updateUI();
                await updateLeaderboard();
                hideModal();
            } catch (error) {
                console.error('Error submitting video:', error);
                showNotification("Произошла ошибка при отправке видео. Попробуйте позже.");
            }
        } else {
            showNotification("Пожалуйста, введите ссылку на видео.");
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
        daysHtml += `
            <div class="day-box ${dayClass}">
                <div class="day-number">День ${i}</div>
                <div class="coin-icon"></div>
                <div class="bonus-amount">${bonusAmounts[i-1]}</div>
            </div>
        `;
    }

    const modalContent = `
        <div class="daily-bonus-container">
            <div class="bonus-icon">🎁</div>
            <h2>Ежедневный буст</h2>
            <p>Получайте $SWITCH за ежедневный логин,<br>не пропуская ни одного</p>
            <div class="days-grid">
                ${daysHtml}
            </div>
            <button id="claimDailyBonus" class="claim-button" ${currentDay > 10 ? 'disabled' : ''}>
                ${currentDay > 10 ? 'Возвращайтесь завтра' : 'Получить бонус'}
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

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    document.body.addEventListener('click', (event) => {
        if (event.target.closest('#miningContainer')) {
            handleManualMining(event);
        }
    });
    
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tab = button.getAttribute('data-tab');
            loadTabContent(tab);
        });
    });
});

particlesJS("particles-js", {
    particles: {
        number: { value: 400, density: { enable: true, value_area: 800 } },
        color: { value: "#fff" },
        shape: { type: "circle" },
        opacity: { value: 0.5, random: true },
        size: { value: 3, random: true },
        move: { enable: true, speed: 1, direction: "bottom", straight: false }
    }
});

setInterval(() => {
    updateMining();
}, 1000);

setInterval(() => {
    saveGame();
}, 5000);

tg.expand();