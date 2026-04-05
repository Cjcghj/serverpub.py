console.log('[SYSTEM] 📦 client.js loaded');

const socket = io({ reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000 });

let myName = '', myId = '', myRole = '', gCode = '';
let isOst = false, myTurn = false, selPic = null;
let currentGuesserSid = null;
let gameFinished = false;
let ostethExpectedRound = null;
let selectedTheme = null;
let gameLaunched = false;

// ⏱️ TURN TIMER
let turnTimer = null;
let turnTimeLeft = 30;
const TURN_TIMEOUT_SEC = 30;

const CK = 'ostedh_player';
const COOKIE_EXP_HOURS = 2;
const log = (...args) => console.log('[GAME]', ...args);

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('osteth-timer-css')) {
        const style = document.createElement('style');
        style.id = 'osteth-timer-css';
        style.textContent = `@keyframes ost-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}} @keyframes ost-flash{0%{background:rgba(231,76,60,0.5)}100%{background:rgba(231,76,60,0.1)}}`;
        document.head.appendChild(style);
    }
    if (!document.getElementById('turn-timer')) {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            const timer = document.createElement('div');
            timer.id = 'turn-timer';
            timer.textContent = '⏱️ 30s';
            Object.assign(timer.style, { textAlign: 'center', fontSize: '22px', fontWeight: 'bold', color: '#2ecc71', padding: '6px', borderRadius: '8px', background: 'rgba(46,204,113,0.15)', border: '2px solid rgba(46,204,113,0.3)', margin: '5px 0', fontFamily: 'monospace', display: 'none', transition: 'all 0.3s ease' });
            gameScreen.insertBefore(timer, gameScreen.firstChild);
        }
    }
});

// [DATA LISTS - UNCHANGED]
const FOOTBALL_PLAYERS = ["lionel messi", "cristiano ronaldo", "kylian mbappe", "erling haaland", "neymar", "kevin de bruyne", "mohamed salah", "vinicius jr", "jude bellingham", "harry kane", "robert lewandowski", "karim benzema", "luka modric", "toni kroos", "pedri", "gavi", "antoine griezmann", "paulo dybala", "lautaro martinez", "sergio ramos", "gerard pique", "thiago silva", "virgil van dijk", "ruben dias", "achraf hakimi", "trent alexander-arnold", "andrew robertson", "marcelo", "dani alves", "manuel neuer", "thibaut courtois", "alisson becker", "ederson", "gianluigi donnarumma", "jan oblak", "petr cech", "iker casillas", "buffon", "david de gea", "ronaldinho", "zinedine zidane", "thierry henry", "ronaldo nazario", "kaka", "andres iniesta", "xavi hernandez", "wayne rooney", "didier drogba", "sergio aguero", "eden hazard", "mesut ozil", "alexis sanchez", "arturo vidal", "ngolo kante", "casemiro", "fabinho", "rodri", "ilkay gundogan", "bruno fernandes", "bernardo silva", "phil foden", "jack grealish", "raheem sterling", "riyad mahrez", "heung min son", "bukayo saka", "marcus rashford", "anthony martial", "jadon sancho", "declan rice", "kai havertz", "mason mount", "christian pulisic", "timo werner", "jamal musiala", "leroy sane", "serge gnabry", "thomas muller", "joshua kimmich", "alphonso davies", "dayot upamecano", "matthijs de ligt", "frenkie de jong", "memphis depay", "hakim ziyech", "gabriel jesus", "gabriel martinelli", "richarlison", "raphinha", "marquinhos", "thiago alcantara", "david silva", "isco", "marco asensio", "federico valverde", "eduardo camavinga", "aurelien tchouameni", "joao felix", "darwin nunez", "luis diaz", "diogo jota", "roberto firmino", "sadio mane", "kalidou koulibaly", "edouard mendy", "victor osimhen", "khvicha kvaratskhelia", "joao cancelo", "ferran torres", "ansu fati", "pedro", "alvaro morata", "gerard moreno", "jordi alba", "sergi roberto", "pepe", "renato sanches", "joao moutinho", "ruben neves", "diogo dalot", "nuno mendes", "vitinha", "romelu lukaku", "zlatan ibrahimovic", "edinson cavani", "luis suarez", "fernando torres", "david villa", "raul", "dennis bergkamp", "yaya toure", "arsene wenger", "pep guardiola", "jurgen klopp"];
const ANIME_DATA = [{ name: 'Naruto', detail: 'Shonen - Ninja (2002)', image: 'https://cdn.myanimelist.net/images/anime/6/73245.jpg' }, { name: 'One Piece', detail: 'Shonen - Pirates (1999)', image: 'https://cdn.myanimelist.net/images/anime/12/76049.jpg' }, { name: 'Dragon Ball Z', detail: 'Shonen - Fighting (1989)', image: 'https://cdn.myanimelist.net/images/anime/13/17405.jpg' }, { name: 'Attack on Titan', detail: 'Action - Dark (2013)', image: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg' }, { name: 'Demon Slayer', detail: 'Shonen - Demons (2019)', image: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg' }, { name: 'My Hero Academia', detail: 'Shonen - Heroes (2016)', image: 'https://cdn.myanimelist.net/images/anime/10/78745.jpg' }];
const ANIMALS = [{ name: 'Lion', detail: 'King of the Jungle', image: 'https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=400&h=400&fit=crop' }, { name: 'Tiger', detail: 'Bengal Tiger', image: 'https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=400&h=400&fit=crop' }, { name: 'Elephant', detail: 'African Elephant', image: 'https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?w=400&h=400&fit=crop' }, { name: 'Panda', detail: 'Giant Panda', image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&h=400&fit=crop' }, { name: 'Zebra', detail: 'Plains Zebra', image: 'https://images.unsplash.com/photo-1470093851219-69951fcbb533?w=400&h=400&fit=crop' }, { name: 'Giraffe', detail: 'Masai Giraffe', image: 'https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=400&h=400&fit=crop' }];
const FOOD = [{ name: 'Pizza', detail: 'Italian Classic', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop' }, { name: 'Burger', detail: 'American Fast Food', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop' }, { name: 'Sushi', detail: 'Japanese Cuisine', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop' }, { name: 'Pasta', detail: 'Italian Dish', image: 'https://images.unsplash.com/photo-1551183053-bf91b1dca034?w=400&h=400&fit=crop' }, { name: 'Tacos', detail: 'Mexican Street Food', image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=400&fit=crop' }, { name: 'Ramen', detail: 'Japanese Noodles', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop' }];

// [UTILS & SCREENS - UNCHANGED]
function calculateAge(birthDate) { if (!birthDate) return 'N/A'; const b = new Date(birthDate); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); const m = t.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--; return a; }
function setCKObj(key, obj, hours) { const e = new Date(); e.setTime(e.getTime() + (hours || COOKIE_EXP_HOURS) * 3600 * 1000); document.cookie = `${key}=${encodeURIComponent(JSON.stringify(obj))};expires=${e.toUTCString()};path=/`; }
function getCKObj(key) { const v = `; ${document.cookie}`, parts = v.split(`; ${key}=`); if (parts.length === 2) { try { return JSON.parse(decodeURIComponent(parts.pop().split(';')[0])); } catch (e) { return null; } } return null; }
function clearGameCookie() { const s = getCKObj(CK) || {}; delete s.code; delete s.role; delete s.ts; setCKObj(CK, s, COOKIE_EXP_HOURS); }
function hasShownScoreboardForGame(code) { return sessionStorage.getItem(`shown_sb_${code}`) === 'true'; }
function markScoreboardShown(code) { sessionStorage.setItem(`shown_sb_${code}`, 'true'); }
function clearShownScoreboard(code) { sessionStorage.removeItem(`shown_sb_${code}`); }

const sc = { reg: document.getElementById('register-screen'), lob: document.getElementById('lobby-screen'), ost: document.getElementById('ostedh-screen'), game: document.getElementById('game-screen'), theme: document.getElementById('theme-screen') };
function show(s) { log('📺 Showing screen:', s); document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active')); const t = sc[s] || document.getElementById(s); if (t) t.classList.add('active'); }
function chat(t, type = 'norm') { const c = document.getElementById('chat'); if (!c) return; const e = document.createElement('div'); e.className = `ce ${type}`; e.textContent = t; c.appendChild(e); c.scrollTop = c.scrollHeight; }

// ⏱️ TURN TIMER LOGIC
function startTurnTimer() {
    console.log('[TIMER] 🟢 Turn timer STARTED');
    clearTurnTimer();
    turnTimeLeft = TURN_TIMEOUT_SEC;
    updateTurnTimerDisplay();
    document.getElementById('turn-timer').style.display = 'block';
    turnTimer = setInterval(() => {
        turnTimeLeft--;
        updateTurnTimerDisplay();
        if (turnTimeLeft <= 0) handleTurnTimeout();
    }, 1000);
}

function clearTurnTimer() {
    if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
    const el = document.getElementById('turn-timer');
    if (el) el.style.display = 'none';
}

function updateTurnTimerDisplay() {
    const el = document.getElementById('turn-timer');
    if (!el) return;
    el.textContent = `⏱️ ${turnTimeLeft}s`;
    el.style.animation = 'none';
    if (turnTimeLeft <= 5) { el.style.color = '#e74c3c'; el.style.background = 'rgba(231,76,60,0.2)'; el.style.borderColor = 'rgba(231,76,60,0.5)'; el.style.animation = 'ost-pulse 0.5s infinite'; }
    else if (turnTimeLeft <= 10) { el.style.color = '#f39c12'; el.style.background = 'rgba(243,156,18,0.15)'; el.style.borderColor = 'rgba(243,156,18,0.4)'; }
    else { el.style.color = '#2ecc71'; el.style.background = 'rgba(46,204,113,0.15)'; el.style.borderColor = 'rgba(46,204,113,0.3)'; }
}

// ✅ TOKEN-BASED TIMEOUT
function handleTurnTimeout() {
    console.log('[TIMER] ⏰ Turn timed out! Emitting token to server...');
    clearTurnTimer();
    chat('⏰ Time\'s up! Turn passed.', 'sys');
    // 🎫 SEND TOKEN TO SERVER
    socket.emit('turn_expired_token', { code: gCode, player_id: myId });
    myTurn = false;
    document.getElementById('ctrls').style.display = 'none';
    document.getElementById('turn-ind').textContent = 'Waiting...';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// 🔍 TEST: window.testTurnTimer()
window.testTurnTimer = () => { console.log('[TIMER] 🧪 Test'); myTurn = true; document.getElementById('ctrls').style.display = 'block'; document.getElementById('turn-ind').textContent = "✅ YOUR turn!"; startTurnTimer(); };

socket.on('connect', () => log('✅ Connected'));
socket.on('disconnect', () => log('❌ Disconnected'));
socket.on('reconnect', (n) => { log('🔄 Reconnected after', n); clearTurnTimer(); if (gCode) setTimeout(() => socket.emit('request_state', { code: gCode }), 500); });

window.addEventListener('load', () => {
    log('🔄 Page loaded');
    const saved = getCKObj(CK);
    if (saved?.name && saved?.playerId) {
        const now = Date.now();
        if (saved.code && saved.ts && (now - saved.ts) < COOKIE_EXP_HOURS * 3600 * 1000) {
            myName = saved.name; myId = saved.playerId; myRole = saved.role || 'user'; gCode = saved.code;
            document.getElementById('saved-name').textContent = myName; document.getElementById('saved-id').textContent = myId;
            document.getElementById('welcome-back').style.display = 'block'; document.getElementById('new-reg').style.display = 'none';
            socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode });
            document.getElementById('dname').textContent = myName; document.getElementById('did').textContent = myId; return;
        } else {
            myName = saved.name; myId = saved.playerId;
            document.getElementById('saved-name').textContent = myName; document.getElementById('saved-id').textContent = myId;
            document.getElementById('welcome-back').style.display = 'block'; document.getElementById('new-reg').style.display = 'none';
            delete saved.code; delete saved.role; delete saved.ts; setCKObj(CK, saved, COOKIE_EXP_HOURS);
        }
    }
    log('ℹ️ No saved game - showing registration');
});

document.getElementById('use-saved-btn').onclick = () => { const s = getCKObj(CK); if (s) { myName = s.name; myId = s.playerId; document.getElementById('dname').textContent = myName; document.getElementById('did').textContent = myId; show('lob'); } };
document.getElementById('new-name-btn').onclick = () => { document.getElementById('welcome-back').style.display = 'none'; document.getElementById('new-reg').style.display = 'block'; document.getElementById('name-input').value = ''; };
document.getElementById('register-btn').onclick = async () => { const n = document.getElementById('name-input').value.trim(); if (!n || n.length < 2) { document.getElementById('reg-err').textContent = 'Name too short!'; return; } try { const r = await fetch('/api/generate-id', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); const d = await r.json(); myName = n; myId = d.player_id; setCKObj(CK, { name: myName, playerId: myId }, COOKIE_EXP_HOURS); document.getElementById('dname').textContent = myName; document.getElementById('did').textContent = myId; show('lob'); } catch (e) { document.getElementById('reg-err').textContent = 'Failed'; } };
document.getElementById('create-btn').onclick = () => { if (!myName || !myId) { alert('Register first!'); return; } show('theme'); selectedTheme = null; document.getElementById('selected-theme-info').style.display = 'none'; document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected')); };
document.getElementById('join-btn').onclick = () => { if (!myName || !myId) { alert('Register first!'); return; } gCode = document.getElementById('join-code').value.trim().toUpperCase(); if (!gCode || gCode.length !== 5) { alert('Valid 5-digit code!'); return; } myRole = 'user'; log('Joining:', gCode); setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS); socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode }); };
document.getElementById('quit-btn').onclick = () => { if (!gCode) { alert('No active game!'); return; } if (!confirm('Quit?')) return; socket.emit('quit_game', { code: gCode }); clearTurnTimer(); clearGameCookie(); clearShownScoreboard(gCode); gCode = ''; myRole = ''; isOst = false; myTurn = false; gameFinished = false; gameLaunched = false; setTimeout(() => location.reload(), 500); };
document.getElementById('leave-btn').onclick = () => { clearTurnTimer(); clearGameCookie(); clearShownScoreboard(gCode); location.reload(); };

function selectTheme(theme) { document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected')); event.currentTarget.classList.add('selected'); selectedTheme = theme; const n = { 'football': '⚽ Football', 'anime': '🎌 Anime', 'animals': '🦁 Animals', 'food': '🍕 Food', 'random': '🎲 Random Mix' }; document.getElementById('theme-name-display').textContent = n[theme]; document.getElementById('selected-theme-info').style.display = 'block'; }
document.getElementById('create-room-btn').onclick = () => { if (!selectedTheme) { alert('Select theme!'); return; } gCode = Math.floor(10000 + Math.random() * 90000).toString(); myRole = 'admin'; log('Creating:', selectedTheme); setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS); socket.emit('create_room_with_theme', { name: myName, player_id: myId, role: 'admin', code: gCode, theme: selectedTheme }); };

socket.on('room_created_with_theme', d => { log('Room created'); document.getElementById('lobby-cho').style.display = 'none'; document.getElementById('in-lobby').style.display = 'block'; document.getElementById('lcode').textContent = d.code; document.getElementById('lrole').textContent = '👑 Admin'; document.getElementById('admin-ctl').style.display = 'block'; document.getElementById('lstat').textContent = 'Waiting...'; const i = { 'football': '⚽', 'anime': '🎌', 'animals': '🦁', 'food': '🍕', 'random': '🎲' }; const td = document.getElementById('room-theme-display'); td.style.display = 'block'; td.innerHTML = `<strong>Theme:</strong> ${i[d.theme] || '🎲'} ${d.theme.charAt(0).toUpperCase() + d.theme.slice(1)}`; show('lob'); });
socket.on('registered', d => { log('Registered'); gCode = d.code; myRole = d.role; document.getElementById('lobby-cho').style.display = 'none'; document.getElementById('in-lobby').style.display = 'block'; document.getElementById('lcode').textContent = d.code; document.getElementById('lrole').textContent = d.role === 'admin' ? '👑 Admin' : '🎮 Player'; if (d.role === 'admin') document.getElementById('admin-ctl').style.display = 'block'; const s = getCKObj(CK) || {}; s.name = myName; s.playerId = myId; s.code = gCode; s.role = myRole; s.ts = Date.now(); setCKObj(CK, s, COOKIE_EXP_HOURS); setTimeout(() => socket.emit('request_state', { code: gCode }), 300); });
socket.on('player_joined', d => { const p = document.getElementById('pul'); if (!p || p.querySelector(`[data-pid="${d.id}"]`)) return; const l = document.createElement('li'); l.innerHTML = `<span>${d.name}</span><span class="pid" data-pid="${d.id}">${d.id}</span>`; p.appendChild(l); updatePlayerCount(); });
socket.on('player_left', d => { const p = document.getElementById('pul'); if (!p) return; const l = p.querySelector(`[data-pid="${d.id}"]`); if (l) l.remove(); updatePlayerCount(); chat(`🚪 ${d.name} left`, 'sys'); });
socket.on('players_list', d => { const p = document.getElementById('pul'); if (!p || !Array.isArray(d.players)) return; p.innerHTML = ''; d.players.forEach(pl => { const l = document.createElement('li'); l.innerHTML = `<span>${pl.name}</span><span class="pid" data-pid="${pl.id}">${pl.id}</span>`; p.appendChild(l); }); updatePlayerCount(); });
function updatePlayerCount() { const p = document.getElementById('pul'); const c = p ? p.querySelectorAll('li').length : 0; const ce = document.getElementById('player-count'); const ls = document.getElementById('lstat'); const lb = document.getElementById('launch-btn'); if (ce) ce.textContent = c; if (c >= 1) { if (ls) ls.textContent = `✅ Ready! (${c + 1} total)`; if (lb) lb.disabled = false; } else { if (ls) ls.textContent = '⚠️ Need at least 1 player!'; if (lb) lb.disabled = true; } }
socket.on('register_error', d => { log('Reg error'); alert(d.message); document.getElementById('lobby-cho').style.display = 'block'; document.getElementById('in-lobby').style.display = 'none'; });
socket.on('ready_to_launch', () => { log('Ready'); updatePlayerCount(); });
document.getElementById('launch-btn').onclick = () => { const p = document.getElementById('pul'); const c = p ? p.querySelectorAll('li').length : 0; if (c < 1) { alert('Need 1+ player!'); return; } socket.emit('launch_game', { code: gCode }); };
socket.on('launch_error', d => { alert(d.message); });
socket.on('game_launched', () => { chat('🎮 Started!', 'sys'); gameLaunched = true; });

async function loadOstethPictures(theme) {
    let pics = [];
    if (theme === 'football') { const s = [...FOOTBALL_PLAYERS].sort(() => 0.5 - Math.random()).slice(0, 3); for (const pl of s) { try { const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${pl}`); const d = await r.json(); if (d.player && d.player[0]) { const p = d.player[0]; pics.push({ url: p.strCutout || p.strThumb, name: p.strPlayer, detail: `${p.strTeam || 'Unknown'}\n${p.strNationality || 'Unknown'} • ${calculateAge(p.dateBorn)}`, apiSource: 'thesportsdb' }); } else { pics.push({ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(pl)}&size=400&background=random&color=fff&bold=true`, name: pl.charAt(0).toUpperCase() + pl.slice(1), detail: 'API Unavailable', apiSource: 'avatar' }); } } catch (e) { pics.push({ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(pl)}&size=400&background=random&color=fff&bold=true`, name: pl.charAt(0).toUpperCase() + pl.slice(1), detail: 'Failed', apiSource: 'avatar' }); } } }
    else if (theme === 'anime') { const s = [...ANIME_DATA].sort(() => 0.5 - Math.random()); pics = s.slice(0, 3).map(a => ({ url: a.image, name: a.name, detail: a.detail, apiSource: 'direct' })); }
    else if (theme === 'animals') { const s = [...ANIMALS].sort(() => 0.5 - Math.random()); pics = s.slice(0, 3).map(a => ({ url: a.image, name: a.name, detail: a.detail, apiSource: 'direct' })); }
    else if (theme === 'food') { const s = [...FOOD].sort(() => 0.5 - Math.random()); pics = s.slice(0, 3).map(f => ({ url: f.image, name: f.name, detail: f.detail, apiSource: 'direct' })); }
    else { for (let i = 0; i < 3; i++)pics.push({ url: `https://picsum.photos/400?random=${Date.now() + i}`, name: `Random ${i + 1}`, detail: 'Mystery', apiSource: 'direct' }); }
    for (let i = 0; i < 3; i++) { const img = document.getElementById(`p${i + 1}`); if (img && pics[i]) { img.dataset.url = pics[i].url; img.dataset.name = pics[i].name; img.dataset.detail = pics[i].detail; img.dataset.apiSource = pics[i].apiSource; img.src = pics[i].url; img.onerror = () => { img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(pics[i].name)}&size=400&background=random&color=fff&bold=true`; }; img.onclick = () => { document.querySelectorAll('.popt').forEach(p => p.classList.remove('sel')); img.classList.add('sel'); selPic = i + 1; }; } }
}

socket.on('you_are_ostedh', d => { log('You are Osteth'); isOst = true; show('ost'); selPic = null; const v = document.getElementById('osteth-view-pic-btn'); if (v) v.style.display = 'block'; loadOstethPictures(d.theme || 'random'); });

async function uploadImageForOsteth(el) {
    const url = el.dataset.url, src = el.dataset.apiSource;
    try { if (src === 'thesportsdb' || src === 'direct') { const r = await fetch('/api/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ external_url: url, code: gCode }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.url; } const c = document.createElement('canvas'); c.width = el.naturalWidth || 400; c.height = el.naturalHeight || 400; c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); const b = await new Promise((res, rej) => c.toBlob(bl => bl ? res(bl) : rej(new Error('null')), 'image/jpeg', 0.9)); const f = new FormData(); f.append('image', b, 'chosen.jpg'); f.append('code', gCode); const r = await fetch('/api/upload-image', { method: 'POST', body: f }); const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.url; } catch (e) { console.error('Upload err:', e); const r = await fetch('/api/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ external_url: url, code: gCode }) }); return (await r.json()).url; }
}

document.getElementById('conf-ost').onclick = async () => {
    if (!selPic) { alert('Pick a picture!'); return; } const img = document.getElementById(`p${selPic}`); if (!img.complete || img.naturalWidth === 0) { alert('Image not loaded!'); return; }
    let er = parseInt(document.getElementById('exp-r').value) || 10; if (er > 30) { er = 30; document.getElementById('exp-r').value = 30; alert('Max 30!'); } if (er < 1) { er = 1; document.getElementById('exp-r').value = 1; }
    try { const su = await uploadImageForOsteth(img); document.getElementById('ostedh-img').src = su; document.getElementById('ostedh-picked').style.display = 'block'; ostethExpectedRound = er; socket.emit('ostedh_ready', { code: gCode, expected_tour: er, image_url: su, picture_name: img.dataset.name || '', picture_detail: img.dataset.detail || '' }); show('game'); } catch (err) { console.error(err); alert('Upload failed'); const su = await uploadImageForOsteth(img); document.getElementById('ostedh-img').src = su; socket.emit('ostedh_ready', { code: gCode, expected_tour: er, image_url: su, picture_name: img.dataset.name || '', picture_detail: img.dataset.detail || '' }); show('game'); }
};

socket.on('ostedh_is', d => chat(`🎭 ${d.name} is Osteth`, 'sys'));
socket.on('game_start', d => { chat(`🚀 ${d.message}`, 'sys'); show('game'); gameFinished = false; clearTurnTimer(); });
socket.on('round_update', d => document.getElementById('rnd').textContent = d.round);

// ⏱️ TURN HANDLERS
socket.on('turn_update', d => {
    const el = document.getElementById('turn-ind');
    if (d.current === myName && !isOst) {
        el.textContent = "✅ YOUR turn!"; el.style.background = 'rgba(39,174,96,0.3)';
        myTurn = true; document.getElementById('ctrls').style.display = 'block';
        startTurnTimer();
    } else {
        el.textContent = d.current ? `🎯 ${d.current}'s turn` : 'Waiting...';
        el.style.background = 'rgba(74,105,189,0.3)';
        myTurn = false; document.getElementById('ctrls').style.display = 'none';
        clearTurnTimer();
    }
});
socket.on('your_turn', () => { myTurn = true; document.getElementById('ctrls').style.display = 'block'; document.getElementById('turn-ind').textContent = "✅ YOUR turn!"; startTurnTimer(); });
socket.on('score_update', d => { if (d.name === myName) document.getElementById('mscore').textContent = `Score: ${d.score}`; });

// MODALS
document.getElementById('ask-btn').onclick = () => { document.getElementById('q-modal').style.display = 'flex'; document.getElementById('q-in').value = ''; };
document.getElementById('send-q').onclick = () => { clearTurnTimer(); const q = document.getElementById('q-in').value.trim(); if (q) socket.emit('ask_question', { code: gCode, question: q }); document.getElementById('q-modal').style.display = 'none'; myTurn = false; document.getElementById('ctrls').style.display = 'none'; };
document.getElementById('cancel-q').onclick = () => { document.getElementById('q-modal').style.display = 'none'; };
document.getElementById('guess-btn').onclick = () => { document.getElementById('g-modal').style.display = 'flex'; document.getElementById('g-in').value = ''; };
document.getElementById('send-g').onclick = () => { clearTurnTimer(); const g = document.getElementById('g-in').value.trim(); if (g) socket.emit('try_guess', { code: gCode, guess: g }); document.getElementById('g-modal').style.display = 'none'; myTurn = false; document.getElementById('ctrls').style.display = 'none'; };
document.getElementById('cancel-g').onclick = () => { document.getElementById('g-modal').style.display = 'none'; };
socket.on('question_asked', d => chat(`[Q] ${d.asker}: ${d.question}`, 'q'));
socket.on('answer_given', d => { const a = d.answer === 'YES' ? '✅ YES' : '❌ NO'; chat(`[A] Osteth: ${a} (Q: ${d.question || ''})`, 'a'); });
socket.on('guess_submitted', d => chat(`🎯 ${d.guesser}: "${d.guess}"`, 'norm'));
socket.on('guess_result', d => { const r = d.decision === 'yes' ? '✅ CORRECT!' : '❌ WRONG'; chat(`📝 ${d.guesser} -> ${r}`, d.decision === 'yes' ? 'win' : 'norm'); });
socket.on('guess_for_you', d => { document.getElementById('g-asker').textContent = d.guesser; document.getElementById('g-txt').textContent = d.guess; document.getElementById('ost-guess-modal').style.display = 'flex'; currentGuesserSid = d.guesser_sid; });
document.getElementById('g-y').onclick = () => { if (!currentGuesserSid) return alert('Err'); socket.emit('guess_decision', { code: gCode, decision: 'yes', guesser_sid: currentGuesserSid }); document.getElementById('ost-guess-modal').style.display = 'none'; currentGuesserSid = null; };
document.getElementById('g-n').onclick = () => { if (!currentGuesserSid) return alert('Err'); socket.emit('guess_decision', { code: gCode, decision: 'no', guesser_sid: currentGuesserSid }); document.getElementById('ost-guess-modal').style.display = 'none'; currentGuesserSid = null; };
socket.on('game_won', d => chat(`🏆 ${d.winner} WON!`, 'win'));
socket.on('game_over', data => { log('Game over'); gameFinished = true; clearTurnTimer(); clearGameCookie(); showScoreboardOverlay(data); });

document.getElementById('osteth-view-pic-btn').onclick = () => { if (!isOst || !gCode) { alert('Only Osteth!'); return; } socket.emit('osteth_view_picture', { code: gCode }); };
socket.on('osteth_picture', data => { if (!data.picture_url) return; const m = document.getElementById('osteth-picture-modal'); const mc = m.querySelector('.mc'); let dh = `<div style="background:rgba(255,215,0,0.2);padding:15px;border-radius:10px;margin:15px 0;"><p style="font-size:14px;color:#ffd700;">🎯 Expected Round</p><p style="font-size:28px;font-weight:bold;color:#fff;">${data.expected_round || '?'}</p></div>`; if (data.description) dh += `<div style="background:rgba(255,255,255,0.1);padding:10px;border-radius:8px;margin:10px 0;"><p style="font-size:12px;color:#aaa;white-space:pre-line;">${data.description}</p></div>`; mc.innerHTML = `<h3>🖼️ Secret Picture</h3><img src="${data.picture_url}" style="max-width:100%;border-radius:12px;margin:15px 0;">${dh}<button id="close-osteth-pic" class="btn-sec">Close</button>`; document.getElementById('close-osteth-pic').onclick = () => { m.style.display = 'none'; }; m.style.display = 'flex'; });
socket.on('osteth_picture_error', d => alert(d.error));

function showScoreboardOverlay(data) { const o = document.getElementById('scoreboard-overlay'); const s = document.getElementById('overlay-sb'); const w = document.getElementById('winner-banner'); const t = document.getElementById('overlay-title'); const cb = document.getElementById('close-sb-btn'); s.innerHTML = ''; if (Array.isArray(data.scoreboard)) data.scoreboard.forEach(r => { const d = document.createElement('div'); d.className = 'sb-row' + (r.name === myName ? ' you' : ''); d.innerHTML = `<div><strong>${r.rank}. ${r.name}${r.name === myName ? ' (You)' : ''}</strong></div><div class="sb-pts">${r.score} pts</div>`; s.appendChild(d); }); t.textContent = data.winner ? `🏆 ${data.winner} Wins!` : '🏆 Game Ended'; if (data.ostedh_image_url) { w.style.display = 'block'; w.innerHTML = `<img src="${data.ostedh_image_url}" style="max-width:150px;border-radius:12px;">`; cb.textContent = '🏠 Return to Lobby'; } else { w.style.display = 'none'; cb.textContent = '❌ Close'; } o.style.display = 'flex'; }
document.getElementById('view-sb-btn').onclick = async () => { if (!gCode) { alert('No game'); return; } try { const r = await fetch(`/api/scoreboard/${gCode}`); const d = await r.json(); if (!r.ok) { alert(d.error); return; } showScoreboardOverlay(d); } catch (e) { alert('Failed'); } };
document.getElementById('close-sb-btn').onclick = () => { document.getElementById('scoreboard-overlay').style.display = 'none'; if (document.getElementById('close-sb-btn').textContent.includes('Lobby')) setTimeout(() => location.reload(), 100); };

socket.on('reconnect_state', state => { log('📡 Reconnect state'); clearTurnTimer(); if (hasShownScoreboardForGame(gCode)) { show('lob'); return; } if (state.game_started && !state.winner) { show('game'); document.getElementById('rnd').textContent = state.current_tour || 1; const el = document.getElementById('turn-ind'); if (state.current_player_name === myName && !isOst) { el.textContent = "✅ YOUR turn!"; el.style.background = 'rgba(39,174,96,0.3)'; myTurn = true; document.getElementById('ctrls').style.display = 'block'; startTurnTimer(); } else { el.textContent = state.current_player_name ? `🎯 ${state.current_player_name}'s turn` : 'Waiting...'; el.style.background = 'rgba(74,105,189,0.3)'; myTurn = false; document.getElementById('ctrls').style.display = 'none'; } if (state.ostedh_name === myName) { isOst = true; const v = document.getElementById('osteth-view-pic-btn'); if (v) v.style.display = 'block'; } if (Array.isArray(state.scoreboard)) state.scoreboard.forEach(r => { if (r.name === myName) document.getElementById('mscore').textContent = `Score: ${r.score}`; }); } else if (state.winner) { markScoreboardShown(gCode); showScoreboardOverlay(state); } else if (state.ostedh_name === myName && !state.game_started) { isOst = true; show('ost'); } else { show('lob'); } });

window.onclick = (e) => { const modals = ['q-modal', 'g-modal', 'ost-guess-modal', 'osteth-picture-modal', 'ost-ans-modal']; modals.forEach(id => { const m = document.getElementById(id); if (e.target === m) m.style.display = 'none'; }); };
