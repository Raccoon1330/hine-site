/**
 * cloud-sync.js - GitHub Gist 外观+数据同步模块
 * 同步内容：名字、头像、主题配色、聊天背景、纪念日、自定义回复/字卡、开屏次数等
 * 不同步：聊天记录（本地独立保留）
 */
(function (global) {
    'use strict';

    var GIST_API = 'https://api.github.com/gists';

    function getPrefix() {
        return (typeof APP_PREFIX !== 'undefined' ? APP_PREFIX : 'CHAT_APP_V3_');
    }

    function getSessionId() {
        return (typeof SESSION_ID !== 'undefined' && SESSION_ID) ? SESSION_ID : 'default';
    }

    function getSessionKey(base) {
        return getPrefix() + getSessionId() + '_' + base;
    }

    function getGlobalKey(base) {
        return getPrefix() + base;
    }

    function safeGetItem(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    }

    function safeSetItem(key, val) {
        try {
            if (typeof val === 'object') val = JSON.stringify(val);
            localStorage.setItem(key, val);
        } catch(e) {}
    }

    function hashPassword(pwd) {
        if (!pwd) return 'default';
        var h = 0;
        for (var i = 0; i < pwd.length; i++) {
            h = ((h << 5) - h + pwd.charCodeAt(i)) | 0;
        }
        return Math.abs(h).toString(36);
    }

    async function packAppearanceData() {
        var prefix = getPrefix();
        var sessionId = getSessionId();

        var sessionKeys = [
            'chatSettings',
            'partnerAvatar',
            'myAvatar',
            'chatBackground',
            'backgroundGallery',
            'anniversaries',
            'customReplies',
            'customReplyGroups',
            'customPokes',
            'customPokeGroups',
            'customStatuses',
            'customStatusGroups',
            'customMottos',
            'customIntros',
            'customEmojis',
            'partnerPersonas',
            'myStickerLibrary',
            'stickerLibrary'
        ];

        var globalKeys = [
            'customThemes',
            'themeSchemes',
            'mission_count',
            'mission_log'
        ];

        var data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            sessionId: sessionId,
            sessionItems: {},
            globalItems: {}
        };

        for (var i = 0; i < sessionKeys.length; i++) {
            var key = sessionKeys[i];
            var fullKey = prefix + sessionId + '_' + key;
            try {
                var val = await localforage.getItem(fullKey);
                if (val !== null && val !== undefined) {
                    data.sessionItems[key] = val;
                }
            } catch(e) {}
        }

        for (var j = 0; j < globalKeys.length; j++) {
            var gk = globalKeys[j];
            var fullGk = prefix + gk;
            try {
                var gval = await localforage.getItem(fullGk);
                if (gval !== null && gval !== undefined) {
                    data.globalItems[gk] = gval;
                }
            } catch(e) {}
        }

        return data;
    }

    async function unpackAndApplyAppearance(data) {
        if (!data) throw new Error('同步数据为空');
        
        var prefix = getPrefix();
        var sessionId = getSessionId();

        var sessionItems = data.version === 2 ? (data.sessionItems || {}) : (data.items || {});
        var globalItems = data.globalItems || {};

        for (var key in sessionItems) {
            if (!sessionItems.hasOwnProperty(key)) continue;
            var fullKey = prefix + sessionId + '_' + key;
            try {
                await localforage.setItem(fullKey, sessionItems[key]);
            } catch(e) { console.warn('sync apply error:', key, e); }

            if (key === 'chatSettings') {
                if (typeof settings !== 'undefined' && sessionItems[key] && typeof sessionItems[key] === 'object') {
                    Object.assign(settings, sessionItems[key]);
                }
            }
        }

        for (var gk in globalItems) {
            if (!globalItems.hasOwnProperty(gk)) continue;
            var fullGk = prefix + gk;
            try {
                await localforage.setItem(fullGk, globalItems[gk]);
            } catch(e) { console.warn('sync apply error:', gk, e); }
        }

        if (typeof loadFromStorage === 'function') {
            try { loadFromStorage(); } catch(e) {}
        }
        
        if (typeof location !== 'undefined' && location.reload) {
            setTimeout(function() { location.reload(); }, 800);
        }
    }

    async function uploadToGist(token, password) {
        if (!token) throw new Error('请先填写 GitHub Token');
        
        var data = await packAppearanceData();
        var pwdHash = hashPassword(password || '');
        
        var body = {
            description: 'HINE 外观同步 - ' + pwdHash + ' - ' + new Date().toLocaleString(),
            public: false,
            files: {
                'appearance.json': {
                    content: JSON.stringify(data, null, 2)
                }
            }
        };

        var gistId = safeGetItem('cloud_sync_gist_id_' + pwdHash);
        var url = gistId ? (GIST_API + '/' + gistId) : GIST_API;
        var method = gistId ? 'PATCH' : 'POST';

        var resp = await fetch(url, {
            method: method,
            headers: {
                'Authorization': 'token ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            var errText = await resp.text();
            throw new Error('Gist API 错误 (' + resp.status + '): ' + errText);
        }

        var result = await resp.json();
        var newGistId = result.id;
        safeSetItem('cloud_sync_gist_id_' + pwdHash, newGistId);
        
        return { success: true, gistId: newGistId, created: !gistId };
    }

    async function listMyGists(token) {
        if (!token) throw new Error('请先填写 GitHub Token');
        
        var resp = await fetch(GIST_API + '?per_page=100', {
            headers: {
                'Authorization': 'token ' + token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!resp.ok) {
            var errText = await resp.text();
            throw new Error('Gist API 错误 (' + resp.status + '): ' + errText);
        }

        return await resp.json();
    }

    async function downloadFromGist(token, password) {
        if (!token) throw new Error('请先填写 GitHub Token');
        
        var pwdHash = hashPassword(password || '');
        var gistId = safeGetItem('cloud_sync_gist_id_' + pwdHash);

        if (!gistId) {
            var gists = await listMyGists(token);
            for (var i = 0; i < gists.length; i++) {
                var g = gists[i];
                if (g.description && g.description.indexOf(pwdHash) !== -1) {
                    gistId = g.id;
                    safeSetItem('cloud_sync_gist_id_' + pwdHash, gistId);
                    break;
                }
            }
        }

        if (!gistId) throw new Error('未找到对应的同步数据，请先在另一台设备上上传外观');

        var resp = await fetch(GIST_API + '/' + gistId, {
            headers: {
                'Authorization': 'token ' + token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!resp.ok) {
            var errText = await resp.text();
            throw new Error('Gist API 错误 (' + resp.status + '): ' + errText);
        }

        var gistData = await resp.json();
        var file = gistData.files && gistData.files['appearance.json'];
        if (!file || !file.content) throw new Error('Gist 中无外观数据');

        var appearance = JSON.parse(file.content);
        await unpackAndApplyAppearance(appearance);
        
        return { success: true, gistId: gistId };
    }

    async function testToken(token) {
        if (!token) return { valid: false, reason: 'Token 为空' };
        
        try {
            var resp = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!resp.ok) {
                var body = await resp.json().catch(function() { return {}; });
                return { valid: false, reason: body.message || ('HTTP ' + resp.status) };
            }

            var user = await resp.json();
            return { valid: true, login: user.login };
        } catch(e) {
            return { valid: false, reason: e.message };
        }
    }

    global.CloudSync = {
        pack: packAppearanceData,
        unpack: unpackAndApplyAppearance,
        upload: uploadToGist,
        download: downloadFromGist,
        testToken: testToken,
        hashPassword: hashPassword
    };

})(typeof window !== 'undefined' ? window : this);