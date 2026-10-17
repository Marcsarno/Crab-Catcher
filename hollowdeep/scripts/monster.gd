extends CharacterBody3D
## A monster: data-driven stats, simple state machine and procedural part animation.

signal died(m)

const DATA := {
	"ghoul": {"names": ["Ghoul", "Rotting Ghoul", "Plague Ghoul"], "model": "ghoul", "hp": [9, 15], "ac": 5, "tohit": 10, "dmg": [2, 5],
		"xp": 45, "mlvl": 1, "speed": 1.5, "run": 2.1, "range": 2.0, "atk_time": 1.15, "kind": "melee",
		"snd": "ghoul", "hitsnd": "hit_flesh", "blood": Color(0.45, 0.02, 0.02), "radius": 0.42, "height": 1.8},
	"imp": {"names": ["Gnarl", "Gnarl Raider", "Gnarl Firebrand"], "model": "imp", "hp": [4, 8], "ac": 10, "tohit": 15, "dmg": [1, 4],
		"xp": 30, "mlvl": 1, "speed": 2.6, "run": 3.9, "range": 1.7, "atk_time": 0.75, "kind": "melee", "flees": true,
		"snd": "imp", "hitsnd": "hit_flesh", "blood": Color(0.5, 0.05, 0.02), "radius": 0.32, "height": 1.15},
	"skeleton": {"names": ["Bone Warrior", "Bone Soldier", "Bone Knight"], "model": "skeleton", "hp": [10, 16], "ac": 15, "tohit": 20,
		"dmg": [2, 6], "xp": 55, "mlvl": 2, "speed": 2.0, "run": 2.9, "range": 2.1, "atk_time": 0.95, "kind": "melee",
		"snd": "skel", "hitsnd": "hit_bone", "blood": Color(0.85, 0.82, 0.72), "radius": 0.38, "height": 1.8},
	"skeleton_archer": {"names": ["Bone Archer", "Bone Marksman", "Bone Sniper"], "model": "skeleton_archer", "hp": [8, 12], "ac": 10,
		"tohit": 25, "dmg": [2, 5], "xp": 60, "mlvl": 2, "speed": 2.0, "run": 2.6, "range": 15.0, "keep": 7.0, "atk_time": 1.7,
		"kind": "ranged", "proj": "arrow", "snd": "skel", "hitsnd": "hit_bone", "blood": Color(0.85, 0.82, 0.72), "radius": 0.38, "height": 1.8},
	"cultist": {"names": ["Acolyte", "Blood Acolyte", "Hollow Priest"], "model": "cultist", "hp": [12, 18], "ac": 12, "tohit": 30,
		"dmg": [3, 7], "xp": 85, "mlvl": 4, "speed": 2.0, "run": 2.6, "range": 14.0, "keep": 8.0, "atk_time": 2.2, "kind": "ranged",
		"proj": "bolt", "snd": "cultist", "hitsnd": "hit_flesh", "blood": Color(0.45, 0.02, 0.02), "radius": 0.4, "height": 1.85},
	"brute": {"names": ["The Flayer"], "model": "brute", "hp": [160, 160], "ac": 25, "tohit": 45, "dmg": [5, 11], "xp": 900,
		"mlvl": 6, "speed": 2.4, "run": 4.0, "range": 2.7, "atk_time": 1.3, "kind": "melee", "boss": true, "snd": "brute",
		"hitsnd": "hit_flesh", "blood": Color(0.45, 0.02, 0.02), "radius": 0.75, "height": 2.7},
	"matron": {"names": ["The Hollow Matron"], "model": "matron", "hp": [300, 300], "ac": 35, "tohit": 60, "dmg": [6, 12], "xp": 2000,
		"mlvl": 12, "speed": 1.8, "run": 2.4, "range": 16.0, "keep": 6.0, "atk_time": 2.4, "kind": "ranged", "proj": "bolt_green",
		"boss": true, "snd": "matron", "hitsnd": "hit_bone", "blood": Color(0.4, 1.0, 0.5), "radius": 0.6, "height": 2.5},
}

enum S { IDLE, CHASE, ATTACK, HIT, FLEE, DEAD }

var id := ""
var d: Dictionary
var display_name := ""
var level  # level.gd
var spawn_index := -1
var mlvl := 1
var max_hp := 10.0
var hp := 10.0
var ac := 0
var tohit := 0
var dmg := Vector2i(1, 2)
var xp_value := 10
var is_boss := false
var champion := false
var state := S.IDLE
var state_t := 0.0
var atk_cd := 0.0
var struck := false
var aggro := false
var path: PackedVector3Array = []
var path_t := 0.0
var think_t := 0.0
var walk_phase := 0.0
var move_amount := 0.0
var hit_anim := 0.0
var summon_t := 8.0
var blink_t := 0.0
var home := Vector3.ZERO
var wander_target := Vector3.ZERO
var wander_t := 0.0
var model: Node3D
var parts := {}
var rest := {}
var aura: OmniLight3D


func setup(monster_id: String, depth: int, rng: RandomNumberGenerator, idx: int, lvl) -> void:
	id = monster_id
	d = DATA[id]
	level = lvl
	spawn_index = idx
	is_boss = d.get("boss", false)
	var tier := clampi(depth - 1, 0, 2)
	var names: Array = d.names
	display_name = names[min(tier, names.size() - 1)]
	var hp_mult := 1.0 + 0.75 * tier
	var dmg_mult := 1.0 + 0.4 * tier
	if is_boss:
		hp_mult = 1.0
		dmg_mult = 1.0
		tier = 0
	mlvl = d.mlvl + tier * 3
	max_hp = rng.randi_range(d.hp[0], d.hp[1]) * hp_mult
	ac = d.ac + tier * 6
	tohit = d.tohit + tier * 6
	dmg = Vector2i(int(d.dmg[0] * dmg_mult), int(d.dmg[1] * dmg_mult + 0.5))
	xp_value = int(d.xp * (1.0 + 0.7 * tier))
	if not is_boss and rng.randf() < 0.07:
		champion = true
		display_name = "%s Champion" % display_name
		max_hp *= 2.4
		dmg = Vector2i(int(dmg.x * 1.3) + 1, int(dmg.y * 1.3) + 1)
		xp_value *= 3
		tohit += 10
	hp = max_hp


func _ready() -> void:
	add_to_group("monsters")
	add_to_group("hittable")
	collision_layer = Util.LAYER_MONSTER
	collision_mask = Util.LAYER_WORLD | Util.LAYER_MONSTER | Util.LAYER_PLAYER
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = d.radius
	cap.height = max(d.height, d.radius * 2.0 + 0.1)
	cs.shape = cap
	cs.position.y = cap.height / 2.0
	add_child(cs)
	model = Util.model(d.model)
	add_child(model)
	Util.set_vis_range(model, 46.0)
	for p in ["torso", "head", "arm_l", "arm_r", "leg_l", "leg_r", "weapon"]:
		var n := model.find_child(p, true, false)
		if n:
			parts[p] = n
			rest[p] = n.transform
	if champion:
		aura = OmniLight3D.new()
		aura.light_color = Color(0.35, 0.5, 1.0)
		aura.omni_range = 3.0
		aura.light_energy = 1.4
		aura.position.y = 1.0
		add_child(aura)
		model.scale = Vector3.ONE * 1.12
	if id == "matron":
		var l := OmniLight3D.new()
		l.light_color = Color(0.4, 1.0, 0.55)
		l.omni_range = 7.0
		l.light_energy = 1.6
		l.position.y = 2.0
		add_child(l)
	home = global_position
	wander_target = home
	think_t = randf() * 0.3


func hit_center() -> Vector3:
	return global_position + Vector3(0, d.height * 0.55, 0)


func is_alive() -> bool:
	return state != S.DEAD


func _physics_process(delta: float) -> void:
	if state == S.DEAD:
		return
	var player = level.player
	if player == null:
		return
	var to_p: Vector3 = player.global_position - global_position
	to_p.y = 0
	var dist := to_p.length()
	if dist > 48.0 and not aggro:
		return  # asleep far away
	state_t += delta
	atk_cd = max(0.0, atk_cd - delta)
	think_t -= delta
	hit_anim = max(0.0, hit_anim - delta * 4.0)
	var desired := Vector3.ZERO
	var speed: float = d.run if aggro else d.speed

	if think_t <= 0.0:
		think_t = 0.25
		if not aggro and dist < (18.0 if is_boss else 13.0) and player.alive and level.line_of_sight(hit_center(), player.eye_position()):
			set_aggro()
		if aggro and not player.alive:
			aggro = false
			state = S.IDLE

	match state:
		S.IDLE:
			wander_t -= delta
			if wander_t <= 0.0:
				wander_t = randf_range(2.0, 5.0)
				wander_target = home + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
			var wv := wander_target - global_position
			wv.y = 0
			if wv.length() > 0.5:
				desired = wv.normalized() * d.speed * 0.5
			if aggro:
				_set_state(S.CHASE)
		S.CHASE:
			if d.kind == "melee":
				if dist <= d.range and atk_cd <= 0.0:
					_set_state(S.ATTACK)
				else:
					desired = _steer_to(player.global_position, dist) * speed
			else:
				var los: bool = dist < d.range and level.line_of_sight(hit_center(), player.eye_position())
				if los and atk_cd <= 0.0:
					_set_state(S.ATTACK)
				elif los and dist < d.keep:
					desired = -to_p.normalized() * speed * 0.8
				elif not los or dist > d.range * 0.8:
					desired = _steer_to(player.global_position, dist) * speed
			if id == "matron":
				_matron_tricks(delta, dist)
		S.ATTACK:
			_face(to_p, delta * 10.0)
			var wind: float = d.atk_time * 0.45
			if not struck and state_t >= wind:
				struck = true
				_strike(player, dist)
			if state_t >= d.atk_time:
				atk_cd = randf_range(0.1, 0.5) if d.kind == "melee" else randf_range(0.6, 1.4)
				_set_state(S.CHASE)
		S.HIT:
			if state_t > (0.18 if is_boss else 0.32):
				_set_state(S.CHASE)
		S.FLEE:
			desired = -to_p.normalized() * speed
			if state_t > 2.5:
				_set_state(S.CHASE)

	if desired.length() > 0.01:
		_face(desired, delta * 8.0)
	velocity = velocity.lerp(desired, clampf(delta * 10.0, 0.0, 1.0))
	velocity.y = 0
	move_and_slide()
	global_position.y = 0.0
	move_amount = lerpf(move_amount, clampf(velocity.length() / max(0.1, d.run), 0.0, 1.0), delta * 8.0)
	_animate(delta)


func _set_state(s: int) -> void:
	state = s
	state_t = 0.0
	struck = false
	if s == S.ATTACK and d.kind == "melee":
		Sfx.play_at("swing", global_position, -4.0)


func set_aggro() -> void:
	if aggro or state == S.DEAD:
		return
	aggro = true
	if state == S.IDLE:
		_set_state(S.CHASE)
	if randf() < (1.0 if is_boss else 0.5):
		Sfx.play_at(d.snd + "_aggro", global_position, 2.0 if is_boss else -2.0)
	if is_boss:
		level.boss_engaged(self)
	# rouse nearby kin
	for m in get_tree().get_nodes_in_group("monsters"):
		if m != self and m.is_alive() and not m.aggro and m.global_position.distance_to(global_position) < 7.0:
			m.call_deferred("set_aggro")


func _steer_to(target: Vector3, dist: float) -> Vector3:
	var direct: bool = dist < 6.0 and level.line_of_sight(hit_center(), target + Vector3(0, 1.0, 0))
	if direct:
		var v := target - global_position
		v.y = 0
		return v.normalized()
	path_t -= get_physics_process_delta_time()
	if path_t <= 0.0 or path.size() == 0:
		path_t = 0.6 + randf() * 0.3
		path = level.find_path(global_position, target)
	while path.size() > 0 and Vector2(path[0].x - global_position.x, path[0].z - global_position.z).length() < 1.2:
		path.remove_at(0)
	if path.size() == 0:
		var v := target - global_position
		v.y = 0
		return v.normalized()
	var nv: Vector3 = path[0] - global_position
	nv.y = 0
	level.open_doors_near(global_position)
	return nv.normalized()


func _face(dir: Vector3, t: float) -> void:
	dir.y = 0
	if dir.length() < 0.01:
		return
	var target_yaw := atan2(-dir.x, -dir.z)
	rotation.y = lerp_angle(rotation.y, target_yaw, clampf(t, 0.0, 1.0))


func _strike(player, dist: float) -> void:
	if d.kind == "melee":
		var fwd := -global_transform.basis.z
		var to_p: Vector3 = (player.global_position - global_position)
		to_p.y = 0
		if dist <= d.range + 0.6 and fwd.dot(to_p.normalized()) > 0.2:
			player.receive_attack(self, randi_range(dmg.x, dmg.y), tohit, mlvl, false)
		if id == "brute":
			level.shake(0.25)
	else:
		var proj: String = d.proj
		var origin := hit_center() + (-global_transform.basis.z) * 0.6 + Vector3(0, 0.25, 0)
		var aim: Vector3 = player.eye_position() - Vector3(0, 0.35, 0)
		var shots := 1
		if id == "matron":
			shots = 3
		for i in shots:
			var dir := (aim - origin).normalized()
			if shots > 1:
				dir = dir.rotated(Vector3.UP, (i - 1) * 0.18)
			level.spawn_projectile(proj, origin, dir, self, randi_range(dmg.x, dmg.y), tohit)
		Sfx.play_at("bow" if proj == "arrow" else "magic_bolt", global_position, -2.0)


func _matron_tricks(delta: float, dist: float) -> void:
	summon_t -= delta
	if summon_t <= 0.0:
		summon_t = 11.0
		level.summon_minions(global_position, 2)
	if dist < 3.0:
		blink_t += delta
		if blink_t > 2.5:
			blink_t = 0.0
			level.blink_away(self)
	else:
		blink_t = 0.0


## Called by the player's attacks and spells.
func take_hit(amount: int, attacker, is_spell := false) -> void:
	if state == S.DEAD:
		return
	hp -= amount
	Util.float_text(level, hit_center() + Vector3(0, 0.6, 0), str(amount), Color(1, 0.95, 0.75) if not is_spell else Color(1, 0.6, 0.2))
	Util.burst(level, hit_center(), d.blood, 14, 3.5, 0.09)
	Sfx.play_at(d.hitsnd, global_position, -1.0)
	hit_anim = 1.0
	if d.blood.g < 0.2 and randf() < 0.5:
		Util.blood_splat(level, global_position, randf_range(0.8, 1.4))
	if hp <= 0:
		_die()
		return
	set_aggro()
	# stagger: interrupts attacks (bosses only on heavy hits)
	if not is_boss or amount >= 9:
		if state == S.ATTACK and is_boss and randf() < 0.5:
			return
		_set_state(S.HIT)
		var push: Vector3 = (global_position - attacker.global_position)
		push.y = 0
		velocity = push.normalized() * (1.0 if is_boss else 3.0)


func flee() -> void:
	if state != S.DEAD and d.get("flees", false) and not champion:
		_set_state(S.FLEE)


func _die() -> void:
	state = S.DEAD
	hp = 0
	Sfx.play_at(d.snd + "_death", global_position, 1.0 if is_boss else -1.0)
	collision_layer = 0
	collision_mask = 0
	remove_from_group("hittable")
	if aura:
		aura.queue_free()
	Util.burst(level, hit_center(), d.blood, 30, 4.5, 0.12)
	if d.blood.g < 0.2:
		Util.blood_splat(level, global_position, 1.8 if is_boss else 1.4)
	died.emit(self)
	# topple backwards and settle into a corpse
	var tw := create_tween().set_parallel(true)
	tw.tween_property(model, "rotation:x", -PI / 2.0 + randf_range(-0.1, 0.1), 0.55).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_property(model, "position:y", d.radius * 0.6, 0.55)
	tw.tween_property(model, "position:z", d.height * 0.15, 0.55)
	if d.blood.g > 0.5 and id != "matron":
		# skeletons collapse into a heap
		tw.tween_property(model, "scale", Vector3(1.0, 0.45, 1.0), 0.5)
	if id == "matron":
		tw.tween_property(model, "scale", Vector3(0.01, 0.01, 0.01), 2.0).set_delay(0.4)


func _animate(delta: float) -> void:
	if parts.is_empty():
		return
	var spd: float = 7.0 + (d.run * 1.6)
	walk_phase += delta * spd * (0.4 + move_amount)
	var sw := sin(walk_phase) * 0.7 * move_amount
	_rot("leg_l", Vector3(sw, 0, 0))
	_rot("leg_r", Vector3(-sw, 0, 0))
	var arm_l := -sw * 0.6
	var arm_r := sw * 0.6
	var torso_x := 0.0
	var torso_y := 0.0
	if state == S.ATTACK:
		var k: float = state_t / d.atk_time
		var wind := 0.45
		if d.kind == "melee":
			if k < wind:
				arm_r = lerpf(0.0, 2.5, ease(k / wind, 0.5))
				torso_x = -0.15 * k / wind
				torso_y = 0.3 * k / wind
			elif k < wind + 0.15:
				var u: float = (k - wind) / 0.15
				arm_r = lerpf(2.5, 0.4, u)
				torso_x = lerpf(-0.15, 0.3, u)
				torso_y = lerpf(0.3, -0.4, u)
			else:
				var u: float = (k - wind - 0.15) / (1.0 - wind - 0.15)
				arm_r = lerpf(0.4, 0.0, u)
				torso_x = lerpf(0.3, 0.0, u)
				torso_y = lerpf(-0.4, 0.0, u)
			if id == "brute":
				arm_l = arm_r * 0.5
		else:
			var raise := sin(clampf(k / wind, 0.0, 1.0) * PI * 0.5) * (1.0 - clampf((k - wind) / 0.3, 0.0, 1.0))
			arm_l = 1.4 * raise
			arm_r = 1.2 * raise
	elif state == S.FLEE:
		arm_l = 2.6
		arm_r = 2.6
	var hb := hit_anim * hit_anim
	torso_x -= 0.45 * hb
	_rot("arm_l", Vector3(arm_l, 0, 0))
	_rot("arm_r", Vector3(arm_r, 0, 0))
	_rot("torso", Vector3(torso_x + sin(walk_phase * 2.0) * 0.04 * move_amount, torso_y, 0))
	_rot("head", Vector3(-hb * 0.4, sin(state_t * 0.7) * 0.15 * (1.0 - move_amount), 0))
	if id == "matron":
		model.position.y = 0.35 + sin(state_t * 2.0) * 0.12
	else:
		model.position.y = absf(sin(walk_phase)) * 0.05 * move_amount


func _rot(p: String, euler: Vector3) -> void:
	if not parts.has(p):
		return
	var n: Node3D = parts[p]
	var r: Transform3D = rest[p]
	n.transform = Transform3D(r.basis * Basis.from_euler(euler), r.origin)
