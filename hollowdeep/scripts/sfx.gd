extends Node
## Sound effects (pooled, optional 3D positioning) and cross-faded music.

const POOL := 14
var _players: Array[AudioStreamPlayer] = []
var _players3d: Array[AudioStreamPlayer3D] = []
var _cache := {}
var _music_a: AudioStreamPlayer
var _music_b: AudioStreamPlayer
var _current_music := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in POOL:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
		var p3 := AudioStreamPlayer3D.new()
		p3.unit_size = 6.0
		p3.max_distance = 40.0
		p3.attenuation_filter_cutoff_hz = 20500
		add_child(p3)
		_players3d.append(p3)
	_music_a = AudioStreamPlayer.new()
	_music_b = AudioStreamPlayer.new()
	add_child(_music_a)
	add_child(_music_b)


func _stream(name: String) -> AudioStream:
	if not _cache.has(name):
		var path := "res://assets/audio/%s.wav" % name
		if not ResourceLoader.exists(path):
			path = "res://assets/audio/%s.ogg" % name
		_cache[name] = load(path) if ResourceLoader.exists(path) else null
	return _cache[name]


func play(name: String, volume_db := 0.0, pitch_var := 0.08) -> void:
	if not Game.sfx_on:
		return
	var s := _stream(name)
	if s == null:
		return
	for p in _players:
		if not p.playing:
			p.stream = s
			p.volume_db = volume_db
			p.pitch_scale = 1.0 + randf_range(-pitch_var, pitch_var)
			p.play()
			return


func play_at(name: String, pos: Vector3, volume_db := 0.0, pitch_var := 0.1) -> void:
	if not Game.sfx_on:
		return
	var s := _stream(name)
	if s == null:
		return
	for p in _players3d:
		if not p.playing:
			p.stream = s
			p.global_position = pos
			p.volume_db = volume_db
			p.pitch_scale = 1.0 + randf_range(-pitch_var, pitch_var)
			p.play()
			return


func music(name: String) -> void:
	if name == _current_music:
		return
	_current_music = name
	var old := _music_a if _music_a.playing else _music_b
	var nxt := _music_b if old == _music_a else _music_a
	if old.playing:
		var tw := create_tween()
		tw.tween_property(old, "volume_db", -40.0, 1.5)
		tw.tween_callback(old.stop)
	if name == "" or not Game.music_on:
		return
	var s := _stream(name)
	if s is AudioStreamOggVorbis:
		s.loop = true
	nxt.stream = s
	nxt.volume_db = -40.0
	nxt.play()
	var tw2 := create_tween()
	tw2.tween_property(nxt, "volume_db", -6.0, 2.0)


func set_music_enabled(on: bool) -> void:
	Game.music_on = on
	var n := _current_music
	_current_music = "__"
	if on:
		music(n)
	else:
		_music_a.stop()
		_music_b.stop()
		_current_music = n
