#include <flutter/runtime_effect.glsl>

precision mediump float;

uniform vec2 uSize;

out vec4 fragColor;

void main() {
  vec2 size = max(uSize, vec2(1.0, 1.0));
  vec2 uv = FlutterFragCoord().xy / size;
  vec3 glow = mix(vec3(0.02, 0.08, 0.18), vec3(0.16, 0.72, 0.96), uv.y);
  float pulse = 0.85 + (0.15 * sin((uv.x + uv.y) * 12.0));
  fragColor = vec4(glow * pulse, 1.0);
}
