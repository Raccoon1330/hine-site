(function () {
    'use strict';

    const STORAGE_KEY = 'cinemaTickets';
    const PREFIX = (window.APP_PREFIX || 'hine_');

    let tickets = [];
    let currentTicket = null;
    let floatingPlayer = null;

    function getKey() {
        if (typeof getStorageKey === 'function') return getStorageKey('cinemaTickets');
        let sid = window.SESSION_ID || localStorage.getItem(PREFIX + 'sessionId') || 'default';
        return PREFIX + sid + '_cinemaTickets';
    }

    async function loadTickets() {
        try {
            const raw = window.localforage
                ? await localforage.getItem(getKey())
                : localStorage.getItem(getKey());
            if (raw) tickets = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) { tickets = []; }
        if (!Array.isArray(tickets)) tickets = [];
    }

    async function saveTickets() {
        try {
            const data = JSON.parse(JSON.stringify(tickets));
            if (window.localforage) await localforage.setItem(getKey(), data);
            else localStorage.setItem(getKey(), JSON.stringify(data));
        } catch (e) { console.warn('saveTickets failed', e); }
    }

    function uid() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    function isValidVideoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.trim();
        if (!u) return false;
        const low = u.toLowerCase();
        // 直接 mp4/webm/m3u8 链接
        if (low.match(/\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/)) return true;
        // YouTube / Bilibili / 其他 iframe
        if (low.includes('youtube.com') || low.includes('youtu.be')) return true;
        if (low.includes('bilibili.com') || low.includes('b23.tv')) return true;
        if (low.includes('vimeo.com')) return true;
        // 通用 http(s) 链接也允许（用户自己负责）
        if (low.startsWith('http://') || low.startsWith('https://')) return true;
        return false;
    }

    function buildTicketCard(t) {
        const time = new Date(t.createdAt).toLocaleString('zh-CN', { hour12: false });
        const statusIcon = t.watched ? 'fa-check-circle' : 'fa-clock';
        const statusText = t.watched ? '已入场' : '待检票';
        return `
        <div class="cinema-ticket-card" data-id="${t.id}">
            <div class="cinema-ticket-stub">
                <div class="cts-perf">PERFORMANCE</div>
                <div class="cts-movie">${escapeHtml(t.movie)}</div>
                <div class="cts-row">
                    <span>场次</span><b>${escapeHtml(t.session)}</b>
                </div>
                <div class="cts-row">
                    <span>座位</span><b>${escapeHtml(t.seat)}</b>
                </div>
                <div class="cts-row">
                    <span>时间</span><b>${time}</b>
                </div>
                <div class="cts-status"><i class="fas ${statusIcon}"></i>${statusText}</div>
                <div class="cts-tear"></div>
                <div class="cts-barcode">
                    ${Math.random().toString(36).slice(2, 10).toUpperCase()}
                </div>
            </div>
            <div class="cinema-ticket-action">
                <button class="cta-enter" data-action="enter"><i class="fas fa-ticket-alt"></i>检票入场</button>
                <button class="cta-delete" data-action="delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function renderTicketList() {
        const list = document.getElementById('cinema-ticket-list');
        if (!list) return;
        if (!tickets.length) {
            list.innerHTML = `
                <div class="cinema-empty">
                    <i class="fas fa-film"></i>
                    <div>还没有影票</div>
                    <div class="cinema-empty-hint">填写下方表单创建第一张票根 ✨</div>
                </div>`;
            return;
        }
        list.innerHTML = tickets.map(buildTicketCard).join('');
        list.querySelectorAll('[data-action="enter"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('.cinema-ticket-card').dataset.id;
                enterCinema(id);
            });
        });
        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('.cinema-ticket-card').dataset.id;
                deleteTicket(id);
            });
        });
    }

    async function createTicket() {
        const movieInput = document.getElementById('cinema-movie');
        const sessionInput = document.getElementById('cinema-session');
        const seatInput = document.getElementById('cinema-seat');
        const urlInput = document.getElementById('cinema-video-url');
        const statusEl = document.getElementById('cinema-form-status');

        const movie = (movieInput?.value || '').trim();
        const session = (sessionInput?.value || '').trim();
        const seat = (seatInput?.value || '').trim();
        const url = (urlInput?.value || '').trim();

        if (!movie) { flashError('请填写电影名字'); movieInput?.focus(); return; }
        if (!session) { flashError('请填写场次'); sessionInput?.focus(); return; }
        if (!seat) { flashError('请填写座位号'); seatInput?.focus(); return; }
        if (!url) { flashError('请填写视频链接'); urlInput?.focus(); return; }

        if (!isValidVideoUrl(url)) {
            flashError('视频链接格式不对（需要 http(s) 开头）');
            urlInput?.focus();
            return;
        }

        const t = {
            id: uid(),
            movie, session, seat, url,
            createdAt: Date.now(),
            watched: false
        };
        tickets.unshift(t);
        await saveTickets();

        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i>影票已生成';
            setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 1600);
        }

        // 清空表单
        if (movieInput) movieInput.value = '';
        if (sessionInput) sessionInput.value = '';
        if (seatInput) seatInput.value = '';
        if (urlInput) urlInput.value = '';

        renderTicketList();
    }

    function flashError(msg) {
        const el = document.getElementById('cinema-form-status');
        if (el) {
            el.innerHTML = `<i class="fas fa-exclamation-circle"></i>${escapeHtml(msg)}`;
            el.style.color = '#ff6b6b';
            setTimeout(() => {
                if (el) { el.innerHTML = ''; el.style.color = ''; }
            }, 2000);
        }
    }

    async function deleteTicket(id) {
        tickets = tickets.filter(t => t.id !== id);
        await saveTickets();
        renderTicketList();
    }

    function parseVideoUrl(url) {
        const low = url.toLowerCase();
        // YouTube
        if (low.includes('youtube.com/watch')) {
            const m = url.match(/[?&]v=([^&]+)/);
            if (m) return { type: 'youtube', embed: 'https://www.youtube.com/embed/' + m[1] };
        }
        if (low.includes('youtu.be/')) {
            const m = url.match(/youtu\.be\/([^?]+)/);
            if (m) return { type: 'youtube', embed: 'https://www.youtube.com/embed/' + m[1] };
        }
        // Bilibili
        if (low.includes('bilibili.com/') || low.includes('b23.tv')) {
            // 直接走 iframe srcdoc 包装（避免跨域嵌入问题）
            return { type: 'iframe', embed: url };
        }
        // vimeo
        if (low.includes('vimeo.com/')) {
            const m = url.match(/vimeo\.com\/(\d+)/);
            if (m) return { type: 'vimeo', embed: 'https://player.vimeo.com/video/' + m[1] };
        }
        // 直接视频文件
        if (low.match(/\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/)) {
            return { type: 'video', src: url };
        }
        // 兜底：iframe 嵌入
        return { type: 'iframe', embed: url };
    }

    function enterCinema(id) {
        const t = tickets.find(x => x.id === id);
        if (!t) return;
        currentTicket = t;
        t.watched = true;
        saveTickets().then(() => renderTicketList());
        // 关闭票根弹窗
        const m = document.getElementById('cinema-modal');
        if (m && typeof hideModal === 'function') hideModal(m);
        else if (m) m.style.display = 'none';

        openFloatingPlayer(t);
    }

    function openFloatingPlayer(ticket) {
        closeFloatingPlayer();

        const info = parseVideoUrl(ticket.url);
        const root = document.createElement('div');
        root.id = 'cinema-floating-player';
        root.innerHTML = `
        <div class="cfp-header">
            <div class="cfp-title">
                <i class="fas fa-film"></i>
                <span class="cfp-title-text">${escapeHtml(ticket.movie)}</span>
                <span class="cfp-sub">${escapeHtml(ticket.session)} · ${escapeHtml(ticket.seat)}</span>
            </div>
            <div class="cfp-controls">
                <button class="cfp-btn" id="cfp-pip" title="画中画"><i class="fas fa-picture-in-picture"></i></button>
                <button class="cfp-btn" id="cfp-expand" title="放大"><i class="fas fa-expand"></i></button>
                <button class="cfp-btn" id="cfp-close" title="关闭"><i class="fas fa-times"></i></button>
            </div>
        </div>
        <div class="cfp-stage" id="cfp-stage"></div>
        <div class="cfp-footer">
            <i class="fas fa-volume-up"></i>
            <span>私人影院 · ${escapeHtml(ticket.movie)}</span>
        </div>`;
        document.body.appendChild(root);
        floatingPlayer = root;

        const stage = root.querySelector('#cfp-stage');
        if (info.type === 'video') {
            const video = document.createElement('video');
            video.src = info.src;
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            stage.appendChild(video);
        } else if (info.type === 'youtube' || info.type === 'vimeo') {
            const iframe = document.createElement('iframe');
            iframe.src = info.embed + '?autoplay=1&rel=0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            stage.appendChild(iframe);
        } else {
            const iframe = document.createElement('iframe');
            iframe.src = info.embed;
            iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
            iframe.allowFullscreen = true;
            stage.appendChild(iframe);
        }

        // 绑定控制
        root.querySelector('#cfp-close').addEventListener('click', closeFloatingPlayer);
        root.querySelector('#cfp-expand').addEventListener('click', () => {
            const el = root.querySelector('.cfp-stage video, .cfp-stage iframe');
            if (el && el.requestFullscreen) el.requestFullscreen();
        });
        root.querySelector('#cfp-pip').addEventListener('click', async () => {
            const video = root.querySelector('.cfp-stage video');
            if (!video) { flashPlayerMsg('画中画仅支持直接视频文件'); return; }
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else await video.requestPictureInPicture();
            } catch (e) { flashPlayerMsg('画中画开启失败'); }
        });

        // 拖拽移动（整个 root 可拖）
        let dragOff = null;
        root.querySelector('.cfp-header').addEventListener('pointerdown', (e) => {
            if (e.target.closest('.cfp-controls')) return;
            dragOff = { x: e.clientX - root.offsetLeft, y: e.clientY - root.offsetTop };
            root.setPointerCapture(e.pointerId);
            root.style.transition = 'none';
        });
        root.querySelector('.cfp-header').addEventListener('pointermove', (e) => {
            if (!dragOff) return;
            const x = Math.max(0, Math.min(window.innerWidth - root.offsetWidth, e.clientX - dragOff.x));
            const y = Math.max(0, Math.min(window.innerHeight - root.offsetHeight, e.clientY - dragOff.y));
            root.style.left = x + 'px';
            root.style.top = y + 'px';
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        });
        root.querySelector('.cfp-header').addEventListener('pointerup', () => {
            dragOff = null;
            root.style.transition = '';
        });

        // 默认位置：右下角
        root.style.right = '20px';
        root.style.bottom = '20px';
        requestAnimationFrame(() => {
            root.classList.add('visible');
        });
    }

    function flashPlayerMsg(msg) {
        if (!floatingPlayer) return;
        let tip = floatingPlayer.querySelector('.cfp-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'cfp-tip';
            floatingPlayer.appendChild(tip);
        }
        tip.textContent = msg;
        tip.classList.add('show');
        clearTimeout(flashPlayerMsg._t);
        flashPlayerMsg._t = setTimeout(() => tip.classList.remove('show'), 1800);
    }

    function closeFloatingPlayer() {
        if (!floatingPlayer) return;
        const video = floatingPlayer.querySelector('video');
        if (video) video.pause?.();
        floatingPlayer.classList.remove('visible');
        const p = floatingPlayer;
        setTimeout(() => { p.remove(); }, 350);
        floatingPlayer = null;
    }

    async function openCinemaModal() {
        await loadTickets();
        renderTicketList();
        const m = document.getElementById('cinema-modal');
        if (!m) return;
        if (typeof showModal === 'function') showModal(m);
        else m.style.display = 'flex';
    }

    function bindForm() {
        const btn = document.getElementById('cinema-create-btn');
        btn?.addEventListener('click', createTicket);
        ['cinema-movie', 'cinema-session', 'cinema-seat', 'cinema-video-url'].forEach(id => {
            const el = document.getElementById(id);
            el?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && el.id !== 'cinema-video-url') {
                    e.preventDefault();
                    const next = document.getElementById(
                        { 'cinema-movie': 'cinema-session', 'cinema-session': 'cinema-seat', 'cinema-seat': 'cinema-video-url' }[el.id]
                    );
                    next?.focus();
                }
            });
        });
    }

    function injectCSS() {
        if (document.getElementById('cinema-feature-style')) return;
        const css = `
:root {
    --cinema-red: #e50914;
    --cinema-red-dark: #b00610;
    --cinema-red-deep: #5a0508;
    --cinema-gold: #f5c518;
    --cinema-bg: #0a0a0c;
    --cinema-bg-card: #141418;
    --cinema-bg-card-2: #1c1c22;
    --cinema-line: rgba(229,9,20,0.35);
    --cinema-text: #fff2f2;
    --cinema-text-dim: rgba(255,242,242,0.55);
}

/* ===== 弹窗容器 ===== */
#cinema-modal {
    background: transparent !important;
    backdrop-filter: blur(0px);
}
#cinema-modal .modal-content {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    max-width: 480px;
    width: 92vw;
}

/* ===== 票根主体 ===== */
.cinema-ticket {
    position: relative;
    background: var(--cinema-bg);
    border-radius: 20px;
    color: var(--cinema-text);
    overflow: hidden;
    box-shadow:
        0 0 0 1px rgba(229,9,20,0.25),
        0 24px 60px rgba(229,9,20,0.18),
        0 4px 20px rgba(0,0,0,0.6);
    animation: cinemaTicketIn .45s cubic-bezier(.2,.8,.2,1);
}
@keyframes cinemaTicketIn {
    from { transform: translateY(24px) scale(.95); opacity: 0; }
    to { transform: none; opacity: 1; }
}

/* 顶栏 */
.cinema-ticket-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--cinema-red-deep) 0%, #2a060a 55%, var(--cinema-bg) 100%);
    border-bottom: 1px solid var(--cinema-line);
    position: relative;
}
.cinema-ticket-header::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(245,197,24,0.55), transparent);
}
.cth-left { display: flex; align-items: center; gap: 10px; }
.cth-logo {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, var(--cinema-red), var(--cinema-red-dark));
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 14px;
    box-shadow: 0 0 18px rgba(229,9,20,0.55);
}
.cth-title { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; }
.cth-sub { font-size: 10px; color: var(--cinema-text-dim); letter-spacing: 0.18em; margin-top: 1px; }
.cth-close {
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
    color: var(--cinema-text); cursor: pointer; font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transition: all .18s;
}
.cth-close:hover { background: var(--cinema-red); border-color: var(--cinema-red); transform: rotate(90deg); }

/* 表单区 */
.cinema-form {
    padding: 20px;
    display: flex; flex-direction: column; gap: 12px;
}
.cinema-field {
    position: relative;
}
.cinema-field label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: var(--cinema-gold);
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 600;
}
.cinema-field input {
    width: 100%;
    padding: 11px 14px;
    background: var(--cinema-bg-card);
    border: 1px solid rgba(229,9,20,0.25);
    border-radius: 10px;
    color: var(--cinema-text);
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    outline: none;
    transition: all .18s;
}
.cinema-field input:focus {
    border-color: var(--cinema-red);
    box-shadow: 0 0 0 3px rgba(229,9,20,0.18);
    background: var(--cinema-bg-card-2);
}
.cinema-field input::placeholder { color: rgba(255,242,242,0.3); }

.cinema-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* 状态提示 */
.cinema-form-status {
    min-height: 18px;
    font-size: 11px;
    color: var(--cinema-gold);
    display: flex; align-items: center; gap: 6px;
}

/* 检票按钮（票根风格） */
.cinema-create-bar {
    margin-top: 8px;
    background: linear-gradient(135deg, var(--cinema-red), var(--cinema-red-dark));
    border-radius: 12px;
    padding: 12px 18px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform .18s;
    border: none;
    color: #fff;
    font-family: inherit;
}
.cinema-create-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 0% 50%, transparent 8px, var(--cinema-bg) 8px),
        radial-gradient(circle at 100% 50%, transparent 8px, var(--cinema-bg) 8px);
    pointer-events: none;
    left: -2px; right: -2px;
}
.cinema-create-bar:hover { transform: translateY(-2px); }
.cinema-create-bar:active { transform: translateY(0); }
.ccb-left { display: flex; flex-direction: column; gap: 2px; }
.ccb-big { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; }
.ccb-small { font-size: 9px; letter-spacing: 0.22em; opacity: 0.75; }
.ccb-arrow { font-size: 18px; }

/* 分割线 */
.cinema-divider {
    position: relative;
    height: 14px;
    margin: 0 20px;
    display: flex; align-items: center; justify-content: center;
}
.cinema-divider::before, .cinema-divider::after {
    content: ''; flex: 1; height: 0;
    border-top: 1.5px dashed rgba(229,9,20,0.35);
}
.cinema-divider-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--cinema-bg);
    border: 2px solid var(--cinema-red);
    margin: 0 10px;
}

/* 票根列表标题 */
.cinema-list-title {
    padding: 14px 20px 8px;
    font-size: 10px; letter-spacing: 0.22em; color: var(--cinema-text-dim); text-transform: uppercase;
}
#cinema-ticket-list {
    padding: 0 16px 16px;
    max-height: 40vh; overflow-y: auto;
}
#cinema-ticket-list::-webkit-scrollbar { width: 5px; }
#cinema-ticket-list::-webkit-scrollbar-thumb { background: rgba(229,9,20,0.4); border-radius: 3px; }

/* 历史票根卡片 */
.cinema-ticket-card {
    background: var(--cinema-bg-card);
    border: 1px solid rgba(229,9,20,0.2);
    border-radius: 10px;
    margin-bottom: 10px;
    padding: 12px 14px;
    display: flex; gap: 12px; align-items: center;
    position: relative;
}
.cinema-ticket-card::before,
.cinema-ticket-card::after {
    content: ''; position: absolute; width: 10px; height: 10px; border-radius: 50%;
    background: var(--cinema-bg); top: 50%; transform: translateY(-50%);
}
.cinema-ticket-card::before { left: -5px; }
.cinema-ticket-card::after { right: -5px; }
.cinema-ticket-stub {
    flex: 1; min-width: 0;
}
.cts-perf { font-size: 9px; letter-spacing: 0.25em; color: var(--cinema-gold); opacity: 0.75; }
.cts-movie {
    font-size: 14px; font-weight: 700; margin: 3px 0 6px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cts-row {
    display: flex; justify-content: space-between; gap: 8px;
    font-size: 11px; color: var(--cinema-text-dim);
    padding: 1px 0;
}
.cts-row b { color: var(--cinema-text); font-weight: 600; }
.cts-status {
    font-size: 10px; margin-top: 6px;
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 8px; border-radius: 10px;
    background: rgba(229,9,20,0.15); color: var(--cinema-red);
}
.cinema-ticket-card.watched .cts-status {
    background: rgba(245,197,24,0.15); color: var(--cinema-gold);
}
.cinema-ticket-action { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.cta-enter {
    background: linear-gradient(135deg, var(--cinema-red), var(--cinema-red-dark));
    color: #fff; border: none; border-radius: 8px;
    padding: 8px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    transition: all .18s;
}
.cta-enter:hover { transform: scale(1.03); box-shadow: 0 4px 14px rgba(229,9,20,0.4); }
.cta-delete {
    background: rgba(255,255,255,0.04); color: var(--cinema-text-dim);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
    padding: 6px 10px; font-size: 11px; cursor: pointer;
    transition: all .18s;
}
.cta-delete:hover { background: rgba(229,9,20,0.15); color: var(--cinema-red); border-color: var(--cinema-red); }

.cinema-empty {
    text-align: center; padding: 28px 12px;
    color: var(--cinema-text-dim);
}
.cinema-empty i { font-size: 36px; color: var(--cinema-red); opacity: 0.5; margin-bottom: 10px; }
.cinema-empty div { font-size: 12px; margin-bottom: 4px; }
.cinema-empty-hint { font-size: 10px; opacity: 0.6; }

/* ===== 悬挂播放器 ===== */
#cinema-floating-player {
    position: fixed;
    z-index: 99995;
    width: 360px;
    height: 280px;
    background: #000;
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
        0 0 0 1px rgba(229,9,20,0.5),
        0 20px 60px rgba(0,0,0,0.8),
        0 0 60px rgba(229,9,20,0.18);
    display: flex; flex-direction: column;
    opacity: 0; transform: translateY(12px) scale(.96);
    transition: opacity .3s ease, transform .3s ease;
}
#cinema-floating-player.visible { opacity: 1; transform: none; }
#cinema-floating-player.mini {
    width: 160px; height: 100px;
    border-radius: 50px;
    overflow: hidden;
}
#cinema-floating-player.mini .cfp-header,
#cinema-floating-player.mini .cfp-footer { display: none; }
#cinema-floating-player.mini .cfp-stage { flex: 1; }

.cfp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    background: linear-gradient(135deg, var(--cinema-red-deep), #1a0002);
    cursor: grab; flex-shrink: 0;
}
.cfp-header:active { cursor: grabbing; }
.cfp-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 700;
}
.cfp-title i { color: var(--cinema-gold); font-size: 12px; }
.cfp-title-text { color: #fff; }
.cfp-sub { font-size: 9px; color: rgba(255,255,255,0.55); margin-left: 4px; }
.cfp-controls { display: flex; gap: 3px; }
.cfp-btn {
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: none;
    color: #fff; cursor: pointer; font-size: 11px;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s;
}
.cfp-btn:hover { background: var(--cinema-red); transform: scale(1.1); }

.cfp-stage { flex: 1; background: #000; position: relative; min-height: 0; }
.cfp-stage video, .cfp-stage iframe {
    width: 100%; height: 100%; border: none; object-fit: contain; background: #000;
}

.cfp-footer {
    padding: 6px 12px;
    font-size: 10px; color: rgba(255,255,255,0.6);
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
}
.cfp-footer i { color: var(--cinema-red); }

.cfp-tip {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.85);
    color: #fff; padding: 6px 14px; border-radius: 20px;
    font-size: 11px; opacity: 0;
    transition: opacity .2s;
    pointer-events: none; z-index: 5;
}
.cfp-tip.show { opacity: 1; }

/* ===== 顶部影院按钮 ===== */
.header-action-cinema {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--cinema-red), #8b0509);
    color: #fff; font-size: 14px;
    border: none; cursor: pointer;
    box-shadow: 0 4px 14px rgba(229,9,20,0.45);
    transition: all .18s;
}
.header-action-cinema:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(229,9,20,0.6); }
.header-action-cinema:active { transform: translateY(0); }

/* ===== 主页 app 图标 ===== */
.home-app-cinema .home-app-icon {
    background: linear-gradient(135deg, #e50914 0%, #5a0508 100%);
    box-shadow: 0 6px 18px rgba(229,9,20,0.35);
}
.home-app-cinema .home-app-icon i { color: #fff; }
.home-app-cinema .home-app-label { color: #b00610; }

/* ===== 响应式 ===== */
@media (max-width: 500px) {
    #cinema-floating-player { width: 280px; height: 220px; }
    .cinema-row2 { grid-template-columns: 1fr; }
}
        `;
        const el = document.createElement('style');
        el.id = 'cinema-feature-style';
        el.textContent = css;
        document.head.appendChild(el);
    }

    function injectToolbarBtn() {
        if (document.getElementById('header-cinema-btn')) return;
        const anchor = document.getElementById('settings-btn');
        if (!anchor) return;
        const btn = document.createElement('button');
        btn.id = 'header-cinema-btn';
        btn.className = 'action-btn header-action-cinema';
        btn.title = '私人影院';
        btn.innerHTML = '<i class="fas fa-film"></i>';
        btn.addEventListener('click', openCinemaModal);
        anchor.parentNode.insertBefore(btn, anchor);
    }

    async function init() {
        injectCSS();
        injectToolbarBtn();
        await loadTickets();
        bindForm();
        window.cinemaFeature = { openCinemaModal, closeFloatingPlayer };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();