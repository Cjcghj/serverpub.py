# app.py
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import random, uuid, os, threading, time
from werkzeug.utils import secure_filename
import requests

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config['SECRET_KEY'] = 'ostedh_2026'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

UPLOAD_DIR = os.path.join(app.static_folder, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

_CLEANUP_QUEUE = []
_CLEANUP_LOCK = threading.Lock()

def _cleanup_worker():
    while True:
        try:
            now = time.time()
            to_remove = []
            with _CLEANUP_LOCK:
                for item in list(_CLEANUP_QUEUE):
                    if item.get('remove_at', 0) <= now:
                        to_remove.append(item)
            for item in to_remove:
                path = item.get('path')
                try:
                    if path and os.path.exists(path):
                        os.remove(path)
                        print(f"[CLEANUP] Removed {path}")
                except Exception as e:
                    print(f"[CLEANUP] Remove error for {path}: {e}")
                try:
                    _CLEANUP_QUEUE.remove(item)
                except ValueError:
                    pass
        except Exception as e:
            print(f"[CLEANUP] Worker error: {e}")
        time.sleep(1)

threading.Thread(target=_cleanup_worker, daemon=True).start()

def schedule_file_removal(path, delay_seconds=5):
    if not path:
        return
    remove_at = time.time() + max(1, int(delay_seconds))
    with _CLEANUP_LOCK:
        for item in _CLEANUP_QUEUE:
            if item.get('path') == path:
                if remove_at > item.get('remove_at', 0):
                    item['remove_at'] = remove_at
                return
        _CLEANUP_QUEUE.append({'path': path, 'remove_at': remove_at})
    print(f"[CLEANUP] Scheduled removal of {path} in {delay_seconds}s")

_RECENT_ACTIONS = {}

def _recent_action_allowed(player_id, window_ms=300):
    if not player_id:
        return True
    now = int(time.time() * 1000)
    last = _RECENT_ACTIONS.get(player_id, 0)
    if now - last < window_ms:
        return False
    _RECENT_ACTIONS[player_id] = now
    return True

class Player:
    def __init__(self, sid, name, player_id, role):
        self.sid = sid
        self.name = name
        self.player_id = player_id
        self.role = role
        self.score = 0
        self.ostedh_status = "telmidh"
        self.disconnected = False
        self.disconnect_timer = None
    
    def add_point(self, p):
        self.score += p
        return self.score

class Group:
    def __init__(self, code):
        self.code = code
        self.players = {}
        self.player_order = []
        self.current_turn_index = 0
        self.game_started = False
        self.game_launched = False  
        self.current_tour = 1
        self.expected_tour = None
        self.right_answer = False
        self.pending_guesses = {}
        self.player_timeouts = {}
        self.waiting_for_ostedh_answer = False
        self.waiting_for_ostedh_decision = False
        self.ostedh_image_url = None
        self.ostedh_image_filename = None
        self.osteth_timeout = None
        self._last_asker_key = None
        self._last_question = None
        self.selected_theme = None
        self.secret_image_url = None
        self.secret_description = None
    
    def add_player(self, p, key=None):
        k = key or p.sid
        self.players[k] = p
        if p.role != "admin" and k not in self.player_order:
            self.player_order.append(k)
    
    def get_ostedh(self):
        for p in self.players.values():
            if p.ostedh_status == "ostedh":
                return p
        return None
    
    def get_telmidhs(self):
        return [p for p in self.players.values() if p.ostedh_status == "telmidh" and p.role != "admin"]
    
    def get_all_for_scoreboard(self):
        return [p for p in self.players.values()]
    
    def get_current(self):
        if not self.player_order:
            return None
        if self.current_turn_index >= len(self.player_order):
            self.current_turn_index = 0
        key = self.player_order[self.current_turn_index]
        return self.players.get(key)
    
    def next_turn(self):
        if self.player_order:
            self.current_turn_index = (self.current_turn_index + 1) % len(self.player_order)
            if self.current_turn_index == 0:
                self.current_tour += 1

GROUPS = {}

@socketio.on('request_players')
def on_request_players(d):
    code = d.get('code')
    if not code:
        return
    g = GROUPS.get(code)
    if not g:
        return
    players = [
        {'name': p.name, 'id': p.player_id, 'role': p.role}
        for p in g.players.values()
        if p.role != "admin" or p.sid == request.sid
    ]
    emit('players_list', {'players': players}, room=request.sid)
    print(f"[PLAYERS] Sent {len(players)} players to {request.sid}")

def broadcast(code, event, data, exclude_sid=None):
    g = GROUPS.get(code)
    if not g:
        return
    for p in g.players.values():
        if p.sid != exclude_sid:
            try:
                socketio.emit(event, data, room=p.sid)
            except Exception as e:
                print(f"[BROADCAST] {e}")

def get_scoreboard(g):
    sp = sorted(g.get_all_for_scoreboard(), key=lambda x: x.score, reverse=True)
    sb = [{
        'rank': i+1,
        'name': p.name,
        'score': p.score,
        'id': p.player_id,
        'role': p.role
    } for i, p in enumerate(sp)]
    winner = sp[0].name if sp else None
    return sb, winner

def broadcast_scoreboard(g):
    try:
        sb, winner = get_scoreboard(g)
        for p in g.players.values():
            socketio.emit('scoreboard_sync', {'scoreboard': sb}, room=p.sid)
        for p in g.players.values():
            try:
                socketio.emit('score_update', {'id': p.player_id, 'name': p.name, 'score': p.score}, room=p.sid)
            except Exception as e:
                print(f"[SCORE_UPDATE] {e}")
        print(f"[SCOREBOARD] {g.code} -> " + ", ".join([f"{r['name']}:{r['score']}" for r in sb]))
    except Exception as e:
        print(f"[BROADCAST_SCOREBOARD] {e}")

def notify_turn(g):
    if g.right_answer or not g.player_order:
        return
    cur = g.get_current()
    if cur:
        try:
            socketio.emit('your_turn', {}, room=cur.sid)
        except Exception:
            pass
    ost = g.get_ostedh()
    for p in g.players.values():
        if not ost or p.sid != ost.sid:
            try:
                socketio.emit('turn_update', {'current': cur.name if cur else None}, room=p.sid)
            except Exception:
                pass
    broadcast(g.code, 'round_update', {'round': g.current_tour})

def start_game(g):
    tel = [p for p in g.players.values() if p.role != "admin"]
    if len(tel) < 1:
        for p in g.players.values():
            socketio.emit('error', {'message': 'Need at least 1 player to start!'}, room=p.sid)
        return
    
    g.ostedh_image_url = None
    g.ostedh_image_filename = None
    g.right_answer = False
    g.game_started = False
    g.current_tour = 1
    g.current_turn_index = 0
    g.player_order = [k for k, p in g.players.items() if p.role != "admin"]
    
    for p in g.players.values():
        p.ostedh_status = "telmidh"
    
    ost = random.choice(tel) if tel else None
    if ost:
        ost.ostedh_status = "ostedh"
        socketio.emit('you_are_ostedh', {
            'code': g.code,
            'theme': g.selected_theme
        }, room=ost.sid)
        for p in tel:
            if p.sid != ost.sid:
                socketio.emit('ostedh_is', {'name': ost.name}, room=p.sid)
    
    print(f"[GAME] Started! Code: {g.code}, Theme: {g.selected_theme}")

def _end_game_and_cleanup(g, reason="ended"):
    try:
        sb, winner = get_scoreboard(g)
        payload = {
            'scoreboard': sb,
            'winner': winner,
            'code': g.code,
            'ostedh_image_url': g.ostedh_image_url if g.ostedh_image_url else None,
            'reason': reason
        }
        for p in list(g.players.values()):
            try:
                socketio.emit('game_over', payload, room=p.sid)
            except Exception as e:
                print(f"[GAME_OVER] {e}")
    except Exception as e:
        print(f"[END_GAME] {e}")
    
    g.game_started = False
    g.right_answer = True
    
    try:
        if g.ostedh_image_filename:
            fpath = os.path.join(UPLOAD_DIR, g.ostedh_image_filename)
            schedule_file_removal(fpath, delay_seconds=5)
    except Exception as e:
        print(f"[CLEANUP] {e}")
    
    print(f"[CLEANUP] Group {g.code} scheduled for cleanup in 60 seconds")

def _schedule_osteth_timeout(g, seconds=20):
    def _timeout():
        gg = GROUPS.get(g.code)
        if not gg:
            return
        ost = gg.get_ostedh()
        if not ost or getattr(ost, 'disconnected', False):
            print(f"[TIMEOUT] Osteth did not reconnect for {g.code}. Ending game.")
            _end_game_and_cleanup(gg, reason="osteth_timeout")
        else:
            print(f"[TIMEOUT] Osteth present for {g.code}; no action.")
    
    try:
        if g.osteth_timeout:
            try:
                g.osteth_timeout.cancel()
            except Exception:
                pass
    except Exception:
        pass
    
    t = threading.Timer(seconds, _timeout)
    t.daemon = True
    g.osteth_timeout = t
    t.start()
    print(f"[TIMER] Scheduled osteth timeout for {g.code} in {seconds}s")

def _schedule_player_timeout(g, player_key, seconds=5):
    def _timeout():
        gg = GROUPS.get(g.code)
        if not gg:
            return
        p = gg.players.get(player_key)
        cur = gg.get_current()
        if p and getattr(p, 'disconnected', False) and cur and cur.player_id == p.player_id:
            print(f"[PLAYER TIMEOUT] {p.name} did not reconnect. Advancing turn.")
            gg.waiting_for_ostedh_answer = False
            gg.waiting_for_ostedh_decision = False
            gg.next_turn()
            notify_turn(gg)
        if p:
            p.disconnect_timer = None
    
    p = g.players.get(player_key)
    if p and getattr(p, 'disconnect_timer', None):
        try:
            p.disconnect_timer.cancel()
        except Exception:
            pass
    
    t = threading.Timer(seconds, _timeout)
    t.daemon = True
    if p:
        p.disconnect_timer = t
    t.start()
    print(f"[TIMER] Scheduled player timeout for {player_key} in {seconds}s")

@socketio.on('connect')
def on_connect():
    print(f"[+] Connected: {request.sid}")

@socketio.on('create_room_with_theme')
def on_create_room_with_theme(data):
    name = data.get('name')
    pid = data.get('player_id')
    role = data.get('role')
    code = data.get('code')
    theme = data.get('theme')
    
    if not all([name, pid, role, code, theme]):
        emit('room_creation_error', {'message': 'Missing data'}, room=request.sid)
        return
    
    GROUPS[code] = Group(code)
    g = GROUPS[code]
    g.selected_theme = theme
    
    player = Player(request.sid, name, pid, role)
    g.add_player(player, key=request.sid)
    join_room(request.sid)
    
    print(f"[ROOM] Created {code} with theme: {theme}")
    
    emit('room_created_with_theme', {
        'code': code,
        'theme': theme,
        'message': 'Room created successfully!'
    }, room=request.sid)

@socketio.on('register')
def on_register(d):
    name = d.get('name')
    pid = d.get('player_id')
    role = d.get('role')
    code = d.get('code')
    
    if not name or len(name) < 2:
        emit('register_error', {'message': 'Name too short'}, room=request.sid)
        return
    
    if not pid or len(pid) < 4:
        emit('register_error', {'message': 'Invalid ID'}, room=request.sid)
        return
    
    if code not in GROUPS:
        if role != "admin":
            emit('register_error', {'message': 'Group not found'}, room=request.sid)
            return
        GROUPS[code] = Group(code)
        print(f"[GROUP] Created: {code}")
    
    g = GROUPS[code]
    existing_key = None
    existing = None
    
    for k, p in list(g.players.items()):
        if p.player_id == pid:
            existing_key = k
            existing = p
            break
    
    if existing:
        old_key = existing_key
        existing.sid = request.sid
        existing.name = name
        existing.role = role
        existing.disconnected = False
        
        join_room(request.sid)
        
        if old_key != request.sid:
            try:
                del g.players[old_key]
            except Exception:
                pass
            g.players[request.sid] = existing
            
            for i, k in enumerate(g.player_order):
                if k == old_key:
                    g.player_order[i] = request.sid
            
            if getattr(existing, 'disconnect_timer', None):
                try:
                    existing.disconnect_timer.cancel()
                    existing.disconnect_timer = None
                except Exception:
                    pass
            
            try:
                ost = g.get_ostedh()
                if ost and ost.player_id == pid and g.osteth_timeout:
                    try:
                        g.osteth_timeout.cancel()
                    except Exception:
                        pass
                    g.osteth_timeout = None
                    print(f"[TIMER] Cancelled osteth timeout for {g.code}")
            except Exception:
                pass
        
        emit('registered', {
            'name': existing.name,
            'player_id': existing.player_id,
            'role': existing.role,
            'code': g.code
        }, room=request.sid)
        
        if g.selected_theme:
            emit('room_theme', {
                'theme': g.selected_theme,
                'secret_image': g.secret_image_url,
                'secret_description': g.secret_description
            }, room=request.sid)
        
        sb, winner = get_scoreboard(g)
        ost = g.get_ostedh()
        
        reconnect_state = {
            'game_started': g.game_started,
            'current_tour': g.current_tour,
            'player_order_names': [g.players[k].name for k in g.player_order if k in g.players],
            'current_player_name': g.get_current().name if g.get_current() else None,
            'ostedh_name': ost.name if ost else None,
            'ostedh_sid': ost.sid if ost else None,
            'scoreboard': sb,
            'winner': winner if g.right_answer else None,
            'ostedh_image_url': g.ostedh_image_url if g.right_answer else None,
            'expected_tour': g.expected_tour
        }
        emit('reconnect_state', reconnect_state, room=request.sid)
        socketio.emit('scoreboard_sync', {'scoreboard': sb}, room=request.sid)
        
        for p in g.players.values():
            try:
                socketio.emit('score_update', {'id': p.player_id, 'name': p.name, 'score': p.score}, room=p.sid)
            except Exception:
                pass
        
        broadcast(g.code, 'player_reconnected', {'name': existing.name, 'id': existing.player_id}, exclude_sid=request.sid)
        print(f"[RECONNECT] {existing.name} rejoined {g.code}")
        return
    
    player = Player(request.sid, name, pid, role)
    g.add_player(player, key=request.sid)
    join_room(request.sid)
    
    print(f"[PLAYER] {name} joined {code}")
    
    if role != "admin":
        broadcast(code, 'player_joined', {'name': name, 'id': pid}, exclude_sid=request.sid)
        print(f"[PLAYER] Broadcasted {name} joined to all others")
    
    players = [
        {'name': p.name, 'id': p.player_id}
        for k, p in g.players.items()
        if k != request.sid and p.role != "admin"
    ]
    emit('players_list', {'players': players}, room=request.sid)
    print(f"[PLAYERS] Sent {len(players)} existing players to {name}")
    
    cnt = len([p for p in g.players.values() if p.role != "admin"])
    if cnt >= 1 and not g.game_started:
        admin = next((p for p in g.players.values() if p.role == "admin"), None)
        if admin:
            emit('ready_to_launch', {'code': code}, room=admin.sid)
    
    emit('registered', {
        'name': name,
        'player_id': pid,
        'role': role,
        'code': code
    }, room=request.sid)
    
    if g.game_started:
        sb, winner = get_scoreboard(g)
        ost = g.get_ostedh()
        reconnect_state = {
            'game_started': g.game_started,
            'current_tour': g.current_tour,
            'player_order_names': [g.players[k].name for k in g.player_order if k in g.players],
            'current_player_name': g.get_current().name if g.get_current() else None,
            'ostedh_name': ost.name if ost else None,
            'ostedh_sid': ost.sid if ost else None,
            'scoreboard': sb,
            'winner': winner if g.right_answer else None,
            'ostedh_image_url': g.ostedh_image_url if g.right_answer else None,
            'expected_tour': g.expected_tour
        }
        emit('reconnect_state', reconnect_state, room=request.sid)
        print(f"[REGISTER] Sent game state to NEW player {name} (game_started={g.game_started})")

@socketio.on('request_state')
def on_request_state(d):
    code = d.get('code')
    if not code:
        emit('request_state_error', {'error': 'No code provided'}, room=request.sid)
        return
    
    g = GROUPS.get(code)
    if not g:
        emit('request_state_error', {'error': 'Group not found'}, room=request.sid)
        return
    
    sb, winner = get_scoreboard(g)
    ost = g.get_ostedh()
    
    reconnect_state = {
        'game_started': g.game_started,
        'current_tour': g.current_tour,
        'player_order_names': [g.players[k].name for k in g.player_order if k in g.players],
        'current_player_name': g.get_current().name if g.get_current() else None,
        'ostedh_name': ost.name if ost else None,
        'ostedh_sid': ost.sid if ost else None,
        'scoreboard': sb,
        'winner': winner if g.right_answer else None,
        'ostedh_image_url': g.ostedh_image_url if g.right_answer else None,
        'expected_tour': g.expected_tour
    }
    emit('reconnect_state', reconnect_state, room=request.sid)
    print(f"[RECONNECT] Sent state to {request.sid} for game {code}")

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    if request.content_type and request.content_type.startswith('application/json'):
        data = request.get_json() or {}
        external_url = data.get('external_url')
        code = data.get('code')
        
        if not external_url:
            return jsonify({'error': 'No external_url provided'}), 400
        
        try:
            resp = requests.get(external_url, stream=True, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            })
            if resp.status_code != 200:
                return jsonify({'error': 'Failed to download external image'}), 400
            
            ext = 'jpg'
            ctype = resp.headers.get('content-type', '')
            if 'png' in ctype:
                ext = 'png'
            
            fname = f"{(code or 'g')}_{uuid.uuid4().hex[:10]}.{ext}"
            fpath = os.path.join(UPLOAD_DIR, fname)
            
            with open(fpath, 'wb') as f:
                for chunk in resp.iter_content(1024):
                    if chunk:
                        f.write(chunk)
            
            public_url = f"/static/uploads/{fname}"
            
            if code:
                g = GROUPS.get(code)
                if g:
                    g.ostedh_image_url = public_url
                    g.ostedh_image_filename = fname
            
            return jsonify({'url': public_url}), 200
        except Exception as e:
            print(f"[UPLOAD] {e}")
            return jsonify({'error': 'External download failed'}), 500
    
    file = request.files.get('image')
    code = request.form.get('code')
    
    if not file:
        return jsonify({'error': 'No image file provided'}), 400
    
    filename = secure_filename(file.filename) or 'img.jpg'
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg'
    fname = f"{(code or 'g')}_{uuid.uuid4().hex[:10]}.{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    
    try:
        file.save(fpath)
    except Exception as e:
        print(f"[UPLOAD] {e}")
        return jsonify({'error': 'Failed to save'}), 500
    
    public_url = f"/static/uploads/{fname}"
    
    if code:
        g = GROUPS.get(code)
        if g:
            g.ostedh_image_url = public_url
            g.ostedh_image_filename = fname
            print(f"[UPLOAD] Saved for {code}: {public_url}")
    
    return jsonify({'url': public_url}), 200


@socketio.on('launch_game')
def on_launch(d):
    g = GROUPS.get(d.get('code'))
    if not g:
        emit('launch_error', {'message': 'Game not found!'}, room=request.sid)
        return
    

    if g.game_launched:
        emit('launch_error', {'message': 'Game already launched!'}, room=request.sid)
        print(f"[LAUNCH] Game {g.code} already launched!")
        return
    

    player_count = len([p for p in g.players.values() if p.role != "admin"])
    if player_count < 1:
        emit('launch_error', {
            'message': 'Need at least 1 player to start! (Admin + 1 Player minimum)'
        }, room=request.sid)
        print(f"[LAUNCH] Not enough players in {g.code}: {player_count} players")
        return
    
    g.game_launched = True  
    start_game(g)
    

    for p in g.players.values():
        try:
            socketio.emit('game_launched', {
                'message': 'Game started!',
                'launched_by': request.sid
            }, room=p.sid)
        except Exception as e:
            print(f"[LAUNCH_NOTIFY] {e}")
    
    print(f"[LAUNCH] Game {g.code} launched! Notified {len(g.players)} players")

@socketio.on('ostedh_ready')
def on_ostedh_ready(d):
    g = GROUPS.get(d.get('code'))
    if not g:
        return
    
    try:

        expected_tour = int(d.get('expected_tour') or g.expected_tour or 1)
        if expected_tour > 30:
            expected_tour = 30
        if expected_tour < 1:
            expected_tour = 1
        
        g.expected_tour = expected_tour
        g.game_started = True
        g.current_tour = 1
        g.current_turn_index = 0
        g.player_order = [k for k, p in g.players.items() if p.ostedh_status == "telmidh"]
        
        chosen_url = d.get('image_url')
        if chosen_url:
            g.ostedh_image_url = chosen_url
            g.secret_image_url = chosen_url
            g.secret_description = d.get('picture_detail', '')
        
        broadcast(g.code, 'game_start', {'message': 'Round 1 begins!'})
        notify_turn(g)
        broadcast_scoreboard(g)
    except Exception as e:
        print(f"[ERR] {e}")

@socketio.on('ask_question')
def on_ask(d):
    code = d.get('code')
    question = (d.get('question') or '').strip()
    pid = d.get('player_id')
    
    if not code or not question:
        return
    
    g = GROUPS.get(code)
    if not g:
        return
    
    if g.waiting_for_ostedh_answer:
        try:
            socketio.emit('system', {'message': 'A question is already pending.'}, room=request.sid)
        except Exception:
            pass
        return
    
    asker_key = None
    asker = None
    
    if pid:
        for k, p in g.players.items():
            if p.player_id == pid:
                asker_key = k
                asker = p
                break
    
    if not asker:
        for k, p in g.players.items():
            if p.sid == request.sid:
                asker_key = k
                asker = p
                break
    
    if not asker:
        return
    
    if not _recent_action_allowed(asker.player_id):
        return
    
    try:
        asker.add_point(10)
    except Exception:
        pass
    
    broadcast_scoreboard(g)
    g.waiting_for_ostedh_answer = True
    g._last_asker_key = asker_key
    g._last_question = question
    

    broadcast(g.code, 'question_asked', {'asker': asker.name, 'question': question})
    
    ost = g.get_ostedh()
    if ost:
        try:
            emit('answer_request', {'asker': asker.name, 'question': question}, room=ost.sid)
        except Exception:
            pass

@socketio.on('ostedh_answer')
def on_ans(d):
    code = d.get('code')
    if not code:
        return
    
    g = GROUPS.get(code)
    if not g or not g.waiting_for_ostedh_answer:
        return
    
    g.waiting_for_ostedh_answer = False
    ans = (d.get('answer') or '').strip().lower()

    broadcast(g.code, 'answer_given', {
        'answer': ans.upper(),
        'question': getattr(g, '_last_question', ''),
        'asker': getattr(g, '_last_asker_key', None)
    })
    
    asker_key = getattr(g, '_last_asker_key', None)
    asker = g.players.get(asker_key) if asker_key else None
    
    if asker:
        if ans == "yes":
            pass
        else:
            try:
                asker.add_point(-5)
            except Exception:
                pass
        broadcast_scoreboard(g)
    
    g._last_asker_key = None
    g._last_question = None
    
    try:
        g.next_turn()
        notify_turn(g)
    except Exception:
        pass

@socketio.on('try_guess')
def on_guess(d):
    g = GROUPS.get(d.get('code'))
    if not g or g.waiting_for_ostedh_decision:
        return
    
    pid = d.get('player_id')
    cur = g.get_current()
    
    if not cur:
        return
    
    if not (cur.sid == request.sid or (pid and cur.player_id == pid)):
        return
    
    if not _recent_action_allowed(pid or cur.player_id):
        return
    
    ost = g.get_ostedh()
    if not ost:
        return
    
    g.waiting_for_ostedh_decision = True
    
    cur_key = None
    for k, p in g.players.items():
        if p.sid == cur.sid:
            cur_key = k
            break
    
    if cur_key:
        guess = d.get('guess', '')
        g.pending_guesses[cur_key] = {'name': cur.name, 'guess': guess}

        broadcast(g.code, 'guess_submitted', {
            'guesser': cur.name,
            'guess': guess,
            'round': g.current_tour
        })
        
        emit('guess_for_you', {
            'guesser': cur.name,
            'guess': guess,
            'guesser_key': cur_key,
            'guesser_sid': cur.sid
        }, room=ost.sid)

@socketio.on('guess_decision')
def on_dec(d):
    g = GROUPS.get(d.get('code'))
    if not g or not g.waiting_for_ostedh_decision:
        return
    
    guesser_key = d.get('guesser_key') or d.get('guesser_sid') or d.get('guesser_id')
    if not guesser_key:
        return
    
    gd = g.pending_guesses.get(guesser_key)
    if not gd:
        name = d.get('guesser_name')
        if name:
            for k, v in g.pending_guesses.items():
                if v.get('name') == name:
                    guesser_key = k
                    gd = v
                    break
        if not gd:
            return
    
    g.waiting_for_ostedh_decision = False
    dec = (d.get('decision') or '').strip().lower()

    broadcast(g.code, 'guess_result', {
        'guesser': gd['name'],
        'guess': gd['guess'],
        'decision': dec,
        'round': g.current_tour
    })
    
    if dec == "yes":
        diff = abs(g.current_tour - (g.expected_tour or g.current_tour))
        pts = {0: (300, 400), 1: (220, 280), 2: (160, 200)}
        
        if diff in pts:
            gp, op = pts[diff]
        else:
            if diff <= 4:
                gp, op = (100, 130)
            elif diff <= 7:
                gp, op = (60, 70)
            else:
                gp = max(20, 80 - diff * 6)
                op = max(15, 60 - diff * 5)
        
        guesser = g.players.get(guesser_key)
        if guesser:
            guesser.add_point(gp)
        
        ost = g.get_ostedh()
        if ost:
            ost.add_point(op)
        
        broadcast(g.code, 'game_won', {
            'winner': gd['name'],
            'points': gp,
            'tour': g.current_tour,
            'guess': gd['guess']
        })
        
        g.right_answer = True
        broadcast_scoreboard(g)
        
        sb, winner = get_scoreboard(g)
        payload = {
            'scoreboard': sb,
            'winner': winner,
            'code': g.code,
            'ostedh_image_url': g.ostedh_image_url if g.right_answer else None
        }
        
        for p in g.players.values():
            try:
                socketio.emit('game_over', payload, room=p.sid)
            except Exception:
                pass
        
        print(f"[GAME_OVER] Group {g.code} will be cleaned up in 60 seconds")
    else:
        guesser = g.players.get(guesser_key)
        if guesser:
            guesser.add_point(-30)
        broadcast_scoreboard(g)
        g.next_turn()
        notify_turn(g)
        
        if guesser_key in g.pending_guesses:
            del g.pending_guesses[guesser_key]

@socketio.on('osteth_view_picture')
def on_osteth_view_picture(d):
    code = d.get('code')
    g = GROUPS.get(code)
    
    if not g:
        emit('osteth_picture_error', {'error': 'Group not found'}, room=request.sid)
        return
    
    ost = g.get_ostedh()
    if not ost or ost.sid != request.sid:
        emit('osteth_picture_error', {'error': 'Only Osteth can view picture'}, room=request.sid)
        return
    
    if g.ostedh_image_url:
        emit('osteth_picture', {
            'picture_url': g.ostedh_image_url,
            'expected_round': g.expected_tour,
            'description': g.secret_description,
            'theme': g.selected_theme
        }, room=request.sid)
        print(f"[OSTETH] {ost.name} viewed picture (round: {g.expected_tour})")
    else:
        emit('osteth_picture_error', {'error': 'Picture not set yet'}, room=request.sid)

@socketio.on('quit_game')
def on_quit_game(d):
    code = d.get('code')
    if not code:
        return
    
    g = GROUPS.get(code)
    if not g:
        return
    
    player = None
    player_key = None
    for k, p in g.players.items():
        if p.sid == request.sid:
            player = p
            player_key = k
            break
    
    if not player:
        return
    
    print(f"[QUIT] {player.name} quit game {g.code}")

    if player_key in g.players:
        del g.players[player_key]
    
    if player_key in g.player_order:
        g.player_order.remove(player_key)
    
    if player_key in g.pending_guesses:
        del g.pending_guesses[player_key]
   
    broadcast(g.code, 'player_left', {'name': player.name, 'id': player.player_id}, exclude_sid=request.sid)
    

    cnt = len([p for p in g.players.values() if p.role != "admin" and not p.disconnected])
    if g.game_started and cnt < 1:
        _end_game_and_cleanup(g, reason="not_enough_players")
    
    leave_room(request.sid)

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    
    for g in list(GROUPS.values()):
        player = None
        player_key = None
        for k, p in g.players.items():
            if p.sid == sid:
                player = p
                player_key = k
                break
        
        if not player:
            continue
        
        print(f"[DISCONNECT] {player.name} ({sid}) disconnected from {g.code}")
        player.disconnected = True
        
        broadcast(g.code, 'player_left', {'name': player.name, 'id': player.player_id}, exclude_sid=sid)
        
        ost = g.get_ostedh()
        if ost and ost.sid == sid and g.game_started and not g.right_answer:
            _schedule_osteth_timeout(g, seconds=20)
            broadcast(g.code, 'system', {'message': f'Osteth {player.name} disconnected. Waiting 20s...'})
        else:
            if player_key in g.pending_guesses:
                del g.pending_guesses[player_key]
            if g.waiting_for_ostedh_decision:
                g.waiting_for_ostedh_decision = False
                g.next_turn()
                notify_turn(g)
            
            cur = g.get_current()
            if cur and cur.sid == sid and g.waiting_for_ostedh_answer:
                _schedule_player_timeout(g, player_key, seconds=5)
            else:
                _schedule_player_timeout(g, player_key, seconds=5)
        
        cnt = len([p for p in g.players.values() if p.role != "admin" and not p.disconnected])
        if g.game_started and cnt < 1:
            _end_game_and_cleanup(g, reason="not_enough_players")
            break
    
    leave_room(sid)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate-id', methods=['POST'])
def gen_id():
    return jsonify({'player_id': str(uuid.uuid4())[:8].upper()})

@app.route('/api/scoreboard/<code>')
def get_sb(code):
    g = GROUPS.get(code)
    if not g:
        return jsonify({'error': 'Not found'}), 404
    
    sb, winner = get_scoreboard(g)
    resp = {'scoreboard': sb, 'winner': winner}
    
    if g.right_answer and g.ostedh_image_url:
        resp['ostedh_image_url'] = g.ostedh_image_url
    
    return jsonify(resp)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
