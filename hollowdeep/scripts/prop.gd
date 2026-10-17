extends StaticBody3D
## Interactive world objects: chests, barrels, sarcophagi, stairs, doors, portals, NPCs, the cathedral gate.

var kind := ""
var level
var uid := ""
var used := false
var label := ""
var data := {}
var model: Node3D
var radius := 2.6
var hp := 1


func setup(k: String, lvl, id: String, extra := {}) -> void:
	kind = k
	level = lvl
	uid = id
	data = extra


func _ready() -> void:
	add_to_group("interactable")
	collision_layer = Util.LAYER_WORLD
	collision_mask = 0
	match kind:
		"chest":
			model = Util.model("chest")
			_box(Vector3(0.95, 0.9, 0.6), Vector3(0, 0.45, 0))
			label = "Open chest"
		"barrel":
			model = Util.model("barrel")
			_cyl(0.36, 1.0)
			label = "Break barrel"
			add_to_group("hittable")
		"sarcophagus":
			model = Util.model("sarcophagus")
			_box(Vector3(1.1, 1.1, 2.3), Vector3(0, 0.55, 0))
			label = "Open sarcophagus"
		"stairs_down":
			model = Util.model("stairs_down")
			_box(Vector3(3.6, 1.0, 3.6), Vector3(0, 0.5, 0))
			label = "Descend to %s" % Game.DEPTH_NAMES[level.depth + 1]
			radius = 3.6
		"stairs_up":
			model = Util.model("stairs_up")
			_box(Vector3(3.2, 4.0, 3.4), Vector3(0, 2.0, -0.4))
			label = "Climb to %s" % ("Hollowmere" if level.depth == 1 else Game.DEPTH_NAMES[level.depth - 1])
			radius = 3.4
		"gate":
			label = "Enter the Cathedral"
			radius = 4.0
		"portal":
			model = Util.model("portal")
			label = "Step into the portal"
			radius = 2.6
			_make_portal_fx()
		"npc":
			model = Util.model("npc_" + data.npc)
			_cyl(0.45, 1.8)
			label = "Talk to %s" % data.title
			radius = 3.2
		"door":
			model = Util.model("door")
			_box(Vector3(2.0, 3.2, 0.25), Vector3(0, 1.6, 0))
			_box(Vector3(1.0, 5.0, 0.5), Vector3(1.5, 2.5, 0))
			_box(Vector3(1.0, 5.0, 0.5), Vector3(-1.5, 2.5, 0))
			label = "Open door"
			remove_from_group("interactable")
	if model:
		add_child(model)
		Util.set_vis_range(model, 50.0)
	if used:
		_apply_used(false)


func _box(size: Vector3, pos: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = size
	cs.shape = b
	cs.position = pos
	add_child(cs)


func _cyl(r: float, h: float) -> void:
	var cs := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = r
	c.height = h
	cs.shape = c
	cs.position.y = h / 2.0
	add_child(cs)


func _make_portal_fx() -> void:
	var disc := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.9, 2.6)
	var m := StandardMaterial3D.new()
	m.albedo_texture = Util.tex("glow")
	m.albedo_color = Color(0.3, 0.55, 1.0, 0.9)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	q.material = m
	disc.mesh = q
	disc.position.y = 1.4
	add_child(disc)
	var p := Util.flame_particles(24, 1.4)
	p.color = Color(0.4, 0.6, 1.0)
	var g := Gradient.new()
	g.set_color(0, Color(0.6, 0.8, 1.0))
	g.set_color(1, Color(0.1, 0.2, 0.9, 0))
	p.color_ramp = g
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	p.emission_ring_axis = Vector3(0, 0, 1)
	p.emission_ring_radius = 0.9
	p.emission_ring_inner_radius = 0.8
	p.emission_ring_height = 0.1
	p.position.y = 1.4
	add_child(p)
	var l := OmniLight3D.new()
	l.light_color = Color(0.4, 0.6, 1.0)
	l.omni_range = 7.0
	l.light_energy = 2.0
	l.position.y = 1.5
	add_child(l)


func interact_pos() -> Vector3:
	return global_position + Vector3(0, 1.0, 0)


func interact_label() -> String:
	return label


func can_interact() -> bool:
	if kind in ["chest", "sarcophagus", "barrel"] and used:
		return false
	return true


func interact(player) -> void:
	match kind:
		"chest", "sarcophagus":
			if used:
				return
			_open()
		"barrel":
			take_hit(1, player)
		"stairs_down":
			level.main.change_level(level.depth + 1, "start")
		"stairs_up":
			level.main.change_level(level.depth - 1, "down")
		"gate":
			level.main.change_level(1, "start")
		"portal":
			level.main.use_portal()
		"npc":
			level.main.hud.open_npc(data.npc)


func _open() -> void:
	used = true
	Game.lstate(level.depth).used.append(uid)
	Sfx.play_at("chest" if kind == "chest" else "door", global_position)
	_apply_used(true)
	var count := 1 + (randi() % 3 if kind == "chest" else randi() % 2)
	for i in count:
		var it = Game.Items.roll_drop(level.depth * 2 + 1, 0.6)
		if it:
			level.drop_item(it, global_position + Vector3(randf_range(-1, 1), 0, 1.4).rotated(Vector3.UP, rotation.y))
	if kind == "sarcophagus" and randf() < 0.35:
		level.summon_minions(global_position + global_transform.basis.z * 1.8, 1)


func _apply_used(animate: bool) -> void:
	if model == null:
		return
	var lid := model.find_child("lid", true, false)
	if kind == "chest" and lid:
		if animate:
			create_tween().tween_property(lid, "rotation:x", -1.9, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		else:
			lid.rotation.x = -1.9
	elif kind == "sarcophagus" and lid:
		var target := Vector3(0.9, 0.0, 0.3)
		if animate:
			var tw := create_tween().set_parallel(true)
			tw.tween_property(lid, "position", lid.position + target, 0.8)
			tw.tween_property(lid, "rotation:y", 0.35, 0.8)
		else:
			lid.position += target
			lid.rotation.y = 0.35
	elif kind == "barrel":
		visible = false
		collision_layer = 0
		remove_from_group("hittable")
		remove_from_group("interactable")


## Barrels can be smashed with weapons.
func hit_center() -> Vector3:
	return global_position + Vector3(0, 0.55, 0)


func is_alive() -> bool:
	return not used


func take_hit(_amount: int, _attacker, _spell := false) -> void:
	if kind != "barrel" or used:
		return
	used = true
	Game.lstate(level.depth).used.append(uid)
	Sfx.play_at("break_wood", global_position)
	Util.burst(level, hit_center(), Color(0.45, 0.3, 0.16), 24, 4.0, 0.14)
	_apply_used(true)
	if randf() < 0.45:
		var it = Game.Items.roll_drop(level.depth * 2, 0.0)
		if it:
			level.drop_item(it, global_position)


# ---------------------------------------------------------------- doors
var door_open := false


func open_door() -> void:
	if kind != "door" or door_open:
		return
	door_open = true
	Sfx.play_at("door", global_position, -2.0)
	var leaf := model.find_child("leaf", true, false)
	if leaf:
		create_tween().tween_property(leaf, "rotation:y", -1.75, 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	# drop only the leaf collider (first shape), keep the posts
	for c in get_children():
		if c is CollisionShape3D:
			c.disabled = true
			break
	level.door_opened(self)
