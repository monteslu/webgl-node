import gl from 'native-gles'
import { WebGL2RenderingContext } from './lib/webgl2-context.mjs'
import { createMockCanvas } from './lib/canvas-mock.mjs'

export function createWebGL2Context(width, height, opts = {}) {
  // createContext returns a context HANDLE (an int > 0, so this check still
  // works against older native-gles builds that returned a boolean). Every
  // context-management call below binds that handle, which is what keeps two
  // consumers in one process — two carts, a cart and a bezel compositor —
  // from silently sharing (and corrupting) a single global context.
  const id = gl.createContext(width, height, opts)
  if (!id) throw new Error('webgl-node: failed to create EGL context')

  const ctx = new WebGL2RenderingContext(gl, width, height, opts)
  const canvas = createMockCanvas(width, height, ctx)
  ctx.canvas = canvas

  const result = { canvas, gl: ctx, ctxId: id }

  // makeCurrent must be available for EVERY context, not just window
  // surfaces: in a multi-context process each consumer switches the shared
  // GL dispatch onto its own context before rendering. destroy() releases
  // this context specifically, never a bystander's.
  result.makeCurrent = gl.makeCurrent ? () => gl.makeCurrent(id) : null
  result.destroy = () => gl.destroyContext(id)

  if (opts.nativeWindow || opts.windowSurface) {
    result.swapBuffers = () => gl.swapBuffers(id)
    result.setSwapInterval = gl.setSwapInterval ? (interval) => gl.setSwapInterval(interval, id) : null
  }

  return result
}

export { WebGL2RenderingContext }
export { GL } from './lib/constants.mjs'
export * from './lib/webgl-objects.mjs'
