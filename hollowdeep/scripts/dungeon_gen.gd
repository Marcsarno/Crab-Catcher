extends RefCounted
## Grid dungeon layout: rooms joined by corridors, plus door, stairs and boss-room placement.

const WALL := 0
const ROOM := 1
const HALL := 2

var w := 40
var h := 40
var grid := PackedByteArray()
var room_id := PackedInt32Array()
var rooms: Array[Rect2i] = []
var doors: Array = []  # {cell: Vector2i, axis: "x"|"z"}
var start_room := 0
var end_room := -1
var boss_room := -1
var stairs_up := Vector2i.ZERO
var stairs_down := Vector2i(-1, -1)
var rng := RandomNumberGenerator.new()


func at(x: int, y: int) -> int:
	if x < 0 or y < 0 or x >= w or y >= h:
		return WALL
	return grid[y * w + x]


func setc(x: int, y: int, v: int) -> void:
	grid[y * w + x] = v


func floor_at(x: int, y: int) -> bool:
	return at(x, y) != WALL


func generate(seed_value: int, depth: int) -> void:
	rng.seed = seed_value
	w = 34 + depth * 4
	h = 34 + depth * 4
	grid.resize(w * h)
	grid.fill(WALL)
	room_id.resize(w * h)
	room_id.fill(-1)
	rooms.clear()
	doors.clear()
	var want_boss := depth >= 2
	var tries := 0
	var target := 11 + depth * 2
	while rooms.size() < target and tries < 600:
		tries += 1
		var rw := rng.randi_range(3, 7)
		var rh := rng.randi_range(3, 7)
		if want_boss and rooms.size() == 0:
			rw = 7
			rh = 7
		var r := Rect2i(rng.randi_range(1, w - rw - 2), rng.randi_range(1, h - rh - 2), rw, rh)
		var ok := true
		for o in rooms:
			if o.grow(2).intersects(r):
				ok = false
				break
		if ok:
			rooms.append(r)
	for i in rooms.size():
		var r := rooms[i]
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				setc(x, y, ROOM)
				room_id[y * w + x] = i
	_connect_rooms()
	_pick_special_rooms(want_boss)
	_place_doors()
	_place_stairs(depth)


func center(i: int) -> Vector2i:
	var r := rooms[i]
	return r.position + r.size / 2


func _connect_rooms() -> void:
	# Prim's MST over room centres, then a few extra loops
	var connected := [0]
	var edges: Array = []
	var remaining := range(1, rooms.size())
	while remaining.size() > 0:
		var best := Vector3i(-1, -1, 1 << 30)
		for a in connected:
			for b in remaining:
				var d := (center(a) - center(b)).length_squared()
				if d < best.z:
					best = Vector3i(a, b, d)
		edges.append(Vector2i(best.x, best.y))
		connected.append(best.y)
		remaining.erase(best.y)
	for i in rooms.size() / 3:
		var a := rng.randi_range(0, rooms.size() - 1)
		var b := rng.randi_range(0, rooms.size() - 1)
		if a != b and (center(a) - center(b)).length() < 16:
			edges.append(Vector2i(a, b))
	for e in edges:
		_carve(center(e.x), center(e.y))


func _carve(a: Vector2i, b: Vector2i) -> void:
	var p := a
	var horiz_first := rng.randf() < 0.5
	var steps := 0
	while p != b and steps < 400:
		steps += 1
		var dx := signi(b.x - p.x)
		var dy := signi(b.y - p.y)
		if horiz_first:
			p.x += dx if dx != 0 else 0
			if dx == 0:
				p.y += dy
		else:
			p.y += dy if dy != 0 else 0
			if dy == 0:
				p.x += dx
		if at(p.x, p.y) == WALL:
			setc(p.x, p.y, HALL)


func _pick_special_rooms(want_boss: bool) -> void:
	start_room = rooms.size() - 1
	if want_boss:
		boss_room = 0
		# keep the boss lair far from where the hero arrives
		var far := -1.0
		for i in range(1, rooms.size()):
			var d := Vector2(center(i) - center(0)).length()
			if d > far:
				far = d
				start_room = i
	# farthest room from the start gets the stairs down
	var best := -1.0
	for i in rooms.size():
		if i == start_room or i == boss_room:
			continue
		var d := Vector2(center(i) - center(start_room)).length()
		if d > best:
			best = d
			end_room = i


func _place_doors() -> void:
	for i in rooms.size():
		var r := rooms[i]
		var candidates: Array = []
		for x in range(r.position.x, r.end.x):
			candidates.append([Vector2i(x, r.position.y - 1), "x", Vector2i(1, 0)])
			candidates.append([Vector2i(x, r.end.y), "x", Vector2i(1, 0)])
		for y in range(r.position.y, r.end.y):
			candidates.append([Vector2i(r.position.x - 1, y), "z", Vector2i(0, 1)])
			candidates.append([Vector2i(r.end.x, y), "z", Vector2i(0, 1)])
		for c in candidates:
			var cell: Vector2i = c[0]
			var side: Vector2i = c[2]
			if at(cell.x, cell.y) != HALL:
				continue
			# a proper doorway: walls on both sides across the passage
			if at(cell.x + side.x, cell.y + side.y) != WALL or at(cell.x - side.x, cell.y - side.y) != WALL:
				continue
			var chance := 1.0 if i == boss_room else 0.4
			if rng.randf() < chance and not _has_door(cell):
				doors.append({"cell": cell, "axis": c[1], "room": i})


func _has_door(cell: Vector2i) -> bool:
	for d in doors:
		if d.cell == cell or (d.cell - cell).length_squared() <= 1:
			return true
	return false


func _place_stairs(depth: int) -> void:
	# stairs up: a start-room cell whose north neighbour is wall
	var r := rooms[start_room]
	var opts: Array = []
	for x in range(r.position.x + 1, r.end.x - 1):
		if at(x, r.position.y - 1) == WALL:
			opts.append(Vector2i(x, r.position.y))
	if opts.is_empty():
		for x in range(r.position.x, r.end.x):
			if at(x, r.position.y - 1) == WALL:
				opts.append(Vector2i(x, r.position.y))
	stairs_up = opts[rng.randi_range(0, opts.size() - 1)] if opts.size() > 0 else r.position
	if depth < 3:
		stairs_down = center(end_room)


## Spawn point for the hero: the cell just south of the stairs up.
func start_cell() -> Vector2i:
	return stairs_up + Vector2i(0, 1)


func is_room_interior(c: Vector2i) -> bool:
	return room_id[c.y * w + c.x] >= 0
