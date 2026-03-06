# threejs-simple

A minimal three.js example running in Node.js via [webgl-node](https://github.com/monteslu/webgl-node) with an [@kmamal/sdl](https://github.com/nicksrandall/kmamal-sdl) window — no browser required.

Renders a lit, rotating cube using `MeshStandardMaterial` with directional and ambient lighting in a native SDL window.

## Run

```bash
npm install
npm start
```

## How it works

`webgl-node` provides a headless `WebGL2RenderingContext` backed by EGL/GLES3. The mock canvas and GL context are passed directly to three.js's `WebGLRenderer`:

```js
const window = sdl.video.createWindow({ title: 'cube', width: 512, height: 512, opengl: true })
const { canvas, gl, swapBuffers } = createWebGL2Context(512, 512, {
  nativeWindow: window.native,
})
const renderer = new THREE.WebGLRenderer({ canvas, context: gl })
```

The SDL window provides the native surface, and `swapBuffers()` presents each frame. Standard three.js code works as-is from there.

## Credits

- [three.js](https://threejs.org/) — JavaScript 3D library by [mrdoob](https://github.com/mrdoob) and contributors
- [@kmamal/sdl](https://github.com/nicksrandall/kmamal-sdl) — Node.js SDL2 bindings by [kmamal](https://github.com/nicksrandall)
- [native-gles](https://github.com/monteslu/native-gles) — EGL/GLES3 bindings for Node.js
