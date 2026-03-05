import { createWebGL2Context } from '../index.mjs'
import * as THREE from 'three'

console.log('--- test-threejs ---')

const W = 256, H = 256
const { canvas, gl } = createWebGL2Context(W, H)

const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false })
renderer.setSize(W, H)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x222222)

const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000)
camera.position.z = 3

const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

cube.rotation.x = 0.5
cube.rotation.y = 0.5

renderer.render(scene, camera)
gl.finish()

// Readback
const pixels = new Uint8Array(W * H * 4)
gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

// Check center pixel — should be green cube
const cx = Math.floor(W / 2)
const cy = Math.floor(H / 2)
const idx = (cy * W + cx) * 4
const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2], a = pixels[idx + 3]
console.log(`center pixel: rgba(${r}, ${g}, ${b}, ${a})`)

// Green cube: g should be dominant
if (g < 100) {
  console.error(`FAIL: expected green-ish center, got rgba(${r}, ${g}, ${b}, ${a})`)
  process.exit(1)
}

// Check that background is dark (corner pixel)
const bgIdx = 0  // bottom-left corner
const bgR = pixels[bgIdx], bgG = pixels[bgIdx + 1], bgB = pixels[bgIdx + 2]
console.log(`corner pixel: rgba(${bgR}, ${bgG}, ${bgB}, ${pixels[bgIdx + 3]})`)

if (bgR > 100 || bgG > 100 || bgB > 100) {
  console.error(`FAIL: expected dark background, got rgba(${bgR}, ${bgG}, ${bgB})`)
  process.exit(1)
}

const err = gl.getError()
if (err !== 0) {
  console.error('FAIL: GL error:', '0x' + err.toString(16))
  process.exit(1)
}

console.log('three.js version:', THREE.REVISION)
console.log('PASS: test-threejs')
