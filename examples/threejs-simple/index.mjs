import sdl from '@kmamal/sdl'
import { createWebGL2Context } from 'webgl-node'
import * as THREE from 'three'

const W = 512, H = 512

// Create SDL window
const window = sdl.video.createWindow({ title: 'threejs-simple', width: W, height: H, opengl: true, accelerated: false })

// Create WebGL2 context on the SDL window's native surface
const { canvas, gl, swapBuffers, setSwapInterval, makeCurrent } = createWebGL2Context(W, H, {
  nativeWindow: window.native.gl,
})
if (setSwapInterval) setSwapInterval(1)

// Re-assert EGL context after SDL init
if (makeCurrent) makeCurrent()

// Three.js renderer
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false })
renderer.setSize(W, H)

// Re-assert again after three.js init (it may probe/reset GL state)
if (makeCurrent) makeCurrent()

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a2e)

// Camera
const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 100)
camera.position.z = 3

// Lit cube
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0x00ff88 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Lights
const ambientLight = new THREE.AmbientLight(0x404040)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(2, 3, 4)
scene.add(directionalLight)

// Animation loop — use setInterval so the event loop can process SDL events
window.on('close', () => { process.exit(0) })

console.log(`three.js ${THREE.REVISION} — rendering ${W}x${H}`)

setInterval(() => {
  cube.rotation.x += 0.01
  cube.rotation.y += 0.015

  renderer.render(scene, camera)
  swapBuffers()
}, 16)
