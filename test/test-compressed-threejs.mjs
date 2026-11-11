// A DXT1 CompressedTexture drawn through three.js reads back red: the path an
// app takes (three asks getExtension for the format, uploads the mip chain
// with compressedTex*, and samples it), not just the raw context calls.
import { createWebGL2Context } from '../index.mjs'

// three.js r150 and later render through WebGL2 only (this repo's three is a devDependency, kept current).
console.log('--- test-compressed-threejs ---')
let THREE, KTX2Loader
try {
  THREE = await import('three')
  ;({ KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js'))
} catch (e) {
  console.log(`FAIL: three.js could not be imported (${e.code || e.message}); run npm install`)
  process.exit(1)
}
if (Number(THREE.REVISION) < 150) {
  console.log(`FAIL: three r${THREE.REVISION} predates WebGL2-only rendering; this test needs r150 or later`)
  process.exit(1)
}

const { canvas, gl } = createWebGL2Context(1, 1)
const renderer = new THREE.WebGLRenderer({ canvas, context: gl })
let failed = false
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`); if (!ok) failed = true }

// the loader apps call at startup: it asks every compressed extension what it supports, and calls
// getSupportedProfiles() on ASTC, so an extension object without it throws here
const driverExts = new Set()
{
  const num = new Int32Array(1)
  gl._gl.glGetIntegerv(0x821D /* NUM_EXTENSIONS */, num)
  for (let i = 0; i < num[0]; i++) driverExts.add(gl._gl.glGetStringi(0x1F03, i))
}
let support = null
try {
  support = new KTX2Loader().detectSupport(renderer).workerConfig
  check(true, 'KTX2Loader.detectSupport(renderer) does not throw')
} catch (e) {
  check(false, `KTX2Loader.detectSupport(renderer) throws: ${e.message}`)
}
if (support) {
  // three disables ASTC / ETC1 / ETC2 on Linux when the driver also reports BPTC and S3TC (Mesa emulates them in
  // software), so detectSupport's astcSupported and etc2Supported are not the driver's answer; the extension
  // queries it makes are
  check(renderer.extensions.has('WEBGL_compressed_texture_astc') === driverExts.has('GL_KHR_texture_compression_astc_ldr'), 'three finds WEBGL_compressed_texture_astc exactly when the driver has ASTC LDR')
  check(renderer.extensions.has('WEBGL_compressed_texture_etc') === true, 'three finds WEBGL_compressed_texture_etc (ETC2 is core in GLES 3.0)')
  check(support.astcHDRSupported === driverExts.has('GL_KHR_texture_compression_astc_hdr'), `detectSupport astcHDRSupported (${support.astcHDRSupported}) matches the driver`)
  check(support.dxtSupported === driverExts.has('GL_EXT_texture_compression_s3tc'), `detectSupport dxtSupported (${support.dxtSupported}) matches the driver`)
  check(support.bptcSupported === driverExts.has('GL_EXT_texture_compression_bptc'), `detectSupport bptcSupported (${support.bptcSupported}) matches the driver`)
}

check(renderer.extensions.has('WEBGL_compressed_texture_s3tc') === gl.getSupportedExtensions().includes('WEBGL_compressed_texture_s3tc'),
  'three sees the same S3TC support the context advertises')

// the driver's own extension list, so a context that fails to advertise S3TC fails here instead of skipping
const driverHasS3tc = (() => {
  const num = new Int32Array(1)
  gl._gl.glGetIntegerv(0x821D /* NUM_EXTENSIONS */, num)
  for (let i = 0; i < num[0]; i++) if (gl._gl.glGetStringi(0x1F03, i) === 'GL_EXT_texture_compression_s3tc') return true
  return false
})()
if (driverHasS3tc) {
  const block = new Uint8Array([0x00, 0xf8, 0, 0, 0, 0, 0, 0]) // DXT1, solid red
  const texture = new THREE.CompressedTexture([{ data: block, width: 4, height: 4 }], 4, 4, THREE.RGB_S3TC_DXT1_Format)
  texture.needsUpdate = true
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture })))
  renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))
  const px = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  check(px[0] > 240 && px[1] < 16 && px[2] < 16, `a DXT1 CompressedTexture draws red through three.js (read ${[...px]})`)
} else {
  console.log('SKIP: this driver has no S3TC')
}

if (failed) { console.log('\nFAILED'); process.exit(1) }
console.log('\nOK')
process.exit(0)
