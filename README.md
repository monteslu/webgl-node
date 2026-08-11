# webgl-node

[![CI](https://github.com/monteslu/webgl-node/actions/workflows/ci.yml/badge.svg)](https://github.com/monteslu/webgl-node/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/webgl-node.svg)](https://www.npmjs.com/package/webgl-node)
[![license](https://img.shields.io/npm/l/webgl-node.svg)](https://github.com/monteslu/webgl-node/blob/main/LICENSE)

WebGL2 implementation for Node.js, backed by native OpenGL ES via [native-gles](https://github.com/monteslu/native-gles).

Provides a spec-compliant `WebGL2RenderingContext` that runs on real GPU hardware through EGL pbuffer contexts. Designed for running browser GL code (like [three.js](https://threejs.org/)) in Node.js without a browser.

## Features

- **Full WebGL 2.0 spec compliance** — Complete implementation of the [WebGL 2.0 specification](https://registry.khronos.org/webgl/specs/latest/2.0/), including UBOs, transform feedback, sync objects, sampler objects, 3D textures, instanced drawing, multiple render targets, and PBO offsets
- **Cross-platform** — Works on Linux, macOS, and Windows
- **x64 and arm64** — Native support for both architectures on all three platforms
- **Real GPU acceleration** — Runs directly on the system's OpenGL ES 3.0 driver, no software translation layer
- **Minimal footprint** — ~1200 lines of JS wrapping a thin native addon; single runtime dependency

## Install

```bash
npm install webgl-node
```

Requires `native-gles` (EGL/GLES3 bindings for Node.js).

## Quick Start

```js
import { createWebGL2Context } from 'webgl-node'

const { canvas, gl } = createWebGL2Context(800, 600)

// Use gl exactly like a browser WebGL2RenderingContext
gl.clearColor(0.2, 0.3, 0.4, 1.0)
gl.clear(gl.COLOR_BUFFER_BIT)

// Read pixels back
const pixels = new Uint8Array(800 * 600 * 4)
gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
```

## API

### `createWebGL2Context(width, height, opts?)`

Creates an EGL pbuffer context and returns:

- `canvas` — Mock canvas object compatible with libraries that expect `canvas.getContext('webgl2')`
- `gl` — Full `WebGL2RenderingContext` instance
- `ctxId` — The native-gles context handle backing this context
- `makeCurrent()` — Make **this** context current before rendering
- `destroy()` — Destroy this context (and only this one)
- `attachWindow(handle)` — Bind this context to a native window handle, turning
  a pbuffer context into one that presents to that window. Returns `false` if
  the bind is refused (the context is left untouched and still usable
  offscreen). On success `swapBuffers`/`setSwapInterval` become available even
  if the context was created without the window opts below.
- `detachWindow()` — Release the window surface and return to offscreen
  rendering. Returns `false` if not attached.

native-gles is multi-context: each `createWebGL2Context` call creates an
independent EGL context with its own object namespace, and every returned
function is bound to it. In a process with more than one context (several
carts, a compositor and a cart, …) each consumer must call its own
`makeCurrent()` before rendering — whoever rendered last owns the current
context otherwise, and draws land in the wrong context silently.

### `WebGL2RenderingContext`

Implements the complete [WebGL 2.0 API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext):

- **Buffers**: `createBuffer`, `bindBuffer`, `bufferData`, `bufferSubData`, `copyBufferSubData`, `getBufferSubData`
- **VAOs**: `createVertexArray`, `bindVertexArray`, `vertexAttribPointer`, `vertexAttribIPointer`, `vertexAttribDivisor`
- **Shaders & Programs**: `createShader`, `compileShader`, `createProgram`, `linkProgram`, `useProgram`
- **Uniforms**: All scalar, vector, and matrix variants (`uniform[1234][fiui][v]`, `uniformMatrix[234]x[234]fv`)
- **Textures**: `texImage2D/3D`, `texSubImage2D/3D`, `texStorage2D/3D`, `compressedTexImage2D/3D`, `compressedTexSubImage2D/3D`
- **Framebuffers**: `createFramebuffer`, `blitFramebuffer`, `framebufferTextureLayer`, `readBuffer`, `invalidateFramebuffer`
- **Renderbuffers**: `renderbufferStorage`, `renderbufferStorageMultisample`
- **Drawing**: `drawArrays`, `drawElements`, `drawArraysInstanced`, `drawElementsInstanced`, `drawRangeElements`, `drawBuffers`
- **Queries**: `createQuery`, `beginQuery`, `endQuery`, `getQuery`, `getQueryParameter`
- **Sync**: `fenceSync`, `clientWaitSync`, `waitSync`, `getSyncParameter`
- **Samplers**: `createSampler`, `samplerParameteri/f`, `getSamplerParameter`
- **Transform Feedback**: `createTransformFeedback`, `beginTransformFeedback`, `transformFeedbackVaryings`
- **UBOs**: `bindBufferBase`, `bindBufferRange`, `getUniformBlockIndex`, `uniformBlockBinding`, `getActiveUniforms`
- **State**: `getParameter`, `getIndexedParameter`, `isEnabled`, `getError`
- **Readback**: `readPixels`, `getBufferSubData`
- **Clear Buffers**: `clearBufferfv`, `clearBufferiv`, `clearBufferuiv`, `clearBufferfi`
- **Extensions**: `getSupportedExtensions`, `getExtension`

### `GL` (constants)

All WebGL2 constants exported as a plain object:

```js
import { GL } from 'webgl-node'
console.log(GL.TRIANGLES) // 0x0004
```

Constants are also available as properties on the context: `gl.TRIANGLES`.

### WebGL Object Classes

Exported for `instanceof` checks:

```js
import { WebGLBuffer, WebGLTexture, WebGLProgram, WebGLShader } from 'webgl-node'
```

## Mock Canvas

The returned `canvas` object supports:

- `width`, `height`, `clientWidth`, `clientHeight`
- `getContext('webgl2')` — returns the GL context
- `getBoundingClientRect()` — returns dimensions
- `addEventListener()`, `removeEventListener()` — no-ops
- `style` object

This is sufficient for libraries like three.js that probe canvas properties during initialization.

## Rendering to a Window with SDL

For on-screen rendering, pair with [@kmamal/sdl](https://github.com/nicksrandall/kmamal-sdl). Create an SDL window with `opengl: true` and pass its native GL handle:

```js
import sdl from '@kmamal/sdl'
import { createWebGL2Context } from 'webgl-node'

const win = sdl.video.createWindow({ title: 'My App', width: 800, height: 600, opengl: true })

const { canvas, gl, swapBuffers, makeCurrent } = createWebGL2Context(800, 600, {
  nativeWindow: win.native.gl,
})

// Re-assert EGL context after SDL init
if (makeCurrent) makeCurrent()

// Render loop
setInterval(() => {
  gl.clearColor(0.2, 0.3, 0.4, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  swapBuffers()
}, 16)

win.on('close', () => process.exit(0))
```

When `nativeWindow` (or `windowSurface`) is provided, `createWebGL2Context` also returns:
- `swapBuffers()` — present the frame
- `setSwapInterval(n)` — set vsync (1 = on, 0 = off). On macOS this drives
  `CAMetalLayer.displaySyncEnabled` through native-gles (ANGLE's own
  `eglSwapInterval` is a no-op there).

`makeCurrent()` and `destroy()` are returned for every context, window or
pbuffer — see above.

#### Attaching a window to an existing context

`nativeWindow` above requires the handle up front. When the context already
exists and a window arrives later — an offscreen renderer that a viewer window
opens onto — use `attachWindow(handle)` instead:

```js
const ctx = createWebGL2Context(1920, 1080)   // offscreen; no window yet
// ... render offscreen, read pixels back, whatever ...

if (ctx.attachWindow(win.native.handle)) {    // now present to a real window
  ctx.setSwapInterval(0)                      // see the note below
  ctx.swapBuffers()
}
ctx.detachWindow()                            // back to offscreen rendering
```

This replaces a `glReadPixels` + software-blit round trip with a GPU swap. Read
pixels back BEFORE swapping: after a swap the back buffer's contents are
undefined, so a readback then returns a torn or stale frame.

> **Set `setSwapInterval(0)` unless you specifically want to block on vsync.**
> The driver default is 1, which parks the calling thread inside
> `swapBuffers()` until the next vblank — measured at ~33 ms/frame, i.e. slower
> than the CPU round trip you are replacing, and on a single-threaded host it
> blocks the whole event loop. A window toolkit's own "vsync off" setting does
> not affect this surface's interval.

On macOS pass `win.native.handle` (an `NSView*`); native-gles resolves it to
the view's backing `CALayer` for ANGLE's Metal backend and keeps its
`contentsScale` synced to the display the window is on.

See [`examples/`](examples/) for complete demos using three.js with SDL.

## Notes

- Runs on EGL pbuffer (offscreen) — no window or display required
- Boolean parameters (`depthMask`, `colorMask`, `vertexAttribPointer` normalized, etc.) are coerced with `!!` for N-API compatibility
- WebGL-specific pixel store params (`UNPACK_FLIP_Y_WEBGL`, `UNPACK_PREMULTIPLY_ALPHA_WEBGL`) are tracked in JS
- `getParameter` returns proper WebGL wrapper objects for binding queries
- `getUniform` introspects the uniform type to return the correct typed array
- `texImage2D` and `texSubImage2D` accept the Image/Canvas source form; pixels are read back via the source's `getContext('2d')` (or a temp canvas for an `Image`), so the source must expose a 2D context

## License

MIT
