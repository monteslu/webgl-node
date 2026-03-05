import { createWebGL2Context, GL, WebGLBuffer, WebGLTexture, WebGLFramebuffer,
  WebGLRenderbuffer, WebGLProgram, WebGLShader, WebGLVertexArrayObject,
  WebGLSampler, WebGLQuery, WebGLSync, WebGLTransformFeedback,
  WebGLUniformLocation, WebGLActiveInfo, WebGLShaderPrecisionFormat } from '../index.mjs'

let passed = 0
let failed = 0
const failures = []

function assert(cond, msg) {
  if (cond) {
    passed++
  } else {
    failed++
    failures.push(msg)
    console.error(`  FAIL: ${msg}`)
  }
}

function assertEq(a, b, msg) {
  assert(a === b, `${msg} — expected ${b}, got ${a}`)
}

function assertClose(a, b, tol, msg) {
  assert(Math.abs(a - b) < tol, `${msg} — expected ~${b}, got ${a}`)
}

// Helper: compile shader
function compileShader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile: ${gl.getShaderInfoLog(s)}`)
  }
  return s
}

// Helper: link program
function linkProgram(gl, vs, fs) {
  const p = gl.createProgram()
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link: ${gl.getProgramInfoLog(p)}`)
  }
  return p
}

const VS_BASIC = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`
const FS_RED = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0, 0.0, 0.0, 1.0); }
`
const FS_BLUE = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0, 0.0, 1.0, 1.0); }
`
const VS_UNIFORM = `#version 300 es
precision highp float;
precision highp int;
in vec2 aPos;
uniform float uScale;
uniform int uMode;
uniform uint uFlags;
uniform vec4 uColor;
uniform mat4 uMatrix;
void main() {
  gl_Position = uMatrix * vec4(aPos * uScale + float(uMode) + float(uFlags), 0.0, 1.0);
}
`
const FS_UNIFORM = `#version 300 es
precision highp float;
precision highp int;
uniform float uScale;
uniform int uMode;
uniform uint uFlags;
uniform vec4 uColor;
uniform mat4 uMatrix;
out vec4 fragColor;
void main() {
  fragColor = uColor * uScale + vec4(float(uMode), float(uFlags), uMatrix[0][0], 0.0) * 0.001;
}
`

// ─── Tests ──────────────────────────────────────────────────────────────

const W = 64, H = 64
const { canvas, gl } = createWebGL2Context(W, H)

console.log('=== webgl-node test suite ===\n')

// ─── Context & Canvas ────────────────────────────────────────────────

console.log('-- context & canvas --')
assert(gl !== null, 'gl context created')
assertEq(gl.drawingBufferWidth, W, 'drawingBufferWidth')
assertEq(gl.drawingBufferHeight, H, 'drawingBufferHeight')
assertEq(gl.isContextLost(), false, 'isContextLost')
assert(canvas !== null, 'canvas created')
assertEq(canvas.width, W, 'canvas.width')
assertEq(canvas.height, H, 'canvas.height')
assertEq(canvas.getContext('webgl2'), gl, 'canvas.getContext returns gl')
assertEq(canvas.getContext('2d'), null, 'canvas.getContext(2d) returns null')
{
  const r = canvas.getBoundingClientRect()
  assertEq(r.width, W, 'getBoundingClientRect width')
  assertEq(r.height, H, 'getBoundingClientRect height')
}

// ─── Constants ───────────────────────────────────────────────────────

console.log('-- constants --')
assertEq(gl.TRIANGLES, 0x0004, 'gl.TRIANGLES')
assertEq(gl.VERTEX_SHADER, 0x8B31, 'gl.VERTEX_SHADER')
assertEq(gl.FRAGMENT_SHADER, 0x8B30, 'gl.FRAGMENT_SHADER')
assertEq(gl.ARRAY_BUFFER, 0x8892, 'gl.ARRAY_BUFFER')
assertEq(gl.STATIC_DRAW, 0x88E4, 'gl.STATIC_DRAW')
assertEq(GL.TRIANGLES, gl.TRIANGLES, 'GL export matches instance')
assertEq(gl.TEXTURE_2D_ARRAY, 0x8C1A, 'TEXTURE_2D_ARRAY constant')
assertEq(gl.UNIFORM_BUFFER, 0x8A11, 'UNIFORM_BUFFER constant')
assertEq(gl.TRANSFORM_FEEDBACK, 0x8E22, 'TRANSFORM_FEEDBACK constant')

// ─── Errors ─────────────────────────────────────────────────────────

console.log('-- errors --')
assertEq(gl.getError(), gl.NO_ERROR, 'no initial error')

// ─── Context Attributes ─────────────────────────────────────────────

console.log('-- context attributes --')
{
  const attrs = gl.getContextAttributes()
  assertEq(attrs.depth, true, 'context has depth')
  assertEq(attrs.stencil, true, 'context has stencil')
  assertEq(typeof attrs.alpha, 'boolean', 'alpha is boolean')
}

// ─── getParameter ───────────────────────────────────────────────────

console.log('-- getParameter --')
{
  const ver = gl.getParameter(gl.VERSION)
  assert(ver.includes('WebGL 2.0'), `VERSION contains WebGL 2.0: ${ver}`)
  const vendor = gl.getParameter(gl.VENDOR)
  assert(typeof vendor === 'string' && vendor.length > 0, `VENDOR: ${vendor}`)
  const renderer = gl.getParameter(gl.RENDERER)
  assert(typeof renderer === 'string' && renderer.length > 0, `RENDERER: ${renderer}`)
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  assert(maxTex >= 2048, `MAX_TEXTURE_SIZE >= 2048: ${maxTex}`)
  const maxVA = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)
  assert(maxVA >= 8, `MAX_VERTEX_ATTRIBS >= 8: ${maxVA}`)

  // WebGL-specific params
  assertEq(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), false, 'UNPACK_FLIP_Y default')
  assertEq(gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), false, 'UNPACK_PREMULTIPLY_ALPHA default')

  // Viewport
  const vp = gl.getParameter(gl.VIEWPORT)
  assert(vp instanceof Int32Array, 'VIEWPORT is Int32Array')

  // Depth range
  const dr = gl.getParameter(gl.DEPTH_RANGE)
  assert(dr instanceof Float32Array, 'DEPTH_RANGE is Float32Array')
  assertClose(dr[0], 0.0, 0.01, 'DEPTH_RANGE near')
  assertClose(dr[1], 1.0, 0.01, 'DEPTH_RANGE far')

  // Color writemask
  const cwm = gl.getParameter(gl.COLOR_WRITEMASK)
  assert(Array.isArray(cwm) && cwm.length === 4, 'COLOR_WRITEMASK is array[4]')
  assertEq(cwm[0], true, 'COLOR_WRITEMASK[0] = true')

  // Depth writemask
  assertEq(gl.getParameter(gl.DEPTH_WRITEMASK), true, 'DEPTH_WRITEMASK default true')
}

// ─── Extensions ─────────────────────────────────────────────────────

console.log('-- extensions --')
{
  const exts = gl.getSupportedExtensions()
  assert(Array.isArray(exts), 'getSupportedExtensions returns array')
  assert(exts.includes('WEBGL_debug_renderer_info'), 'has WEBGL_debug_renderer_info')
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  assert(dbg !== null, 'getExtension returns object')
  assertEq(dbg.UNMASKED_VENDOR_WEBGL, 0x9245, 'UNMASKED_VENDOR_WEBGL constant')
  assertEq(gl.getExtension('NONEXISTENT_ext'), null, 'unknown extension returns null')
}

// ─── Shader Precision ───────────────────────────────────────────────

console.log('-- shader precision --')
{
  const fmt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)
  assert(fmt !== null, 'getShaderPrecisionFormat returns object')
  assert(typeof fmt.rangeMin === 'number', 'has rangeMin')
  assert(typeof fmt.rangeMax === 'number', 'has rangeMax')
  assert(typeof fmt.precision === 'number', 'has precision')
}

// ─── Buffers ────────────────────────────────────────────────────────

console.log('-- buffers --')
{
  const buf = gl.createBuffer()
  assert(buf instanceof WebGLBuffer, 'createBuffer returns WebGLBuffer')
  assert(!gl.isBuffer(buf), 'isBuffer false before bind')
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  assert(gl.isBuffer(buf), 'isBuffer true after bind')
  assertEq(gl.getParameter(gl.ARRAY_BUFFER_BINDING), buf, 'ARRAY_BUFFER_BINDING tracks')

  // bufferData with size
  gl.bufferData(gl.ARRAY_BUFFER, 64, gl.STATIC_DRAW)
  const bSize = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE)
  assertEq(bSize, 64, 'bufferData size=64')

  // bufferData with typed array
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 2, 3, 4]), gl.DYNAMIC_DRAW)
  assertEq(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE), 16, 'bufferData float32 size=16')
  assertEq(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_USAGE), gl.DYNAMIC_DRAW, 'buffer usage DYNAMIC_DRAW')

  // bufferSubData
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([5, 6]))
  assertEq(gl.getError(), gl.NO_ERROR, 'bufferSubData no error')

  // copyBufferSubData
  const buf2 = gl.createBuffer()
  gl.bindBuffer(gl.COPY_WRITE_BUFFER, buf2)
  gl.bufferData(gl.COPY_WRITE_BUFFER, 16, gl.STATIC_DRAW)
  gl.copyBufferSubData(gl.ARRAY_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 8)
  assertEq(gl.getError(), gl.NO_ERROR, 'copyBufferSubData no error')

  // Unbind
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  assertEq(gl.getParameter(gl.ARRAY_BUFFER_BINDING), null, 'ARRAY_BUFFER_BINDING null after unbind')

  gl.deleteBuffer(buf)
  gl.deleteBuffer(buf2)
}

// ─── VAOs ───────────────────────────────────────────────────────────

console.log('-- VAOs --')
{
  const vao = gl.createVertexArray()
  assert(vao instanceof WebGLVertexArrayObject, 'createVertexArray returns WebGLVertexArrayObject')
  gl.bindVertexArray(vao)
  assert(gl.isVertexArray(vao), 'isVertexArray after bind')
  assertEq(gl.getParameter(gl.VERTEX_ARRAY_BINDING), vao, 'VERTEX_ARRAY_BINDING tracks')

  gl.bindVertexArray(null)
  assertEq(gl.getParameter(gl.VERTEX_ARRAY_BINDING), null, 'VERTEX_ARRAY_BINDING null')
  gl.deleteVertexArray(vao)
}

// ─── Shaders ────────────────────────────────────────────────────────

console.log('-- shaders --')
{
  const vs = gl.createShader(gl.VERTEX_SHADER)
  assert(vs instanceof WebGLShader, 'createShader returns WebGLShader')
  assert(gl.isShader(vs), 'isShader')
  gl.shaderSource(vs, VS_BASIC)
  gl.compileShader(vs)
  assertEq(gl.getShaderParameter(vs, gl.COMPILE_STATUS), true, 'VS compile success')
  assertEq(gl.getShaderParameter(vs, gl.SHADER_TYPE), gl.VERTEX_SHADER, 'shader type')
  {
    const src = gl.getShaderSource(vs)
    assert(src.includes('aPos'), 'getShaderSource contains source')
  }
  {
    const log = gl.getShaderInfoLog(vs)
    assert(typeof log === 'string', 'getShaderInfoLog returns string')
  }

  // Bad shader
  const bad = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(bad, 'invalid glsl!!!')
  gl.compileShader(bad)
  assertEq(gl.getShaderParameter(bad, gl.COMPILE_STATUS), false, 'bad shader fails')
  assert(gl.getShaderInfoLog(bad).length > 0, 'bad shader has info log')

  gl.deleteShader(vs)
  gl.deleteShader(bad)
}

// ─── Programs ───────────────────────────────────────────────────────

console.log('-- programs --')
{
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_BASIC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_RED)
  const prog = gl.createProgram()
  assert(prog instanceof WebGLProgram, 'createProgram returns WebGLProgram')
  assert(gl.isProgram(prog), 'isProgram')

  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  assertEq(gl.getProgramParameter(prog, gl.LINK_STATUS), true, 'link success')

  // getAttachedShaders
  const attached = gl.getAttachedShaders(prog)
  assertEq(attached.length, 2, 'getAttachedShaders returns 2')
  assert(attached[0] instanceof WebGLShader, 'attached[0] is WebGLShader')

  // Attributes
  const aPos = gl.getAttribLocation(prog, 'aPos')
  assert(aPos >= 0, 'getAttribLocation aPos')
  assertEq(gl.getAttribLocation(prog, 'nonexistent'), -1, 'getAttribLocation nonexistent')

  // getActiveAttrib
  const numAttrs = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES)
  assertEq(numAttrs, 1, 'ACTIVE_ATTRIBUTES = 1')
  const attr = gl.getActiveAttrib(prog, 0)
  assert(attr instanceof WebGLActiveInfo, 'getActiveAttrib returns WebGLActiveInfo')
  assertEq(attr.name, 'aPos', 'active attrib name')
  assertEq(attr.type, gl.FLOAT_VEC2, 'active attrib type')

  gl.useProgram(prog)
  assertEq(gl.getParameter(gl.CURRENT_PROGRAM), prog, 'CURRENT_PROGRAM tracks')

  gl.validateProgram(prog)
  assertEq(gl.getProgramParameter(prog, gl.VALIDATE_STATUS), true, 'validate succeeds')

  gl.useProgram(null)
  gl.detachShader(prog, vs)
  gl.detachShader(prog, fs)
  gl.deleteProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
}

// ─── Uniforms ───────────────────────────────────────────────────────

console.log('-- uniforms --')
{
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_UNIFORM)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_UNIFORM)
  const prog = linkProgram(gl, vs, fs)
  gl.useProgram(prog)

  const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
  assert(numUniforms >= 5, `ACTIVE_UNIFORMS >= 5: ${numUniforms}`)

  // Float uniform
  const uScale = gl.getUniformLocation(prog, 'uScale')
  assert(uScale instanceof WebGLUniformLocation, 'getUniformLocation returns WebGLUniformLocation')
  gl.uniform1f(uScale, 2.5)
  assertClose(gl.getUniform(prog, uScale), 2.5, 0.001, 'getUniform float')

  // Int uniform
  const uMode = gl.getUniformLocation(prog, 'uMode')
  gl.uniform1i(uMode, 42)
  assertEq(gl.getUniform(prog, uMode), 42, 'getUniform int')

  // Uint uniform
  const uFlags = gl.getUniformLocation(prog, 'uFlags')
  gl.uniform1ui(uFlags, 7)
  assertEq(gl.getUniform(prog, uFlags), 7, 'getUniform uint')

  // Vec4 uniform
  const uColor = gl.getUniformLocation(prog, 'uColor')
  gl.uniform4f(uColor, 0.1, 0.2, 0.3, 1.0)
  const colorVal = gl.getUniform(prog, uColor)
  assert(colorVal instanceof Float32Array && colorVal.length === 4, 'getUniform vec4 returns Float32Array[4]')
  assertClose(colorVal[0], 0.1, 0.01, 'getUniform vec4[0]')

  // Mat4 uniform
  const uMatrix = gl.getUniformLocation(prog, 'uMatrix')
  const identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
  gl.uniformMatrix4fv(uMatrix, false, identity)
  const matVal = gl.getUniform(prog, uMatrix)
  assert(matVal instanceof Float32Array && matVal.length === 16, 'getUniform mat4 returns Float32Array[16]')
  assertClose(matVal[0], 1.0, 0.001, 'getUniform mat4[0,0]')

  // Nonexistent uniform
  assertEq(gl.getUniformLocation(prog, 'uNope'), null, 'nonexistent uniform returns null')

  // getActiveUniform
  const info = gl.getActiveUniform(prog, 0)
  assert(info instanceof WebGLActiveInfo, 'getActiveUniform returns WebGLActiveInfo')
  assert(typeof info.name === 'string' && info.name.length > 0, 'active uniform has name')

  // Null-safe: uniform calls with null loc should not throw
  gl.uniform1f(null, 1.0)
  gl.uniform1i(null, 1)
  assertEq(gl.getError(), gl.NO_ERROR, 'null uniform loc no error')

  gl.useProgram(null)
  gl.deleteProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
}

// ─── Textures ───────────────────────────────────────────────────────

console.log('-- textures --')
{
  const tex = gl.createTexture()
  assert(tex instanceof WebGLTexture, 'createTexture returns WebGLTexture')
  assert(!gl.isTexture(tex), 'isTexture false before bind')
  gl.bindTexture(gl.TEXTURE_2D, tex)
  assert(gl.isTexture(tex), 'isTexture true after bind')
  assertEq(gl.getParameter(gl.TEXTURE_BINDING_2D), tex, 'TEXTURE_BINDING_2D tracks')

  // Upload 2x2 RGBA texture
  const data = new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255])
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  assertEq(gl.getError(), gl.NO_ERROR, 'texImage2D no error')

  // Tex params
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  assertEq(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), gl.NEAREST, 'getTexParameter MIN_FILTER')
  assertEq(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S), gl.CLAMP_TO_EDGE, 'getTexParameter WRAP_S')

  // texSubImage2D
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255]))
  assertEq(gl.getError(), gl.NO_ERROR, 'texSubImage2D no error')

  // texStorage2D
  const tex2 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex2)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 4, 4)
  assertEq(gl.getError(), gl.NO_ERROR, 'texStorage2D no error')

  // Active texture unit
  gl.activeTexture(gl.TEXTURE1)
  assertEq(gl.getParameter(gl.ACTIVE_TEXTURE), gl.TEXTURE1, 'ACTIVE_TEXTURE tracks')
  gl.activeTexture(gl.TEXTURE0)

  // generateMipmap
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.generateMipmap(gl.TEXTURE_2D)
  assertEq(gl.getError(), gl.NO_ERROR, 'generateMipmap no error')

  gl.deleteTexture(tex)
  gl.deleteTexture(tex2)
}

// ─── Framebuffers ───────────────────────────────────────────────────

console.log('-- framebuffers --')
{
  const fbo = gl.createFramebuffer()
  assert(fbo instanceof WebGLFramebuffer, 'createFramebuffer returns WebGLFramebuffer')
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  assert(gl.isFramebuffer(fbo), 'isFramebuffer after bind')
  assertEq(gl.getParameter(gl.FRAMEBUFFER_BINDING), fbo, 'FRAMEBUFFER_BINDING tracks')

  // Attach color texture
  const colorTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, colorTex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 16, 16)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0)

  // Attach depth renderbuffer
  const depthRb = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 16, 16)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb)

  assertEq(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE, 'FBO complete')

  // getFramebufferAttachmentParameter
  const attachType = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE)
  assertEq(attachType, gl.TEXTURE, 'FBO attachment type is TEXTURE')

  // getRenderbufferParameter
  assert(gl.isRenderbuffer(depthRb), 'isRenderbuffer')
  const rbWidth = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_WIDTH)
  assertEq(rbWidth, 16, 'renderbuffer width')

  // Draw to FBO and read back
  gl.viewport(0, 0, 16, 16)
  gl.clearColor(0.0, 1.0, 0.0, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  const fboPixels = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, fboPixels)
  assertEq(fboPixels[0], 0, 'FBO pixel R=0')
  assertEq(fboPixels[1], 255, 'FBO pixel G=255')

  // Unbind
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  assertEq(gl.getParameter(gl.FRAMEBUFFER_BINDING), null, 'FRAMEBUFFER_BINDING null')

  gl.deleteFramebuffer(fbo)
  gl.deleteRenderbuffer(depthRb)
  gl.deleteTexture(colorTex)
}

// ─── renderbufferStorageMultisample ─────────────────────────────────

console.log('-- renderbufferStorageMultisample --')
{
  const rb = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, 32, 32)
  const samples = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_SAMPLES)
  assert(samples >= 0, `multisample samples: ${samples}`)
  assertEq(gl.getError(), gl.NO_ERROR, 'renderbufferStorageMultisample no error')
  gl.deleteRenderbuffer(rb)
}

// ─── Drawing ────────────────────────────────────────────────────────

console.log('-- drawing --')
{
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, W, H)

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_BASIC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_RED)
  const prog = linkProgram(gl, vs, fs)
  gl.useProgram(prog)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.finish()

  const px = new Uint8Array(4)
  gl.readPixels(W/2, H/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  assert(px[0] > 200 && px[1] < 50, `center pixel is red: rgba(${px[0]},${px[1]},${px[2]},${px[3]})`)

  assertEq(gl.getError(), gl.NO_ERROR, 'drawing no errors')

  gl.deleteBuffer(vbo)
  gl.deleteVertexArray(vao)
  gl.deleteProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
}

// ─── Indexed drawing ────────────────────────────────────────────────

console.log('-- indexed drawing --')
{
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_BASIC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_BLUE)
  const prog = linkProgram(gl, vs, fs)
  gl.useProgram(prog)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const ebo = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW)

  gl.viewport(0, 0, W, H)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  gl.finish()

  const px = new Uint8Array(4)
  gl.readPixels(W/2, H/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  assert(px[2] > 200 && px[0] < 50, `indexed center pixel is blue: rgba(${px[0]},${px[1]},${px[2]},${px[3]})`)

  gl.deleteBuffer(vbo)
  gl.deleteBuffer(ebo)
  gl.deleteVertexArray(vao)
  gl.deleteProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
}

// ─── State: enable/disable ──────────────────────────────────────────

console.log('-- state --')
{
  gl.enable(gl.DEPTH_TEST)
  assertEq(gl.isEnabled(gl.DEPTH_TEST), true, 'DEPTH_TEST enabled')
  gl.disable(gl.DEPTH_TEST)
  assertEq(gl.isEnabled(gl.DEPTH_TEST), false, 'DEPTH_TEST disabled')

  gl.enable(gl.BLEND)
  assertEq(gl.isEnabled(gl.BLEND), true, 'BLEND enabled')
  gl.disable(gl.BLEND)

  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)
  gl.frontFace(gl.CCW)
  gl.disable(gl.CULL_FACE)

  gl.depthFunc(gl.LEQUAL)
  gl.depthMask(true)
  gl.depthRange(0.0, 1.0)

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ZERO)
  gl.blendEquation(gl.FUNC_ADD)
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD)
  gl.blendColor(0.5, 0.5, 0.5, 1.0)

  gl.colorMask(true, true, true, true)
  gl.polygonOffset(0, 0)
  gl.sampleCoverage(1.0, false)
  assertEq(gl.getError(), gl.NO_ERROR, 'state ops no error')
}

// ─── Stencil ────────────────────────────────────────────────────────

console.log('-- stencil --')
{
  gl.enable(gl.STENCIL_TEST)
  gl.stencilFunc(gl.ALWAYS, 1, 0xFF)
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
  gl.stencilMask(0xFF)
  gl.stencilFuncSeparate(gl.FRONT, gl.ALWAYS, 0, 0xFF)
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP)
  gl.stencilMaskSeparate(gl.FRONT, 0xFF)
  gl.clearStencil(0)
  gl.disable(gl.STENCIL_TEST)
  assertEq(gl.getError(), gl.NO_ERROR, 'stencil ops no error')
}

// ─── Pixel Store ────────────────────────────────────────────────────

console.log('-- pixel store --')
{
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  assertEq(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), true, 'UNPACK_FLIP_Y set')
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  assertEq(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), false, 'UNPACK_FLIP_Y unset')

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  assertEq(gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), true, 'UNPACK_PREMULTIPLY_ALPHA set')
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  assertEq(gl.getError(), gl.NO_ERROR, 'pixelStorei no error')
}

// ─── Scissor ────────────────────────────────────────────────────────

console.log('-- scissor --')
{
  gl.enable(gl.SCISSOR_TEST)
  gl.scissor(10, 10, 20, 20)
  const sb = gl.getParameter(gl.SCISSOR_BOX)
  assert(sb instanceof Int32Array && sb.length === 4, 'SCISSOR_BOX is Int32Array[4]')
  assertEq(sb[0], 10, 'scissor x')
  assertEq(sb[2], 20, 'scissor width')
  gl.disable(gl.SCISSOR_TEST)
}

// ─── Samplers ───────────────────────────────────────────────────────

console.log('-- samplers --')
{
  const sampler = gl.createSampler()
  assert(sampler instanceof WebGLSampler, 'createSampler returns WebGLSampler')
  gl.bindSampler(0, sampler)
  assert(gl.isSampler(sampler), 'isSampler')

  gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.samplerParameterf(sampler, gl.TEXTURE_MIN_LOD, -1.0)
  gl.samplerParameterf(sampler, gl.TEXTURE_MAX_LOD, 4.0)

  assertEq(gl.getSamplerParameter(sampler, gl.TEXTURE_MIN_FILTER), gl.LINEAR, 'sampler MIN_FILTER')
  assertEq(gl.getSamplerParameter(sampler, gl.TEXTURE_MAG_FILTER), gl.NEAREST, 'sampler MAG_FILTER')
  assertEq(gl.getSamplerParameter(sampler, gl.TEXTURE_WRAP_S), gl.REPEAT, 'sampler WRAP_S')
  assertClose(gl.getSamplerParameter(sampler, gl.TEXTURE_MIN_LOD), -1.0, 0.01, 'sampler MIN_LOD')
  assertClose(gl.getSamplerParameter(sampler, gl.TEXTURE_MAX_LOD), 4.0, 0.01, 'sampler MAX_LOD')

  gl.bindSampler(0, null)
  gl.deleteSampler(sampler)
  assertEq(gl.getError(), gl.NO_ERROR, 'sampler ops no error')
}

// ─── Queries ────────────────────────────────────────────────────────

console.log('-- queries --')
{
  const q = gl.createQuery()
  assert(q instanceof WebGLQuery, 'createQuery returns WebGLQuery')
  assert(!gl.isQuery(q), 'isQuery false before use')

  // Begin/end a query
  gl.beginQuery(gl.ANY_SAMPLES_PASSED, q)
  assert(gl.isQuery(q), 'isQuery true after begin')

  // getQuery (returns current active query or null)
  const currentQ = gl.getQuery(gl.ANY_SAMPLES_PASSED, gl.CURRENT_QUERY)
  assert(currentQ === null || currentQ instanceof WebGLQuery, 'getQuery returns query or null')

  gl.endQuery(gl.ANY_SAMPLES_PASSED)

  // After end, query result should eventually be available
  gl.finish()
  const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)
  assert(typeof available === 'boolean', 'QUERY_RESULT_AVAILABLE is boolean')

  gl.deleteQuery(q)
  assertEq(gl.getError(), gl.NO_ERROR, 'query ops no error')
}

// ─── Sync ───────────────────────────────────────────────────────────

console.log('-- sync --')
{
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  assert(sync instanceof WebGLSync, 'fenceSync returns WebGLSync')
  assert(gl.isSync(sync), 'isSync')

  gl.flush()
  const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 1000000)
  assert(status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED, `clientWaitSync: ${status}`)

  const syncStatus = gl.getSyncParameter(sync, gl.SYNC_STATUS)
  assert(syncStatus === gl.SIGNALED || syncStatus === gl.UNSIGNALED || syncStatus === 0, `getSyncParameter SYNC_STATUS: ${syncStatus}`)
  const syncCond = gl.getSyncParameter(sync, gl.SYNC_CONDITION)
  assert(typeof syncCond === 'number', 'getSyncParameter SYNC_CONDITION is number')

  gl.deleteSync(sync)
  assertEq(gl.getError(), gl.NO_ERROR, 'sync ops no error')
}

// ─── Transform Feedback ─────────────────────────────────────────────

console.log('-- transform feedback --')
{
  const tf = gl.createTransformFeedback()
  assert(tf instanceof WebGLTransformFeedback, 'createTransformFeedback returns WebGLTransformFeedback')
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf)
  assert(gl.isTransformFeedback(tf), 'isTransformFeedback')

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
  gl.deleteTransformFeedback(tf)
  assertEq(gl.getError(), gl.NO_ERROR, 'transform feedback ops no error')
}

// ─── Clear Buffers ──────────────────────────────────────────────────

console.log('-- clear buffers --')
{
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, W, H)

  gl.clearBufferfv(0x1800 /* COLOR */, 0, new Float32Array([0.0, 0.5, 1.0, 1.0]))
  gl.finish()
  const px = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  assertClose(px[1] / 255, 0.5, 0.02, 'clearBufferfv green channel')
  assertClose(px[2] / 255, 1.0, 0.02, 'clearBufferfv blue channel')

  gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1.0, 0)
  assertEq(gl.getError(), gl.NO_ERROR, 'clearBufferfi no error')
}

// ─── Vertex Attrib ──────────────────────────────────────────────────

console.log('-- vertex attribs --')
{
  gl.vertexAttrib1f(0, 1.0)
  gl.vertexAttrib2f(1, 1.0, 2.0)
  gl.vertexAttrib3f(2, 1.0, 2.0, 3.0)
  gl.vertexAttrib4f(3, 1.0, 2.0, 3.0, 4.0)
  gl.vertexAttrib4fv(3, new Float32Array([5, 6, 7, 8]))

  const cur = gl.getVertexAttrib(3, gl.CURRENT_VERTEX_ATTRIB)
  assert(cur instanceof Float32Array && cur.length === 4, 'CURRENT_VERTEX_ATTRIB is Float32Array[4]')
  assertClose(cur[0], 5.0, 0.01, 'vertex attrib value')

  assertEq(gl.getError(), gl.NO_ERROR, 'vertex attrib ops no error')
}

// ─── Instanced Drawing ─────────────────────────────────────────────

console.log('-- instanced drawing --')
{
  const vs = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 aPos;
    in vec2 aOffset;
    void main() { gl_Position = vec4(aPos + aOffset, 0.0, 1.0); }
  `)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_RED)
  const prog = linkProgram(gl, vs, fs)
  gl.useProgram(prog)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 0.1,0, 0,0.1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const obo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, obo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 0.5,0.5]), gl.STATIC_DRAW)
  const aOffset = gl.getAttribLocation(prog, 'aOffset')
  gl.enableVertexAttribArray(aOffset)
  gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(aOffset, 1)

  gl.viewport(0, 0, W, H)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 2)
  gl.finish()
  assertEq(gl.getError(), gl.NO_ERROR, 'drawArraysInstanced no error')

  gl.deleteBuffer(vbo)
  gl.deleteBuffer(obo)
  gl.deleteVertexArray(vao)
  gl.deleteProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
}

// ─── blitFramebuffer ────────────────────────────────────────────────

console.log('-- blitFramebuffer --')
{
  // Create source FBO
  const srcFbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, srcFbo)
  const srcTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, srcTex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 16, 16)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, srcTex, 0)
  assertEq(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE, 'src FBO complete')

  // Clear source to green
  gl.viewport(0, 0, 16, 16)
  gl.clearColor(0, 1, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Create dest FBO
  const dstFbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFbo)
  const dstTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, dstTex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 16, 16)
  gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dstTex, 0)

  // Blit
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
  gl.blitFramebuffer(0, 0, 16, 16, 0, 0, 16, 16, gl.COLOR_BUFFER_BIT, gl.NEAREST)

  // Read back from dest
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, dstFbo)
  const blitPx = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, blitPx)
  assertEq(blitPx[1], 255, 'blit green channel')

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.deleteFramebuffer(srcFbo)
  gl.deleteFramebuffer(dstFbo)
  gl.deleteTexture(srcTex)
  gl.deleteTexture(dstTex)
  assertEq(gl.getError(), gl.NO_ERROR, 'blitFramebuffer no error')
}

// ─── 3D Textures ────────────────────────────────────────────────────

console.log('-- 3D textures --')
{
  const tex3d = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_3D, tex3d)
  assertEq(gl.getParameter(gl.TEXTURE_BINDING_3D), tex3d, 'TEXTURE_BINDING_3D tracks')

  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, 4, 4, 4)
  assertEq(gl.getError(), gl.NO_ERROR, 'texStorage3D no error')

  const data3d = new Uint8Array(4 * 4 * 4 * 4)
  gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, 4, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, data3d)
  assertEq(gl.getError(), gl.NO_ERROR, 'texSubImage3D no error')

  gl.deleteTexture(tex3d)
}

// ─── 2D Array Textures ──────────────────────────────────────────────

console.log('-- 2D array textures --')
{
  const texArr = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArr)
  assertEq(gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY), texArr, 'TEXTURE_BINDING_2D_ARRAY tracks')

  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 4, 4, 3)
  assertEq(gl.getError(), gl.NO_ERROR, 'texStorage3D for 2D array no error')

  // framebufferTextureLayer
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, texArr, 0, 1)
  assertEq(gl.getError(), gl.NO_ERROR, 'framebufferTextureLayer no error')

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.deleteFramebuffer(fbo)
  gl.deleteTexture(texArr)
}

// ─── Cube Map Textures ──────────────────────────────────────────────

console.log('-- cube map textures --')
{
  const cube = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube)
  assertEq(gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP), cube, 'TEXTURE_BINDING_CUBE_MAP tracks')

  const faceData = new Uint8Array(8 * 8 * 4)
  for (let face = 0; face < 6; face++) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA, 8, 8, 0, gl.RGBA, gl.UNSIGNED_BYTE, faceData)
  }
  assertEq(gl.getError(), gl.NO_ERROR, 'cube map upload no error')

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

  gl.deleteTexture(cube)
}

// ─── drawBuffers / MRT ──────────────────────────────────────────────

console.log('-- drawBuffers / MRT --')
{
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

  const tex0 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex0)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 8, 8)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0)

  const tex1 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex1)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 8, 8)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex1, 0)

  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
  assertEq(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE, 'MRT FBO complete')
  assertEq(gl.getError(), gl.NO_ERROR, 'drawBuffers no error')

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.deleteFramebuffer(fbo)
  gl.deleteTexture(tex0)
  gl.deleteTexture(tex1)
}

// ─── Hints ──────────────────────────────────────────────────────────

console.log('-- hints --')
{
  gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST)
  gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.FASTEST)
  assertEq(gl.getError(), gl.NO_ERROR, 'hints no error')
}

// ─── getInternalformatParameter ─────────────────────────────────────

console.log('-- getInternalformatParameter --')
{
  const samples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES)
  assert(samples instanceof Int32Array, 'getInternalformatParameter returns Int32Array')
}

// ─── Cleanup verification ───────────────────────────────────────────

console.log('-- final cleanup --')
{
  // Null delete calls should not throw
  gl.deleteBuffer(null)
  gl.deleteTexture(null)
  gl.deleteFramebuffer(null)
  gl.deleteRenderbuffer(null)
  gl.deleteVertexArray(null)
  gl.deleteQuery(null)
  gl.deleteSampler(null)
  gl.deleteTransformFeedback(null)
  gl.deleteSync(null)
  gl.deleteShader(null)
  gl.deleteProgram(null)

  // is* with null/undefined should return false
  assertEq(gl.isBuffer(null), false, 'isBuffer(null)')
  assertEq(gl.isTexture(null), false, 'isTexture(null)')
  assertEq(gl.isFramebuffer(null), false, 'isFramebuffer(null)')
  assertEq(gl.isRenderbuffer(null), false, 'isRenderbuffer(null)')
  assertEq(gl.isVertexArray(null), false, 'isVertexArray(null)')
  assertEq(gl.isQuery(null), false, 'isQuery(null)')
  assertEq(gl.isSampler(null), false, 'isSampler(null)')
  assertEq(gl.isSync(null), false, 'isSync(null)')
  assertEq(gl.isTransformFeedback(null), false, 'isTransformFeedback(null)')
  assertEq(gl.isShader(null), false, 'isShader(null)')
  assertEq(gl.isProgram(null), false, 'isProgram(null)')

  assertEq(gl.getError(), gl.NO_ERROR, 'final no error')
}

// ─── Exported Classes ───────────────────────────────────────────────

console.log('-- exported classes --')
{
  assert(typeof WebGLBuffer === 'function', 'WebGLBuffer exported')
  assert(typeof WebGLTexture === 'function', 'WebGLTexture exported')
  assert(typeof WebGLFramebuffer === 'function', 'WebGLFramebuffer exported')
  assert(typeof WebGLRenderbuffer === 'function', 'WebGLRenderbuffer exported')
  assert(typeof WebGLProgram === 'function', 'WebGLProgram exported')
  assert(typeof WebGLShader === 'function', 'WebGLShader exported')
  assert(typeof WebGLVertexArrayObject === 'function', 'WebGLVertexArrayObject exported')
  assert(typeof WebGLSampler === 'function', 'WebGLSampler exported')
  assert(typeof WebGLQuery === 'function', 'WebGLQuery exported')
  assert(typeof WebGLSync === 'function', 'WebGLSync exported')
  assert(typeof WebGLTransformFeedback === 'function', 'WebGLTransformFeedback exported')
  assert(typeof WebGLUniformLocation === 'function', 'WebGLUniformLocation exported')
  assert(typeof WebGLActiveInfo === 'function', 'WebGLActiveInfo exported')
  assert(typeof WebGLShaderPrecisionFormat === 'function', 'WebGLShaderPrecisionFormat exported')
}

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failures.length > 0) {
  console.log('\nFailures:')
  failures.forEach(f => console.log(`  - ${f}`))
  process.exit(1)
}
