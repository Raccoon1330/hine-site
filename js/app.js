document.addEventListener('DOMContentLoaded', async () => {
    const loaderBar = document.getElementById('loader-tech-bar');
    const welcomeSubtitle = document.querySelector('.welcome-subtitle-scramble');
    const welcomeScreen = document.getElementById('welcome-animation');

    const updateLoader = (text, width) => {
        if (welcomeSubtitle) welcomeSubtitle.textContent = text;
        if (loaderBar) loaderBar.style.width = width;
    };

    const hideWelcomeScreen = () => {
        if (!welcomeScreen) return;
        welcomeScreen.classList.add('hidden');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
        }, 800);
    };

    const safeAwait = async (promise, fallback = null) => {
        try {
            return await promise;
        } catch (error) {
            console.error('操作失败:', error);
            return fallback;
        }
    };

    try {
        try { setupEventListeners?.(); } catch(e) { console.error('setupEventListeners:', e); }

        if (typeof localforage === 'undefined') {
            console.warn('LocalForage 未加载，将使用 localStorage 降级方案');
        }

        try {
            const emergencyBackupRaw = localStorage.getItem('BACKUP_V1_critical');
            if (emergencyBackupRaw) {
                const emergencyBackup = JSON.parse(emergencyBackupRaw);
                if (emergencyBackup && Array.isArray(emergencyBackup.messages) && emergencyBackup.messages.length > 0) {
                    console.warn('[boot] 检测到紧急备份，可用于异常恢复');
                }
            }
        } catch (e) {
            console.warn('[boot] 紧急备份检查失败:', e);
        }

        updateLoader('正在建立安全连接...', '10%');
        await safeAwait(initializeSession());

        updateLoader('正在读取记忆存档...', '40%');
        await safeAwait(loadData());

        updateLoader('正在渲染我们的世界...', '70%');
        
        await Promise.allSettled([
            safeAwait(initializeRandomUI?.()),
            safeAwait(initMusicPlayer?.())
        ]);

        setInterval(checkStatusChange, 60000);

        updateLoader('连接成功，欢迎回来。', '100%');
        setTimeout(hideWelcomeScreen, 3500);

        setTimeout(() => {
            initHomeScreen();
            openHomeScreen({ playSplash: true });
        }, 4200);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                try {
                    if (typeof saveTimeout !== 'undefined') clearTimeout(saveTimeout);
                } catch (e) {}
                try { _backupCriticalData(); } catch (e) { console.warn('[visibilitychange] 紧急备份失败:', e); }
                try {
                    const p = saveData();
                    if (p && typeof p.catch === 'function') {
                        p.catch(e => console.error('[visibilitychange] 保存失败:', e));
                    }
                } catch (e) {
                    console.error('[visibilitychange] 保存失败:', e);
                }
            } else if (document.visibilityState === 'visible') {
                try {
                    const backup = typeof _tryRecoverFromBackup === 'function' ? _tryRecoverFromBackup() : null;
                    if (backup && Array.isArray(backup.messages) && backup.messages.length > 0 && Array.isArray(messages) && backup.messages.length > messages.length) {
                        console.warn('[visibilitychange] 检测到备份消息比当前更多，自动尝试恢复');
                        try {
                            messages = backup.messages.map(m => ({
                                ...m,
                                timestamp: new Date(m.timestamp)
                            }));
                            if (backup.settings) Object.assign(settings, backup.settings);
                            if (typeof updateUI === 'function') updateUI();
                            if (typeof throttledSaveData === 'function') throttledSaveData();
                            showNotification('已自动恢复本地临时备份内容', 'warning', 3500);
                        } catch (restoreErr) {
                            console.warn('[visibilitychange] 自动恢复失败，保留当前页面内容:', restoreErr);
                        }
                    }
                } catch (e) {
                    console.warn('[visibilitychange] 恢复备份失败:', e);
                }
            }
        });

        window.addEventListener('pagehide', () => {
            try { _backupCriticalData(); } catch (e) {}
        });

        window.addEventListener('beforeunload', () => {
            try { _backupCriticalData(); } catch (e) {}
        });

        setInterval(() => {
            saveData().catch(e => console.warn('[autoBackup] 定时保存失败:', e));
        }, 3 * 60 * 1000);

        (() => {
            const REMIND_KEY = 'exportReminderLastShown';
            const last = parseInt(localStorage.getItem(REMIND_KEY) || '0', 10);
            const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
            if (daysSince >= 7) {
                setTimeout(() => {
                    showNotification('建议定期导出备份，防止数据意外丢失', 'info', 7000);
                    localStorage.setItem(REMIND_KEY, String(Date.now()));
                }, 8000);
            }
        })();

        setTimeout(async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        showNotification('已开启系统通知，收到消息时会提醒你', 'success', 3000);
                    }
                } catch(e) {
                    console.warn('通知权限请求失败:', e);
                }
            }
        }, 3000);

    } catch (err) {
        console.error('严重初始化错误:', err);
        try {
            const backup = typeof _tryRecoverFromBackup === 'function' ? _tryRecoverFromBackup() : null;
            if (backup && Array.isArray(backup.messages) && backup.messages.length > 0) {
                messages = backup.messages.map(m => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                if (backup.settings) Object.assign(settings, backup.settings);
                if (typeof updateUI === 'function') updateUI();
                showNotification('初始化异常，已使用本地紧急备份恢复', 'warning', 5000);
            }
        } catch (recoverErr) {
            console.warn('[boot] 初始化失败后的恢复也失败:', recoverErr);
        }
        updateLoader('加载遇到问题，已强制进入...', '100%');
        setTimeout(hideWelcomeScreen, 3500);
    }
});
const stickerInput = document.getElementById('sticker-file-input');
            if (stickerInput) {
                stickerInput.addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files);
                    if (!files.length) return;

                    const oversized = files.filter(f => f.size > 2 * 1024 * 1024);
                    if (oversized.length > 0) {
                        showNotification(oversized.length + ' 张图片超过 2MB 限制，已跳过', 'warning');
                    }

                    const validFiles = files.filter(f => f.size <= 2 * 1024 * 1024);
                    if (!validFiles.length) return;

                    showNotification('正在批量处理 ' + validFiles.length + ' 张图片...', 'info');

                    let successCount = 0;
                    let failCount = 0;

                    for (const file of validFiles) {
                        try {
                            const base64 = await optimizeImage(file, 300, 0.8);
                            stickerLibrary.push(base64);
                            successCount++;
                        } catch (err) {
                            console.error(err);
                            failCount++;
                        }
                    }

                    throttledSaveData();
                    renderReplyLibrary();

                    if (failCount > 0) {
                        showNotification('上传完成：' + successCount + ' 张成功，' + failCount + ' 张失败', 'warning');
                    } else {
                        showNotification('上传成功，共 ' + successCount + ' 张', 'success');
                    }

                    e.target.value = '';
                });
            }
const myStickerQuickUpload = document.getElementById('my-sticker-quick-upload');
if (myStickerQuickUpload) {
    myStickerQuickUpload.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const oversized = files.filter(f => f.size > 2 * 1024 * 1024);
        if (oversized.length > 0) showNotification(oversized.length + ' 张图片超过 2MB，已跳过', 'warning');
        const validFiles = files.filter(f => f.size <= 2 * 1024 * 1024);
        if (!validFiles.length) return;
        showNotification('正在处理 ' + validFiles.length + ' 张...', 'info');
        let ok = 0, fail = 0;
        for (const file of validFiles) {
            try {
                const base64 = await optimizeImage(file, 300, 0.8);
                myStickerLibrary.push(base64);
                ok++;
            } catch(err) { fail++; }
        }
        throttledSaveData();
        if (typeof renderComboContent === 'function') renderComboContent('my-sticker');
        showNotification(fail > 0 ? `上传完成：${ok} 成功 ${fail} 失败` : `✓ 已添加 ${ok} 张到我的表情库`, fail > 0 ? 'warning' : 'success');
        e.target.value = '';
    });
}

window.addEventListener('load', function() {
    setTimeout(function() {
        try {
            if (localStorage.getItem('dailyGreetingShown') === new Date().toDateString()) return;
            try { if (typeof checkPartnerDailyMood === 'function') checkPartnerDailyMood(); } catch(e2) { console.warn('checkPartnerDailyMood error:', e2); }
            if (typeof _buildDailyGreeting === 'function') _buildDailyGreeting();
            if (window.localforage && window.APP_PREFIX) {
                localforage.getItem(window.APP_PREFIX + 'tour_seen').then(function(seen) {
                    if (seen) {
                        var modal = document.getElementById('daily-greeting-modal');
                        if (modal) modal.classList.remove('hidden');
                        localStorage.setItem('dailyGreetingShown', new Date().toDateString());
                    }
                }).catch(function() {
                    var modal = document.getElementById('daily-greeting-modal');
                    if (modal) modal.classList.remove('hidden');
                    localStorage.setItem('dailyGreetingShown', new Date().toDateString());
                });
            } else {
                var modal = document.getElementById('daily-greeting-modal');
                if (modal) modal.classList.remove('hidden');
                localStorage.setItem('dailyGreetingShown', new Date().toDateString());
            }
        } catch(e) { console.warn('Daily greeting timing error:', e); }
    }, 4500);
}, { once: true });

/* ========== HOME SCREEN ========== */
function enterChat() {
    var hs = document.getElementById('home-screen');
    document.body.classList.remove('chat-in-home');
    if (hs) {
        hs.classList.remove('show');
        hs.classList.add('hide');
        setTimeout(function() { hs.classList.remove('hide'); }, 500);
    }
}

var _splashPlayedThisSession = false;

function openHomeScreen(opts) {
    opts = opts || {};
    var hs = document.getElementById('home-screen');
    document.body.classList.add('chat-in-home');
    if (hs) hs.classList.add('show');
    syncHomeAvatars();
    if (opts.playSplash && !_splashPlayedThisSession) {
        _splashPlayedThisSession = true;
        playHomeSplash();
    }
}

async function playHomeSplash() {
    var splash = document.getElementById('home-splash');
    if (!splash) return;

    var hs = document.getElementById('home-screen');
    hs.classList.add('splash-playing');
    splash.classList.remove('splash-done', 'fading');
    splash.classList.add('active');

    var missionCount = 1;
    try {
        var key = (window.APP_PREFIX || 'hine_') + 'mission_count';
        var existing = await (localforage ? localforage.getItem(key) : Promise.resolve(localStorage.getItem(key)));
        missionCount = (parseInt(existing, 10) || 0) + 1;
        if (localforage) await localforage.setItem(key, missionCount);
        else localStorage.setItem(key, missionCount);

        var logKey = (window.APP_PREFIX || 'hine_') + 'mission_log';
        var logs = await (localforage ? localforage.getItem(logKey) : Promise.resolve(localStorage.getItem(logKey)));
        logs = logs ? (typeof logs === 'string' ? JSON.parse(logs) : logs) : [];
        logs.push({ count: missionCount, ts: Date.now() });
        if (logs.length > 500) logs = logs.slice(-500);
        if (localforage) await localforage.setItem(logKey, logs);
        else localStorage.setItem(logKey, JSON.stringify(logs));
    } catch (e) {
        console.warn('mission count error', e);
    }

    var starLayer = document.getElementById('splash-stars');
    starLayer.innerHTML = '';
    for (var i = 0; i < 60; i++) {
        var s = document.createElement('div');
        s.className = 'splash-star' + (Math.random() < .25 ? ' gold' : '');
        var size = 1 + Math.random() * 2;
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
        s.style.setProperty('--delay', (Math.random() * 5) + 's');
        s.style.setProperty('--min', (.15 + Math.random() * .35).toFixed(2));
        starLayer.appendChild(s);
    }

    var splashLeft = document.getElementById('splash-avatar-left');
    var splashRight = document.getElementById('splash-avatar-right');
    var chatPartnerAvatar = document.getElementById('partner-avatar');
    var chatSelfAvatar = document.getElementById('my-avatar');
    var partnerSrc = chatPartnerAvatar ? chatPartnerAvatar.querySelector('img')?.src : '';
    var selfSrc = chatSelfAvatar ? chatSelfAvatar.querySelector('img')?.src : '';
    splashLeft.innerHTML = partnerSrc ? '<img src="' + partnerSrc + '" alt="">' : '';
    splashRight.innerHTML = selfSrc ? '<img src="' + selfSrc + '" alt="">' : '';

    var textEl = document.getElementById('splash-text');
    var progressEl = document.getElementById('splash-progress');
    var flashLeft = document.getElementById('splash-avatar-left');

    textEl.textContent = '';
    textEl.style.animation = '';
    progressEl.style.width = '0%';

    var phase1 = '等待 黑泽阵 进入中';
    var phase2 = '链接成功，请开始第 ' + missionCount + ' 次行动';

    function resetTextAnim() {
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = '';
    }

    function typeText(str, done) {
        resetTextAnim();
        textEl.textContent = '';
        textEl.style.opacity = '1';
        textEl.classList.add('splash-text');
        var i = 0;
        var iv = setInterval(function() {
            if (i >= str.length) { clearInterval(iv); done && done(); return; }
            textEl.textContent += str.charAt(i);
            i++;
        }, 55);
    }

    function flashAvatar() {
        flashLeft.classList.remove('splash-flash');
        void flashLeft.offsetWidth;
        flashLeft.classList.add('splash-flash');
        setTimeout(function() { flashLeft.classList.remove('splash-flash'); }, 500);
    }

    progressEl.style.width = '100%';
    progressEl.style.transition = 'width 5.2s linear';

    var stage1Done = false;
    typeText(phase1, function() { stage1Done = true; });

    setTimeout(function() { if (stage1Done) flashAvatar(); }, 1200);
    setTimeout(function() {
        if (stage1Done) {
            textEl.innerHTML = phase1 + '<span class="splash-dots"><span></span><span></span><span></span></span>';
        }
    }, 1500);
    setTimeout(function() {
        textEl.style.animation = 'splashTextFade .5s ease reverse forwards';
    }, 2300);
    setTimeout(function() { typeText(phase2); }, 2900);

    setTimeout(function() {
        splash.classList.add('fading');
        setTimeout(function() {
            splash.classList.remove('active', 'fading');
            splash.classList.add('splash-done');
            hs.classList.remove('splash-playing');
        }, 800);
    }, 5200);
}

function syncHomeAvatars() {
    var partnerAvatarEl = document.getElementById('home-avatar-partner');
    var selfAvatarEl = document.getElementById('home-avatar-self');
    var chatPartnerAvatar = document.getElementById('partner-avatar');
    var chatSelfAvatar = document.getElementById('my-avatar');
    if (partnerAvatarEl && chatPartnerAvatar) {
        partnerAvatarEl.innerHTML = chatPartnerAvatar.innerHTML || '<i class="fas fa-heart"></i>';
    }
    if (selfAvatarEl && chatSelfAvatar) {
        selfAvatarEl.innerHTML = chatSelfAvatar.innerHTML || '<i class="fas fa-user"></i>';
    }
}
window.syncHomeAvatars = syncHomeAvatars;

function initHomeScreen() {
    var timeEl = document.getElementById('home-time');
    var dateEl = document.getElementById('home-date');
    var selfNameEl = document.getElementById('home-name-self');
    var partnerNameEl = document.getElementById('home-name-partner');
    var selfAvatarEl = document.getElementById('home-avatar-self');
    var partnerAvatarEl = document.getElementById('home-avatar-partner');
    var signatureEl = document.getElementById('home-signature');
    var returnBtn = document.getElementById('home-return-chat');

    function updateClock() {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        if (timeEl) timeEl.textContent = hh + ':' + mm;
        var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日  ' + weekdays[now.getDay()];
        if (dateEl) dateEl.textContent = dateStr;
    }
    updateClock();
    setInterval(updateClock, 30000);

    if (typeof settings !== 'undefined') {
        if (selfNameEl) selfNameEl.textContent = settings.myName || '我';
        if (partnerNameEl) partnerNameEl.textContent = settings.partnerName || '对方';
    }

    syncHomeAvatars();

    var apps = document.querySelectorAll('.home-app');
    apps.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var action = btn.getAttribute('data-action');
            if (action === 'chat') {
                enterChat();
                return;
            }
            var show = function(modalId, setupFn) {
                var m = document.getElementById(modalId);
                if (!m) return;
                if (typeof setupFn === 'function') setupFn();
                if (typeof showModal === 'function') showModal(m);
                else m.style.display = 'flex';
            };
            switch (action) {
                case 'settings':
                    show('settings-modal');
                    break;
                case 'envelope':
                    show('envelope-modal', async function() {
                        if (typeof loadEnvelopeData === 'function') await loadEnvelopeData();
                        if (typeof checkEnvelopeStatus === 'function') await checkEnvelopeStatus();
                        var outTab = document.getElementById('env-tab-outbox');
                        var inTab = document.getElementById('env-tab-inbox');
                        var outSec = document.getElementById('env-outbox-section');
                        var inSec = document.getElementById('env-inbox-section');
                        var compose = document.getElementById('env-compose-form');
                        var closeBtn = document.getElementById('env-main-close-btn');
                        if (outTab) outTab.classList.add('active');
                        if (inTab) inTab.classList.remove('active');
                        if (outSec) outSec.style.display = 'block';
                        if (inSec) inSec.style.display = 'none';
                        if (compose) compose.style.display = 'none';
                        if (closeBtn) closeBtn.style.display = 'flex';
                        if (typeof renderEnvelopeLists === 'function') renderEnvelopeLists();
                    });
                    break;
                case 'mood':
                    show('mood-modal');
                    break;
                case 'anniversary':
                    show('anniversary-modal');
                    break;
                case 'fortune':
                    show('fortune-lenormand-modal', function() {
                        if (typeof generateFortune === 'function') generateFortune();
                        if (typeof switchFLTab === 'function') switchFLTab('fortune');
                    });
                    break;
                case 'stats':
                    show('stats-modal');
                    break;
                case 'decision':
                    show('decision-menu-modal');
                    break;
                case 'call-video':
                    if (window.callFeature?.startCall) window.callFeature.startCall(false, 'video');
                    break;
                case 'call-voice':
                    if (window.callFeature?.startCall) window.callFeature.startCall(false, 'voice');
                    break;
            }
        });
    });

    if (returnBtn) {
        returnBtn.addEventListener('click', openHomeScreen);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var openModal = document.querySelector('.modal[style*="display: flex"]');
            if (openModal) return;
            var hs = document.getElementById('home-screen');
            if (hs && hs.classList.contains('show')) {
                enterChat();
            }
        }
    });
}
