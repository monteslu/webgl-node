// Demonstrates the GH issue #1 fix: texImage2D AND texSubImage2D accept the
// Image/Canvas "source" form. We upload a 2x2 canvas, overwrite one texel via
// texSubImage2D(source), then render the texture full-screen and read it back
// so the result is visible and verifiable end-to-end on the real GL driver.
import { createWebGL2Context } from '../index.mjs'

const W = 64, H = 64
const { gl } = createWebGL2Context(W, H)

let pass = 0, fail = 0
const check = (cond, msg) => {
  if (cond) { pass++; console.log('  PASS:', msg) }
  else { fail++; console.error('  FAIL:', msg) }
}

// A minimal "canvas" source: width/height + getContext('2d').getImageData().
// This is exactly the shape three.js / browser code passes to texImage2D.
function canvasSource(w, h, rgbaPerTexel) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(rgbaPerTexel[i], i * 4)
  return {
    width: w,
    height: h,
    getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }),
  }
}

const R = [255, 0, 0, 255]
const G = [0, 255, 0, 255]
const B = [0, 0, 255, 255]
const Y = [255, 255, 0, 255]

console.log('-- texImage2D(canvas source) --')
const tex = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, tex)
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

// 2x2 texture, bottom row [R, G], top row [B, B], uploaded from a "canvas".
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
  canvasSource(2, 2, [R, G, B, B]))
check(gl.getError() === gl.NO_ERROR, 'texImage2D(source) uploaded with no GL error')

console.log('-- texSubImage2D(canvas source) --')
// Overwrite the top-left texel (0,1) with yellow, from a 1x1 "canvas".
// Pre-fix this threw / no-op'd because the source form was unsupported.
gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, gl.RGBA, gl.UNSIGNED_BYTE,
  canvasSource(1, 1, [Y]))
check(gl.getError() === gl.NO_ERROR, 'texSubImage2D(source) sub-uploaded with no GL error')

// --- Render the texture full-screen so we can read back actual texels ---
const vs = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`
const fs = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() { fragColor = texture(u_tex, v_uv); }`

function compile(type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}
const prog = gl.createProgram()
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs))
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs))
gl.linkProgram(prog)
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
gl.useProgram(prog)

const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
const vbo = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
const loc = gl.getAttribLocation(prog, 'a_pos')
gl.enableVertexAttribArray(loc)
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0)

gl.viewport(0, 0, W, H)
gl.clearColor(0, 0, 0, 1)
gl.clear(gl.COLOR_BUFFER_BIT)
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

const px = new Uint8Array(W * H * 4)
gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)

// Sample the four quadrants (readPixels origin is bottom-left).
const sample = (fx, fy) => {
  const x = Math.floor(fx * W), y = Math.floor(fy * H)
  const o = (y * W + x) * 4
  return [px[o], px[o + 1], px[o + 2], px[o + 3]]
}
const eq = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1)

console.log('-- readback (texture rendered to framebuffer) --')
const bl = sample(0.25, 0.25) // bottom-left  -> texel (0,0) = R
const br = sample(0.75, 0.25) // bottom-right -> texel (1,0) = G
const tl = sample(0.25, 0.75) // top-left     -> texel (0,1), overwritten to Y
const tr = sample(0.75, 0.75) // top-right     -> texel (1,1) = B
console.log(`  bottom-left  rgba(${bl}) expected red ${R}`)
console.log(`  bottom-right rgba(${br}) expected green ${G}`)
console.log(`  top-left     rgba(${tl}) expected yellow ${Y} (from texSubImage2D source)`)
console.log(`  top-right    rgba(${tr}) expected blue ${B}`)
check(eq(bl, R), 'bottom-left is red   (texImage2D source, texel 0,0)')
check(eq(br, G), 'bottom-right is green (texImage2D source, texel 1,0)')
check(eq(tl, Y), 'top-left is yellow   (texSubImage2D source overwrote texel 0,1)')
check(eq(tr, B), 'top-right is blue    (texImage2D source, texel 1,1)')

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)
