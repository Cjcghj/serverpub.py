const socket = io();
let myName = '', myId = '', myRole = '', gCode = '';
let isOst = false, myTurn = false, selPic = null;
let currentGuesserSid = null;
let gameFinished = false;

const CK = 'ostedh_player';
const COOKIE_EXP_HOURS = 2;

const log = (...args) => console.log('[GAME]', ...args);

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

const sc = {
  reg: document.getElementById('register-screen'),
  lob: document.getElementById('lobby-screen'),
  ost: document.getElementById('ostedh-screen'),
  game: document.getElementById('game-screen')
};
function show(s) { Object.values(sc).forEach(x => x.classList.remove('active')); sc[s].classList.add('active'); }

window.addEventListener('load', () => {
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
      show('lob');
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
});

document.getElementById('use-saved-btn').onclick = () => {
  const s = getCKObj(CK);
  if (s) { myName = s.name; myId = s.playerId; document.getElementById('dname').textContent = myName; document.getElementById('did').textContent = myId; show('lob'); }
};
document.getElementById('new-name-btn').onclick = () => {
  document.getElementById('welcome-back').style.display = 'none';
  document.getElementById('new-reg').style.display = 'block';
  document.getElementById('name-input').value = '';
};
document.getElementById('register-btn').onclick = async () => {
  const n = document.getElementById('name-input').value.trim();
  if (!n || n.length < 2) { document.getElementById('reg-err').textContent = 'Name too short!'; return; }
  try {
    const r = await fetch('/api/generate-id', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await r.json();
    myName = n; myId = d.player_id;
    setCKObj(CK, { name: myName, playerId: myId }, COOKIE_EXP_HOURS);
    document.getElementById('dname').textContent = myName; document.getElementById('did').textContent = myId;
    show('lob');
  } catch (e) {
    document.getElementById('reg-err').textContent = 'Failed to generate ID';
  }
};

document.getElementById('create-btn').onclick = () => {
  if (!myName || !myId) { alert('Register first!'); return; }
  gCode = Math.floor(10000 + Math.random() * 90000).toString();
  myRole = 'admin';
  setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS);
  socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode });
};
document.getElementById('join-btn').onclick = () => {
  if (!myName || !myId) { alert('Register first!'); return; }
  gCode = document.getElementById('join-code').value.trim().toUpperCase();
  if (!gCode || gCode.length !== 5) { alert('Valid 5-digit code!'); return; }
  myRole = 'user';
  setCKObj(CK, { name: myName, playerId: myId, code: gCode, role: myRole, ts: Date.now() }, COOKIE_EXP_HOURS);
  socket.emit('register', { name: myName, player_id: myId, role: myRole, code: gCode });
};
document.getElementById('leave-btn').onclick = () => {
  const s = getCKObj(CK) || {};
  delete s.code; delete s.role; delete s.ts;
  setCKObj(CK, s, COOKIE_EXP_HOURS);
  location.reload();
};

socket.on('registered', d => {
  gCode = d.code; myRole = d.role;
  document.getElementById('lobby-cho').style.display = 'none';
  document.getElementById('in-lobby').style.display = 'block';
  document.getElementById('lcode').textContent = d.code;
  document.getElementById('lrole').textContent = d.role === 'admin' ? '👑 Admin' : '🎮 Player';
  if (d.role === 'admin') document.getElementById('admin-ctl').style.display = 'block';
  const s = getCKObj(CK) || {};
  s.name = myName; s.playerId = myId; s.code = gCode; s.role = myRole; s.ts = Date.now();
  setCKObj(CK, s, COOKIE_EXP_HOURS);
});

socket.on('player_joined', d => {
  const li = document.createElement('li');
  li.innerHTML = `<span>${d.name}</span><span class="pid">${d.id}</span>`;
  document.getElementById('pul').appendChild(li);
});
socket.on('ready_to_launch', () => document.getElementById('lstat').textContent = '✅ Ready! (2+ players)');

// ✅ Launch button with visual feedback
document.getElementById('launch-btn').onclick = () => {
  const btn = document.getElementById('launch-btn');
  const originalText = btn.textContent;
  
  btn.textContent = '🚀 Launching...';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  
  socket.emit('launch_game', { code: gCode });
  
  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
    btn.style.opacity = '1';
  }, 2000);
};

// ✅ Launch confirmation handler
socket.on('game_launched', data => {
  chat('🎮 Game has started! Good luck!', 'sys');
  const turnInd = document.getElementById('turn-ind');
  turnInd.style.animation = 'pulse 0.5s ease';
  setTimeout(() => { turnInd.style.animation = ''; }, 500);
});

socket.on('you_are_ostedh', d => {
  isOst = true; show('ost'); selPic = null;
  const viewBtn = document.getElementById('osteth-view-pic-btn');
  if (viewBtn) viewBtn.style.display = 'block';
  for (let i = 1; i <= 3; i++) {
    const img = document.getElementById(`p${i}`);
    img.crossOrigin = 'anonymous';
    img.onload = () => {};
    img.onerror = () => { console.warn('Image load error p' + i); };
    img.src = `https://picsum.photos/400?random=${Date.now() + i}`;
    img.onclick = () => { document.querySelectorAll('.popt').forEach(p => p.classList.remove('sel')); img.classList.add('sel'); selPic = i; };
  }
});

async function uploadBlobAsImage(blob, filename = 'chosen.jpg') {
  const form = new FormData();
  form.append('image', blob, filename);
  form.append('code', gCode);
  const res = await fetch('/api/upload-image', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

document.getElementById('conf-ost').onclick = async () => {
  if (!selPic) { alert('Pick a picture!'); return; }
  const img = document.getElementById(`p${selPic}`);
  if (!img.complete || img.naturalWidth === 0) { alert('Image not loaded yet. Wait and try again.'); return; }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 400;
    canvas.height = img.naturalHeight || 400;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob(b => { if (!b) reject(new Error('toBlob returned null')); else resolve(b); }, 'image/jpeg', 0.9);
      } catch (err) { reject(err); }
    });

    const stableUrl = await uploadBlobAsImage(blob, 'chosen.jpg');
    document.getElementById('ostedh-img').src = stableUrl;
    document.getElementById('ostedh-picked').style.display = 'block';
    socket.emit('ostedh_ready', { code: gCode, expected_tour: document.getElementById('exp-r').value, image_url: stableUrl });
    show('game');
    return;
  } catch (err) {
    log('Canvas export failed, trying fetch fallback:', err);
  }

  try {
    const resp = await fetch(img.src, { mode: 'cors' });
    if (!resp.ok) throw new Error('Fetch failed');
    const blob = await resp.blob();
    const stableUrl = await uploadBlobAsImage(blob, 'chosen.jpg');
    document.getElementById('ostedh-img').src = stableUrl;
    document.getElementById('ostedh-picked').style.display = 'block';
    socket.emit('ostedh_ready', { code: gCode, expected_tour: document.getElementById('exp-r').value, image_url: stableUrl });
    show('game');
    return;
  } catch (err) {
    console.error('Fetch/upload fallback failed:', err);
    alert('Could not export/upload the chosen image due to CORS. Please pick another picture or try again.');
  }
};

socket.on('ostedh_is', d => chat(`🎭 ${d.name} is Osteth`, 'sys'));
socket.on('game_start', d => { chat(`🚀 ${d.message}`, 'sys'); show('game'); gameFinished = false; });

socket.on('round_update', d => document.getElementById('rnd').textContent = d.round);
socket.on('turn_update', d => {
  const el = document.getElementById('turn-ind');
  if (d.current === myName && !isOst) {
    el.textContent = "✅ YOUR turn!"; el.style.background = 'rgba(39,174,96,0.3)'; myTurn = true; document.getElementById('ctrls').style.display = 'block';
  } else {
    el.textContent = d.current ? `🎯 ${d.current}'s turn` : 'Waiting...'; el.style.background = 'rgba(74,105,189,0.3)'; myTurn = false; document.getElementById('ctrls').style.display = 'none';
  }
});
socket.on('your_turn', () => { myTurn = true; document.getElementById('ctrls').style.display = 'block'; document.getElementById('turn-ind').textContent = "✅ YOUR turn!"; });
socket.on('score_update', d => { if (d.name === myName) document.getElementById('mscore').textContent = `Score: ${d.score}`; });

document.getElementById('ask-btn').onclick = () => document.getElementById('q-modal').style.display = 'flex';
document.getElementById('send-q').onclick = () => {
  const q = document.getElementById('q-in').value.trim();
  if (q) { socket.emit('ask_question', { code: gCode, question: q }); document.getElementById('q-in').value = ''; }
  document.getElementById('q-modal').style.display = 'none'; myTurn = false; document.getElementById('ctrls').style.display = 'none';
};
document.getElementById('cancel-q').onclick = () => document.getElementById('q-modal').style.display = 'none';

document.getElementById('guess-btn').onclick = () => document.getElementById('g-modal').style.display = 'flex';
document.getElementById('send-g').onclick = () => {
  const g = document.getElementById('g-in').value.trim();
  if (g) { socket.emit('try_guess', { code: gCode, guess: g }); document.getElementById('g-in').value = ''; }
  document.getElementById('g-modal').style.display = 'none'; myTurn = false; document.getElementById('ctrls').style.display = 'none';
};
document.getElementById('cancel-g').onclick = () => document.getElementById('g-modal').style.display = 'none';

function chat(t, type = 'norm') {
  const c = document.getElementById('chat'), e = document.createElement('div');
  e.className = `ce ${type}`; e.textContent = t; c.appendChild(e); c.scrollTop = c.scrollHeight;
}
socket.on('question_asked', d => chat(`[Q] ${d.asker}: ${d.question}`, 'q'));
socket.on('answer_given', d => chat(`[A] Osteth: ${d.answer}`, 'a'));
socket.on('answer_request', d => {
  document.getElementById('ans-asker').textContent = d.asker;
  document.getElementById('ans-q').textContent = d.question;
  document.getElementById('ost-ans-modal').style.display = 'flex';
});
document.getElementById('ans-y').onclick = () => { socket.emit('ostedh_answer', { code: gCode, answer: 'yes' }); document.getElementById('ost-ans-modal').style.display = 'none'; };
document.getElementById('ans-n').onclick = () => { socket.emit('ostedh_answer', { code: gCode, answer: 'no' }); document.getElementById('ost-ans-modal').style.display = 'none'; };

socket.on('guess_for_you', d => {
  document.getElementById('g-asker').textContent = d.guesser;
  document.getElementById('g-txt').textContent = d.guess;
  document.getElementById('ost-guess-modal').style.display = 'flex';
  currentGuesserSid = d.guesser_sid;
  log(`Guesser: ${d.guesser}, SID: ${currentGuesserSid}`);
});
document.getElementById('g-y').onclick = () => {
  if (!currentGuesserSid) { alert('Error: No guesser data'); return; }
  socket.emit('guess_decision', { code: gCode, decision: 'yes', guesser_sid: currentGuesserSid });
  document.getElementById('ost-guess-modal').style.display = 'none'; currentGuesserSid = null;
};
document.getElementById('g-n').onclick = () => {
  if (!currentGuesserSid) { alert('Error: No guesser data'); return; }
  socket.emit('guess_decision', { code: gCode, decision: 'no', guesser_sid: currentGuesserSid });
  document.getElementById('ost-guess-modal').style.display = 'none'; currentGuesserSid = null;
};

socket.on('game_won', d => chat(`🏆 ${d.winner} WON! +${d.points} pts`, 'win'));

socket.on('game_over', data => {
  log('GAME_OVER event received', data);
  gameFinished = true;
  const s = getCKObj(CK) || {};
  delete s.code; delete s.role; delete s.ts;
  setCKObj(CK, s, COOKIE_EXP_HOURS);
  showScoreboardOverlay(data);
});

document.getElementById('osteth-view-pic-btn').onclick = () => {
  if (!isOst || !gCode) { alert('Only Osteth can view the secret picture!'); return; }
  socket.emit('osteth_view_picture', { code: gCode });
};
socket.on('osteth_picture', data => {
  if (data.picture_url) {
    document.getElementById('osteth-view-img').src = data.picture_url;
    document.getElementById('osteth-picture-modal').style.display = 'flex';
    log('Osteth viewed picture');
  }
});
socket.on('osteth_picture_error', d => alert(`Error: ${d.error}`));
document.getElementById('close-osteth-pic').onclick = () => document.getElementById('osteth-picture-modal').style.display = 'none';

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
      const isAdmin = row.role === 'admin';
      r.innerHTML = `<div><strong>${row.rank}. ${row.name}${isAdmin ? ' 👑' : ''}${row.name === myName ? ' (You)' : ''}</strong></div><div class="sb-pts">${row.score} pts</div>`;
      sbContainer.appendChild(r);
    });
  }

  if (data.winner) title.textContent = `🏆 ${data.winner} Wins!`; else title.textContent = '🏆 Scoreboard';

  if (data.ostedh_image_url) {
    winnerBanner.style.display = 'block';
    winnerBanner.innerHTML = `<div style="font-weight:bold;margin-bottom:8px;">🎨 Secret Picture Revealed!</div><img src="${data.ostedh_image_url}" style="max-width:150px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.6);">`;
    closeBtn.textContent = '🏠 Return to Lobby';
  } else {
    winnerBanner.style.display = 'none';
    winnerBanner.innerHTML = '';
    closeBtn.textContent = '❌ Close';
  }

  overlay.style.display = 'flex';
}

document.getElementById('view-sb-btn').onclick = async () => {
  if (!gCode) { alert('No game code'); return; }
  try {
    const res = await fetch(`/api/scoreboard/${gCode}`);
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to fetch scoreboard'); return; }
    showScoreboardOverlay(data);
  } catch (err) {
    console.error(err);
    alert('Failed to fetch scoreboard');
  }
};

document.getElementById('close-sb-btn').onclick = () => {
  document.getElementById('scoreboard-overlay').style.display = 'none';
  if (document.getElementById('close-sb-btn').textContent.includes('Lobby')) {
    setTimeout(() => location.reload(), 100);
  }
};

socket.on('system', d => {
  if (d && d.message) chat(`⚠️ ${d.message}`, 'sys');
});

socket.on('connect', () => log('Connected'));
socket.on('disconnect', () => log('Disconnected'));

socket.on('game_launched', data => {
  // Show in chat
  chat('🎮 Game has started! Good luck!', 'sys');
  
  // Show visible banner notification
  showNotification('🚀 Game Launched!', 'Get ready to play...');
  
  // Pulse animation on turn indicator
  const turnInd = document.getElementById('turn-ind');
  if (turnInd) {
    turnInd.style.animation = 'pulse 0.5s ease';
    setTimeout(() => { turnInd.style.animation = ''; }, 500);
  }
});

function showNotification(title, message) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    color: white;
    padding: 15px 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 2000;
    text-align: center;
    animation: slideDown 0.3s ease, fadeOut 0.3s ease 2.7s;
    max-width: 90%;
  `;
  notif.innerHTML = `<strong>${title}</strong><br><small>${message}</small>`;
  document.body.appendChild(notif);
  setTimeout(() => {
    if (notif.parentNode) notif.parentNode.removeChild(notif);
  }, 3000);
}
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { top: -100px; opacity: 0; }
    to { top: 20px; opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(-50%) scale(1); }
    to { opacity: 0; transform: translateX(-50%) scale(0.95); }
  }
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(style);
