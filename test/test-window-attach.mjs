// attachWindow/detachWindow passthrough.
//
// native-gles has always shipped these; webgl-node did not surface them, so a
// consumer holding a webgl-node context (every wasmcart GL cart) had no way to
// present to a window and had to round-trip every frame GPU -> CPU -> GPU
// (glReadPixels + a software blit, ~5.4 ms/frame at 1080p).
//
// The real attach needs a display and an SDL window handle (native-gles keeps
// that in its own manual_window_attach.js). What is testable headlessly is the
// contract that matters for correctness: the methods exist, they forward the
// context id, and a REFUSED attach leaves the context exactly as it was —
// notably without granting a swapBuffers that would then swap a pbuffer.

import assert from 'node:assert/strict'
import { createWebGL2Context } from '../index.mjs'

const ctx = createWebGL2Context(64, 64)

assert.equal(typeof ctx.attachWindow, 'function', 'attachWindow must be exposed')
assert.equal(typeof ctx.detachWindow, 'function', 'detachWindow must be exposed')

// A pbuffer context created without window opts has no swapBuffers yet.
assert.equal(ctx.swapBuffers, undefined, 'a pbuffer context must not expose swapBuffers')

// Refusal contract, mirroring native-gles/test/test_window_attach.js.
assert.equal(ctx.attachWindow(), false, 'attachWindow() with no handle must refuse')
assert.equal(ctx.attachWindow(Buffer.alloc(2)), false, 'a too-short handle buffer must refuse')
assert.equal(ctx.detachWindow(), false, 'detachWindow() must refuse when not attached')

// The important half: a refused attach must NOT leave the context looking like
// a window surface. If swapBuffers appeared here, the caller would swap a
// pbuffer every frame and see nothing while believing it had presented.
assert.equal(ctx.swapBuffers, undefined, 'a REFUSED attach must not grant swapBuffers')

// And the context must still work after all that.
const gl = ctx.gl
gl.clearColor(0, 1, 0, 1)
gl.clear(gl.COLOR_BUFFER_BIT)
const px = new Uint8Array(4)
gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
assert.deepEqual([px[0], px[1], px[2]], [0, 255, 0], 'context still renders after refused attaches')

ctx.destroy()
console.log('ok  test-window-attach')
