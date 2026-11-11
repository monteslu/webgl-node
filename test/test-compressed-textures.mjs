// Compressed textures: the context advertises the compressed-texture
// extensions the driver has (ETC2 is core in GLES 3.0), getExtension returns
// their format constants, and the four compressedTex* uploads (2D and 3D, image
// and sub-image, whole arrays and srcOffset views) reach the driver with the
// signature native-gles takes: (..., format, data), no separate byte length.
// A block of solid red is drawn and read back, so a silent upload failure
// cannot pass.
import { createWebGL2Context } from '../index.mjs'

console.log('--- test-compressed-textures ---')

const ctx = createWebGL2Context(4, 4)
const gl = ctx.gl
let failed = false
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`); if (!ok) failed = true }

// ---- extensions ----
const supported = gl.getSupportedExtensions()
const native = []
{
  const num = new Int32Array(1)
  gl._gl.glGetIntegerv(0x821D, num)
  for (let i = 0; i < num[0]; i++) native.push(gl._gl.glGetStringi(0x1F03, i))
}
const expectations = [
  ['GL_EXT_texture_compression_s3tc', 'WEBGL_compressed_texture_s3tc', ['COMPRESSED_RGB_S3TC_DXT1_EXT', 'COMPRESSED_RGBA_S3TC_DXT5_EXT']],
  ['GL_EXT_texture_compression_s3tc_srgb', 'WEBGL_compressed_texture_s3tc_srgb', ['COMPRESSED_SRGB_S3TC_DXT1_EXT', 'COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT']],
  ['GL_EXT_texture_compression_bptc', 'EXT_texture_compression_bptc', ['COMPRESSED_RGBA_BPTC_UNORM_EXT', 'COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT']],
  ['GL_EXT_texture_compression_rgtc', 'EXT_texture_compression_rgtc', ['COMPRESSED_RED_RGTC1_EXT', 'COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT']],
  ['GL_KHR_texture_compression_astc_ldr', 'WEBGL_compressed_texture_astc', ['COMPRESSED_RGBA_ASTC_4x4_KHR', 'COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR']],
]
for (const [nativeName, webName, constants] of expectations) {
  if (native.includes(nativeName)) {
    check(supported.includes(webName), `${webName} is advertised (driver has ${nativeName})`)
    const ext = gl.getExtension(webName)
    check(ext && constants.every((c) => typeof ext[c] === 'number'), `${webName} returns its format constants (${constants.join(', ')})`)
  } else {
    check(!supported.includes(webName), `${webName} is not advertised (driver lacks ${nativeName})`)
    check(gl.getExtension(webName) === null, `${webName} is not returned by getExtension`)
  }
}
{
  // WEBGL_compressed_texture_astc is the one extension object with a method (the WebGL spec): getSupportedProfiles()
  const astc = gl.getExtension('WEBGL_compressed_texture_astc')
  if (native.includes('GL_KHR_texture_compression_astc_ldr')) {
    const profiles = astc && typeof astc.getSupportedProfiles === 'function' ? astc.getSupportedProfiles() : null
    check(Array.isArray(profiles) && profiles.includes('ldr'), 'getSupportedProfiles() returns an array that includes ldr')
    check(Array.isArray(profiles) && profiles.includes('hdr') === native.includes('GL_KHR_texture_compression_astc_hdr'),
      "getSupportedProfiles() lists hdr exactly when the driver has GL_KHR_texture_compression_astc_hdr")
  }
}
check(supported.includes('WEBGL_compressed_texture_etc'), 'WEBGL_compressed_texture_etc is always advertised (ETC2 is core in GLES 3.0)')
const etc = gl.getExtension('WEBGL_compressed_texture_etc')
check(!!etc && etc.COMPRESSED_RGB8_ETC2 === 0x9274 && etc.COMPRESSED_RGBA8_ETC2_EAC === 0x9278 && etc.COMPRESSED_R11_EAC === 0x9270,
  'WEBGL_compressed_texture_etc returns the ETC2 / EAC constants')
check(!!etc && typeof etc.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC === 'number' && typeof etc.COMPRESSED_RG11_EAC === 'number', 'the ETC2 constants include the sRGB and RG11 formats')

// ---- drawing a compressed texture ----
function compile(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
  return shader
}
function makeProgram(sampler, fetch) {
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float; precision mediump sampler2DArray;
uniform ${sampler} uTex; out vec4 color;
void main() { color = ${fetch}; }`))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  return program
}
const program2D = makeProgram('sampler2D', 'texture(uTex, vec2(0.5))')
const program3D = makeProgram('sampler2DArray', 'texture(uTex, vec3(0.5, 0.5, 0.0))')
const vao = gl.createVertexArray()
gl.bindVertexArray(vao)

function draw(program, target, texture) {
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(target, texture)
  gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  const px = new Uint8Array(4)
  gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  return [...px]
}
const isRed = (px) => px[0] > 240 && px[1] < 16 && px[2] < 16
const isGreen = (px) => px[0] < 16 && px[1] > 240 && px[2] < 16
const noError = () => { const e = gl.getError(); return e === 0 ? true : `GL error 0x${e.toString(16)}` }

const hasS3tc = native.includes('GL_EXT_texture_compression_s3tc') // the driver, not what the context advertises, so the upload checks run either way
if (!hasS3tc) {
  console.log('SKIP: no S3TC on this driver, so the upload and draw checks have no DXT1 to use')
} else {
  const DXT1 = 0x83F0 // COMPRESSED_RGB_S3TC_DXT1_EXT
  // DXT1 block: color0 = RGB565 red (0xF800, little endian 00 F8), color1 = 0, all indices 0 => solid red
  const red = new Uint8Array([0x00, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const green = new Uint8Array([0xe0, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) // RGB565 green 0x07E0

  // compressedTexImage2D, whole typed array
  let tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.compressedTexImage2D(gl.TEXTURE_2D, 0, DXT1, 4, 4, 0, red)
  check(noError() === true, 'compressedTexImage2D accepts a typed array without a GL error')
  check(isRed(draw(program2D, gl.TEXTURE_2D, tex)), 'compressedTexImage2D: a DXT1 block of solid red draws red')

  // compressedTexSubImage2D replaces the block
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, DXT1, green)
  check(noError() === true, 'compressedTexSubImage2D accepts a typed array without a GL error')
  check(isGreen(draw(program2D, gl.TEXTURE_2D, tex)), 'compressedTexSubImage2D: the block is replaced (draws green)')

  // srcOffset / srcLengthOverride on a larger buffer: the block sits at byte 8 of 24
  const padded = new Uint8Array(24)
  padded.set(green, 0); padded.set(red, 8); padded.set(green, 16)
  const paddedTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, paddedTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.compressedTexImage2D(gl.TEXTURE_2D, 0, DXT1, 4, 4, 0, padded, 8, 8)
  check(noError() === true, 'compressedTexImage2D with srcOffset and srcLengthOverride: no GL error')
  check(isRed(draw(program2D, gl.TEXTURE_2D, paddedTex)), 'compressedTexImage2D reads the block at srcOffset 8 (draws red, not the green around it)')
  gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, DXT1, padded, 16, 8)
  check(isGreen(draw(program2D, gl.TEXTURE_2D, paddedTex)), 'compressedTexSubImage2D reads the block at srcOffset 16 (draws green)')

  // a view with its own byteOffset (a DataView-style slice) is read from its own start
  const view = new Uint8Array(padded.buffer, 8, 8)
  const viewTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, viewTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.compressedTexImage2D(gl.TEXTURE_2D, 0, DXT1, 4, 4, 0, view)
  check(isRed(draw(program2D, gl.TEXTURE_2D, viewTex)), 'a Uint8Array view with a byteOffset uploads from the view start (draws red)')

  // 3D: a one-layer 2D array texture
  const arr = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arr)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.compressedTexImage3D(gl.TEXTURE_2D_ARRAY, 0, DXT1, 4, 4, 1, 0, red)
  check(noError() === true, 'compressedTexImage3D accepts a typed array without a GL error')
  check(isRed(draw(program3D, gl.TEXTURE_2D_ARRAY, arr)), 'compressedTexImage3D: a DXT1 layer of solid red draws red')
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arr)
  gl.compressedTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 4, 4, 1, DXT1, green)
  check(noError() === true, 'compressedTexSubImage3D accepts a typed array without a GL error')
  check(isGreen(draw(program3D, gl.TEXTURE_2D_ARRAY, arr)), 'compressedTexSubImage3D: the layer is replaced (draws green)')
}

// ETC2 is always available: an RGB8 block uploads without a GL error (the block's colour is not checked)
{
  const ETC2_RGB8 = 0x9274
  const block = new Uint8Array(8)
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.compressedTexImage2D(gl.TEXTURE_2D, 0, ETC2_RGB8, 4, 4, 0, block)
  check(noError() === true, 'an ETC2 RGB8 block uploads through compressedTexImage2D without a GL error')
  gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, ETC2_RGB8, block)
  check(noError() === true, 'an ETC2 RGB8 block uploads through compressedTexSubImage2D without a GL error')
}

if (failed) { console.log('\nFAILED'); process.exit(1) }
console.log('\nOK')
