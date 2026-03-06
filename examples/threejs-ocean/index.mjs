/**
 * Adapted from the three.js "webgl_shaders_ocean" official example
 * https://threejs.org/examples/#webgl_shaders_ocean
 *
 * Ported to run in Node.js via webgl-node + @kmamal/sdl.
 * Enhanced with additional scene objects using image textures.
 *
 * Original example by three.js contributors (MIT license).
 */

import { fileURLToPath } from 'url'
import path from 'path'
import sdl from '@kmamal/sdl'
import sharp from 'sharp'
import { createWebGL2Context } from 'webgl-node'
import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
import { Sky } from 'three/addons/objects/Sky.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEX_DIR = path.join(__dirname, 'textures')

let W = 1024, H = 768

// ─── Image texture loader ───────────────────────────────────────────

async function loadTexture(filename, opts = {}) {
  const { data, info } = await sharp(path.join(TEX_DIR, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const tex = new THREE.DataTexture(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    info.width, info.height, THREE.RGBAFormat,
  )
  tex.wrapS = opts.wrapS ?? THREE.RepeatWrapping
  tex.wrapT = opts.wrapT ?? THREE.RepeatWrapping
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1])
  tex.flipY = opts.flipY ?? true
  tex.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

// ─── SDL window + webgl-node context ────────────────────────────────

const win = sdl.video.createWindow({
  title: 'three.js Ocean',
  width: W, height: H,
  opengl: true,
  accelerated: false,
  resizable: true,
})

const { canvas, gl, swapBuffers, setSwapInterval, makeCurrent } =
  createWebGL2Context(W, H, { nativeWindow: win.native.gl })

if (makeCurrent) makeCurrent()
if (setSwapInterval) setSwapInterval(1)

// ─── Renderer ───────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ canvas, context: gl })
renderer.setSize(W, H)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.5

if (makeCurrent) makeCurrent()

// ─── Scene + Camera ─────────────────────────────────────────────────

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, W / H, 1, 20000)
camera.position.set(30, 30, 100)

// ─── Sun vector ─────────────────────────────────────────────────────

const sun = new THREE.Vector3()
const sunParams = { elevation: 2, azimuth: 180 }
const phi = THREE.MathUtils.degToRad(90 - sunParams.elevation)
const theta = THREE.MathUtils.degToRad(sunParams.azimuth)
sun.setFromSphericalCoords(1, phi, theta)

// ─── Water ──────────────────────────────────────────────────────────

const waterNormalsTex = await loadTexture('waternormals.jpg', {
  colorSpace: THREE.NoColorSpace,
})

const waterGeometry = new THREE.PlaneGeometry(10000, 10000)
const water = new Water(waterGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals: waterNormalsTex,
  sunDirection: new THREE.Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
  fog: false,
})
water.rotation.x = -Math.PI / 2
water.material.uniforms['sunDirection'].value.copy(sun).normalize()
scene.add(water)

// ─── Sky ────────────────────────────────────────────────────────────

const sky = new Sky()
sky.scale.setScalar(10000)
scene.add(sky)

const skyUniforms = sky.material.uniforms
skyUniforms['turbidity'].value = 10
skyUniforms['rayleigh'].value = 2
skyUniforms['mieCoefficient'].value = 0.005
skyUniforms['mieDirectionalG'].value = 0.8
skyUniforms['sunPosition'].value.copy(sun)

// ─── Lighting ───────────────────────────────────────────────────────

const ambientLight = new THREE.AmbientLight(0x404050, 1.0)
scene.add(ambientLight)

const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x445566, 1.5)
scene.add(hemiLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0)
dirLight.position.set(50, 80, 30)
scene.add(dirLight)

const pointLight1 = new THREE.PointLight(0xff8844, 3.0, 400)
pointLight1.position.set(60, 50, 60)
scene.add(pointLight1)

const pointLight2 = new THREE.PointLight(0x4488ff, 3.0, 400)
pointLight2.position.set(-60, 50, -60)
scene.add(pointLight2)

// ─── Shiny cube (from original example) ─────────────────────────────

const cubeGeo = new THREE.BoxGeometry(30, 30, 30)
const cubeMat = new THREE.MeshPhongMaterial({
  color: 0x8888cc,
  specular: 0xffffff,
  shininess: 200,
})
const cube = new THREE.Mesh(cubeGeo, cubeMat)
scene.add(cube)

// ─── Earth globe ────────────────────────────────────────────────────

const earthTex = await loadTexture('land_ocean_ice_cloud_2048.jpg')
const earthGeo = new THREE.SphereGeometry(15, 64, 32)
const earthMat = new THREE.MeshPhongMaterial({
  map: earthTex,
  specular: 0x333333,
  shininess: 15,
})
const earth = new THREE.Mesh(earthGeo, earthMat)
earth.position.set(-80, 25, -40)
scene.add(earth)

// ─── Brick pillar ───────────────────────────────────────────────────

const brickDiffuse = await loadTexture('brick_diffuse.jpg', { repeat: [2, 4] })
const brickBump = await loadTexture('brick_bump.jpg', {
  repeat: [2, 4], colorSpace: THREE.NoColorSpace,
})

const pillarGeo = new THREE.CylinderGeometry(8, 8, 60, 32)
const pillarMat = new THREE.MeshPhongMaterial({
  map: brickDiffuse,
  bumpMap: brickBump,
  bumpScale: 1.5,
  specular: 0x222222,
  shininess: 10,
})
const pillar = new THREE.Mesh(pillarGeo, pillarMat)
pillar.position.set(80, 10, -60)
scene.add(pillar)

// ─── Wooden crate ───────────────────────────────────────────────────

const woodDiffuse = await loadTexture('hardwood2_diffuse.jpg')
const woodBump = await loadTexture('hardwood2_bump.jpg', {
  colorSpace: THREE.NoColorSpace,
})

const crateGeo = new THREE.BoxGeometry(20, 20, 20)
const crateMat = new THREE.MeshPhongMaterial({
  map: woodDiffuse,
  bumpMap: woodBump,
  bumpScale: 1.0,
  specular: 0x444444,
  shininess: 20,
})
const crate = new THREE.Mesh(crateGeo, crateMat)
crate.position.set(50, 15, 50)
crate.rotation.y = 0.4
scene.add(crate)

// ─── Shiny torus knot ──────────────────────────────────────────────

const torusGeo = new THREE.TorusKnotGeometry(12, 3.5, 128, 32)
const torusMat = new THREE.MeshPhongMaterial({
  color: 0xcc8844,
  specular: 0xffffcc,
  shininess: 300,
})
const torusKnot = new THREE.Mesh(torusGeo, torusMat)
torusKnot.position.set(-40, 30, 60)
scene.add(torusKnot)

// ─── Ring of colorful spheres ───────────────────────────────────────

const smallSphereGeo = new THREE.IcosahedronGeometry(4, 2)
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2
  const r = 120
  const mat = new THREE.MeshPhongMaterial({
    color: new THREE.Color().setHSL(i / 12, 0.8, 0.5),
    specular: 0xffffff,
    shininess: 100,
  })
  const sphere = new THREE.Mesh(smallSphereGeo, mat)
  sphere.position.set(Math.cos(angle) * r, 20 + Math.sin(angle * 3) * 8, Math.sin(angle) * r)
  scene.add(sphere)
}

// ─── Window resize ──────────────────────────────────────────────────

win.on('resize', ({ width, height }) => {
  if (width === 0 || height === 0) return
  W = width
  H = height
  canvas.width = W
  canvas.height = H
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  renderer.setSize(W, H)
})

// ─── Close ──────────────────────────────────────────────────────────

win.on('close', () => process.exit(0))

// ─── Animation loop ────────────────────────────────────────────────

const clock = new THREE.Clock()

setInterval(() => {
  const time = clock.getElapsedTime()

  // Floating cube (from original example)
  cube.position.y = Math.sin(time) * 20 + 5
  cube.rotation.x = time * 0.5
  cube.rotation.z = time * 0.51

  // Earth rotation
  earth.rotation.y = time * 0.3

  // Torus knot spin
  torusKnot.rotation.x = time * 0.4
  torusKnot.rotation.y = time * 0.6
  torusKnot.position.y = 30 + Math.sin(time * 0.7) * 5

  // Crate gentle bob
  crate.position.y = 15 + Math.sin(time * 1.2) * 3
  crate.rotation.y = 0.4 + time * 0.2

  // Orbit point lights
  pointLight1.position.x = Math.cos(time * 0.3) * 80
  pointLight1.position.z = Math.sin(time * 0.3) * 80
  pointLight2.position.x = Math.cos(time * 0.3 + Math.PI) * 80
  pointLight2.position.z = Math.sin(time * 0.3 + Math.PI) * 80

  // Animate water
  water.material.uniforms['time'].value += 1.0 / 60.0

  // Orbit camera slowly
  const camAngle = time * 0.08
  const camRadius = 150
  camera.position.x = Math.cos(camAngle) * camRadius
  camera.position.z = Math.sin(camAngle) * camRadius
  camera.position.y = 30 + Math.sin(time * 0.15) * 10
  camera.lookAt(0, 10, 0)

  renderer.render(scene, camera)
  swapBuffers()
}, 16)

console.log('three.js Ocean demo running — close window to exit')
