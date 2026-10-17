extends Node
## Global game state: the hero, inventory, quests, per-level persistence and saving.

signal stats_changed
signal inventory_changed
signal message(text: String, color: Color)
signal leveled_up(new_level: int)

const SAVE_PATH := "user://hollowdeep_save.json"
const MAX_DEPTH := 3
const INV_SIZE := 40
const BELT_SIZE := 4
const XP_TABLE := [0, 0, 250, 650, 1300, 2300, 3800, 5800, 8500, 12000, 16500, 22000, 28000, 35000, 43000, 52000]
const DEPTH_NAMES := ["Hollowmere", "The Cathedral", "The Charnel Halls", "The Ossuary"]

var Items = preload("res://scripts/items.gd").new()

# --- hero ---
var hero_name := "Wanderer"
var clvl := 1
var xp := 0
var base_str := 30
var base_mag := 10
var base_dex := 20
var base_vit := 25
var stat_points := 0
var hp := 70.0
var mana := 10.0
var gold := 100

# --- items ---
var inventory: Array = []  # Array of item dicts (null for empty)
var equip := {"weapon": null, "shield": null, "armor": null, "helm": null, "ring": null, "amulet": null}
var belt: Array = []

# --- world ---
var depth := 0
var max_depth_reached := 0
var seeds := {}
var level_state := {}  # depth(String) -> {killed:[], used:[], items:[], explored:""}
var quests := {"flayer": 0, "matron": 0}  # 0 unknown, 1 given, 2 done, 3 rewarded
var portal := {}  # {depth, pos:[x,y,z]} when a town portal is open
var victory_seen := false
var music_on := true
var sfx_on := true
var spawn_hint := "start"  # where to put the hero on level entry: start | down | up | portal

# --- shop stock ---
var smith_stock: Array = []
var healer_stock: Array = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_input()
	new_game()


func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A], "move_right": [KEY_D],
		"turn_left": [KEY_Q, KEY_LEFT], "turn_right": [KEY_E, KEY_RIGHT],
		"attack": [KEY_SPACE], "interact": [KEY_F, KEY_ENTER],
		"spell": [KEY_R], "heal_spell": [KEY_H], "inventory": [KEY_I, KEY_B], "character": [KEY_C],
		"map": [KEY_TAB, KEY_M], "belt1": [KEY_1], "belt2": [KEY_2], "belt3": [KEY_3], "belt4": [KEY_4],
		"pause": [KEY_ESCAPE, KEY_P],
	}
	for action in keys:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)


func new_game() -> void:
	clvl = 1
	xp = 0
	base_str = 30
	base_mag = 10
	base_dex = 20
	base_vit = 25
	stat_points = 0
	gold = 100
	depth = 0
	max_depth_reached = 0
	quests = {"flayer": 0, "matron": 0}
	portal = {}
	victory_seen = false
	level_state = {}
	seeds = {}
	var r := RandomNumberGenerator.new()
	r.randomize()
	for d in range(1, MAX_DEPTH + 1):
		seeds[str(d)] = r.randi()
	inventory = []
	inventory.resize(INV_SIZE)
	belt = []
	belt.resize(BELT_SIZE)
	for k in equip:
		equip[k] = null
	equip["weapon"] = Items.make_base("short_sword")
	equip["shield"] = Items.make_base("buckler")
	equip["armor"] = Items.make_base("rags")
	belt[0] = Items.make_base("potion_heal")
	belt[1] = Items.make_base("potion_heal")
	belt[2] = Items.make_base("potion_mana")
	inventory[0] = Items.make_base("scroll_portal")
	restock_shops()
	hp = max_hp()
	mana = max_mana()
	spawn_hint = "start"


# ----------------------------------------------------------- derived stats
func _affix_sum(key: String) -> float:
	var total := 0.0
	for slot in equip:
		var it = equip[slot]
		if it and it.has("affixes") and it.affixes.has(key):
			total += float(it.affixes[key])
	return total


func strength() -> int:
	return base_str + int(_affix_sum("str"))


func magic() -> int:
	return base_mag + int(_affix_sum("mag"))


func dexterity() -> int:
	return base_dex + int(_affix_sum("dex"))


func vitality() -> int:
	return base_vit + int(_affix_sum("vit"))


func max_hp() -> float:
	return 2.0 * vitality() + 2.0 * clvl + 18.0 + _affix_sum("hp")


func max_mana() -> float:
	return float(magic()) + float(clvl - 1) + _affix_sum("mana")


func armor_class() -> int:
	var ac := dexterity() / 5.0
	for slot in ["shield", "armor", "helm"]:
		var it = equip[slot]
		if it:
			ac += it.get("ac", 0) * (1.0 + it.get("affixes", {}).get("ac_pct", 0) / 100.0)
	return int(ac)


func to_hit() -> int:
	return int(50 + dexterity() / 2.0 + clvl + 20 + _affix_sum("tohit"))


func weapon() -> Dictionary:
	return equip["weapon"] if equip["weapon"] else Items.make_base("fists")


func damage_range() -> Vector2i:
	var w := weapon()
	var pct: float = 1.0 + w.get("affixes", {}).get("dmg_pct", 0) / 100.0
	var bonus := strength() * clvl / 100.0 + _affix_sum("dmg")
	return Vector2i(int(w.min_dmg * pct + bonus), int(w.max_dmg * pct + bonus))


func roll_damage() -> int:
	var r := damage_range()
	return randi_range(r.x, max(r.x, r.y))


func attack_time() -> float:
	return weapon().get("speed", 0.5) * (1.0 - _affix_sum("speed") / 100.0)


func block_chance(mlvl: int) -> int:
	if equip["shield"] == null:
		return 0
	return clampi(dexterity() + 2 * (clvl - mlvl) + 30, 0, 75)


func spell_damage() -> Vector2i:
	var b := magic() / 8
	return Vector2i(1 + b + clvl / 2, 10 + b + clvl)


func heal_amount() -> float:
	return 10.0 + clvl * 4.0 + magic() / 4.0


func xp_for_next() -> int:
	return XP_TABLE[min(clvl + 1, XP_TABLE.size() - 1)]


func add_xp(amount: int, mlvl: int) -> void:
	# experience scales with the level difference, as classic ARPGs did
	var mult := clampf(1.0 + 0.1 * (mlvl - clvl), 0.25, 2.0)
	var gained := int(amount * mult)
	if gained <= 0:
		return
	xp += gained
	while clvl < XP_TABLE.size() - 1 and xp >= xp_for_next():
		clvl += 1
		stat_points += 5
		hp = max_hp()
		mana = max_mana()
		leveled_up.emit(clvl)
		message.emit("You have reached level %d!" % clvl, Color(1, 0.85, 0.4))
	stats_changed.emit()


func can_equip(it: Dictionary) -> bool:
	return strength() >= it.get("req_str", 0) and dexterity() >= it.get("req_dex", 0) and magic() >= it.get("req_mag", 0)


# --------------------------------------------------------------- inventory
func free_slot() -> int:
	for i in INV_SIZE:
		if inventory[i] == null:
			return i
	return -1


func add_item(it: Dictionary) -> bool:
	if it.kind == "gold":
		gold += it.amount
		stats_changed.emit()
		return true
	if it.kind == "potion":
		for i in BELT_SIZE:
			if belt[i] == null:
				belt[i] = it
				inventory_changed.emit()
				return true
	var s := free_slot()
	if s < 0:
		message.emit("I have no room.", Color(1, 0.4, 0.3))
		return false
	inventory[s] = it
	inventory_changed.emit()
	return true


func equip_from_inventory(idx: int) -> bool:
	var it = inventory[idx]
	if it == null:
		return false
	var slot: String = Items.slot_for(it)
	if slot == "":
		return false
	if not can_equip(it):
		message.emit("I am not strong enough to use that.", Color(1, 0.4, 0.3))
		return false
	var old = equip[slot]
	equip[slot] = it
	inventory[idx] = old
	_clamp_vitals()
	inventory_changed.emit()
	stats_changed.emit()
	return true


func unequip(slot: String) -> bool:
	var it = equip[slot]
	if it == null:
		return false
	var s := free_slot()
	if s < 0:
		message.emit("I have no room.", Color(1, 0.4, 0.3))
		return false
	inventory[s] = it
	equip[slot] = null
	_clamp_vitals()
	inventory_changed.emit()
	stats_changed.emit()
	return true


func _clamp_vitals() -> void:
	hp = min(hp, max_hp())
	mana = min(mana, max_mana())


func spend_point(stat: String) -> void:
	if stat_points <= 0:
		return
	stat_points -= 1
	match stat:
		"str": base_str += 1
		"mag": base_mag += 1
		"dex": base_dex += 1
		"vit":
			base_vit += 1
			hp += 2
	stats_changed.emit()


## Uses a consumable. Returns true if consumed.
func use_consumable(it: Dictionary) -> bool:
	match it.get("effect", ""):
		"heal":
			if hp >= max_hp():
				return false
			hp = min(max_hp(), hp + max_hp() * 0.4 + 8)
			Sfx.play("drink")
		"mana":
			if mana >= max_mana():
				return false
			mana = min(max_mana(), mana + max_mana() * 0.5 + 6)
			Sfx.play("drink")
		"rejuv":
			hp = max_hp()
			mana = max_mana()
			Sfx.play("drink")
		"portal":
			if depth == 0:
				message.emit("I can not use that here.", Color(1, 0.4, 0.3))
				return false
			get_tree().call_group("main", "open_town_portal")
		_:
			return false
	stats_changed.emit()
	return true


func use_belt(i: int) -> void:
	if i < 0 or i >= BELT_SIZE or belt[i] == null:
		return
	if use_consumable(belt[i]):
		belt[i] = null
		# refill the belt from the pack
		for j in INV_SIZE:
			var it = inventory[j]
			if it and it.kind == "potion":
				belt[i] = it
				inventory[j] = null
				break
		inventory_changed.emit()


# ----------------------------------------------------------- level state
func lstate(d: int) -> Dictionary:
	var k := str(d)
	if not level_state.has(k):
		level_state[k] = {"killed": [], "used": [], "items": [], "explored": ""}
	return level_state[k]


func restock_shops() -> void:
	smith_stock = []
	var ilvl := clampi(clvl + max_depth_reached * 2, 1, 20)
	for i in 8:
		smith_stock.append(Items.random_equipment(ilvl, 0.35 if i > 3 else 0.0, true))
	healer_stock = [Items.make_base("potion_heal"), Items.make_base("potion_mana"), Items.make_base("scroll_portal")]
	if max_depth_reached >= 2:
		healer_stock.append(Items.make_base("potion_rejuv"))


# ---------------------------------------------------------------- saving
func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func save_game() -> void:
	var data := {
		"v": 1, "clvl": clvl, "xp": xp, "str": base_str, "mag": base_mag, "dex": base_dex, "vit": base_vit,
		"points": stat_points, "hp": hp, "mana": mana, "gold": gold, "inventory": inventory, "equip": equip,
		"belt": belt, "depth": depth, "maxd": max_depth_reached, "seeds": seeds, "levels": level_state,
		"quests": quests, "portal": portal, "victory": victory_seen, "music": music_on, "sfx": sfx_on,
		"smith": smith_stock, "healer": healer_stock,
	}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()


func load_game() -> bool:
	if not has_save():
		return false
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return false
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if typeof(data) != TYPE_DICTIONARY:
		return false
	clvl = int(data.clvl)
	xp = int(data.xp)
	base_str = int(data.str)
	base_mag = int(data.mag)
	base_dex = int(data.dex)
	base_vit = int(data.vit)
	stat_points = int(data.points)
	gold = int(data.gold)
	inventory = _fix_items(data.inventory)
	inventory.resize(INV_SIZE)
	belt = _fix_items(data.belt)
	belt.resize(BELT_SIZE)
	for k in equip:
		equip[k] = _fix_item(data.equip.get(k))
	max_depth_reached = int(data.maxd)
	seeds = data.seeds
	level_state = data.levels
	quests = data.quests
	for q in quests:
		quests[q] = int(quests[q])
	portal = data.portal
	victory_seen = bool(data.victory)
	music_on = bool(data.get("music", true))
	sfx_on = bool(data.get("sfx", true))
	smith_stock = _fix_items(data.get("smith", []))
	healer_stock = _fix_items(data.get("healer", []))
	if smith_stock.is_empty():
		restock_shops()
	hp = clampf(float(data.hp), 1.0, max_hp())
	mana = clampf(float(data.mana), 0.0, max_mana())
	depth = 0
	spawn_hint = "start"
	return true


func _fix_items(arr) -> Array:
	var out: Array = []
	for it in arr:
		out.append(_fix_item(it))
	return out


func _fix_item(it):
	if it == null or typeof(it) != TYPE_DICTIONARY:
		return null
	# JSON turns ints into floats; normalise the numeric fields we compare
	for k in ["min_dmg", "max_dmg", "ac", "req_str", "req_dex", "req_mag", "value", "amount", "rarity", "ilvl"]:
		if it.has(k):
			it[k] = int(it[k])
	return it
