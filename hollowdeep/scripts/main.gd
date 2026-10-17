extends Node3D
## Root: owns the environment, the current level, the hero and the HUD; handles transitions.

const LevelScript = preload("res://scripts/level.gd")
const PlayerScript = preload("res://scripts/player.gd")
const HudScript = preload("res://scripts/ui/hud.gd")

var level
var player
var hud
var env: Environment
var world_env: WorldEnvironment
var moon: DirectionalLight3D
var title_cam: Camera3D
var title_t := 0.0
var in_title := true
var transitioning := false


func _ready() -> void:
	add_to_group("main")
	world_env = WorldEnvironment.new()
	env = Environment.new()
	world_env.environment = env
	add_child(world_env)
	moon = DirectionalLight3D.new()
	moon.rotation = Vector3(deg_to_rad(-38), deg_to_rad(28), 0)
	add_child(moon)
	hud = HudScript.new()
	hud.main = self
	hud.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(hud)
	player = PlayerScript.new()
	player.main = self
	player.hud = hud
	add_child(player)
	hud.automap.player = player
	title_cam = Camera3D.new()
	title_cam.fov = 70
	add_child(title_cam)
	get_viewport().scaling_3d_scale = 0.85
	to_title()
	_debug_hooks()


## Command-line hooks for automated screenshots: -- --depth=2 --shot=path.png --wait=3 --menu=inventory
func _debug_hooks() -> void:
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if args.is_empty():
		return
	await get_tree().create_timer(0.5).timeout
	if args.has("depth"):
		hud.menus.close()
		Game.new_game()
		Game.clvl = int(args.get("clvl", "1"))
		start_game(true)
		var d := int(args.depth)
		if d > 0:
			change_level(d, args.get("hint", "start"))
			await get_tree().create_timer(1.5).timeout
		if args.has("yaw"):
			player.yaw = float(args.yaw)
		if args.has("boss") and level.boss:
			player.global_position = level.boss.global_position + Vector3(0, 0, 9)
			level.boss.set_physics_process(args.has("bossmove"))
			player.yaw = 0.0
		if args.has("walk"):
			for i in int(args.walk):
				hud.controls.move = Vector2(0, -1)
				await get_tree().create_timer(0.1).timeout
			hud.controls.move = Vector2.ZERO
		if args.has("nohud"):
			hud.root.visible = false
		if args.has("attack"):
			hud.controls.attack_held = true
		if args.has("autoplay"):
			await _autoplay(float(args.autoplay))
		if args.has("menu"):
			match args.menu:
				"inventory": hud.menus.open_inventory()
				"character": hud.menus.open_character()
				"smith": hud.menus.open_shop("smith")
				"elder": hud.menus.open_npc("elder")
				"map": hud.automap.visible = true
	await get_tree().create_timer(float(args.get("wait", "2"))).timeout
	if args.has("shot"):
		var img := get_viewport().get_texture().get_image()
		img.save_png(args.shot)
		print("SHOT ", args.shot)
	if args.has("quit"):
		get_tree().quit()


func to_title() -> void:
	in_title = true
	get_tree().paused = false
	player.active = false
	hud.set_gameplay_visible(false)
	_load_level(0)
	title_cam.current = true
	Sfx.music("music_town")
	hud.fade(false, 1.2)
	hud.menus.open_title()


func _process(delta: float) -> void:
	if in_title:
		title_t += delta
		var a := title_t * 0.05
		title_cam.position = Vector3(sin(a) * 16.0, 3.2 + sin(title_t * 0.3) * 0.4, -14.0 + cos(a) * 9.0)
		title_cam.look_at(Vector3(0, 8.0, -40), Vector3.UP)


func start_game(fresh: bool) -> void:
	in_title = false
	player.active = true
	player.cam.current = true
	hud.set_gameplay_visible(true)
	Game.depth = 0
	_load_level(0)
	_place_player(Game.spawn_hint)
	Sfx.music("music_town")
	if fresh:
		hud.show_banner("Hollowmere", "Speak with the townsfolk, then enter the cathedral")
	else:
		hud.show_banner("Hollowmere", "Welcome back, Wanderer")
	Game.save_game()


## Test bot: walks to the nearest monster, fights, drinks potions and loots. Prints a summary.
func _autoplay(seconds: float) -> void:
	var t := 0.0
	var kills0: int = Game.lstate(Game.depth).killed.size()
	while t < seconds:
		await get_tree().create_timer(0.1).timeout
		t += 0.1
		if not player.alive:
			print("BOT died at t=", t)
			break
		if Game.hp < Game.max_hp() * 0.4:
			for i in 4:
				if Game.belt[i] and Game.belt[i].effect == "heal":
					Game.use_belt(i)
					break
		var best = null
		var bd := INF
		for m in get_tree().get_nodes_in_group("monsters"):
			if m.is_alive():
				var dd: float = m.global_position.distance_to(player.global_position)
				if dd < bd:
					bd = dd
					best = m
		var target_pos: Vector3
		if best and bd < 40.0:
			target_pos = best.global_position
		else:
			var picks := get_tree().get_nodes_in_group("pickups")
			if picks.size() > 0:
				target_pos = picks[0].global_position
			else:
				hud.controls.move = Vector2.ZERO
				continue
		var path: PackedVector3Array = level.find_path(player.global_position, target_pos)
		var nxt: Vector3 = target_pos if path.size() == 0 or bd < 5.0 else path[0]
		var to: Vector3 = nxt - player.global_position
		player.yaw = atan2(-to.x, -to.z)
		hud.controls.move = Vector2(0, -1) if (bd > 2.2 or best == null) else Vector2.ZERO
		hud.controls.attack_held = best != null and bd < 3.0
		if player.interact_target and player.interact_target.is_in_group("pickups"):
			player.do_interact()
	hud.controls.move = Vector2.ZERO
	hud.controls.attack_held = false
	print("BOT summary: kills=", Game.lstate(Game.depth).killed.size() - kills0, " hp=", Game.hp, "/", Game.max_hp(), " xp=", Game.xp, " clvl=", Game.clvl, " gold=", Game.gold, " inv=", Game.inventory.filter(func(x): return x != null).size())


func _configure_env(depth: int) -> void:
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.fog_enabled = true
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 0.9
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 0.92
	if depth == 0:
		var sky := Sky.new()
		var sm := ProceduralSkyMaterial.new()
		sm.sky_top_color = Color(0.05, 0.06, 0.12)
		sm.sky_horizon_color = Color(0.22, 0.16, 0.2)
		sm.ground_horizon_color = Color(0.1, 0.08, 0.09)
		sm.ground_bottom_color = Color(0.02, 0.02, 0.03)
		sm.sun_angle_max = 8.0
		sky.sky_material = sm
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.32, 0.32, 0.45)
		env.ambient_light_energy = 0.55
		env.fog_light_color = Color(0.13, 0.12, 0.18)
		env.fog_density = 0.028
		env.fog_sky_affect = 0.6
		moon.visible = true
		moon.light_color = Color(0.62, 0.68, 0.95)
		moon.light_energy = 0.55
		moon.shadow_enabled = false
	else:
		env.background_mode = Environment.BG_COLOR
		env.background_color = Color(0, 0, 0)
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		var amb: Color = [Color(0.26, 0.22, 0.2), Color(0.26, 0.17, 0.16), Color(0.18, 0.24, 0.2)][depth - 1]
		env.ambient_light_color = amb
		env.ambient_light_energy = 0.4
		env.fog_light_color = Color(0.01, 0.008, 0.008)
		env.fog_density = 0.055
		env.fog_sky_affect = 0.0
		moon.visible = false


func _load_level(depth: int) -> void:
	if level:
		level.queue_free()
		remove_child(level)
	hud.boss_ref = null
	Game.depth = depth
	if depth > Game.max_depth_reached:
		Game.max_depth_reached = depth
	level = LevelScript.new()
	level.name = "Level"
	add_child(level)
	level.build(depth, self)
	level.player = player
	player.level = level
	hud.automap.level = level
	_configure_env(depth)


func _place_player(hint: String) -> void:
	var key := hint if level.spawn_points.has(hint) else "start"
	player.place(level.spawn_points[key], level.spawn_points.get(key + "_yaw", 0.0))


func change_level(depth: int, hint: String) -> void:
	if transitioning:
		return
	transitioning = true
	player.active = false
	hud.controls.release_all()
	Sfx.play("stairs")
	await hud.fade(true, 0.4).finished
	_load_level(depth)
	_place_player(hint)
	if depth == 0:
		Sfx.music("music_town")
		Game.restock_shops()
		hud.show_banner("Hollowmere")
	else:
		Sfx.music("music_dungeon")
		var subs := ["", "The halls of Saint Aldric's", "Where the Flayer keeps his larder", "Where the dead are sung awake"]
		hud.show_banner("%s" % Game.DEPTH_NAMES[depth], "Level %d · %s" % [depth, subs[depth]])
	Game.save_game()
	await get_tree().create_timer(0.15).timeout
	hud.fade(false, 0.5)
	player.active = true
	transitioning = false


func open_town_portal() -> void:
	if Game.depth == 0 or transitioning:
		return
	Game.portal = {"depth": Game.depth, "pos": [player.global_position.x, 0, player.global_position.z], "yaw": player.yaw}
	Sfx.play("portal")
	hud.flash(Color(0.3, 0.5, 1.0, 0.5))
	hud.show_message("A portal tears open...", Color(0.6, 0.75, 1.0))
	if hud.menu_open():
		hud.menus.close()
	await get_tree().create_timer(0.6).timeout
	change_level(0, "portal")


func use_portal() -> void:
	if Game.portal.is_empty() or transitioning:
		return
	var p: Dictionary = Game.portal
	var d := int(p.depth)
	Sfx.play("portal")
	transitioning = true
	player.active = false
	await hud.fade(true, 0.4).finished
	Game.portal = {}
	_load_level(d)
	player.place(Vector3(p.pos[0], 0, p.pos[2]), float(p.get("yaw", 0.0)))
	Sfx.music("music_dungeon")
	hud.show_banner(Game.DEPTH_NAMES[d], "Level %d" % d)
	Game.save_game()
	hud.fade(false, 0.5)
	player.active = true
	transitioning = false


func boss_defeated(m) -> void:
	Sfx.music("music_dungeon")
	hud.flash(Color(1, 0.8, 0.4, 0.35))
	if m.id == "brute":
		hud.show_banner("The Flayer is slain", "Return to Elder Corwin")
	else:
		hud.show_banner("The Matron is silenced", "")
		Game.save_game()
		await get_tree().create_timer(3.0).timeout
		if not Game.victory_seen:
			Game.victory_seen = true
			hud.controls.release_all()
			hud.menus.open_victory()
	Game.save_game()


func drop_at_player(it: Dictionary) -> void:
	level.drop_item(it, player.global_position + player.forward() * 1.2)


func player_died() -> void:
	hud.controls.release_all()
	await get_tree().create_timer(1.8).timeout
	hud.menus.open_death()


func respawn() -> void:
	Game.gold = int(Game.gold * 0.75)
	Game.hp = Game.max_hp()
	Game.mana = Game.max_mana()
	player.revive()
	transitioning = false
	change_level(0, "start")


func on_menu_closed() -> void:
	pass
