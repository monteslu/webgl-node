// A new drawing buffer starts at colour 0, depth 1.0, stencil 0, as WebGL
// requires: at context creation and again after a resize. A depth- and
// stencil-tested draw into a never-cleared default framebuffer must cover
// every pixel, and the clear must leave the app's GL state untouched.
import { createWebGL2Context } from '../index.mjs'

console.log('--- test-drawing-buffer ---')

const W = 256, H = 256
const ctx = createWebGL2Context(W, H)
const gl = ctx.gl
let failed = false
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`); if (!ok) failed = true }

function compile(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
  return shader
}
const program = gl.createProgram()
gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
in vec2 aPos;
uniform float uZ;
void main() { gl_Position = vec4(aPos, uZ, 1.0); }`))
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
out vec4 color;
void main() { color = vec4(0.0, 1.0, 0.0, 1.0); }`))
gl.linkProgram(program)
const vbo = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
const vao = gl.createVertexArray()
gl.bindVertexArray(vao)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

// Full-screen green at depth z (NDC), depth test LEQUAL against the never
// cleared depth buffer and stencil EQUAL 0 against the never-cleared stencil.
function drawUncleared(z, width, height) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, width, height)
  gl.useProgram(program)
  gl.uniform1f(gl.getUniformLocation(program, 'uZ'), z)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)
  gl.enable(gl.STENCIL_TEST)
  gl.stencilFunc(gl.EQUAL, 0, 0xff)
  gl.bindVertexArray(vao)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.disable(gl.STENCIL_TEST)
  gl.disable(gl.DEPTH_TEST)
  const px = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px)
  let green = 0
  for (let i = 0; i < px.length; i += 4) if (px[i] === 0 && px[i + 1] === 255 && px[i + 2] === 0) green++
  return green
}

check(gl.getParameter(gl.DEPTH_BITS) > 0 && gl.getParameter(gl.STENCIL_BITS) > 0, 'default framebuffer has depth and stencil')
const atCreation = drawUncleared(0.98, W, H)
check(atCreation === W * H, `after creation, a depth+stencil tested draw covers ${atCreation}/${W * H} pixels`)

// App state that the resize-time clear must not disturb.
const fbo = gl.createFramebuffer()
gl.clearColor(0.1, 0.2, 0.3, 0.4)
gl.clearDepth(0.25)
gl.clearStencil(7)
gl.colorMask(false, true, true, true)
gl.depthMask(false)
gl.stencilMaskSeparate(gl.FRONT, 0x0f)
gl.stencilMaskSeparate(gl.BACK, 0xf0)
gl.enable(gl.SCISSOR_TEST)
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

ctx.resize(320, 200)

const same = (a, b) => JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b))
check(gl.getParameter(gl.FRAMEBUFFER_BINDING) === fbo, 'resize keeps the bound framebuffer')
check(same(Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE), v => Math.round(v * 10) / 10), [0.1, 0.2, 0.3, 0.4]), 'resize keeps the clear colour')
check(gl.getParameter(gl.DEPTH_CLEAR_VALUE) === 0.25 && gl.getParameter(gl.STENCIL_CLEAR_VALUE) === 7, 'resize keeps the depth and stencil clear values')
check(same(gl.getParameter(gl.COLOR_WRITEMASK), [false, true, true, true]) && gl.getParameter(gl.DEPTH_WRITEMASK) === false, 'resize keeps the colour and depth write masks')
check(gl.getParameter(gl.STENCIL_WRITEMASK) === 0x0f && gl.getParameter(gl.STENCIL_BACK_WRITEMASK) === 0xf0, 'resize keeps both stencil write masks')
check(gl.isEnabled(gl.SCISSOR_TEST), 'resize keeps the scissor test enabled')

gl.disable(gl.SCISSOR_TEST)
gl.colorMask(true, true, true, true)
gl.depthMask(true)
gl.stencilMask(0xff)
const afterResize = drawUncleared(0.98, 320, 200)
check(afterResize === 320 * 200, `after resize, a depth+stencil tested draw covers ${afterResize}/${320 * 200} pixels`)
check(gl.getError() === gl.NO_ERROR, 'no GL error')

ctx.destroy()
if (failed) { console.log('test-drawing-buffer FAILED'); process.exit(1) }
console.log('test-drawing-buffer passed')
