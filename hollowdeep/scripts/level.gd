extends Node3D
## Builds and runs one area: the town of Hollowmere (depth 0) or a dungeon level (1-3).

const DungeonGen = preload("res://scripts/dungeon_gen.gd")
const MonsterScript = preload("res://scripts/monster.gd")
const PropScript = preload("res://scripts/prop.gd")
const PickupScript = preload("res://scripts/pickup.gd")
const ProjectileScript = preload("res://scripts/projectile.gd")

const CELL := 4.0
const WALL_H := 5.0
const CHUNK := 8

var depth := 0
var main
var player
var gen
var astar: AStarGrid2D
var explored := PackedByteArray()
var torches: Array = []
var doors: Array = []
var boss
var rng := RandomNumberGenerator.new()
var _flicker_t := 0.0
var spawn_points := {}
var town_bounds := 44.0


func build(d: int, main_ref) -> void:
	depth = d
	main = main_ref
	if depth == 0:
		_build_town()
	else:
		_build_dungeon()


# =================================================================== DUNGEON
func _build_dungeon() -> void:
	gen = DungeonGen.new()
	gen.generate(int(Game.seeds[str(depth)]), depth)
	rng.seed = int(Game.seeds[str(depth)]) + 77
	var st: Dictionary = Game.lstate(depth)
	explored.resize(gen.w * gen.h)
	explored.fill(0)
	if st.explored != "":
		var raw := Marshalls.base64_to_raw(st.explored)
		if raw.size() == explored.size():
			explored = raw
	_build_geometry()
	_build_collision()
	_build_astar()
	_place_stairs()
	_place_doors()
	_place_torches()
	_place_props()
	_spawn_monsters()
	_restore_items()
	spawn_points["start"] = cell_center(gen.start_cell())
	spawn_points["start_yaw"] = PI  # facing south, away from the stairs
	var down: Vector2i = gen.stairs_down
	if down.x >= 0:
		spawn_points["down"] = cell_center(down) + Vector3(0, 0, 3.0)
		if not gen.floor_at(down.x, down.y + 1):
			spawn_points["down"] = cell_center(down) + Vector3(0, 0, -3.0)
	else:
		spawn_points["down"] = spawn_points["start"]
	spawn_points["down_yaw"] = 0.0


func cell_center(c: Vector2i) -> Vector3:
	return Vector3(c.x * CELL + CELL / 2.0, 0, c.y * CELL + CELL / 2.0)


func world_cell(p: Vector3) -> Vector2i:
	return Vector2i(int(floor(p.x / CELL)), int(floor(p.z / CELL)))


func _textures() -> Array:
	return [["wall_cathedral", "floor_cathedral"], ["wall_crypt", "floor_crypt"], ["wall_catacomb", "floor_catacomb"]][depth - 1]


func _build_geometry() -> void:
	var tx := _textures()
	var wall_mat: StandardMaterial3D = Util.world_mat(tx[0]).duplicate()
	wall_mat.vertex_color_use_as_albedo = true
	var floor_mat: StandardMaterial3D = Util.world_mat(tx[1]).duplicate()
	floor_mat.vertex_color_use_as_albedo = true
	var ceil_mat: StandardMaterial3D = Util.world_mat("ceiling").duplicate()
	ceil_mat.vertex_color_use_as_albedo = true
	for cy in range(0, gen.h, CHUNK):
		for cx in range(0, gen.w, CHUNK):
			var sf := SurfaceTool.new()
			var sw := SurfaceTool.new()
			var sc := SurfaceTool.new()
			for s in [sf, sw, sc]:
				s.begin(Mesh.PRIMITIVE_TRIANGLES)
			var nf := 0
			var nw := 0
			for y in range(cy, min(cy + CHUNK, gen.h)):
				for x in range(cx, min(cx + CHUNK, gen.w)):
					if not gen.floor_at(x, y):
						continue
					var x0 := x * CELL
					var z0 := y * CELL
					var x1 := x0 + CELL
					var z1 := z0 + CELL
					if Vector2i(x, y) != gen.stairs_down:
						var a := Vector3(x0, 0, z0)
						var b := Vector3(x1, 0, z0)
						var c := Vector3(x1, 0, z1)
						var dd := Vector3(x0, 0, z1)
						_quad(sf, [a, b, c, dd], Vector3.UP,
							[Vector2(x0, z0) / CELL, Vector2(x1, z0) / CELL, Vector2(x1, z1) / CELL, Vector2(x0, z1) / CELL],
							[_ao(x, y, -1, -1), _ao(x, y, 1, -1), _ao(x, y, 1, 1), _ao(x, y, -1, 1)])
						nf += 1
					var ca := Vector3(x0, WALL_H, z1)
					var cb := Vector3(x1, WALL_H, z1)
					var cc := Vector3(x1, WALL_H, z0)
					var cd := Vector3(x0, WALL_H, z0)
					_quad(sc, [ca, cb, cc, cd], Vector3.DOWN,
						[Vector2(x0, z1) / CELL, Vector2(x1, z1) / CELL, Vector2(x1, z0) / CELL, Vector2(x0, z0) / CELL],
						[Color(0.8, 0.8, 0.8), Color(0.8, 0.8, 0.8), Color(0.8, 0.8, 0.8), Color(0.8, 0.8, 0.8)])
					for dir in [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]:
						if gen.floor_at(x + dir.x, y + dir.y):
							continue
						var n := Vector3(-dir.x, 0, -dir.y)  # faces into this cell
						var r := Vector3.UP.cross(n)
						var e := cell_center(Vector2i(x, y)) - n * (CELL / 2.0)
						var l := e - r * (CELL / 2.0)
						var rr := e + r * (CELL / 2.0)
						var ul := l.dot(r) / 2.5
						var ur := rr.dot(r) / 2.5
						var top := Color(0.95, 0.95, 0.95)
						var bot := Color(0.42, 0.4, 0.38)
						_quad(sw, [l + Vector3.UP * WALL_H, rr + Vector3.UP * WALL_H, rr, l], n,
							[Vector2(ul, 0), Vector2(ur, 0), Vector2(ur, WALL_H / 2.5), Vector2(ul, WALL_H / 2.5)],
							[top, top, bot, bot])
						nw += 1
			if nf == 0 and nw == 0:
				continue
			var mesh := ArrayMesh.new()
			var surf := 0
			for pair in [[sf, floor_mat, nf], [sw, wall_mat, nw], [sc, ceil_mat, 1]]:
				if pair[2] == 0:
					continue
				pair[0].commit(mesh)
				mesh.surface_set_material(surf, pair[1])
				surf += 1
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(mi)


func _ao(x: int, y: int, sx: int, sy: int) -> Color:
	var walls := 0
	if not gen.floor_at(x + sx, y):
		walls += 1
	if not gen.floor_at(x, y + sy):
		walls += 1
	if not gen.floor_at(x + sx, y + sy):
		walls += 1
	var v := 1.0 - walls * 0.17
	return Color(v, v, v)


func _quad(s: SurfaceTool, v: Array, n: Vector3, uv: Array, col: Array) -> void:
	for i in [0, 1, 2, 0, 2, 3]:
		s.set_normal(n)
		s.set_uv(uv[i])
		s.set_color(col[i])
		s.add_vertex(v[i])


func _build_collision() -> void:
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	body.collision_mask = 0
	add_child(body)
	for y in gen.h:
		for x in gen.w:
			if gen.floor_at(x, y):
				continue
			var near := false
			for dy in [-1, 0, 1]:
				for dx in [-1, 0, 1]:
					if gen.floor_at(x + dx, y + dy):
						near = true
			if not near:
				continue
			var cs := CollisionShape3D.new()
			var b := BoxShape3D.new()
			b.size = Vector3(CELL, WALL_H + 2.0, CELL)
			cs.shape = b
			cs.position = cell_center(Vector2i(x, y)) + Vector3(0, WALL_H / 2.0, 0)
			body.add_child(cs)
	var fl := CollisionShape3D.new()
	var fb := BoxShape3D.new()
	fb.size = Vector3(gen.w * CELL, 1.0, gen.h * CELL)
	fl.shape = fb
	fl.position = Vector3(gen.w * CELL / 2.0, -0.5, gen.h * CELL / 2.0)
	body.add_child(fl)


func _build_astar() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, gen.w, gen.h)
	astar.cell_size = Vector2(1, 1)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	astar.update()
	for y in gen.h:
		for x in gen.w:
			if not gen.floor_at(x, y):
				astar.set_point_solid(Vector2i(x, y), true)
	if gen.stairs_down.x >= 0:
		astar.set_point_solid(gen.stairs_down, true)
	astar.set_point_solid(gen.stairs_up, true)


func find_path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var out := PackedVector3Array()
	if astar == null:
		return out
	var a := world_cell(from)
	var b := world_cell(to)
	if not astar.is_in_boundsv(a) or not astar.is_in_boundsv(b) or astar.is_point_solid(b):
		return out
	if astar.is_point_solid(a):
		return out
	var ids := astar.get_id_path(a, b, true)
	for i in range(1, ids.size()):
		out.append(cell_center(ids[i]))
	if out.size() > 0:
		out[out.size() - 1] = Vector3(to.x, 0, to.z)
	return out


func line_of_sight(a: Vector3, b: Vector3) -> bool:
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(a, b, Util.LAYER_WORLD)
	return space.intersect_ray(q).is_empty()


func _place_stairs() -> void:
	var up := PropScript.new()
	up.setup("stairs_up", self, "up")
	add_child(up)
	up.global_position = cell_center(gen.stairs_up) + Vector3(0, 0, -0.4)
	if gen.stairs_down.x >= 0:
		var dn := PropScript.new()
		dn.setup("stairs_down", self, "down")
		add_child(dn)
		dn.global_position = cell_center(gen.stairs_down)
		var l := OmniLight3D.new()
		l.light_color = Color(0.6, 0.15, 0.1)
		l.omni_range = 6.0
		l.light_energy = 1.5
		l.position = Vector3(0, -1.5, 0)
		dn.add_child(l)


func _place_doors() -> void:
	for dd in gen.doors:
		var p := PropScript.new()
		p.setup("door", self, "door")
		add_child(p)
		p.global_position = cell_center(dd.cell)
		if dd.axis == "z":
			p.rotation.y = PI / 2.0
		doors.append(p)


func open_doors_near(pos: Vector3) -> void:
	for dd in doors:
		if not dd.door_open and dd.global_position.distance_to(pos) < 3.2:
			dd.open_door()


func door_opened(_d) -> void:
	pass


func _wall_faces(room_only := true) -> Array:
	var out: Array = []
	for y in gen.h:
		for x in gen.w:
			if not gen.floor_at(x, y):
				continue
			if room_only and not gen.is_room_interior(Vector2i(x, y)):
				continue
			for dir in [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]:
				if not gen.floor_at(x + dir.x, y + dir.y):
					out.append([Vector2i(x, y), dir])
	return out


func _place_torches() -> void:
	var faces := _wall_faces(false)
	var placed: Array = []
	var trng := RandomNumberGenerator.new()
	trng.seed = rng.seed + 5
	for i in faces.size():
		var j := trng.randi_range(i, faces.size() - 1)
		var tmp = faces[i]
		faces[i] = faces[j]
		faces[j] = tmp
	for f in faces:
		var c: Vector2i = f[0]
		var dir: Vector2i = f[1]
		var n := Vector3(-dir.x, 0, -dir.y)
		var pos := cell_center(c) - n * (CELL / 2.0 - 0.05) + Vector3(0, 2.4, 0)
		var ok := true
		for p in placed:
			if p.distance_to(pos) < (9.0 if gen.is_room_interior(c) else 13.0):
				ok = false
				break
		if not ok:
			continue
		placed.append(pos)
		var t := Util.model("torch")
		add_child(t)
		t.global_position = pos
		t.basis = Basis.looking_at(n)
		var fl := Util.flame_particles(12, 1.0)
		fl.position = Vector3(0, 0.38, -0.245)
		t.add_child(fl)
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.58, 0.28)
		l.omni_range = 8.5
		l.omni_attenuation = 1.3
		l.light_energy = 1.7
		l.position = Vector3(0, 0.5, -0.7)
		l.distance_fade_enabled = true
		l.distance_fade_begin = 26.0
		l.distance_fade_length = 6.0
		t.add_child(l)
		torches.append(l)


func _process(delta: float) -> void:
	_flicker_t += delta
	if torches.size() > 0:
		for i in torches.size():
			var l: OmniLight3D = torches[i]
			l.light_energy = 1.55 + sin(_flicker_t * 9.0 + i * 1.7) * 0.12 + sin(_flicker_t * 23.0 + i) * 0.08
	if depth > 0 and player and gen:
		_mark_explored()


func _mark_explored() -> void:
	var c := world_cell(player.global_position)
	var changed := false
	var rid := -1
	if c.x >= 0 and c.y >= 0 and c.x < gen.w and c.y < gen.h:
		rid = gen.room_id[c.y * gen.w + c.x]
	for dy in range(-2, 3):
		for dx in range(-2, 3):
			var x := c.x + dx
			var y := c.y + dy
			if x < 0 or y < 0 or x >= gen.w or y >= gen.h:
				continue
			if explored[y * gen.w + x] == 0:
				explored[y * gen.w + x] = 1
				changed = true
	if rid >= 0:
		var r: Rect2i = gen.rooms[rid]
		for y in range(r.position.y - 1, r.end.y + 1):
			for x in range(r.position.x - 1, r.end.x + 1):
				if x >= 0 and y >= 0 and x < gen.w and y < gen.h and explored[y * gen.w + x] == 0:
					explored[y * gen.w + x] = 1
					changed = true
	if changed:
		Game.lstate(depth).explored = Marshalls.raw_to_base64(explored)


# ----------------------------------------------------------------- props
func _free_wall_cell(r: Rect2i, used_cells: Dictionary) -> Array:
	# a cell inside room r touching a wall but no corridor; returns [cell, wall_dir] or []
	for attempt in 30:
		var c := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
		if used_cells.has(c) or c == gen.stairs_up or c == gen.stairs_down or c == gen.start_cell():
			continue
		var bad := false
		var wall_dir := Vector2i.ZERO
		for dir in [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]:
			var v: int = gen.at(c.x + dir.x, c.y + dir.y)
			if v == DungeonGen.HALL:
				bad = true
			elif v == DungeonGen.WALL:
				wall_dir = dir
		if bad or wall_dir == Vector2i.ZERO:
			continue
		return [c, wall_dir]
	return []


func _place_props() -> void:
	var used_cells := {}
	var st: Dictionary = Game.lstate(depth)
	var idx := 0
	for ri in gen.rooms.size():
		var r: Rect2i = gen.rooms[ri]
		var big := r.size.x >= 5 and r.size.y >= 5
		if big:
			for px in [r.position.x + 1, r.end.x - 2]:
				for py in [r.position.y + 1, r.end.y - 2]:
					var c := Vector2i(px, py)
					if c == gen.stairs_down or c == gen.stairs_up or c == gen.start_cell():
						continue
					_static_model("pillar", cell_center(c), 0.0, Vector3(0.9, WALL_H, 0.9))
					astar.set_point_solid(c, true)
					used_cells[c] = true
		if ri == gen.boss_room:
			_dress_boss_room(r, used_cells)
			continue
		# barrels
		for i in rng.randi_range(0, 3):
			var spot := _free_wall_cell(r, used_cells)
			idx += 1
			if spot.is_empty():
				continue
			var n := Vector3(-spot[1].x, 0, -spot[1].y)
			var base: Vector3 = cell_center(spot[0]) - n * 1.3
			for k in rng.randi_range(1, 3):
				idx += 1
				var uid := "b%d_%d" % [idx, k]
				if uid in st.used:
					continue
				var p := PropScript.new()
				p.setup("barrel", self, uid)
				add_child(p)
				p.global_position = base + n.cross(Vector3.UP) * (k - 1) * 0.85 + Vector3(rng.randf_range(-0.1, 0.1), 0, rng.randf_range(-0.1, 0.1))
			used_cells[spot[0]] = true
		# chests and sarcophagi
		var sarc_chance: float = [0.08, 0.2, 0.45][depth - 1]
		if rng.randf() < 0.3:
			var spot := _free_wall_cell(r, used_cells)
			idx += 1
			if not spot.is_empty():
				_interactive("chest", spot, "c%d" % idx, 1.4, used_cells)
		if rng.randf() < sarc_chance:
			var spot := _free_wall_cell(r, used_cells)
			idx += 1
			if not spot.is_empty():
				_interactive("sarcophagus", spot, "s%d" % idx, 1.0, used_cells, true)
		# decorations
		if rng.randf() < 0.45:
			var spot := _free_wall_cell(r, used_cells)
			if not spot.is_empty():
				var n := Vector3(-spot[1].x, 0, -spot[1].y)
				var cpos: Vector3 = cell_center(spot[0]) - n * 1.2
				_static_model("candelabra", cpos, 0.0, Vector3(0.4, 1.5, 0.4))
				var l := OmniLight3D.new()
				l.light_color = Color(1.0, 0.7, 0.4)
				l.omni_range = 4.5
				l.light_energy = 0.9
				l.position = cpos + Vector3(0, 1.7, 0)
				l.distance_fade_enabled = true
				l.distance_fade_begin = 20.0
				add_child(l)
				used_cells[spot[0]] = true
		if rng.randf() < 0.5:
			var c := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
			if not used_cells.has(c) and c != gen.stairs_down:
				var b := Util.model("bones")
				add_child(b)
				b.global_position = cell_center(c) + Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1))
				b.rotation.y = rng.randf() * TAU
		if depth == 2 and rng.randf() < 0.35:
			for k in rng.randi_range(1, 3):
				var h := Util.model("hook")
				add_child(h)
				h.global_position = cell_center(Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))) + Vector3(rng.randf_range(-1, 1), WALL_H, rng.randf_range(-1, 1))
				h.rotation.y = rng.randf() * TAU
		if depth == 1 and big and rng.randf() < 0.4:
			var spot := _free_wall_cell(r, used_cells)
			if not spot.is_empty():
				var n := Vector3(-spot[1].x, 0, -spot[1].y)
				_static_model("altar", cell_center(spot[0]) - n * 1.0, atan2(-n.x, -n.z) + PI, Vector3(1.6, 1.1, 0.8), true)
				used_cells[spot[0]] = true
		# bodies of the fallen
		if rng.randf() < 0.25:
			var c := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
			Util.blood_splat(self, cell_center(c) + Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1)), rng.randf_range(1.0, 2.2))


func _interactive(kind: String, spot: Array, uid: String, inset: float, used_cells: Dictionary, along_wall := false) -> void:
	var n := Vector3(-spot[1].x, 0, -spot[1].y)
	var p := PropScript.new()
	p.setup(kind, self, uid)
	p.used = uid in Game.lstate(depth).used
	add_child(p)
	p.global_position = cell_center(spot[0]) - n * inset
	# models face -Z; turn them to face into the room
	p.rotation.y = atan2(n.x, n.z) + PI
	if along_wall:
		p.rotation.y += PI / 2.0
	used_cells[spot[0]] = true


func _static_model(name: String, pos: Vector3, yaw: float, col_size: Vector3, centered := false) -> Node3D:
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	body.collision_mask = 0
	add_child(body)
	body.global_position = pos
	body.rotation.y = yaw
	var m := Util.model(name)
	body.add_child(m)
	Util.set_vis_range(m, 50.0)
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = col_size
	cs.shape = b
	cs.position.y = col_size.y / 2.0
	body.add_child(cs)
	return body


func _dress_boss_room(r: Rect2i, used_cells: Dictionary) -> void:
	var c := r.position + r.size / 2
	if depth == 2:
		# the Flayer's larder
		for i in 7:
			var h := Util.model("hook")
			add_child(h)
			h.global_position = cell_center(Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))) + Vector3(rng.randf_range(-1.2, 1.2), WALL_H, rng.randf_range(-1.2, 1.2))
			h.rotation.y = rng.randf() * TAU
		for i in 2:
			var spot := _free_wall_cell(r, used_cells)
			if not spot.is_empty():
				var n := Vector3(-spot[1].x, 0, -spot[1].y)
				_static_model("cage", cell_center(spot[0]) - n * 0.9, rng.randf() * TAU, Vector3(1.2, 2.4, 1.2))
				used_cells[spot[0]] = true
		for i in 2:
			var spot := _free_wall_cell(r, used_cells)
			if not spot.is_empty():
				var n := Vector3(-spot[1].x, 0, -spot[1].y)
				_static_model("table", cell_center(spot[0]) - n * 1.0, atan2(n.x, n.z), Vector3(1.6, 0.9, 0.9))
				used_cells[spot[0]] = true
		for i in 12:
			Util.blood_splat(self, cell_center(Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))) + Vector3(rng.randf_range(-1.5, 1.5), 0, rng.randf_range(-1.5, 1.5)), rng.randf_range(1.5, 3.0))
		for i in 4:
			var b := Util.model("bones")
			add_child(b)
			b.global_position = cell_center(Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1)))
			b.rotation.y = rng.randf() * TAU
		var l := OmniLight3D.new()
		l.light_color = Color(0.9, 0.2, 0.1)
		l.omni_range = 14.0
		l.light_energy = 1.2
		l.position = cell_center(c) + Vector3(0, 3.5, 0)
		add_child(l)
	else:
		# the Matron's ossuary chapel
		var spot_pos := cell_center(Vector2i(c.x, r.position.y)) + Vector3(0, 0, -0.6)
		_static_model("altar", spot_pos, PI, Vector3(1.8, 1.1, 0.9))
		used_cells[Vector2i(c.x, r.position.y)] = true
		for k in [-2, 2]:
			var cp := cell_center(Vector2i(c.x + k, r.position.y))
			_static_model("candelabra", cp, 0.0, Vector3(0.4, 1.5, 0.4))
			used_cells[Vector2i(c.x + k, r.position.y)] = true
		for i in 4:
			var spot := _free_wall_cell(r, used_cells)
			if not spot.is_empty():
				_interactive("sarcophagus", spot, "bs%d" % i, 1.0, used_cells, true)
		var l := OmniLight3D.new()
		l.light_color = Color(0.3, 0.9, 0.5)
		l.omni_range = 16.0
		l.light_energy = 1.0
		l.position = cell_center(c) + Vector3(0, 4.0, 0)
		add_child(l)


# ---------------------------------------------------------------- monsters
const POOLS := {
	1: {"ghoul": 4, "imp": 5, "skeleton": 2},
	2: {"ghoul": 3, "imp": 3, "skeleton": 4, "skeleton_archer": 2, "cultist": 1},
	3: {"skeleton": 4, "skeleton_archer": 3, "cultist": 3, "ghoul": 2, "imp": 1},
}


func _pick_type(r: RandomNumberGenerator) -> String:
	var pool: Dictionary = POOLS[depth]
	var total := 0
	for k in pool:
		total += pool[k]
	var x := r.randi_range(1, total)
	for k in pool:
		x -= pool[k]
		if x <= 0:
			return k
	return pool.keys()[0]


func _spawn_monsters() -> void:
	var mr := RandomNumberGenerator.new()
	mr.seed = int(Game.seeds[str(depth)]) + 1234
	var killed: Array = Game.lstate(depth).killed
	var idx := 0
	for ri in gen.rooms.size():
		if ri == gen.start_room:
			continue
		var r: Rect2i = gen.rooms[ri]
		var count := clampi(int(r.get_area() / 5.0) + mr.randi_range(0, 2), 1, 7)
		var t1 := _pick_type(mr)
		var t2 := _pick_type(mr)
		if ri == gen.boss_room:
			idx += 1
			var bid := "brute" if depth == 2 else "matron"
			var bdone: bool = Game.quests["flayer" if depth == 2 else "matron"] >= 2
			if not bdone:
				var m = _spawn(bid, cell_center(r.position + r.size / 2), mr, 9999)
				boss = m
			count = 2 if depth == 2 else 3
			t1 = "imp" if depth == 2 else "skeleton"
			t2 = t1
		for i in count:
			idx += 1
			var t := t1 if (t1 == "imp" or i % 2 == 0) else t2
			var c := Vector2i(mr.randi_range(r.position.x, r.end.x - 1), mr.randi_range(r.position.y, r.end.y - 1))
			var pos := cell_center(c) + Vector3(mr.randf_range(-1.2, 1.2), 0, mr.randf_range(-1.2, 1.2))
			if idx in killed or astar.is_point_solid(c):
				mr.randf()  # keep the sequence stable
				continue
			_spawn(t, pos, mr, idx)
	# a few corridor stragglers
	for y in gen.h:
		for x in gen.w:
			if gen.at(x, y) == DungeonGen.HALL and mr.randf() < 0.035:
				idx += 1
				if idx in killed:
					continue
				var c := Vector2i(x, y)
				if (cell_center(c) - cell_center(gen.start_cell())).length() < 14.0:
					continue
				_spawn(_pick_type(mr), cell_center(c), mr, idx)


func _spawn(t: String, pos: Vector3, r: RandomNumberGenerator, idx: int):
	var m := MonsterScript.new()
	m.setup(t, depth, r, idx, self)
	m.position = pos
	m.rotation.y = r.randf() * TAU
	add_child(m)
	m.died.connect(_on_monster_died)
	return m


func summon_minions(pos: Vector3, count: int) -> void:
	if count <= 0:
		return
	var r := RandomNumberGenerator.new()
	r.randomize()
	for i in count:
		var p := pos + Vector3(r.randf_range(-2.5, 2.5), 0, r.randf_range(-2.5, 2.5))
		var c := world_cell(p)
		if astar and (not astar.is_in_boundsv(c) or astar.is_point_solid(c)):
			p = pos
		var m = _spawn("skeleton", p, r, -1)
		m.xp_value = int(m.xp_value * 0.5)
		Util.burst(self, p + Vector3(0, 0.5, 0), Color(0.4, 1.0, 0.5), 30, 3.0, 0.2, 2.0, 0.8, true)
		Sfx.play_at("portal", p, -6.0)
		m.call_deferred("set_aggro")


func blink_away(m) -> void:
	if gen.boss_room < 0:
		return
	var r: Rect2i = gen.rooms[gen.boss_room]
	Util.burst(self, m.hit_center(), Color(0.4, 1.0, 0.5), 30, 4.0, 0.2, 0.0, 0.6, true)
	for attempt in 10:
		var c := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
		if astar.is_point_solid(c):
			continue
		var p := cell_center(c)
		if p.distance_to(player.global_position) > 7.0:
			m.global_position = p
			break
	Util.burst(self, m.hit_center(), Color(0.4, 1.0, 0.5), 30, 4.0, 0.2, 0.0, 0.6, true)
	Sfx.play_at("portal", m.global_position, -4.0)


func _on_monster_died(m) -> void:
	if m.spawn_index > 0:
		Game.lstate(depth).killed.append(m.spawn_index)
	Game.add_xp(m.xp_value, m.mlvl)
	# loot
	var quality := 0.0
	if m.champion:
		quality = 1.0
	if m.is_boss:
		var it
		if m.id == "brute":
			it = Game.Items.make_unique("gutspiller")
			Game.quests.flayer = max(Game.quests.flayer, 2)
		else:
			it = Game.Items.make_unique("matrons_veil")
			Game.quests.matron = max(Game.quests.matron, 2)
		drop_item(it, m.global_position + Vector3(0, 0, 0.5))
		for i in 4:
			var extra = Game.Items.roll_drop(m.mlvl + 2, 1.0)
			if extra:
				drop_item(extra, m.global_position + Vector3(randf_range(-1.5, 1.5), 0, randf_range(-1.5, 1.5)))
		main.boss_defeated(m)
	else:
		var it = Game.Items.roll_drop(m.mlvl + depth, quality)
		if it:
			drop_item(it, m.global_position)
		if m.champion:
			var it2 = Game.Items.roll_drop(m.mlvl + depth + 2, 1.0)
			if it2:
				drop_item(it2, m.global_position + Vector3(0.6, 0, 0.3))
	# gnarls lose their nerve when kin fall
	if m.id == "imp":
		for o in get_tree().get_nodes_in_group("monsters"):
			if o != m and o.id == "imp" and o.is_alive() and o.global_position.distance_to(m.global_position) < 8.0 and randf() < 0.6:
				o.flee()


func boss_engaged(m) -> void:
	main.hud.show_boss(m)
	Sfx.music("music_boss")
	shake(0.4)
	if m.id == "brute" and Game.quests.flayer < 1:
		Game.quests.flayer = 1


# ------------------------------------------------------------------ items
func drop_item(it: Dictionary, pos: Vector3, record := true) -> void:
	var c := world_cell(pos)
	if gen and (not gen.floor_at(c.x, c.y) or (astar and astar.is_point_solid(c))):
		pos = _nearest_floor(pos)
	var p := PickupScript.new()
	p.setup(it, self)
	add_child(p)
	p.global_position = Vector3(pos.x, 0, pos.z)
	# a little toss
	var m: Node3D = p
	m.scale = Vector3.ONE * 0.2
	create_tween().tween_property(m, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if record:
		Game.lstate(depth).items.append({"item": it, "pos": [p.global_position.x, 0, p.global_position.z]})
	p.set_meta("rec", Game.lstate(depth).items.back() if record else null)


func _nearest_floor(pos: Vector3) -> Vector3:
	var c := world_cell(pos)
	for rad in range(1, 4):
		for dy in range(-rad, rad + 1):
			for dx in range(-rad, rad + 1):
				var n := c + Vector2i(dx, dy)
				if gen.floor_at(n.x, n.y) and not astar.is_point_solid(n):
					return cell_center(n) + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1))
	return pos


func _restore_items() -> void:
	var items: Array = Game.lstate(depth).items
	var copy := items.duplicate()
	items.clear()
	for rec in copy:
		var it = Game._fix_item(rec.item)
		if it:
			drop_item(it, Vector3(rec.pos[0], 0, rec.pos[2]))


func item_taken(p) -> void:
	var rec = p.get_meta("rec", null)
	if rec != null:
		Game.lstate(depth).items.erase(rec)


func spawn_projectile(kind: String, origin: Vector3, dir: Vector3, owner_ref, dmg: int, hit: int) -> void:
	var pr := ProjectileScript.new()
	pr.setup(kind, origin, dir, owner_ref, dmg, hit, self)
	add_child(pr)


func flash_light(pos: Vector3, col: Color) -> void:
	var l := OmniLight3D.new()
	l.light_color = col
	l.omni_range = 7.0
	l.light_energy = 3.0
	add_child(l)
	l.global_position = pos
	var tw := l.create_tween()
	tw.tween_property(l, "light_energy", 0.0, 0.35)
	tw.tween_callback(l.queue_free)


func shake(amount: float) -> void:
	if player:
		player.shake(amount)


# ===================================================================== TOWN
func _build_town() -> void:
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(150, 150)
	ground.mesh = pm
	ground.material_override = Util.world_mat("grass", 30.0)
	add_child(ground)
	# cobbled square and roads
	for rect in [Rect2(-11, -12, 22, 26), Rect2(-3, -32, 6, 22), Rect2(-3, 14, 6, 26), Rect2(-36, -3, 26, 6), Rect2(10, -3, 26, 6)]:
		var mi := MeshInstance3D.new()
		var q := PlaneMesh.new()
		q.size = rect.size
		mi.mesh = q
		mi.material_override = Util.world_mat("cobble", rect.size.x / 5.0).duplicate()
		mi.material_override.uv1_scale = Vector3(rect.size.x / 5.0, rect.size.y / 5.0, 1)
		add_child(mi)
		mi.position = Vector3(rect.position.x + rect.size.x / 2.0, 0.015, rect.position.y + rect.size.y / 2.0)
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	add_child(body)
	var floor_cs := CollisionShape3D.new()
	var fb := BoxShape3D.new()
	fb.size = Vector3(200, 1, 200)
	floor_cs.shape = fb
	floor_cs.position.y = -0.5
	body.add_child(floor_cs)
	# boundary walls (invisible) beyond the fog
	for i in 4:
		var cs := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(100, 10, 2) if i < 2 else Vector3(2, 10, 100)
		cs.shape = b
		var e := town_bounds
		cs.position = [Vector3(0, 5, -e), Vector3(0, 5, e), Vector3(-e, 5, 0), Vector3(e, 5, 0)][i]
		body.add_child(cs)
	# cathedral to the north; its gate is the way down
	_town_obj("cathedral", Vector3(0, 0, -40), PI, Vector3(16, 12, 6))
	var gate := PropScript.new()
	gate.setup("gate", self, "gate")
	add_child(gate)
	gate.global_position = Vector3(0, 0, -36.2)
	var gl := OmniLight3D.new()
	gl.light_color = Color(1.0, 0.3, 0.15)
	gl.omni_range = 8.0
	gl.light_energy = 1.4
	gl.position = Vector3(0, 2.5, -35.5)
	add_child(gl)
	# houses facing the square
	var houses := [["house_b", Vector3(-20, 0, -10)], ["house_a", Vector3(-21, 0, 9)], ["house_a", Vector3(20, 0, -9)],
		["house_b", Vector3(21, 0, 10)], ["house_a", Vector3(-12, 0, 26)], ["house_a", Vector3(13, 0, 27)],
		["house_b", Vector3(-30, 0, -24)], ["house_a", Vector3(31, 0, 24)]]
	for h in houses:
		var pos: Vector3 = h[1]
		var to_center := Vector3(0, 0, pos.z * 0.3) - pos
		var yaw := atan2(-to_center.x, -to_center.z)
		var sz := Vector3(8.6, 4, 6.6) if h[0] == "house_b" else Vector3(6.6, 4, 5.6)
		_town_obj(h[0], pos, yaw, sz)
	_town_obj("well", Vector3(0, 0, 0), 0.0, Vector3(2.0, 2, 2.0))
	_town_obj("cart", Vector3(-7, 0, 9), 0.6, Vector3(2.0, 1.6, 3.0))
	_town_obj("anvil", Vector3(13.5, 0, -4.5), 0.4, Vector3(1.0, 1.0, 0.5))
	# graveyard by the cathedral
	for gx in range(4):
		for gz in range(3):
			_town_obj("grave", Vector3(14 + gx * 3.0 + randf_range(-0.3, 0.3), 0, -30 + gz * 3.5), randf_range(-0.15, 0.15), Vector3(0.7, 1.2, 0.3))
			_town_obj("grave", Vector3(-26 + gx * 3.0, 0, -30 + gz * 3.5), randf_range(-0.15, 0.15) + PI, Vector3(0.7, 1.2, 0.3))
	for i in 10:
		_town_obj("fence", Vector3(11 + (i % 5) * 3.0, 0, -33 if i < 5 else -20), 0.0, Vector3(3, 1.2, 0.2))
	# dead trees around the edge
	var tr := RandomNumberGenerator.new()
	tr.seed = 42
	for i in 34:
		var a := tr.randf() * TAU
		var d := tr.randf_range(32.0, 42.0)
		var p := Vector3(cos(a) * d, 0, sin(a) * d)
		if p.z < -30 and absf(p.x) < 12:
			continue
		var t := _town_obj("tree", p, tr.randf() * TAU, Vector3(0.6, 4, 0.6))
		t.scale = Vector3.ONE * tr.randf_range(0.9, 1.5)
	for p in [Vector3(-26, 0, 2), Vector3(27, 0, -2), Vector3(-8, 0, -20), Vector3(9, 0, 18)]:
		_town_obj("tree", p, tr.randf() * TAU, Vector3(0.6, 4, 0.6))
	# lamps
	for p in [Vector3(-6, 0, -12), Vector3(6, 0, -12), Vector3(-6, 0, 12), Vector3(6, 0, 12), Vector3(-2.5, 0, -28), Vector3(2.5, 0, -28)]:
		var lamp := _town_obj("lamp", p, atan2(p.x, p.z), Vector3(0.3, 3, 0.3))
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.65, 0.35)
		l.omni_range = 11.0
		l.light_energy = 1.6
		l.position = Vector3(0, 2.6, -0.5)
		lamp.add_child(l)
		torches.append(l)
	# townsfolk
	_npc("healer", "Maera the Healer", Vector3(-15.5, 0, -5.5))
	_npc("smith", "Brannoc the Smith", Vector3(15.5, 0, -4.0))
	_npc("elder", "Elder Corwin", Vector3(3.2, 0, 2.5))
	# campfire by the elder
	var fire := Util.flame_particles(26, 2.4)
	add_child(fire)
	fire.position = Vector3(6, 0.1, 6)
	var fl := OmniLight3D.new()
	fl.light_color = Color(1.0, 0.55, 0.25)
	fl.omni_range = 9.0
	fl.light_energy = 2.0
	fl.position = Vector3(6, 1.2, 6)
	add_child(fl)
	torches.append(fl)
	for k in 6:
		var log_mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.08
		cm.bottom_radius = 0.1
		cm.height = 1.0
		var lm := StandardMaterial3D.new()
		lm.albedo_color = Color(0.2, 0.12, 0.07)
		cm.material = lm
		log_mi.mesh = cm
		add_child(log_mi)
		log_mi.position = Vector3(6, 0.15, 6)
		log_mi.rotation = Vector3(PI / 2.0 - 0.3, k * TAU / 6.0, 0)
	if not Game.portal.is_empty():
		var portal := PropScript.new()
		portal.setup("portal", self, "portal")
		add_child(portal)
		portal.global_position = Vector3(-5, 0, 6)
	spawn_points["start"] = Vector3(0, 0, 22)
	spawn_points["start_yaw"] = 0.0
	spawn_points["down"] = Vector3(0, 0, -31)
	spawn_points["down_yaw"] = PI
	spawn_points["portal"] = Vector3(-5, 0, 9)
	spawn_points["portal_yaw"] = 0.0


func _town_obj(name: String, pos: Vector3, yaw: float, col: Vector3) -> Node3D:
	return _static_model(name, pos, yaw, col)


func _npc(kind: String, title: String, pos: Vector3) -> void:
	var p := PropScript.new()
	p.setup("npc", self, kind, {"npc": kind, "title": title})
	add_child(p)
	p.global_position = pos
	var to := Vector3(0, 0, 4) - pos
	p.rotation.y = atan2(-to.x, -to.z)
	var l := Label3D.new()
	l.text = title
	l.font = preload("res://assets/fonts/Cinzel.ttf")
	l.font_size = 44
	l.pixel_size = 0.004
	l.outline_size = 10
	l.modulate = Color(0.95, 0.85, 0.6)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.position.y = 2.25
	l.visibility_range_end = 14.0
	p.add_child(l)
