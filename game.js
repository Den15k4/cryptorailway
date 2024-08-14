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
        const response = await fetch(`/api/game/${tg.initDataUnsafe.user.id}`);
        if (response.ok) {
            const userData = await response.json();
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

            const playerRank = leaderboardData.findIndex(player => player.id === tg.initDataUnsafe.user.id) + 1;

            content += `
                    </table>
                </div>
                <p>Ваше место: ${playerRank || 'N/A'}</p>
            `;

            document.getElementById('mainContent').innerHTML = content;
        } else {
            throw new Error('Failed to fetch leaderboard data');
        }
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
            game.currentMining = 0;
            game.lastClaimTime = Date.now();
            
            updateUI();
            showClaimEffect();
            showNotification("Крипто успешно собрано!");
            sendMessageToBot(`Пользователь ${tg.initDataUnsafe.user.username} собрал ${formatNumber(data.amount)} монет!`);
            await updateLeaderboard();
        } else {
            throw new Error('Failed to claim mining');
        }
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
        const response = await fetch(`/api/subscribe/${tg.initDataUnsafe.user.id}/${channelIndex}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            if (!game.subscribedChannels.includes(channelIndex)) {
                game.subscribedChannels.push(channelIndex);
                game.miningRate += 0.003;
                showNotification("Ускоритель активирован! +0.003 к скорости добычи");
                updateUI();
            } else {
                showNotification("Вы уже активировали этот ускоритель.");
            }
        } else {
            throw new Error('Failed to check subscription');
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        showNotification("Произошла ошибка при проверке подписки. Попробуйте позже.");
    }
    hideModal();
}

async function claimDailyBonus() {
    try {
        const response = await fetch(`/api/daily-bonus/${tg.initDataUnsafe.user.id}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            game.balance += data.bonusAmount;
            game.dailyBonusDay = data.newDailyBonusDay;
            game.lastDailyBonusTime = Date.now();
            
            showNotification(`Вы получили ежедневный бонус: ${data.bonusAmount} монет!`);
            updateUI();
            await updateLeaderboard();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || "Не удалось получить ежедневный бонус. Попробуйте позже.");
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
                    showNotification(`Видео принято! Вы получили ${data.reward} монет.`);
                    updateUI();
                    await updateLeaderboard();
                    hideModal();
                } else {
                    throw new Error('Failed to submit video');
                }
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

function updateLeaderboardUI(leaderboardData) {
    const leaderboardElement = document.getElementById('leaderboard');
    if (leaderboardElement) {
        let content = '<table><tr><th>Место</th><th>Ник</th><th>Счет</th></tr>';
        leaderboardData.forEach((player, index) => {
            content += `
                <tr>
                    <td>${index + 1}</td>
                    <td><img src="icon_button/telegram-icon.png" alt="Telegram" class="telegram-icon">${player.username || 'Аноним'}</td>
                    <td>${formatNumber(player.balance)}</td>
                </tr>
            `;
        });
        content += '</table>';
        leaderboardElement.innerHTML = content;

        const playerRank = leaderboardData.findIndex(player => player.id === tg.initDataUnsafe.user.id) + 1;
        const rankElement = document.querySelector('p:contains("Ваше место:")');
        if (rankElement) {
            rankElement.textContent = `Ваше место: ${playerRank || 'N/A'}`;
        }
    }
}

setInterval(() => {
    updateMining();
}, 1000);

setInterval(() => {
    saveGame();
}, 5000);

window.addEventListener('beforeunload', () => {
    saveGame();
});

// Инициализация частиц
particlesJS("particles-js", {
    particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: "#ffffff" },
        shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 }, image: { src: "img/github.svg", width: 100, height: 100 } },
        opacity: { value: 0.5, random: false, anim: { enable: false, speed: 1, opacity_min: 0.1, sync: false } },
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

tg.expand();