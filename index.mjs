import gl from 'native-gles'
import { WebGL2RenderingContext } from './lib/webgl2-context.mjs'
import { createMockCanvas } from './lib/canvas-mock.mjs'

// WebGL guarantees a new drawing buffer starts at colour 0, depth 1.0 and
// stencil 0. EGL does not: a fresh pbuffer or window surface holds whatever
// memory it was given. Colour often reads back as 0, but depth can be garbage,
// so a depth-tested draw into the default framebuffer that the app never
// cleared (three.js r186's final full-screen pass, for example) fails per
// pixel at random. Runs whenever a drawing buffer is (re)created, with this
// context current, and restores every piece of state it touches.
function initDrawingBuffer(ctx) {
  const fb = ctx.getParameter(ctx.DRAW_FRAMEBUFFER_BINDING)
  const scissor = ctx.isEnabled(ctx.SCISSOR_TEST)
  const discard = ctx.isEnabled(ctx.RASTERIZER_DISCARD)
  const color = ctx.getParameter(ctx.COLOR_CLEAR_VALUE)
  const depth = ctx.getParameter(ctx.DEPTH_CLEAR_VALUE)
  const stencil = ctx.getParameter(ctx.STENCIL_CLEAR_VALUE)
  const colorMask = ctx.getParameter(ctx.COLOR_WRITEMASK)
  const depthMask = ctx.getParameter(ctx.DEPTH_WRITEMASK)
  const stencilFront = ctx.getParameter(ctx.STENCIL_WRITEMASK)
  const stencilBack = ctx.getParameter(ctx.STENCIL_BACK_WRITEMASK)
  ctx.bindFramebuffer(ctx.DRAW_FRAMEBUFFER, null)
  // Only NONE would stop the clear. (Mesa reports FRONT for a single-buffered
  // pbuffer, which GLES will not accept back from drawBuffers, so it is left alone.)
  const drawBufferNone = ctx.getParameter(ctx.DRAW_BUFFER0) === ctx.NONE
  if (drawBufferNone) ctx.drawBuffers([ctx.BACK])
  if (scissor) ctx.disable(ctx.SCISSOR_TEST)
  if (discard) ctx.disable(ctx.RASTERIZER_DISCARD)
  ctx.clearColor(0, 0, 0, 0)
  ctx.clearDepth(1)
  ctx.clearStencil(0)
  ctx.colorMask(true, true, true, true)
  ctx.depthMask(true)
  ctx.stencilMask(0xffffffff)
  ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT | ctx.STENCIL_BUFFER_BIT)
  ctx.clearColor(color[0], color[1], color[2], color[3])
  ctx.clearDepth(depth)
  ctx.clearStencil(stencil)
  ctx.colorMask(colorMask[0], colorMask[1], colorMask[2], colorMask[3])
  ctx.depthMask(depthMask)
  ctx.stencilMaskSeparate(ctx.FRONT, stencilFront)
  ctx.stencilMaskSeparate(ctx.BACK, stencilBack)
  if (scissor) ctx.enable(ctx.SCISSOR_TEST)
  if (discard) ctx.enable(ctx.RASTERIZER_DISCARD)
  if (drawBufferNone) ctx.drawBuffers([ctx.NONE])
  ctx.bindFramebuffer(ctx.DRAW_FRAMEBUFFER, fb)
}

export function createWebGL2Context(width, height, opts = {}) {
  // createContext returns a context HANDLE (an int > 0, so this check still
  // works against older native-gles builds that returned a boolean). Every
  // context-management call below binds that handle, which is what keeps two
  // consumers in one process — two carts, a cart and a bezel compositor —
  // from silently sharing (and corrupting) a single global context.
  // antialias: true (opt in; omitted or false keeps the plain surface, unlike
  // a browser, whose default is true) asks native-gles for a 4x multisampled
  // surface. The driver then resolves it on read and present, as a browser
  // does an antialiased canvas. A display with no such config gets the plain
  // one, and getContextAttributes() reports antialias: false.
  const samples = opts.antialias === true ? 4 : 0
  const id = gl.createContext(width, height, { ...opts, samples })
  if (!id) throw new Error('webgl-node: failed to create EGL context')

  const ctx = new WebGL2RenderingContext(gl, width, height, opts)
  initDrawingBuffer(ctx)
  const canvas = createMockCanvas(width, height, ctx)
  ctx.canvas = canvas

  const result = { canvas, gl: ctx, ctxId: id }

  // makeCurrent must be available for EVERY context, not just window
  // surfaces: in a multi-context process each consumer switches the shared
  // GL dispatch onto its own context before rendering. destroy() releases
  // this context specifically, never a bystander's.
  result.makeCurrent = gl.makeCurrent ? () => gl.makeCurrent(id) : null

  // ALSO PUT makeCurrent ON THE CONTEXT OBJECT ITSELF.
  //
  // Consumers are handed `result.gl` (the WebGL2RenderingContext) and keep
  // only that -- wasmcart's createWebGLImports takes it as `ctx`, and its
  // teardown does `ctx.makeCurrent?.()` before deleting the cart's GL
  // objects. That optional-call silently did NOTHING, because makeCurrent
  // lived only on the wrapper above. native-gles dispatches every GL call
  // against ONE process-global current context, and object names are plain
  // integers with no context identity -- so those deletes ran against
  // WHOEVER WAS CURRENT and destroyed another context's identically-numbered
  // textures.
  //
  // Measured 2026-08-21: two contexts each allocated GL texture name 3; one
  // session's cart teardown deleted name 3 while another session's context
  // was current, killing the live cart's scene target. That window went BLACK
  // at a healthy 60fps (0x8cd7, attachment GL_NONE) with a human playing in
  // it, while a CPU readback still showed a perfect picture.
  //
  // Non-enumerable so it cannot disturb anything that walks the context.
  if (result.makeCurrent && !ctx.makeCurrent) {
    Object.defineProperty(ctx, 'makeCurrent', {
      value: result.makeCurrent, writable: true, configurable: true, enumerable: false,
    })
  }
  Object.defineProperty(ctx, 'ctxId', {
    value: id, writable: false, configurable: true, enumerable: false,
  })
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
      // A resized pbuffer is a new surface; resizeContext leaves this context current.
      try { if (gl.resizeContext(w, h, id) !== false) initDrawingBuffer(ctx) } catch { /* window surfaces refuse; size cache still updates */ }
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
      // The window surface is new and now current.
      if (ok) initDrawingBuffer(ctx)
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
