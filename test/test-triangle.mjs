import { createWebGL2Context } from '../index.mjs'

console.log('--- test-triangle (WebGL2 API) ---')

const W = 64, H = 64
const { gl } = createWebGL2Context(W, H)

// Shaders
const vsSource = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const fsSource = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`

const vs = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vs, vsSource)
gl.compileShader(vs)
if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
  console.error('VS compile error:', gl.getShaderInfoLog(vs))
  process.exit(1)
}

const fs = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fs, fsSource)
gl.compileShader(fs)
if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
  console.error('FS compile error:', gl.getShaderInfoLog(fs))
  process.exit(1)
}

const program = gl.createProgram()
gl.attachShader(program, vs)
gl.attachShader(program, fs)
gl.linkProgram(program)
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error('Link error:', gl.getProgramInfoLog(program))
  process.exit(1)
}

gl.useProgram(program)

// Full-screen triangle
const vertices = new Float32Array([-1, -1, 3, -1, -1, 3])

const vao = gl.createVertexArray()
gl.bindVertexArray(vao)

const vbo = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

const aPos = gl.getAttribLocation(program, 'aPos')
gl.enableVertexAttribArray(aPos)
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

// Draw
gl.viewport(0, 0, W, H)
gl.clearColor(0, 0, 0, 1)
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
gl.drawArrays(gl.TRIANGLES, 0, 3)
gl.finish()

// Readback
const pixels = new Uint8Array(W * H * 4)
gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

// Check center pixel is red
const cx = Math.floor(W / 2)
const cy = Math.floor(H / 2)
const idx = (cy * W + cx) * 4
const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2], a = pixels[idx + 3]
console.log(`center pixel: rgba(${r}, ${g}, ${b}, ${a})`)

if (r < 200 || g > 50 || b > 50) {
  console.error(`FAIL: expected red, got rgba(${r}, ${g}, ${b}, ${a})`)
  process.exit(1)
}

// Check error state
const err = gl.getError()
if (err !== 0) {
  console.error('FAIL: GL error:', '0x' + err.toString(16))
  process.exit(1)
}

// Verify some WebGL2 API properties
console.log(`drawingBufferWidth: ${gl.drawingBufferWidth}`)
console.log(`drawingBufferHeight: ${gl.drawingBufferHeight}`)
console.log(`VERTEX_SHADER constant: 0x${gl.VERTEX_SHADER.toString(16)}`)
console.log(`isContextLost: ${gl.isContextLost()}`)
console.log(`version: ${gl.getParameter(gl.VERSION)}`)
console.log(`vendor: ${gl.getParameter(gl.VENDOR)}`)
console.log(`renderer: ${gl.getParameter(gl.RENDERER)}`)
console.log(`maxTextureSize: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`)
console.log(`extensions: ${gl.getSupportedExtensions().join(', ')}`)

// Cleanup
gl.deleteBuffer(vbo)
gl.deleteVertexArray(vao)
gl.deleteProgram(program)
gl.deleteShader(vs)
gl.deleteShader(fs)

console.log('PASS: test-triangle (WebGL2 API)')
