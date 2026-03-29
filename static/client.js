const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

let myName = '', myId = '', myRole = '', gCode = '';
let isOst = false, myTurn = false, selPic = null;
let currentGuesserSid = null;
let gameFinished = false;
let ostethExpectedRound = null;
let selectedTheme = null;
let gameLaunched = false;

const CK = 'ostedh_player';
const COOKIE_EXP_HOURS = 8760; 

const log = (...args) => console.log('[GAME]', ...args);

const FOOTBALL_PLAYERS = [
    "lionel messi","cristiano ronaldo","kylian mbappe","erling haaland","neymar",
    "kevin de bruyne","mohamed salah","vinicius jr","jude bellingham","harry kane",
    "robert lewandowski","karim benzema","luka modric","toni kroos","pedri",
    "gavi","antoine griezmann","paulo dybala","lautaro martinez",
    "sergio ramos","gerard pique","thiago silva","virgil van dijk","ruben dias",
    "achraf hakimi","trent alexander-arnold","andrew robertson","marcelo","dani alves",
    "manuel neuer","thibaut courtois","alisson becker","ederson","gianluigi donnarumma",
    "jan oblak","petr cech","iker casillas","buffon","david de gea",
    "ronaldinho","zinedine zidane","thierry henry","ronaldo nazario","kaka",
    "andres iniesta","xavi hernandez","wayne rooney","didier drogba",
    "sergio aguero","eden hazard","mesut ozil","alexis sanchez","arturo vidal",
    "ngolo kante","casemiro","fabinho","rodri","ilkay gundogan","bruno fernandes",
    "bernardo silva","phil foden","jack grealish","raheem sterling","riyad mahrez",
    "heung min son","bukayo saka","marcus rashford","anthony martial","jadon sancho",
    "declan rice","kai havertz","mason mount","christian pulisic","timo werner",
    "jamal musiala","leroy sane","serge gnabry","thomas muller","joshua kimmich",
    "alphonso davies","dayot upamecano","matthijs de ligt","frenkie de jong","memphis depay",
    "hakim ziyech","gabriel jesus","gabriel martinelli","richarlison","raphinha",
    "marquinhos","thiago alcantara","david silva","isco","marco asensio",
    "federico valverde","eduardo camavinga","aurelien tchouameni","joao felix",
    "darwin nunez","luis diaz","diogo jota","roberto firmino","sadio mane",
    "kalidou koulibaly","edouard mendy","victor osimhen","khvicha kvaratskhelia",
    "joao cancelo","ferran torres","ansu fati","pedro","alvaro morata","gerard moreno",
    "jordi alba","sergi roberto","pepe","renato sanches","joao moutinho","ruben neves",
    "diogo dalot","nuno mendes","vitinha","romelu lukaku","zlatan ibrahimovic",
    "edinson cavani","luis suarez","fernando torres","david villa","raul",
    "dennis bergkamp","yaya toure","arsene wenger","pep guardiola","jurgen klopp"
];

const ANIME_DATA = [
    { name: 'Naruto', detail: 'Shonen - Ninja (2002)', image: 'https://cdn.myanimelist.net/images/anime/6/73245.jpg' },
    { name: 'One Piece', detail: 'Shonen - Pirates (1999)', image: 'https://cdn.myanimelist.net/images/anime/12/76049.jpg' },
    { name: 'Dragon Ball Z', detail: 'Shonen - Fighting (1989)', image: 'https://cdn.myanimelist.net/images/anime/13/17405.jpg' },
    { name: 'Attack on Titan', detail: 'Action - Dark (2013)', image: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg' },
    { name: 'Demon Slayer', detail: 'Shonen - Demons (2019)', image: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg' },
    { name: 'My Hero Academia', detail: 'Shonen - Heroes (2016)', image: 'https://cdn.myanimelist.net/images/anime/10/78745.jpg' }
];

const ANIMALS = [
    { name: 'Lion', detail: 'King of the Jungle', image: 'https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=400&h=400&fit=crop' },
    { name: 'Tiger', detail: 'Bengal Tiger', image: 'https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=400&h=400&fit=crop' },
    { name: 'Elephant', detail: 'African Elephant', image: 'https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?w=400&h=400&fit=crop' },
    { name: 'Panda', detail: 'Giant Panda', image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&h=400&fit=crop' },
    { name: 'Zebra', detail: 'Plains Zebra', image: 'https://images.unsplash.com/photo-1470093851219-69951fcbb533?w=400&h=400&fit=crop' },
    { name: 'Giraffe', detail: 'Masai Giraffe', image: 'https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=400&h=400&fit=crop' }
];

const FOOD = [
    { name: 'Pizza', detail: 'Italian Classic', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop' },
    { name: 'Burger', detail: 'American Fast Food', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop' },
    { name: 'Sushi', detail: 'Japanese Cuisine', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop' },
    { name: 'Pasta', detail: 'Italian Dish', image: 'https://images.unsplash.com/photo-1551183053-bf91b1dca034?w=400&h=400&fit=crop' },
    { name: 'Tacos', detail: 'Mexican Street Food', image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=400&fit=crop' },
    { name: 'Ramen', detail: 'Japanese Noodles', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop' }
];

function calculateAge(birthDate) {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

function setCKObj(key, obj, hours) {
    const e = new Date();
    e.setTime(e.getTime() + (hours || COOKIE_EXP_HOURS) * 3600 * 1000);
    document.cookie = `${key}=${encodeURIComponent(JSON.stringify(obj))};expires=${e.toUTCString()};path=/`;
}

function getCKObj(key) {
    const v = `; ${document.cookie}`, parts = v.split(`; ${key}=`);
    if (parts.length === 2) {
        try { return JSON.parse(decodeURIComponent(parts.pop().split(';')[0])); } catch (e) { return null; }
    }
    return null;
}


function clearGameCookie() {
    const s = getCKObj(CK) || {};
    delete s.code;
    delete s.role;
    delete s.ts;
    setCKObj(CK, s, COOKIE_EXP_HOURS);
}

function hasShownScoreboardForGame(code) {
    return sessionStorage.getItem(`shown_sb_${code}`) === 'true';
}

function markScoreboardShown(code) {
    sessionStorage.setItem(`shown_sb_${code}`, 'true');
}

function clearShownScoreboard(code) {
    sessionStorage.removeItem(`shown_sb_${code}`);
}

const sc = {
    reg: document.getElementById('register-screen'),
    lob: document.getElementById('lobby-screen'),
    ost: document.getElementById('ostedh-screen'),
    game: document.getElementById('game-screen'),
    theme: document.getElementById('theme-screen'),
    picture: document.getElementById('picture-select-screen')
};

function show(s) {
    log('📺 Showing screen:', s);
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const target = sc[s] || document.getElementById(s);
    if (target) target.classList.add('active');
}

function chat(t, type = 'norm') {
    const c = document.getElementById('chat');
    if (!c) return;
    const e = document.createElement('div');
    e.className = `ce ${type}`;
    e.textContent = t;
    c.appendChild(e);
    c.scrollTop = c.scrollHeight;
}

socket.on('connect', () => log('✅ Connected'));
socket.on('disconnect', () => log('❌ Disconnected'));

socket.on('reconnect', (attemptNumber) => {
    log('🔄 Reconnected after', attemptNumber, 'attempts');
    if (gCode) {
        setTimeout(() => {
            socket.emit('request_state', { code: gCode });
        }, 500);
    }
});

window.addEventListener('load', () => {
    log('🔄 Page loaded');
    const saved = getCKObj(CK);
    if (saved?.name && saved?.playerId) {
        const now = Date.now();
        if (saved.code && saved.ts && (now - saved.ts) < COOKIE_EXP_HOURS * 3600 * 1000) {
            myName = saved.name;
            myId = saved.playerId;
            myRole = saved.role || 'user';
            gCode = saved.code;
            document.getElementById('saved-name').textContent = myName;
            document.getElementById('saved-id').textContent = myId;
            document.getElementById('welcome-back').style.display = 'block';
            document.getElementById('new-reg').style.display = 'none';
            socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode });
            document.getElementById('dname').textContent = myName;
            document.getElementById('did').textContent = myId;
            return;
        } else {
            myName = saved.name;
            myId = saved.playerId;
            document.getElementById('saved-name').textContent = myName;
            document.getElementById('saved-id').textContent = myId;
            document.getElementById('welcome-back').style.display = 'block';
            document.getElementById('new-reg').style.display = 'none';
            delete saved.code; delete saved.role; delete saved.ts;
            setCKObj(CK, saved, COOKIE_EXP_HOURS);
        }
    }
    log('ℹ️ No saved game - showing registration');
});

document.getElementById('use-saved-btn').onclick = () => {
    const s = getCKObj(CK);
    if (s) {
        myName = s.name; myId = s.playerId;
        document.getElementById('dname').textContent = myName;
        document.getElementById('did').textContent = myId;
        show('lob');
    }
};

document.getElementById('new-name-btn').onclick = () => {
    document.getElementById('welcome-back').style.display = 'none';
    document.getElementById('new-reg').style.display = 'block';
    document.getElementById('name-input').value = '';
};

document.getElementById('register-btn').onclick = async () => {
    const n = document.getElementById('name-input').value.trim();
    if (!n || n.length < 2) {
        document.getElementById('reg-err').textContent = 'Name too short!';
        return;
    }
    try {
        const r = await fetch('/api/generate-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const d = await r.json();
        myName = n; myId = d.player_id;
        setCKObj(CK, { name: myName, playerId: myId }, COOKIE_EXP_HOURS);
        document.getElementById('dname').textContent = myName;
        document.getElementById('did').textContent = myId;
        show('lob');
    } catch (e) {
        document.getElementById('reg-err').textContent = 'Failed';
    }
};

document.getElementById('create-btn').onclick = () => {
    if (!myName || !myId) { alert('Register first!'); return; }
    show('theme');
    selectedTheme = null;
    document.getElementById('selected-theme-info').style.display = 'none';
    document.querySelectorAll('.theme-card').forEach(card => card.classList.remove('selected'));
};

document.getElementById('join-btn').onclick = () => {
    if (!myName || !myId) { alert('Register first!'); return; }
    gCode = document.getElementById('join-code').value.trim().toUpperCase();
    if (!gCode || gCode.length !== 5) { alert('Valid 5-digit code!'); return; }
    myRole = 'user';
    log('Joining game:', gCode);
    setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS);
    socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode });
};

document.getElementById('quit-btn').onclick = () => {
    if (!gCode) { alert('No active game!'); return; }
    if (!confirm('Are you sure you want to quit the game?')) return;
    
    socket.emit('quit_game', { code: gCode });
    
    clearGameCookie();
    clearShownScoreboard(gCode);
    
    gCode = '';
    myRole = '';
    isOst = false;
    myTurn = false;
    gameFinished = false;
    gameLaunched = false;
    
    setTimeout(() => {
        location.reload();
    }, 500);
};

document.getElementById('leave-btn').onclick = () => {
    clearGameCookie();
    clearShownScoreboard(gCode);
    location.reload();
};

function selectTheme(theme) {
    document.querySelectorAll('.theme-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    selectedTheme = theme;
    const themeNames = {
        'football': '⚽ Football',
        'anime': '🎌 Anime',
        'animals': '🦁 Animals',
        'food': '🍕 Food',
        'random': '🎲 Random Mix'
    };
    document.getElementById('theme-name-display').textContent = themeNames[theme];
    document.getElementById('selected-theme-info').style.display = 'block';
    log('Selected theme:', theme);
}

document.getElementById('create-room-btn').onclick = () => {
    if (!selectedTheme) { alert('Please select a theme!'); return; }
    gCode = Math.floor(10000 + Math.random() * 90000).toString();
    myRole = 'admin';
    log('Creating room with theme:', selectedTheme);
    setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS);
    socket.emit('create_room_with_theme', {
        name: myName,
        player_id: myId,
        role: 'admin',
        code: gCode,
        theme: selectedTheme
    });
};

socket.on('room_created_with_theme', data => {
    log('Room created:', data);
    document.getElementById('lobby-cho').style.display = 'none';
    document.getElementById('in-lobby').style.display = 'block';
    document.getElementById('lcode').textContent = data.code;
    document.getElementById('lrole').textContent = '👑 Admin';
    document.getElementById('admin-ctl').style.display = 'block';
    document.getElementById('lstat').textContent = 'Waiting for players...';
    const themeIcons = { 'football': '⚽', 'anime': '🎌', 'animals': '🦁', 'food': '🍕', 'random': '🎲' };
    const themeDiv = document.getElementById('room-theme-display');
    themeDiv.style.display = 'block';
    themeDiv.innerHTML = `<strong>Theme:</strong> ${themeIcons[data.theme] || '🎲'} ${data.theme.charAt(0).toUpperCase() + data.theme.slice(1)}`;
    show('lob');
});

socket.on('registered', d => {
    log('📝 Registered:', d);
    gCode = d.code; myRole = d.role;
    document.getElementById('lobby-cho').style.display = 'none';
    document.getElementById('in-lobby').style.display = 'block';
    document.getElementById('lcode').textContent = d.code;
    document.getElementById('lrole').textContent = d.role === 'admin' ? '👑 Admin' : '🎮 Player';
    if (d.role === 'admin') document.getElementById('admin-ctl').style.display = 'block';
    const s = getCKObj(CK) || {};
    s.name = myName; s.playerId = myId; s.code = gCode; s.role = myRole; s.ts = Date.now();
    setCKObj(CK, s, COOKIE_EXP_HOURS);
    setTimeout(() => {
        socket.emit('request_state', { code: gCode });
    }, 300);
});


socket.on('player_joined', d => {
    log('Player joined:', d);
    const pul = document.getElementById('pul');
    if (!pul) return;
    const existing = pul.querySelector(`[data-pid="${d.id}"]`);
    if (existing) return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${d.name}</span><span class="pid" data-pid="${d.id}">${d.id}</span>`;
    pul.appendChild(li);
    

    updatePlayerCount();
});

socket.on('player_left', d => {
    log('Player left:', d);
    const pul = document.getElementById('pul');
    if (!pul) return;
    const li = pul.querySelector(`[data-pid="${d.id}"]`);
    if (li) li.remove();

    updatePlayerCount();
    
    chat(`🚪 ${d.name} left the game`, 'sys');
});

socket.on('players_list', data => {
    log('Received players list:', data);
    const pul = document.getElementById('pul');
    if (!pul || !Array.isArray(data.players)) return;
    pul.innerHTML = '';
    data.players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.name}</span><span class="pid" data-pid="${p.id}">${p.id}</span>`;
        pul.appendChild(li);
    });

    updatePlayerCount();
});


function updatePlayerCount() {
    const pul = document.getElementById('pul');
    const count = pul ? pul.querySelectorAll('li').length : 0;
    const countEl = document.getElementById('player-count');
    const lstat = document.getElementById('lstat');
    const launchBtn = document.getElementById('launch-btn');
    
    if (countEl) countEl.textContent = count;
    
    if (count >= 1) {
        if (lstat) lstat.textContent = `✅ Ready! (${count + 1} total)`;
        if (launchBtn) launchBtn.disabled = false;
    } else {
        if (lstat) lstat.textContent = '⚠️ Need at least 1 player!';
        if (launchBtn) launchBtn.disabled = true;
    }
}

socket.on('register_error', d => {
    log('Register error:', d);
    alert(d.message);
    document.getElementById('lobby-cho').style.display = 'block';
    document.getElementById('in-lobby').style.display = 'none';
});

socket.on('ready_to_launch', () => {
    log('Ready to launch');
    updatePlayerCount();
});

document.getElementById('launch-btn').onclick = () => {
    const pul = document.getElementById('pul');
    const playerCount = pul ? pul.querySelectorAll('li').length : 0;
    
    if (playerCount < 1) {
        alert('⚠️ Need at least 1 player to start! (Admin + 1 Player minimum)');
        return;
    }
    
    log('Launching game:', gCode);
    socket.emit('launch_game', { code: gCode });
};

socket.on('launch_error', d => {
    log('Launch error:', d);
    alert(d.message);
});

socket.on('game_launched', data => {
    log('Game launched');
    chat('🎮 Game has started!', 'sys');
    gameLaunched = true;
});

async function loadOstethPictures(theme) {
    let pictures = [];
    if (theme === 'football') {
        const shuffled = [...FOOTBALL_PLAYERS].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        for (const player of selected) {
            try {
                const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${player}`);
                const data = await res.json();
                if (data.player && data.player[0]) {
                    const p = data.player[0];
                    pictures.push({
                        url: p.strCutout || p.strThumb,
                        name: p.strPlayer,
                        detail: `${p.strTeam || 'Unknown Team'}\n${p.strNationality || 'Unknown'} • ${calculateAge(p.dateBorn)} years`,
                        apiSource: 'thesportsdb'
                    });
                } else {
                    pictures.push({
                        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(player)}&size=400&background=random&color=fff&bold=true`,
                        name: player.charAt(0).toUpperCase() + player.slice(1),
                        detail: 'Football Player\nAPI Unavailable',
                        apiSource: 'avatar'
                    });
                }
            } catch (e) {
                pictures.push({
                    url: `https://ui-avatars.com/api/?name=${encodeURIComponent(player)}&size=400&background=random&color=fff&bold=true`,
                    name: player.charAt(0).toUpperCase() + player.slice(1),
                    detail: 'Football Player\nLoading Failed',
                    apiSource: 'avatar'
                });
            }
        }
    } else if (theme === 'anime') {
        const shuffled = [...ANIME_DATA].sort(() => 0.5 - Math.random());
        pictures = shuffled.slice(0, 3).map(a => ({ url: a.image, name: a.name, detail: a.detail, apiSource: 'direct' }));
    } else if (theme === 'animals') {
        const shuffled = [...ANIMALS].sort(() => 0.5 - Math.random());
        pictures = shuffled.slice(0, 3).map(a => ({ url: a.image, name: a.name, detail: a.detail, apiSource: 'direct' }));
    } else if (theme === 'food') {
        const shuffled = [...FOOD].sort(() => 0.5 - Math.random());
        pictures = shuffled.slice(0, 3).map(f => ({ url: f.image, name: f.name, detail: f.detail, apiSource: 'direct' }));
    } else {
        for (let i = 0; i < 3; i++) {
            pictures.push({
                url: `https://picsum.photos/400?random=${Date.now() + i}`,
                name: `Random ${i+1}`,
                detail: 'Mystery Picture',
                apiSource: 'direct'
            });
        }
    }
    
    for (let i = 0; i < 3; i++) {
        const img = document.getElementById(`p${i+1}`);
        if (img && pictures[i]) {
            img.dataset.url = pictures[i].url;
            img.dataset.name = pictures[i].name;
            img.dataset.detail = pictures[i].detail;
            img.dataset.apiSource = pictures[i].apiSource;
            img.src = pictures[i].url;
            img.onerror = () => {
                log('Image failed to load, using avatar fallback');
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(pictures[i].name)}&size=400&background=random&color=fff&bold=true`;
            };
            img.onclick = () => {
                document.querySelectorAll('.popt').forEach(p => p.classList.remove('sel'));
                img.classList.add('sel');
                selPic = i + 1;
            };
        }
    }
}

socket.on('you_are_ostedh', d => {
    log('You are Osteth');
    isOst = true;
    show('ost');
    selPic = null;
    const viewBtn = document.getElementById('osteth-view-pic-btn');
    if (viewBtn) viewBtn.style.display = 'block';
    const theme = d.theme || 'random';
    loadOstethPictures(theme);
});

async function uploadImageForOsteth(imgElement) {
    const imageUrl = imgElement.dataset.url;
    const apiSource = imgElement.dataset.apiSource;
    try {
        if (apiSource === 'thesportsdb' || apiSource === 'direct') {
            log('Uploading via URL download (server-side)');
            const res = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_url: imageUrl, code: gCode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            return data.url;
        }
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || 400;
        canvas.height = imgElement.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => {
                if (!b) reject(new Error('null'));
                else resolve(b);
            }, 'image/jpeg', 0.9);
        });
        const form = new FormData();
        form.append('image', blob, 'chosen.jpg');
        form.append('code', gCode);
        const res = await fetch('/api/upload-image', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return data.url;
    } catch (e) {
        console.error('Upload failed:', e);
        const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ external_url: imageUrl, code: gCode })
        });
        const data = await res.json();
        return data.url;
    }
}

document.getElementById('conf-ost').onclick = async () => {
    if (!selPic) { alert('Pick a picture!'); return; }
    const img = document.getElementById(`p${selPic}`);
    if (!img.complete || img.naturalWidth === 0) { alert('Image not loaded!'); return; }
 
    let expRound = parseInt(document.getElementById('exp-r').value) || 10;
    if (expRound > 30) {
        expRound = 30;
        document.getElementById('exp-r').value = 30;
        alert('Round limit is 30! Set to maximum.');
    }
    if (expRound < 1) {
        expRound = 1;
        document.getElementById('exp-r').value = 1;
    }
    
    try {
        const stableUrl = await uploadImageForOsteth(img);
        document.getElementById('ostedh-img').src = stableUrl;
        document.getElementById('ostedh-picked').style.display = 'block';
        ostethExpectedRound = expRound;
        log('Osteth expected round:', ostethExpectedRound);
        socket.emit('ostedh_ready', {
            code: gCode,
            expected_tour: ostethExpectedRound,
            image_url: stableUrl,
            picture_name: img.dataset.name || '',
            picture_detail: img.dataset.detail || ''
        });
        show('game');
    } catch (err) {
        console.error(err);
        alert('Upload failed - trying fallback');
        const stableUrl = await uploadImageForOsteth(img);
        document.getElementById('ostedh-img').src = stableUrl;
        document.getElementById('ostedh-picked').style.display = 'block';
        ostethExpectedRound = expRound;
        socket.emit('ostedh_ready', {
            code: gCode,
            expected_tour: ostethExpectedRound,
            image_url: stableUrl,
            picture_name: img.dataset.name || '',
            picture_detail: img.dataset.detail || ''
        });
        show('game');
    }
};

socket.on('ostedh_is', d => chat(`🎭 ${d.name} is Osteth`, 'sys'));
socket.on('game_start', d => { chat(`🚀 ${d.message}`, 'sys'); show('game'); gameFinished = false; });
socket.on('round_update', d => document.getElementById('rnd').textContent = d.round);

socket.on('turn_update', d => {
    const el = document.getElementById('turn-ind');
    if (d.current === myName && !isOst) {
        el.textContent = "✅ YOUR turn!";
        el.style.background = 'rgba(39,174,96,0.3)';
        myTurn = true;
        document.getElementById('ctrls').style.display = 'block';
    } else {
        el.textContent = d.current ? `🎯 ${d.current}'s turn` : 'Waiting...';
        el.style.background = 'rgba(74,105,189,0.3)';
        myTurn = false;
        document.getElementById('ctrls').style.display = 'none';
    }
});

socket.on('your_turn', () => {
    myTurn = true;
    document.getElementById('ctrls').style.display = 'block';
    document.getElementById('turn-ind').textContent = "✅ YOUR turn!";
});

socket.on('score_update', d => {
    if (d.name === myName) document.getElementById('mscore').textContent = `Score: ${d.score}`;
});

document.getElementById('ask-btn').onclick = () => document.getElementById('q-modal').style.display = 'flex';
document.getElementById('send-q').onclick = () => {
    const q = document.getElementById('q-in').value.trim();
    if (q) {
        socket.emit('ask_question', { code: gCode, question: q });
        document.getElementById('q-in').value = '';
    }
    document.getElementById('q-modal').style.display = 'none';
    myTurn = false;
    document.getElementById('ctrls').style.display = 'none';
};
document.getElementById('cancel-q').onclick = () => document.getElementById('q-modal').style.display = 'none';

document.getElementById('guess-btn').onclick = () => document.getElementById('g-modal').style.display = 'flex';
document.getElementById('send-g').onclick = () => {
    const g = document.getElementById('g-in').value.trim();
    if (g) {
        socket.emit('try_guess', { code: gCode, guess: g });
        document.getElementById('g-in').value = '';
    }
    document.getElementById('g-modal').style.display = 'none';
    myTurn = false;
    document.getElementById('ctrls').style.display = 'none';
};
document.getElementById('cancel-g').onclick = () => document.getElementById('g-modal').style.display = 'none';

socket.on('question_asked', d => chat(`[Q] ${d.asker}: ${d.question}`, 'q'));

socket.on('answer_given', d => {
    const ansText = d.answer === 'YES' ? '✅ YES' : '❌ NO';
    chat(`[A] Osteth: ${ansText} (Question: ${d.question || ''})`, 'a');
});

socket.on('answer_request', d => {
    document.getElementById('ans-asker').textContent = d.asker;
    document.getElementById('ans-q').textContent = d.question;
    document.getElementById('ost-ans-modal').style.display = 'flex';
});

document.getElementById('ans-y').onclick = () => {
    socket.emit('ostedh_answer', { code: gCode, answer: 'yes' });
    document.getElementById('ost-ans-modal').style.display = 'none';
};
document.getElementById('ans-n').onclick = () => {
    socket.emit('ostedh_answer', { code: gCode, answer: 'no' });
    document.getElementById('ost-ans-modal').style.display = 'none';
};


socket.on('guess_submitted', d => {
    chat(`🎯 ${d.guesser} guessed: "${d.guess}" (Round ${d.round})`, 'norm');
});


socket.on('guess_result', d => {
    const result = d.decision === 'yes' ? '✅ CORRECT!' : '❌ WRONG';
    chat(`📝 ${d.guesser}'s guess "${d.guess}" - ${result}`, d.decision === 'yes' ? 'win' : 'norm');
});

socket.on('guess_for_you', d => {
    document.getElementById('g-asker').textContent = d.guesser;
    document.getElementById('g-txt').textContent = d.guess;
    document.getElementById('ost-guess-modal').style.display = 'flex';
    currentGuesserSid = d.guesser_sid;
});

document.getElementById('g-y').onclick = () => {
    if (!currentGuesserSid) { alert('Error'); return; }
    socket.emit('guess_decision', { code: gCode, decision: 'yes', guesser_sid: currentGuesserSid });
    document.getElementById('ost-guess-modal').style.display = 'none';
    currentGuesserSid = null;
};

document.getElementById('g-n').onclick = () => {
    if (!currentGuesserSid) { alert('Error'); return; }
    socket.emit('guess_decision', { code: gCode, decision: 'no', guesser_sid: currentGuesserSid });
    document.getElementById('ost-guess-modal').style.display = 'none';
    currentGuesserSid = null;
};

socket.on('game_won', d => chat(`🏆 ${d.winner} WON!`, 'win'));

socket.on('game_over', data => {
    log('Game over');
    gameFinished = true;
    clearGameCookie();
    showScoreboardOverlay(data);
});

document.getElementById('osteth-view-pic-btn').onclick = () => {
    if (!isOst || !gCode) { alert('Only Osteth!'); return; }
    socket.emit('osteth_view_picture', { code: gCode });
};

socket.on('osteth_picture', data => {
    if (data.picture_url) {
        const modal = document.getElementById('osteth-picture-modal');
        const mc = modal.querySelector('.mc');
        let detailsHtml = `
        <div style="background:rgba(255,215,0,0.2); padding:15px; border-radius:10px; margin:15px 0;">
            <p style="font-size:14px; color:#ffd700;">🎯 Expected Round</p>
            <p style="font-size:28px; font-weight:bold; color:#fff;">${data.expected_round || '?'}</p>
        </div>`;
        if (data.description) {
            detailsHtml += `
            <div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:8px; margin:10px 0;">
                <p style="font-size:12px; color:#aaa; white-space:pre-line;">${data.description}</p>
            </div>`;
        }
        mc.innerHTML = `
        <h3>🖼️ Secret Picture</h3>
        <img src="${data.picture_url}" style="max-width:100%; border-radius:12px; margin:15px 0;">
        ${detailsHtml}
        <button id="close-osteth-pic" class="btn-sec">Close</button>`;
        document.getElementById('close-osteth-pic').onclick = () => { modal.style.display = 'none'; };
        modal.style.display = 'flex';
    }
});

socket.on('osteth_picture_error', d => alert(d.error));

function showScoreboardOverlay(data) {
    const overlay = document.getElementById('scoreboard-overlay');
    const sbContainer = document.getElementById('overlay-sb');
    const winnerBanner = document.getElementById('winner-banner');
    const title = document.getElementById('overlay-title');
    const closeBtn = document.getElementById('close-sb-btn');
    
    sbContainer.innerHTML = '';
    if (Array.isArray(data.scoreboard)) {
        data.scoreboard.forEach(row => {
            const r = document.createElement('div');
            r.className = 'sb-row' + (row.name === myName ? ' you' : '');
            r.innerHTML = `<div><strong>${row.rank}. ${row.name}${row.name === myName ? ' (You)' : ''}</strong></div><div class="sb-pts">${row.score} pts</div>`;
            sbContainer.appendChild(r);
        });
    }
    
    if (data.winner) title.textContent = `🏆 ${data.winner} Wins!`; else title.textContent = '🏆 Game Ended';
    
    if (data.ostedh_image_url) {
        winnerBanner.style.display = 'block';
        winnerBanner.innerHTML = `<img src="${data.ostedh_image_url}" style="max-width:150px;border-radius:12px;">`;
        closeBtn.textContent = '🏠 Return to Lobby';
    } else {
        winnerBanner.style.display = 'none';
        closeBtn.textContent = '❌ Close';
    }
    
    overlay.style.display = 'flex';
}

document.getElementById('view-sb-btn').onclick = async () => {
    if (!gCode) { alert('No game'); return; }
    try {
        const res = await fetch(`/api/scoreboard/${gCode}`);
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        showScoreboardOverlay(data);
    } catch (err) { alert('Failed'); }
};

document.getElementById('close-sb-btn').onclick = () => {
    document.getElementById('scoreboard-overlay').style.display = 'none';
    if (document.getElementById('close-sb-btn').textContent.includes('Lobby')) {
        setTimeout(() => location.reload(), 100);
    }
};

socket.on('reconnect_state', state => {
    log('📡 RECONNECT_STATE RECEIVED!');
    if (hasShownScoreboardForGame(gCode)) {
        log('⚠️ Already shown scoreboard, going to lobby');
        show('lob');
        return;
    }
    if (state.game_started && !state.winner) {
        log('✅ Showing GAME screen');
        show('game');
        document.getElementById('rnd').textContent = state.current_tour || 1;
        const curName = state.current_player_name || null;
        const el = document.getElementById('turn-ind');
        if (curName === myName && !isOst) {
            el.textContent = "✅ YOUR turn!";
            el.style.background = 'rgba(39,174,96,0.3)';
            myTurn = true;
            document.getElementById('ctrls').style.display = 'block';
        } else {
            el.textContent = curName ? `🎯 ${curName}'s turn` : 'Waiting...';
            el.style.background = 'rgba(74,105,189,0.3)';
            myTurn = false;
            document.getElementById('ctrls').style.display = 'none';
        }
        if (state.ostedh_name === myName) {
            isOst = true;
            const viewBtn = document.getElementById('osteth-view-pic-btn');
            if (viewBtn) viewBtn.style.display = 'block';
        }
        if (Array.isArray(state.scoreboard)) {
            state.scoreboard.forEach(row => {
                if (row.name === myName) {
                    document.getElementById('mscore').textContent = `Score: ${row.score}`;
                }
            });
        }
    } else if (state.winner) {
        log('✅ Showing SCOREBOARD');
        markScoreboardShown(gCode);
        showScoreboardOverlay(state);
    } else if (state.ostedh_name === myName && !state.game_started) {
        log('✅ Showing OSTETH SETUP');
        isOst = true;
        show('ost');
    } else {
        log('✅ Showing LOBBY');
        show('lob');
    }
});
