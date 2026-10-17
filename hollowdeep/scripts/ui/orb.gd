extends Control
## A glass orb of life or mana with a sloshing liquid shader and a carved frame.

const SHADER := """
shader_type canvas_item;
uniform float fill = 1.0;
uniform vec4 liquid : source_color = vec4(0.8, 0.05, 0.05, 1.0);
uniform sampler2D noise_tex : repeat_enable, filter_linear;
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float r = length(uv);
	if (r > 1.0) { discard; }
	float lvl = 1.0 - fill * 2.0;
	float wave = sin(uv.x * 5.0 + TIME * 2.2) * 0.035 + sin(uv.x * 9.0 - TIME * 3.1) * 0.015;
	float n = texture(noise_tex, UV * 0.9 + vec2(TIME * 0.04, -TIME * 0.06)).r;
	float n2 = texture(noise_tex, UV * 1.7 + vec2(-TIME * 0.05, TIME * 0.03)).r;
	float shade = sqrt(max(0.0, 1.0 - r * r));
	vec3 liq = liquid.rgb * (0.45 + 0.55 * n + 0.35 * n2) * (0.35 + 0.85 * shade);
	vec3 empty = vec3(0.035, 0.03, 0.03) * (0.4 + shade);
	float filled = smoothstep(lvl + wave - 0.01, lvl + wave + 0.01, uv.y);
	vec3 col = mix(empty, liq, filled);
	col += liquid.rgb * 0.6 * smoothstep(0.04, 0.0, abs(uv.y - (lvl + wave))) * filled;
	float hl = smoothstep(0.42, 0.0, length(uv - vec2(-0.32, -0.42)));
	col += vec3(1.0) * hl * 0.32;
	col *= smoothstep(1.0, 0.92, r) * 0.6 + 0.4;
	COLOR = vec4(col, 1.0);
}
"""

var fill := 1.0
var shown := 1.0
var liquid_color := Color(0.8, 0.05, 0.05)
var mat: ShaderMaterial
var value_text := ""


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = SHADER
	mat = ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("noise_tex", Util.tex("orb_noise"))
	mat.set_shader_parameter("liquid", liquid_color)
	var inner := ColorRect.new()
	inner.material = mat
	inner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	inner.set_anchors_preset(Control.PRESET_FULL_RECT)
	inner.offset_left = size.x * 0.13
	inner.offset_top = size.y * 0.13
	inner.offset_right = -size.x * 0.13
	inner.offset_bottom = -size.y * 0.13
	add_child(inner)
	var frame := TextureRect.new()
	frame.texture = Util.tex("orb_frame")
	frame.set_anchors_preset(Control.PRESET_FULL_RECT)
	frame.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(frame)


func _process(delta: float) -> void:
	shown = lerpf(shown, fill, clampf(delta * 6.0, 0.0, 1.0))
	if mat:
		mat.set_shader_parameter("fill", shown)
	queue_redraw()


func _draw() -> void:
	if value_text == "":
		return
	var f: Font = UITheme.head_font
	var w := f.get_string_size(value_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
	var p := Vector2(size.x / 2.0 - w / 2.0, size.y / 2.0 + 9)
	draw_string_outline(f, p, value_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 7, Color(0, 0, 0, 0.95))
	draw_string(f, p, value_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(1, 0.95, 0.88))
