import gl from 'native-gles'
import { WebGL2RenderingContext } from './lib/webgl2-context.mjs'
import { createMockCanvas } from './lib/canvas-mock.mjs'

export function createWebGL2Context(width, height, opts = {}) {
  const ok = gl.createContext(width, height, opts)
  if (!ok) throw new Error('webgl-node: failed to create EGL context')

  const ctx = new WebGL2RenderingContext(gl, width, height, opts)
  const canvas = createMockCanvas(width, height, ctx)
  ctx.canvas = canvas

  const result = { canvas, gl: ctx }

  // Expose swapBuffers when using a window surface (native window or fbdev)
  if (opts.nativeWindow || opts.windowSurface) {
    result.swapBuffers = () => gl.swapBuffers()
  }

  return result
}

export { WebGL2RenderingContext }
export { GL } from './lib/constants.mjs'
export * from './lib/webgl-objects.mjs'
