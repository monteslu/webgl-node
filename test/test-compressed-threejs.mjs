// A DXT1 CompressedTexture drawn through three.js reads back red: the path an
// app takes (three asks getExtension for the format, uploads the mip chain
// with compressedTex*, and samples it), not just the raw context calls.
import { createWebGL2Context } from '../index.mjs'

// three.js r150 and later render through WebGL2 only; the devDependency here is older and treats this
// context as WebGL1, so it cannot show the compressed path. THREE_MODULE points at a newer build
// (a file path or URL); without one, and with an old three, the test skips.
const THREE = await import(process.env.THREE_MODULE ? new URL(process.env.THREE_MODULE, 'file://' + process.cwd() + '/').href : 'three')
if (Number(THREE.REVISION) < 150) {
  console.log('--- test-compressed-threejs ---')
  console.log(`SKIP: three r${THREE.REVISION} predates WebGL2-only rendering; set THREE_MODULE to a three r150 or later build`)
  process.exit(0)
}

console.log('--- test-compressed-threejs ---')

const { canvas, gl } = createWebGL2Context(1, 1)
const renderer = new THREE.WebGLRenderer({ canvas, context: gl })
let failed = false
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`); if (!ok) failed = true }

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
