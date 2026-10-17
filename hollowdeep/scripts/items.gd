extends RefCounted
## Item bases, affixes and random loot generation.

const RARITY_COLORS := [Color(0.92, 0.9, 0.85), Color(0.45, 0.6, 1.0), Color(0.95, 0.75, 0.3)]

# kind, model (glb under res://assets/models/), icon, stats
const BASES := {
	"fists": {"name": "Bare Hands", "kind": "weapon", "min_dmg": 1, "max_dmg": 3, "speed": 0.42, "model": "", "icon": "hand", "value": 0, "ilvl": 0},
	"dagger": {"name": "Dagger", "kind": "weapon", "min_dmg": 1, "max_dmg": 4, "speed": 0.36, "model": "wpn_sword", "scale": 0.6, "icon": "dagger", "value": 60, "ilvl": 1},
	"short_sword": {"name": "Short Sword", "kind": "weapon", "min_dmg": 2, "max_dmg": 6, "speed": 0.45, "model": "wpn_sword", "scale": 0.85, "icon": "sword", "value": 120, "req_str": 18, "ilvl": 1},
	"club": {"name": "Club", "kind": "weapon", "min_dmg": 1, "max_dmg": 6, "speed": 0.48, "model": "wpn_club", "icon": "club", "value": 40, "ilvl": 1},
	"hand_axe": {"name": "Hand Axe", "kind": "weapon", "min_dmg": 2, "max_dmg": 7, "speed": 0.5, "model": "wpn_axe", "scale": 0.85, "icon": "axe", "value": 140, "req_str": 22, "ilvl": 2},
	"mace": {"name": "Mace", "kind": "weapon", "min_dmg": 1, "max_dmg": 8, "speed": 0.5, "model": "wpn_mace", "icon": "mace", "value": 190, "req_str": 16, "ilvl": 2},
	"falchion": {"name": "Falchion", "kind": "weapon", "min_dmg": 4, "max_dmg": 8, "speed": 0.46, "model": "wpn_sword", "icon": "sword", "value": 280, "req_str": 30, "ilvl": 4},
	"long_sword": {"name": "Long Sword", "kind": "weapon", "min_dmg": 2, "max_dmg": 10, "speed": 0.46, "model": "wpn_blade", "scale": 0.95, "icon": "blade", "value": 350, "req_str": 30, "req_dex": 25, "ilvl": 5},
	"morning_star": {"name": "Morning Star", "kind": "weapon", "min_dmg": 3, "max_dmg": 10, "speed": 0.52, "model": "wpn_mace", "scale": 1.1, "icon": "mace", "value": 380, "req_str": 26, "ilvl": 5},
	"broad_axe": {"name": "Broad Axe", "kind": "weapon", "min_dmg": 4, "max_dmg": 12, "speed": 0.58, "model": "wpn_axe", "scale": 1.1, "icon": "axe", "value": 520, "req_str": 40, "ilvl": 7},
	"war_blade": {"name": "War Blade", "kind": "weapon", "min_dmg": 5, "max_dmg": 13, "speed": 0.5, "model": "wpn_blade", "scale": 1.05, "icon": "blade", "value": 700, "req_str": 40, "req_dex": 30, "ilvl": 9},
	"buckler": {"name": "Buckler", "kind": "shield", "ac": 3, "model": "shield_round", "scale": 0.75, "icon": "shield_round", "value": 50, "ilvl": 1},
	"round_shield": {"name": "Round Shield", "kind": "shield", "ac": 6, "model": "shield_round", "icon": "shield_round", "value": 140, "req_str": 20, "ilvl": 3},
	"kite_shield": {"name": "Kite Shield", "kind": "shield", "ac": 11, "model": "shield_kite", "icon": "shield_kite", "value": 360, "req_str": 40, "ilvl": 6},
	"rags": {"name": "Rags", "kind": "armor", "ac": 3, "model": "item_armor", "icon": "armor_leather", "value": 10, "ilvl": 1},
	"leather_armor": {"name": "Leather Armor", "kind": "armor", "ac": 8, "model": "item_armor", "icon": "armor_leather", "value": 150, "ilvl": 2},
	"studded_armor": {"name": "Studded Leather", "kind": "armor", "ac": 14, "model": "item_armor", "icon": "armor_leather", "value": 320, "req_str": 20, "ilvl": 4},
	"chain_mail": {"name": "Chain Mail", "kind": "armor", "ac": 21, "model": "item_armor", "icon": "armor", "value": 600, "req_str": 30, "ilvl": 6},
	"plate_mail": {"name": "Plate Mail", "kind": "armor", "ac": 32, "model": "item_armor", "icon": "armor_plate", "value": 1200, "req_str": 50, "ilvl": 9},
	"cap": {"name": "Cap", "kind": "helm", "ac": 2, "model": "item_helm", "icon": "helm", "value": 30, "ilvl": 1},
	"skull_cap": {"name": "Iron Cap", "kind": "helm", "ac": 4, "model": "item_helm", "icon": "helm", "value": 90, "ilvl": 2},
	"helm": {"name": "Helm", "kind": "helm", "ac": 8, "model": "item_helm", "icon": "helm", "value": 260, "req_str": 25, "ilvl": 5},
	"great_helm": {"name": "Great Helm", "kind": "helm", "ac": 13, "model": "item_helm", "icon": "helm", "value": 600, "req_str": 35, "ilvl": 8},
	"ring": {"name": "Ring", "kind": "ring", "model": "item_ring", "icon": "ring", "value": 200, "ilvl": 3, "magic_only": true},
	"amulet": {"name": "Amulet", "kind": "amulet", "model": "item_amulet", "icon": "amulet", "value": 300, "ilvl": 5, "magic_only": true},
	"potion_heal": {"name": "Potion of Healing", "kind": "potion", "effect": "heal", "model": "item_potion_red", "icon": "potion_red", "value": 50, "ilvl": 1},
	"potion_mana": {"name": "Potion of Mana", "kind": "potion", "effect": "mana", "model": "item_potion_blue", "icon": "potion_blue", "value": 50, "ilvl": 1},
	"potion_rejuv": {"name": "Potion of Rejuvenation", "kind": "potion", "effect": "rejuv", "model": "item_potion_red", "icon": "potion_purple", "value": 300, "ilvl": 6},
	"scroll_portal": {"name": "Scroll of Returning", "kind": "scroll", "effect": "portal", "model": "item_scroll", "icon": "scroll", "value": 120, "ilvl": 1},
}

const WEAPON_POOL := ["dagger", "short_sword", "club", "hand_axe", "mace", "falchion", "long_sword", "morning_star", "broad_axe", "war_blade"]
const ARMOR_POOL := ["buckler", "round_shield", "kite_shield", "leather_armor", "studded_armor", "chain_mail", "plate_mail", "cap", "skull_cap", "helm", "great_helm"]

# [name, kind-filter, key, min, max, ilvl, is_prefix]
const AFFIXES := [
	["Fine", "weapon", "tohit", 5, 15, 1, true],
	["Keen", "weapon", "tohit", 16, 30, 6, true],
	["Jagged", "weapon", "dmg_pct", 20, 35, 1, true],
	["Cruel", "weapon", "dmg_pct", 36, 60, 5, true],
	["Merciless", "weapon", "dmg_pct", 61, 90, 9, true],
	["Sturdy", "defense", "ac_pct", 20, 35, 1, true],
	["Warded", "defense", "ac_pct", 36, 60, 5, true],
	["Hallowed", "defense", "ac_pct", 61, 90, 9, true],
	["Garnet", "jewel", "hp", 6, 12, 2, true],
	["Sapphire", "jewel", "mana", 6, 12, 2, true],
	["Bloodstone", "jewel", "hp", 13, 24, 6, true],
	["of Might", "any", "str", 1, 5, 1, false],
	["of the Ox", "any", "str", 6, 10, 6, false],
	["of Wit", "any", "mag", 1, 5, 1, false],
	["of Insight", "any", "mag", 6, 10, 6, false],
	["of Grace", "any", "dex", 1, 5, 1, false],
	["of the Fox", "any", "dex", 6, 10, 6, false],
	["of Vigor", "any", "vit", 1, 5, 1, false],
	["of the Oak", "any", "vit", 6, 10, 6, false],
	["of Haste", "weapon", "speed", 8, 15, 4, false],
	["of Spikes", "weapon", "dmg", 1, 3, 1, false],
	["of Ruin", "weapon", "dmg", 4, 8, 7, false],
	["of Life", "defense", "hp", 5, 15, 3, false],
]

const AFFIX_LABELS := {
	"tohit": "+%d%% chance to hit", "dmg_pct": "+%d%% damage", "ac_pct": "+%d%% armor", "hp": "+%d life",
	"mana": "+%d mana", "str": "+%d strength", "mag": "+%d magic", "dex": "+%d dexterity", "vit": "+%d vitality",
	"speed": "+%d%% attack speed", "dmg": "+%d damage",
}

const UNIQUES := {
	"gutspiller": {"base": "broad_axe", "name": "Gutspiller", "affixes": {"dmg_pct": 80, "str": 8, "hp": 20, "tohit": 10}},
	"matrons_veil": {"base": "amulet", "name": "The Matron's Veil", "affixes": {"mag": 10, "mana": 20, "hp": 20, "vit": 6}},
	"wardens_band": {"base": "ring", "name": "Warden's Band", "affixes": {"str": 5, "dex": 5, "vit": 5, "hp": 10}},
}


func make_base(id: String) -> Dictionary:
	var b: Dictionary = BASES[id].duplicate(true)
	b["base"] = id
	b["rarity"] = 0
	b["affixes"] = {}
	if b.kind == "weapon" or b.kind in ["shield", "armor", "helm"]:
		b["name"] = b.name
	return b


func make_unique(id: String) -> Dictionary:
	var u: Dictionary = UNIQUES[id]
	var it := make_base(u.base)
	it["name"] = u.name
	it["rarity"] = 2
	it["affixes"] = u.affixes.duplicate()
	if it.has("ac"):
		it["ac"] = int(it.ac * 1.3)
	_reprice(it)
	return it


func slot_for(it: Dictionary) -> String:
	match it.get("kind", ""):
		"weapon": return "weapon"
		"shield": return "shield"
		"armor": return "armor"
		"helm": return "helm"
		"ring": return "ring"
		"amulet": return "amulet"
	return ""


func _affix_ok(a: Array, kind: String) -> bool:
	match a[1]:
		"any": return true
		"weapon": return kind == "weapon"
		"defense": return kind in ["shield", "armor", "helm"]
		"jewel": return kind in ["ring", "amulet"]
	return false


func random_equipment(ilvl: int, magic_chance: float, for_shop := false) -> Dictionary:
	var pool: Array = []
	for id in WEAPON_POOL + ARMOR_POOL:
		if BASES[id].ilvl <= ilvl and BASES[id].ilvl >= ilvl - 6:
			pool.append(id)
	if ilvl >= 3 and randf() < 0.18:
		pool = ["ring", "amulet"] if ilvl >= 5 else ["ring"]
	var id: String = pool[randi() % pool.size()]
	var it := make_base(id)
	if it.has("ac"):
		it["ac"] = int(it.ac * randf_range(0.8, 1.2)) + 1
	var magic: bool = randf() < magic_chance or BASES[id].get("magic_only", false)
	if magic:
		_add_affixes(it, ilvl)
	_reprice(it)
	return it


func _add_affixes(it: Dictionary, ilvl: int) -> void:
	var prefixes: Array = []
	var suffixes: Array = []
	for a in AFFIXES:
		if a[5] <= ilvl and _affix_ok(a, it.kind):
			(prefixes if a[6] else suffixes).append(a)
	var want_pre := randf() < 0.6
	var want_suf := randf() < 0.6 or not want_pre
	var name: String = it.name
	if want_pre and prefixes.size() > 0:
		var p: Array = prefixes[randi() % prefixes.size()]
		it.affixes[p[2]] = randi_range(p[3], p[4])
		name = "%s %s" % [p[0], name]
	if want_suf and suffixes.size() > 0:
		var s: Array = suffixes[randi() % suffixes.size()]
		it.affixes[s[2]] = it.affixes.get(s[2], 0) + randi_range(s[3], s[4])
		name = "%s %s" % [name, s[0]]
	if it.affixes.is_empty():
		var s: Array = suffixes[0]
		it.affixes[s[2]] = randi_range(s[3], s[4])
		name = "%s %s" % [name, s[0]]
	it["name"] = name
	it["rarity"] = 1


func _reprice(it: Dictionary) -> void:
	var v := float(BASES[it.base].value)
	for k in it.affixes:
		v += float(it.affixes[k]) * 25.0
	if it.rarity == 2:
		v *= 3.0
	it["value"] = int(v)


## Loot rolled when a monster dies or a chest opens.
func roll_drop(ilvl: int, quality := 0.0) -> Variant:
	var r := randf()
	if r < 0.32 - quality * 0.1:
		return null
	r = randf()
	if r < 0.42:
		return {"kind": "gold", "amount": randi_range(ilvl * 6, ilvl * 18 + 12), "name": "Gold", "icon": "gold", "model": "item_gold", "rarity": 0}
	if r < 0.68:
		var pick := randf()
		if pick < 0.55:
			return make_base("potion_heal")
		if pick < 0.85:
			return make_base("potion_mana")
		if pick < 0.93 or ilvl < 4:
			return make_base("scroll_portal")
		return make_base("potion_rejuv")
	return random_equipment(ilvl, 0.22 + quality * 0.5)


func sell_price(it: Dictionary) -> int:
	return max(1, int(it.get("value", 0) / 4))


func buy_price(it: Dictionary) -> int:
	return max(1, int(it.get("value", 0) * (1.0 if it.kind in ["potion", "scroll"] else 1.25)))


func describe(it: Dictionary) -> String:
	var lines: Array = []
	match it.kind:
		"weapon":
			lines.append("Damage: %d - %d" % [it.min_dmg, it.max_dmg])
			lines.append("Speed: %s" % ("Fast" if it.speed < 0.42 else ("Normal" if it.speed < 0.52 else "Slow")))
		"shield", "armor", "helm":
			lines.append("Armor: %d" % it.ac)
		"potion", "scroll":
			match it.effect:
				"heal": lines.append("Restores a good portion of life")
				"mana": lines.append("Restores a good portion of mana")
				"rejuv": lines.append("Fully restores life and mana")
				"portal": lines.append("Opens a portal back to Hollowmere")
	for k in it.get("affixes", {}):
		lines.append(AFFIX_LABELS.get(k, "+%d " + k) % int(it.affixes[k]))
	var req: Array = []
	if it.get("req_str", 0) > 0:
		req.append("%d Str" % it.req_str)
	if it.get("req_dex", 0) > 0:
		req.append("%d Dex" % it.req_dex)
	if req.size() > 0:
		lines.append("Requires " + ", ".join(req))
	return "\n".join(lines)
