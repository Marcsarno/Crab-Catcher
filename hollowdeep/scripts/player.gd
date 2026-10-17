extends CharacterBody3D
## The hero: first-person movement, melee combat with aim assist, spells, interaction and the view model.

const EYE := 1.62
const SPEED := 5.2
const LOOK_SENS := 0.0042
const FIREBOLT_COST := 6.0
const HEAL_COST := 5.0

var main
var level
var hud
var cam: Camera3D
var yaw := 0.0
var pitch := 0.0
var alive := true
var active := false
var attack_t := -1.0
var attack_dur := 0.5
var attack_hit_done := false
var attack_target = null
var cast_t := -1.0
var block_t := 0.0
var bob_t := 0.0
var shake_amt := 0.0
var step_dist := 0.0
var step_i := 0
var interact_t := 0.0
var interact_target = null
var view: Node3D
var hand_r: Node3D
var hand_l: Node3D
var weapon_node: Node3D
var shield_node: Node3D
var light: OmniLight3D
var _weapon_key := ""
var _shield_key := ""
var swing_dir := 1.0


func _ready() -> void:
	add_to_group("player")
	collision_layer = Util.LAYER_PLAYER
	collision_mask = Util.LAYER_WORLD | Util.LAYER_MONSTER
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	cam = Camera3D.new()
	cam.position.y = EYE
	cam.fov = 88.0
	cam.near = 0.05
	cam.far = 120.0
	add_child(cam)
	light = OmniLight3D.new()
	light.light_color = Color(1.0, 0.82, 0.62)
	light.omni_range = 12.0
	light.omni_attenuation = 1.4
	light.light_energy = 1.25
	light.position = Vector3(0.3, 0.1, -0.2)
	cam.add_child(light)
	_build_view()
	Game.inventory_changed.connect(_refresh_gear)
	Game.stats_changed.connect(_refresh_gear)


func _build_view() -> void:
	view = Node3D.new()
	cam.add_child(view)
	hand_r = Node3D.new()
	view.add_child(hand_r)
	var arm_r := Util.model("fp_arm_r")
	hand_r.add_child(arm_r)
	hand_l = Node3D.new()
	view.add_child(hand_l)
	var arm_l := Util.model("fp_arm_l")
	hand_l.add_child(arm_l)
	for n in [hand_r, hand_l]:
		_no_shadow(n)
	_refresh_gear()


func _no_shadow(n: Node) -> void:
	if n is GeometryInstance3D:
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for c in n.get_children():
		_no_shadow(c)


func _refresh_gear() -> void:
	if hand_r == null:
		return
	var w = Game.equip["weapon"]
	var key: String = w.model + str(w.get("scale", 1.0)) if w else "none"
	if key != _weapon_key:
		_weapon_key = key
		if weapon_node:
			weapon_node.queue_free()
			weapon_node = null
		if w and w.model != "":
			weapon_node = Util.model(w.model)
			weapon_node.scale = Vector3.ONE * w.get("scale", 1.0) * 0.8
			hand_r.add_child(weapon_node)
			_no_shadow(weapon_node)
	var s = Game.equip["shield"]
	var skey: String = s.model + str(s.get("scale", 1.0)) if s else "none"
	if skey != _shield_key:
		_shield_key = skey
		if shield_node:
			shield_node.queue_free()
			shield_node = null
		if s:
			shield_node = Util.model(s.model)
			shield_node.scale = Vector3.ONE * s.get("scale", 1.0) * 0.7
			shield_node.position = Vector3(0.02, 0.0, 0.0)
			hand_l.add_child(shield_node)
			_no_shadow(shield_node)


func place(pos: Vector3, facing: float) -> void:
	global_position = pos
	yaw = facing
	pitch = 0.0
	rotation.y = yaw
	velocity = Vector3.ZERO
	alive = true
	cam.position = Vector3(0, EYE, 0)
	cam.rotation = Vector3.ZERO
	light.light_energy = 0.7 if level.depth == 0 else 1.25
	light.omni_range = 9.0 if level.depth == 0 else 12.0


func eye_position() -> Vector3:
	return global_position + Vector3(0, EYE - 0.1, 0)


func forward() -> Vector3:
	return Vector3(-sin(yaw), 0, -cos(yaw))


func _physics_process(delta: float) -> void:
	if not active:
		return
	var ctl = hud.controls if hud else null
	# ------------------------------------------------------------ looking
	if alive and ctl:
		var look: Vector2 = ctl.consume_look()
		yaw -= look.x * LOOK_SENS
		pitch = clampf(pitch - look.y * LOOK_SENS, -0.75, 0.6)
	if alive and not hud.menu_open():
		var turn := Input.get_axis("turn_right", "turn_left")
		yaw += turn * 2.6 * delta
	# gently steer toward a committed melee target
	if attack_target and is_instance_valid(attack_target) and attack_t >= 0.0 and attack_t < 0.55:
		var to: Vector3 = attack_target.global_position - global_position
		var want := atan2(-to.x, -to.z)
		yaw = lerp_angle(yaw, want, clampf(delta * 9.0, 0.0, 1.0))
	rotation.y = yaw
	# ------------------------------------------------------------ moving
	var mv := Vector2.ZERO
	if alive and not hud.menu_open():
		if ctl:
			mv = ctl.move
		mv += Vector2(Input.get_axis("move_left", "move_right"), Input.get_axis("move_forward", "move_back"))
		mv = mv.limit_length(1.0)
	var slow := 0.55 if attack_t >= 0.0 else 1.0
	var wish := (transform.basis.x * mv.x + transform.basis.z * mv.y) * SPEED * slow
	velocity.x = lerpf(velocity.x, wish.x, clampf(delta * 12.0, 0.0, 1.0))
	velocity.z = lerpf(velocity.z, wish.z, clampf(delta * 12.0, 0.0, 1.0))
	velocity.y = 0.0
	move_and_slide()
	global_position.y = 0.0
	var spd := Vector2(velocity.x, velocity.z).length()
	step_dist += spd * delta
	if step_dist > 2.3:
		step_dist = 0.0
		step_i = (step_i + 1) % 3
		Sfx.play("step%d" % step_i, -10.0 if level.depth == 0 else -6.0, 0.15)
	# ------------------------------------------------------------ actions
	if alive and not hud.menu_open():
		if Input.is_action_pressed("attack") or (ctl and ctl.attack_held):
			try_attack()
		if Input.is_action_just_pressed("spell"):
			cast_firebolt()
		if Input.is_action_just_pressed("heal_spell"):
			cast_heal()
		if Input.is_action_just_pressed("interact"):
			do_interact()
		for i in 4:
			if Input.is_action_just_pressed("belt%d" % (i + 1)):
				Game.use_belt(i)
	_update_attack(delta)
	_update_view(delta, spd)
	interact_t -= delta
	if interact_t <= 0.0:
		interact_t = 0.12
		_scan(spd)


func try_attack() -> void:
	if attack_t >= 0.0 or cast_t >= 0.0 or not alive:
		return
	attack_t = 0.0
	attack_dur = Game.attack_time()
	attack_hit_done = false
	swing_dir = -swing_dir
	attack_target = _best_target(3.4, 0.35)
	Sfx.play("swing" if randf() < 0.5 else "swing2", -3.0)


func _best_target(reach: float, min_dot: float):
	var best = null
	var best_score := -INF
	var fwd := forward()
	for h in get_tree().get_nodes_in_group("hittable"):
		if not h.is_alive():
			continue
		var to: Vector3 = h.global_position - global_position
		to.y = 0
		var dist := to.length()
		var extra: float = h.d.radius if "d" in h and h.d is Dictionary else 0.4
		if dist > reach + extra:
			continue
		var dot := fwd.dot(to.normalized()) if dist > 0.01 else 1.0
		if dot < min_dot:
			continue
		var score := dot * 2.0 - dist * 0.4 + (1.0 if h.is_in_group("monsters") else 0.0)
		if score > best_score:
			best_score = score
			best = h
	return best


func _update_attack(delta: float) -> void:
	if attack_t < 0.0:
		return
	attack_t += delta / attack_dur
	if not attack_hit_done and attack_t >= 0.5:
		attack_hit_done = true
		_resolve_hit()
	if attack_t >= 1.0:
		attack_t = -1.0
		attack_target = null


func _resolve_hit() -> void:
	var t = attack_target if attack_target and is_instance_valid(attack_target) and attack_target.is_alive() else _best_target(2.8, 0.45)
	if t == null:
		return
	var to: Vector3 = t.global_position - global_position
	to.y = 0
	var extra: float = t.d.radius if "d" in t and t.d is Dictionary else 0.4
	if to.length() > 2.9 + extra:
		return
	if not t.is_in_group("monsters"):
		t.take_hit(1, self)
		return
	var chance := clampi(Game.to_hit() - t.ac, 5, 95)
	if randi() % 100 < chance:
		var dmg := Game.roll_damage()
		var crit := randi() % 100 < Game.clvl
		if crit:
			dmg *= 2
			Util.float_text(level, t.hit_center() + Vector3(0, 1.0, 0), "Critical!", Color(1, 0.5, 0.2), 48)
		t.take_hit(dmg, self)
		shake(0.06 if not crit else 0.15)
	else:
		Util.float_text(level, t.hit_center() + Vector3(0, 0.6, 0), "miss", Color(0.7, 0.7, 0.7), 48)


func cast_firebolt() -> void:
	if not alive or cast_t >= 0.0 or attack_t >= 0.0:
		return
	if Game.mana < FIREBOLT_COST:
		Game.message.emit("Not enough mana.", Color(0.5, 0.6, 1.0))
		Sfx.play("error")
		return
	Game.mana -= FIREBOLT_COST
	Game.stats_changed.emit()
	cast_t = 0.0
	var origin := cam.global_position + forward() * 0.6 + Vector3(0, -0.15, 0)
	var dir := -cam.global_transform.basis.z
	var t = _best_target(22.0, 0.9)
	if t:
		dir = (t.hit_center() - origin).normalized()
	var r := Game.spell_damage()
	level.spawn_projectile("fire", origin, dir, self, randi_range(r.x, r.y), 100)
	Sfx.play("firebolt")


func cast_heal() -> void:
	if not alive or cast_t >= 0.0:
		return
	if Game.mana < HEAL_COST:
		Game.message.emit("Not enough mana.", Color(0.5, 0.6, 1.0))
		Sfx.play("error")
		return
	if Game.hp >= Game.max_hp():
		return
	Game.mana -= HEAL_COST
	Game.hp = min(Game.max_hp(), Game.hp + Game.heal_amount())
	Game.stats_changed.emit()
	cast_t = 0.0
	Sfx.play("heal")
	Util.burst(level, global_position + Vector3(0, 1.0, 0) + forward() * 0.8, Color(0.5, 1.0, 0.6), 30, 2.0, 0.16, 1.5, 0.9, true)
	hud.flash(Color(0.3, 1.0, 0.5, 0.25))


func do_interact() -> void:
	if interact_target and is_instance_valid(interact_target) and interact_target.can_interact():
		interact_target.interact(self)
		interact_t = 0.0


func _scan(spd: float) -> void:
	var best = null
	var best_d := INF
	var fwd := forward()
	for n in get_tree().get_nodes_in_group("interactable"):
		if not n.can_interact():
			continue
		var p: Vector3 = n.interact_pos()
		var to := p - global_position
		to.y = 0
		var d := to.length()
		var reach: float = n.radius if "radius" in n else 2.3
		if d > reach:
			continue
		# auto-collect gold and potions we have room for
		if n.is_in_group("pickups") and d < 1.6:
			var it: Dictionary = n.item
			if it.kind == "gold" or (it.kind == "potion" and Game.belt.has(null)):
				n.interact(self)
				continue
		var score := d - fwd.dot(to.normalized()) * 1.2
		if score < best_d:
			best_d = score
			best = n
	interact_target = best
	hud.set_interact(best)
	# doors swing open as we approach
	if level.depth > 0:
		level.open_doors_near(global_position)
	# show what we are facing
	var tgt = null
	var tbest := INF
	for m in get_tree().get_nodes_in_group("monsters"):
		if not m.is_alive():
			continue
		var to: Vector3 = m.global_position - global_position
		to.y = 0
		var d := to.length()
		if d > 16.0:
			continue
		var dot := fwd.dot(to.normalized())
		if dot < 0.85 - clampf(2.0 / max(d, 0.5), 0.0, 0.5):
			continue
		if d < tbest and level.line_of_sight(eye_position(), m.hit_center()):
			tbest = d
			tgt = m
	hud.set_target(tgt)


func _update_view(delta: float, spd: float) -> void:
	bob_t += delta * (spd * 1.9 + 0.8)
	var moving := clampf(spd / SPEED, 0.0, 1.0)
	var bob := Vector3(sin(bob_t * 0.5) * 0.012 * moving, -absf(sin(bob_t * 0.5)) * 0.018 * moving + sin(bob_t * 0.15) * 0.004, 0)
	var sh := Vector3.ZERO
	if shake_amt > 0.0:
		shake_amt = max(0.0, shake_amt - delta * 1.6)
		sh = Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * shake_amt * 0.12
	if alive:
		cam.position = Vector3(0, EYE + bob.y * 2.0, 0) + sh
		cam.rotation = Vector3(pitch + sh.y * 0.3, 0, sh.x * 0.2)
	# ----- right hand (weapon)
	var rest_pos := Vector3(0.25, -0.38, -0.62)
	var rest_rot := Vector3(-0.55, 0.05, 0.12)
	var pos := rest_pos + bob
	var rot := rest_rot
	if attack_t >= 0.0:
		var p := attack_t
		var raise_pos := Vector3(0.42, -0.08, -0.5)
		var raise_rot := Vector3(0.45, 0.25, -1.15)
		var end_pos := Vector3(-0.18, -0.52, -0.72)
		var end_rot := Vector3(-1.25, -0.4, 0.95)
		if swing_dir < 0:
			raise_pos = Vector3(-0.05, -0.05, -0.5)
			raise_rot = Vector3(0.6, -0.3, 1.0)
			end_pos = Vector3(0.48, -0.5, -0.66)
			end_rot = Vector3(-1.2, 0.5, -1.2)
		if p < 0.35:
			var u := ease(p / 0.35, 0.5)
			pos = rest_pos.lerp(raise_pos, u)
			rot = rest_rot.lerp(raise_rot, u)
		elif p < 0.6:
			var u := ease((p - 0.35) / 0.25, 2.2)
			pos = raise_pos.lerp(end_pos, u)
			rot = raise_rot.lerp(end_rot, u)
		else:
			var u := ease((p - 0.6) / 0.4, 0.6)
			pos = end_pos.lerp(rest_pos, u)
			rot = end_rot.lerp(rest_rot, u)
	hand_r.position = hand_r.position.lerp(pos, clampf(delta * 30.0, 0.0, 1.0))
	hand_r.rotation = hand_r.rotation.lerp(rot, clampf(delta * 30.0, 0.0, 1.0))
	# ----- left hand (shield / casting)
	var lpos := Vector3(-0.38, -0.5, -0.66) + Vector3(-bob.x, bob.y, 0)
	var lrot := Vector3(0.05, 0.75, 0.1)
	if block_t > 0.0:
		block_t -= delta
		lpos = Vector3(-0.14, -0.3, -0.5)
		lrot = Vector3(0.0, 0.05, 0.0)
	if cast_t >= 0.0:
		cast_t += delta / 0.45
		var k := sin(clampf(cast_t, 0.0, 1.0) * PI)
		lpos = lpos.lerp(Vector3(-0.2, -0.25, -0.75), k)
		lrot = lrot.lerp(Vector3(0.5, 0.0, 0.0), k)
		if cast_t >= 1.0:
			cast_t = -1.0
	hand_l.position = hand_l.position.lerp(lpos, clampf(delta * 18.0, 0.0, 1.0))
	hand_l.rotation = hand_l.rotation.lerp(lrot, clampf(delta * 18.0, 0.0, 1.0))


func shake(amount: float) -> void:
	shake_amt = max(shake_amt, amount)


## Called by monster melee hits and projectiles.
func receive_attack(attacker, dmg: int, tohit: int, mlvl: int, magic: bool) -> void:
	if not alive:
		return
	if not magic:
		var chance := clampi(30 + tohit + 2 * (mlvl - Game.clvl) - Game.armor_class(), 15, 95)
		if randi() % 100 >= chance:
			Util.float_text(level, eye_position() + forward() * 1.2, "dodged", Color(0.75, 0.75, 0.75), 40)
			return
		if attack_t < 0.0 and randi() % 100 < Game.block_chance(mlvl):
			block_t = 0.3
			Sfx.play("hit_metal", -4.0)
			Util.float_text(level, eye_position() + forward() * 1.2, "blocked", Color(0.75, 0.8, 1.0), 40)
			Util.burst(level, eye_position() + forward() * 0.8 + Vector3(-0.3, -0.3, 0), Color(1, 0.9, 0.6), 10, 3.0, 0.05, -6.0, 0.3, true)
			return
	Game.hp -= dmg
	Game.stats_changed.emit()
	Sfx.play("player_hurt", -2.0)
	hud.flash(Color(0.8, 0.0, 0.0, clampf(0.25 + dmg / max(1.0, Game.max_hp()) * 2.0, 0.25, 0.6)))
	shake(0.2 + dmg / max(1.0, Game.max_hp()))
	if attacker and is_instance_valid(attacker):
		var push: Vector3 = global_position - attacker.global_position
		push.y = 0
		velocity += push.normalized() * 3.0
	if Game.hp <= 0:
		_die()


func _die() -> void:
	alive = false
	Game.hp = 0
	attack_t = -1.0
	Sfx.play("player_death")
	var tw := create_tween().set_parallel(true)
	tw.tween_property(cam, "position:y", 0.35, 1.2).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_property(cam, "rotation:z", 1.2, 1.0)
	tw.tween_property(cam, "rotation:x", 0.3, 1.0)
	tw.tween_property(view, "position:y", -1.0, 0.6)
	main.player_died()


func revive() -> void:
	view.position = Vector3.ZERO
	alive = true
