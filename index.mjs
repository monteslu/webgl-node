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

  /**
   * Follow a surface size change.
   *
   * `drawingBufferWidth`/`Height` are cached from creation, so after a window
   * resize (or going fullscreen) they still report the ORIGINAL size — and any
   * caller that sizes a viewport or a blit from them draws into a rect built
   * for the old window, which puts the picture in a corner. There is no event
   * to hook: the owner of the window has to say so.
   *
   * Updates the cached size, and resizes the underlying pbuffer when the
   * context is offscreen (native-gles treats resizeContext as a no-op while a
   * window surface is attached, since a window surface tracks its own window).
   */
  result.resize = (width, height) => {
    const w = Math.max(1, width | 0)
    const h = Math.max(1, height | 0)
    if (gl.resizeContext) {
      try { gl.resizeContext(w, h, id) } catch { /* window surfaces refuse; size cache still updates */ }
    }
    ctx._width = w
    ctx._height = h
    if (canvas) { canvas.width = w; canvas.height = h }
    return true
  }

  if (opts.nativeWindow || opts.windowSurface) {
    result.swapBuffers = () => gl.swapBuffers(id)
    result.setSwapInterval = gl.setSwapInterval ? (interval) => gl.setSwapInterval(interval, id) : null
  }

  // attachWindow/detachWindow are NOT gated on the opts above: their whole
  // purpose is to turn a context that was created as a pbuffer into one that
  // presents to a real window, so requiring the window opts up front would
  // exclude exactly the caller who needs them. A consumer that renders
  // offscreen and LATER acquires a window handle (a playtest window opening
  // over an already-running GL cart) can now present by GPU blit + swap
  // instead of round-tripping frames through glReadPixels and a software blit.
  //
  // Once attached, the context IS a window surface, so swapBuffers has to
  // exist even though the opts branch above did not create it.
  if (gl.attachWindow) {
    result.attachWindow = (handle) => {
      const ok = gl.attachWindow(handle, id)
      if (ok && !result.swapBuffers) {
        result.swapBuffers = () => gl.swapBuffers(id)
        result.setSwapInterval = gl.setSwapInterval ? (interval) => gl.setSwapInterval(interval, id) : null
      }
      return ok
    }
  }
  if (gl.detachWindow) result.detachWindow = () => gl.detachWindow(id)

  return result
}

export { WebGL2RenderingContext }
export { GL } from './lib/constants.mjs'
export * from './lib/webgl-objects.mjs'
