import { GL } from './constants.mjs'
import {
  WebGLBuffer, WebGLTexture, WebGLFramebuffer, WebGLRenderbuffer,
  WebGLProgram, WebGLShader, WebGLVertexArrayObject, WebGLSampler,
  WebGLQuery, WebGLSync, WebGLTransformFeedback, WebGLUniformLocation,
  WebGLActiveInfo, WebGLShaderPrecisionFormat,
  unwrap, toUint8,
} from './webgl-objects.mjs'

const _tmp1 = new Uint32Array(1)

export class WebGL2RenderingContext {
  constructor(gl, width, height, opts) {
    this._gl = gl
    this._width = width
    this._height = height
    this._opts = opts

    // Assign all GL constants as instance properties
    for (const [k, v] of Object.entries(GL)) {
      this[k] = v
    }

    // Binding tracking for getParameter
    this._boundArrayBuffer = null
    this._boundElementArrayBuffer = null
    this._boundFramebuffer = null
    this._boundReadFramebuffer = null
    this._boundRenderbuffer = null
    this._boundTexture2D = null
    this._boundTextureCubeMap = null
    this._boundTexture3D = null
    this._boundTexture2DArray = null
    this._boundVAO = null
    this._currentProgram = null
    this._activeTextureUnit = GL.TEXTURE0

    // WebGL-specific pixel store state
    this._unpackFlipY = false
    this._unpackPremultiplyAlpha = false
    this._unpackColorspaceConversion = 0x9244 // BROWSER_DEFAULT_WEBGL

    // Canvas mock (set from outside)
    this.canvas = null
    this.drawingBufferColorSpace = 'srgb'
    this.unpackColorSpace = 'srgb'
  }

  get drawingBufferWidth() { return this._width }
  get drawingBufferHeight() { return this._height }

  // ─── Errors ────────────────────────────────────────────────────────────

  getError() { return this._gl.glGetError() }

  // ─── State ─────────────────────────────────────────────────────────────

  enable(cap) { this._gl.glEnable(cap) }
  disable(cap) { this._gl.glDisable(cap) }
  isEnabled(cap) { return !!this._gl.glIsEnabled(cap) }

  // ─── Viewport / Clear ─────────────────────────────────────────────────

  viewport(x, y, w, h) { this._gl.glViewport(x, y, w, h) }
  scissor(x, y, w, h) { this._gl.glScissor(x, y, w, h) }
  clear(mask) { this._gl.glClear(mask) }
  clearColor(r, g, b, a) { this._gl.glClearColor(r, g, b, a) }
  clearDepth(d) { this._gl.glClearDepthf(d) }
  clearStencil(s) { this._gl.glClearStencil(s) }

  // ─── Blending ─────────────────────────────────────────────────────────

  blendFunc(s, d) { this._gl.glBlendFunc(s, d) }
  blendFuncSeparate(sR, dR, sA, dA) { this._gl.glBlendFuncSeparate(sR, dR, sA, dA) }
  blendEquation(mode) { this._gl.glBlendEquation(mode) }
  blendEquationSeparate(mR, mA) { this._gl.glBlendEquationSeparate(mR, mA) }
  blendColor(r, g, b, a) { this._gl.glBlendColor(r, g, b, a) }

  // ─── Depth / Stencil ──────────────────────────────────────────────────

  depthFunc(f) { this._gl.glDepthFunc(f) }
  depthMask(flag) { this._gl.glDepthMask(!!flag) }
  depthRange(n, f) { this._gl.glDepthRangef(n, f) }
  stencilFunc(func, ref, mask) { this._gl.glStencilFunc(func, ref, mask) }
  stencilFuncSeparate(face, func, ref, mask) { this._gl.glStencilFuncSeparate(face, func, ref, mask) }
  stencilOp(fail, zf, zp) { this._gl.glStencilOp(fail, zf, zp) }
  stencilOpSeparate(face, fail, zf, zp) { this._gl.glStencilOpSeparate(face, fail, zf, zp) }
  stencilMask(mask) { this._gl.glStencilMask(mask) }
  stencilMaskSeparate(face, mask) { this._gl.glStencilMaskSeparate(face, mask) }

  // ─── Color / Culling / Misc ───────────────────────────────────────────

  colorMask(r, g, b, a) { this._gl.glColorMask(!!r, !!g, !!b, !!a) }
  cullFace(mode) { this._gl.glCullFace(mode) }
  frontFace(mode) { this._gl.glFrontFace(mode) }
  lineWidth(w) { this._gl.glLineWidth(w) }
  polygonOffset(factor, units) { this._gl.glPolygonOffset(factor, units) }
  hint(target, mode) { this._gl.glHint(target, mode) }
  sampleCoverage(value, invert) { this._gl.glSampleCoverage(value, !!invert) }
  finish() { this._gl.glFinish() }
  flush() { this._gl.glFlush() }

  // ─── Pixel Store ──────────────────────────────────────────────────────

  pixelStorei(pname, param) {
    if (pname === GL.UNPACK_FLIP_Y_WEBGL) { this._unpackFlipY = !!param; return }
    if (pname === GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL) { this._unpackPremultiplyAlpha = !!param; return }
    if (pname === GL.UNPACK_COLORSPACE_CONVERSION_WEBGL) { this._unpackColorspaceConversion = param; return }
    this._gl.glPixelStorei(pname, param)
  }

  // ─── Buffers ──────────────────────────────────────────────────────────

  createBuffer() {
    this._gl.glGenBuffers(1, _tmp1)
    return new WebGLBuffer(_tmp1[0])
  }

  deleteBuffer(buf) {
    if (!buf) return
    _tmp1[0] = buf._id
    this._gl.glDeleteBuffers(1, _tmp1)
    if (this._boundArrayBuffer === buf) this._boundArrayBuffer = null
    if (this._boundElementArrayBuffer === buf) this._boundElementArrayBuffer = null
  }

  isBuffer(buf) { return buf ? this._gl.glIsBuffer(buf._id) : false }

  bindBuffer(target, buf) {
    this._gl.glBindBuffer(target, unwrap(buf))
    if (target === GL.ARRAY_BUFFER) this._boundArrayBuffer = buf
    else if (target === GL.ELEMENT_ARRAY_BUFFER) this._boundElementArrayBuffer = buf
  }

  bufferData(target, srcDataOrSize, usage, srcOffset, length) {
    if (typeof srcDataOrSize === 'number') {
      this._gl.glBufferData(target, new Uint8Array(srcDataOrSize), usage)
    } else if (srcDataOrSize == null) {
      return
    } else {
      let data = srcDataOrSize
      if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
        const end = length !== undefined ? srcOffset + length : data.length
        data = data.subarray(srcOffset, end)
      }
      this._gl.glBufferData(target, toUint8(data), usage)
    }
  }

  bufferSubData(target, offset, srcData, srcOffset, length) {
    if (srcData == null) return
    let data = srcData
    if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
      const end = length !== undefined ? srcOffset + length : data.length
      data = data.subarray(srcOffset, end)
    }
    this._gl.glBufferSubData(target, offset, toUint8(data))
  }

  copyBufferSubData(readTarget, writeTarget, readOffset, writeOffset, size) {
    this._gl.glCopyBufferSubData(readTarget, writeTarget, readOffset, writeOffset, size)
  }

  getBufferSubData(target, srcByteOffset, dstData, dstOffset, length) {
    // Map buffer, copy to dstData, unmap
    const bufSize = this.getBufferParameter(target, GL.BUFFER_SIZE)
    const readLen = (length !== undefined ? length * dstData.BYTES_PER_ELEMENT : dstData.byteLength - (dstOffset || 0) * dstData.BYTES_PER_ELEMENT)
    const mapped = this._gl.glMapBufferRange(target, srcByteOffset, readLen, GL.MAP_READ_BIT)
    if (mapped) {
      const src = new Uint8Array(mapped.buffer || mapped, mapped.byteOffset || 0, readLen)
      const off = (dstOffset || 0) * dstData.BYTES_PER_ELEMENT
      const dst = new Uint8Array(dstData.buffer, dstData.byteOffset + off, readLen)
      dst.set(src)
    }
    this._gl.glUnmapBuffer(target)
  }

  // ─── Vertex Array Objects ─────────────────────────────────────────────

  createVertexArray() {
    this._gl.glGenVertexArrays(1, _tmp1)
    return new WebGLVertexArrayObject(_tmp1[0])
  }

  deleteVertexArray(vao) {
    if (!vao) return
    _tmp1[0] = vao._id
    this._gl.glDeleteVertexArrays(1, _tmp1)
    if (this._boundVAO === vao) this._boundVAO = null
  }

  bindVertexArray(vao) {
    this._gl.glBindVertexArray(unwrap(vao))
    this._boundVAO = vao
  }

  isVertexArray(vao) { return vao ? this._gl.glIsVertexArray(vao._id) : false }

  // ─── Shaders ──────────────────────────────────────────────────────────

  createShader(type) {
    const id = this._gl.glCreateShader(type)
    return id ? new WebGLShader(id) : null
  }

  deleteShader(shader) {
    if (shader) this._gl.glDeleteShader(shader._id)
  }

  shaderSource(shader, source) {
    this._gl.glShaderSource(shader._id, source)
  }

  compileShader(shader) {
    this._gl.glCompileShader(shader._id)
  }

  getShaderParameter(shader, pname) {
    const val = this._gl.glGetShaderiv(shader._id, pname)
    if (pname === GL.COMPILE_STATUS || pname === GL.DELETE_STATUS) return !!val
    return val
  }

  getShaderInfoLog(shader) {
    return this._gl.glGetShaderInfoLog(shader._id) || ''
  }

  getShaderSource(shader) {
    return this._gl.glGetShaderSource(shader._id) || ''
  }

  isShader(shader) { return shader ? this._gl.glIsShader(shader._id) : false }

  getShaderPrecisionFormat(shaderType, precisionType) {
    const result = this._gl.glGetShaderPrecisionFormat(shaderType, precisionType)
    if (!result) return null
    return new WebGLShaderPrecisionFormat(result.range?.[0] ?? result.rangeMin ?? 0, result.range?.[1] ?? result.rangeMax ?? 0, result.precision ?? 0)
  }

  // ─── Programs ─────────────────────────────────────────────────────────

  createProgram() {
    const id = this._gl.glCreateProgram()
    return id ? new WebGLProgram(id) : null
  }

  deleteProgram(prog) {
    if (prog) this._gl.glDeleteProgram(prog._id)
    if (this._currentProgram === prog) this._currentProgram = null
  }

  attachShader(prog, shader) {
    this._gl.glAttachShader(prog._id, shader._id)
  }

  detachShader(prog, shader) {
    this._gl.glDetachShader(prog._id, shader._id)
  }

  linkProgram(prog) {
    this._gl.glLinkProgram(prog._id)
  }

  useProgram(prog) {
    this._gl.glUseProgram(unwrap(prog))
    this._currentProgram = prog
  }

  validateProgram(prog) {
    this._gl.glValidateProgram(prog._id)
  }

  getProgramParameter(prog, pname) {
    const val = this._gl.glGetProgramiv(prog._id, pname)
    if (pname === GL.LINK_STATUS || pname === GL.VALIDATE_STATUS || pname === GL.DELETE_STATUS) return !!val
    return val
  }

  getProgramInfoLog(prog) {
    return this._gl.glGetProgramInfoLog(prog._id) || ''
  }

  isProgram(prog) { return prog ? this._gl.glIsProgram(prog._id) : false }

  getAttachedShaders(prog) {
    const shadersBuf = new Uint32Array(16)
    this._gl.glGetAttachedShaders(prog._id, shadersBuf)
    // Count non-zero entries
    const result = []
    for (let i = 0; i < shadersBuf.length; i++) {
      if (shadersBuf[i] === 0) break
      result.push(new WebGLShader(shadersBuf[i]))
    }
    return result
  }

  // ─── Attributes ───────────────────────────────────────────────────────

  getAttribLocation(prog, name) {
    return this._gl.glGetAttribLocation(prog._id, name)
  }

  bindAttribLocation(prog, index, name) {
    this._gl.glBindAttribLocation(prog._id, index, name)
  }

  enableVertexAttribArray(index) {
    this._gl.glEnableVertexAttribArray(index)
  }

  disableVertexAttribArray(index) {
    this._gl.glDisableVertexAttribArray(index)
  }

  vertexAttribPointer(index, size, type, normalized, stride, offset) {
    this._gl.glVertexAttribPointer(index, size, type, !!normalized, stride, offset)
  }

  vertexAttribIPointer(index, size, type, stride, offset) {
    this._gl.glVertexAttribIPointer(index, size, type, stride, offset)
  }

  vertexAttribDivisor(index, divisor) {
    this._gl.glVertexAttribDivisor(index, divisor)
  }

  vertexAttrib1f(index, x) { this._gl.glVertexAttrib1f(index, x) }
  vertexAttrib2f(index, x, y) { this._gl.glVertexAttrib2f(index, x, y) }
  vertexAttrib3f(index, x, y, z) { this._gl.glVertexAttrib3f(index, x, y, z) }
  vertexAttrib4f(index, x, y, z, w) { this._gl.glVertexAttrib4f(index, x, y, z, w) }

  vertexAttrib1fv(index, v) { this._gl.glVertexAttrib1fv(index, v instanceof Float32Array ? v : new Float32Array(v)) }
  vertexAttrib2fv(index, v) { this._gl.glVertexAttrib2fv(index, v instanceof Float32Array ? v : new Float32Array(v)) }
  vertexAttrib3fv(index, v) { this._gl.glVertexAttrib3fv(index, v instanceof Float32Array ? v : new Float32Array(v)) }
  vertexAttrib4fv(index, v) { this._gl.glVertexAttrib4fv(index, v instanceof Float32Array ? v : new Float32Array(v)) }

  vertexAttribI4i(index, x, y, z, w) { this._gl.glVertexAttribI4i(index, x, y, z, w) }
  vertexAttribI4ui(index, x, y, z, w) { this._gl.glVertexAttribI4ui(index, x, y, z, w) }
  vertexAttribI4iv(index, v) { this._gl.glVertexAttribI4iv(index, v instanceof Int32Array ? v : new Int32Array(v)) }
  vertexAttribI4uiv(index, v) { this._gl.glVertexAttribI4uiv(index, v instanceof Uint32Array ? v : new Uint32Array(v)) }

  getActiveAttrib(prog, index) {
    const info = this._gl.glGetActiveAttrib(prog._id, index, 256)
    if (!info) return null
    return new WebGLActiveInfo(info.name, info.size, info.type)
  }

  // ─── Uniforms ─────────────────────────────────────────────────────────

  getUniformLocation(prog, name) {
    const loc = this._gl.glGetUniformLocation(prog._id, name)
    return loc === -1 ? null : new WebGLUniformLocation(loc)
  }

  getActiveUniform(prog, index) {
    const info = this._gl.glGetActiveUniform(prog._id, index, 256)
    if (!info) return null
    return new WebGLActiveInfo(info.name, info.size, info.type)
  }

  uniform1i(loc, v0) { if (loc) this._gl.glUniform1i(loc._id, Number(v0)) }
  uniform2i(loc, v0, v1) { if (loc) this._gl.glUniform2i(loc._id, v0, v1) }
  uniform3i(loc, v0, v1, v2) { if (loc) this._gl.glUniform3i(loc._id, v0, v1, v2) }
  uniform4i(loc, v0, v1, v2, v3) { if (loc) this._gl.glUniform4i(loc._id, v0, v1, v2, v3) }

  uniform1f(loc, v0) { if (loc) this._gl.glUniform1f(loc._id, v0) }
  uniform2f(loc, v0, v1) { if (loc) this._gl.glUniform2f(loc._id, v0, v1) }
  uniform3f(loc, v0, v1, v2) { if (loc) this._gl.glUniform3f(loc._id, v0, v1, v2) }
  uniform4f(loc, v0, v1, v2, v3) { if (loc) this._gl.glUniform4f(loc._id, v0, v1, v2, v3) }

  uniform1ui(loc, v0) { if (loc) this._gl.glUniform1ui(loc._id, v0) }
  uniform2ui(loc, v0, v1) { if (loc) this._gl.glUniform2ui(loc._id, v0, v1) }
  uniform3ui(loc, v0, v1, v2) { if (loc) this._gl.glUniform3ui(loc._id, v0, v1, v2) }
  uniform4ui(loc, v0, v1, v2, v3) { if (loc) this._gl.glUniform4ui(loc._id, v0, v1, v2, v3) }

  uniform1iv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform1iv(loc._id, this._uniformArr(data, srcOffset, srcLength, Int32Array)) }
  uniform2iv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform2iv(loc._id, this._uniformArr(data, srcOffset, srcLength, Int32Array)) }
  uniform3iv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform3iv(loc._id, this._uniformArr(data, srcOffset, srcLength, Int32Array)) }
  uniform4iv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform4iv(loc._id, this._uniformArr(data, srcOffset, srcLength, Int32Array)) }

  uniform1fv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform1fv(loc._id, this._uniformArr(data, srcOffset, srcLength, Float32Array)) }
  uniform2fv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform2fv(loc._id, this._uniformArr(data, srcOffset, srcLength, Float32Array)) }
  uniform3fv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform3fv(loc._id, this._uniformArr(data, srcOffset, srcLength, Float32Array)) }
  uniform4fv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform4fv(loc._id, this._uniformArr(data, srcOffset, srcLength, Float32Array)) }

  uniform1uiv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform1uiv(loc._id, this._uniformArr(data, srcOffset, srcLength, Uint32Array)) }
  uniform2uiv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform2uiv(loc._id, this._uniformArr(data, srcOffset, srcLength, Uint32Array)) }
  uniform3uiv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform3uiv(loc._id, this._uniformArr(data, srcOffset, srcLength, Uint32Array)) }
  uniform4uiv(loc, data, srcOffset, srcLength) { if (loc) this._gl.glUniform4uiv(loc._id, this._uniformArr(data, srcOffset, srcLength, Uint32Array)) }

  uniformMatrix2fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix2fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix3fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix3fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix4fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix4fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix2x3fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix2x3fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix3x2fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix3x2fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix2x4fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix2x4fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix4x2fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix4x2fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix3x4fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix3x4fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }
  uniformMatrix4x3fv(loc, transpose, data, srcOffset, srcLength) {
    if (loc) this._gl.glUniformMatrix4x3fv(loc._id, !!transpose, this._uniformArr(data, srcOffset, srcLength, Float32Array))
  }

  _uniformArr(data, srcOffset, srcLength, TypedCtor) {
    let arr = data instanceof TypedCtor ? data : new TypedCtor(data)
    if (srcOffset !== undefined) {
      const end = srcLength !== undefined ? srcOffset + srcLength : arr.length
      arr = arr.subarray(srcOffset, end)
    }
    return arr
  }

  // ─── Textures ─────────────────────────────────────────────────────────

  createTexture() {
    this._gl.glGenTextures(1, _tmp1)
    return new WebGLTexture(_tmp1[0])
  }

  deleteTexture(tex) {
    if (!tex) return
    _tmp1[0] = tex._id
    this._gl.glDeleteTextures(1, _tmp1)
  }

  bindTexture(target, tex) {
    this._gl.glBindTexture(target, unwrap(tex))
    if (target === GL.TEXTURE_2D) this._boundTexture2D = tex
    else if (target === GL.TEXTURE_CUBE_MAP) this._boundTextureCubeMap = tex
    else if (target === GL.TEXTURE_3D) this._boundTexture3D = tex
    else if (target === GL.TEXTURE_2D_ARRAY) this._boundTexture2DArray = tex
  }

  activeTexture(unit) {
    this._gl.glActiveTexture(unit)
    this._activeTextureUnit = unit
  }

  texParameteri(target, pname, param) { this._gl.glTexParameteri(target, pname, param) }
  texParameterf(target, pname, param) { this._gl.glTexParameterf(target, pname, param) }
  generateMipmap(target) { this._gl.glGenerateMipmap(target) }
  isTexture(tex) { return tex ? this._gl.glIsTexture(tex._id) : false }

  texImage2D(target, level, internalformat, ...rest) {
    // 9-arg: texImage2D(target, level, internalformat, width, height, border, format, type, pixels/pboOffset)
    // 6-arg: texImage2D(target, level, internalformat, format, type, source) — source is Image/Canvas
    // 10-arg: texImage2D(target, level, internalformat, width, height, border, format, type, pixels, srcOffset)
    if (rest.length >= 5) {
      const [width, height, border, format, type, pixels, srcOffset] = rest
      if (typeof pixels === 'number') {
        // PBO offset
        this._gl.glTexImage2D(target, level, internalformat, width, height, border, format, type, pixels)
      } else {
        let data = pixels
        if (data != null && srcOffset !== undefined && ArrayBuffer.isView(data)) {
          data = data.subarray(srcOffset)
        }
        this._gl.glTexImage2D(target, level, internalformat, width, height, border, format, type, toUint8(data))
      }
    } else if (rest.length === 3) {
      // 6-arg form: (target, level, internalformat, format, type, source)
      const [format, type, source] = rest
      if (source && typeof source === 'object' && source.width && source.height) {
        // Extract pixel data from Image or Canvas via a temp 2D canvas
        const w = source.width
        const h = source.height
        let pixels
        if (source.getContext) {
          // It's a canvas — get pixels directly
          const ctx = source.getContext('2d')
          pixels = new Uint8Array(ctx.getImageData(0, 0, w, h).data)
        } else if (typeof globalThis.document !== 'undefined' && globalThis.document.createElement) {
          // It's an Image — draw to a temp canvas
          const tmp = globalThis.document.createElement('canvas')
          tmp.width = w
          tmp.height = h
          const ctx = tmp.getContext('2d')
          ctx.drawImage(source, 0, 0)
          pixels = new Uint8Array(ctx.getImageData(0, 0, w, h).data)
        }
        if (pixels) {
          this._gl.glTexImage2D(target, level, internalformat, w, h, 0, format, type, pixels)
        }
      }
    }
  }

  texSubImage2D(target, level, xoffset, yoffset, ...rest) {
    if (rest.length >= 4) {
      const [width, height, format, type, pixels, srcOffset] = rest
      if (typeof pixels === 'number') {
        // PBO offset
        this._gl.glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels)
      } else {
        let data = pixels
        if (data != null && srcOffset !== undefined && ArrayBuffer.isView(data)) {
          data = data.subarray(srcOffset)
        }
        this._gl.glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, toUint8(data))
      }
    }
  }

  texImage3D(target, level, internalformat, width, height, depth, border, format, type, pixels, srcOffset) {
    if (typeof pixels === 'number') {
      this._gl.glTexImage3D(target, level, internalformat, width, height, depth, border, format, type, pixels)
    } else {
      let data = pixels
      if (data != null && srcOffset !== undefined && ArrayBuffer.isView(data)) {
        data = data.subarray(srcOffset)
      }
      this._gl.glTexImage3D(target, level, internalformat, width, height, depth, border, format, type, toUint8(data))
    }
  }

  texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels, srcOffset) {
    if (typeof pixels === 'number') {
      this._gl.glTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels)
    } else {
      let data = pixels
      if (data != null && srcOffset !== undefined && ArrayBuffer.isView(data)) {
        data = data.subarray(srcOffset)
      }
      this._gl.glTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, toUint8(data))
    }
  }

  texStorage2D(target, levels, internalformat, width, height) {
    this._gl.glTexStorage2D(target, levels, internalformat, width, height)
  }

  texStorage3D(target, levels, internalformat, width, height, depth) {
    this._gl.glTexStorage3D(target, levels, internalformat, width, height, depth)
  }

  compressedTexImage2D(target, level, internalformat, width, height, border, dataOrSize, srcOffset, srcLengthOverride) {
    if (typeof dataOrSize === 'number') {
      this._gl.glCompressedTexImage2D(target, level, internalformat, width, height, border, dataOrSize, srcOffset || 0)
    } else {
      let data = dataOrSize
      if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
        const end = srcLengthOverride !== undefined ? srcOffset + srcLengthOverride : data.length
        data = data.subarray(srcOffset, end)
      }
      const u8 = toUint8(data)
      this._gl.glCompressedTexImage2D(target, level, internalformat, width, height, border, u8.byteLength, u8)
    }
  }

  compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, dataOrSize, srcOffset, srcLengthOverride) {
    if (typeof dataOrSize === 'number') {
      this._gl.glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, dataOrSize, srcOffset || 0)
    } else {
      let data = dataOrSize
      if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
        const end = srcLengthOverride !== undefined ? srcOffset + srcLengthOverride : data.length
        data = data.subarray(srcOffset, end)
      }
      const u8 = toUint8(data)
      this._gl.glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, u8.byteLength, u8)
    }
  }

  compressedTexImage3D(target, level, internalformat, width, height, depth, border, dataOrSize, srcOffset, srcLengthOverride) {
    if (typeof dataOrSize === 'number') {
      this._gl.glCompressedTexImage3D(target, level, internalformat, width, height, depth, border, dataOrSize, srcOffset || 0)
    } else {
      let data = dataOrSize
      if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
        const end = srcLengthOverride !== undefined ? srcOffset + srcLengthOverride : data.length
        data = data.subarray(srcOffset, end)
      }
      const u8 = toUint8(data)
      this._gl.glCompressedTexImage3D(target, level, internalformat, width, height, depth, border, u8.byteLength, u8)
    }
  }

  compressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, dataOrSize, srcOffset, srcLengthOverride) {
    if (typeof dataOrSize === 'number') {
      this._gl.glCompressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, dataOrSize, srcOffset || 0)
    } else {
      let data = dataOrSize
      if (srcOffset !== undefined && ArrayBuffer.isView(data)) {
        const end = srcLengthOverride !== undefined ? srcOffset + srcLengthOverride : data.length
        data = data.subarray(srcOffset, end)
      }
      const u8 = toUint8(data)
      this._gl.glCompressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, u8.byteLength, u8)
    }
  }

  copyTexImage2D(target, level, internalformat, x, y, width, height, border) {
    this._gl.glCopyTexImage2D(target, level, internalformat, x, y, width, height, border)
  }

  copyTexSubImage2D(target, level, xoffset, yoffset, x, y, width, height) {
    this._gl.glCopyTexSubImage2D(target, level, xoffset, yoffset, x, y, width, height)
  }

  copyTexSubImage3D(target, level, xoffset, yoffset, zoffset, x, y, width, height) {
    this._gl.glCopyTexSubImage3D(target, level, xoffset, yoffset, zoffset, x, y, width, height)
  }

  // ─── Framebuffers ─────────────────────────────────────────────────────

  createFramebuffer() {
    this._gl.glGenFramebuffers(1, _tmp1)
    return new WebGLFramebuffer(_tmp1[0])
  }

  deleteFramebuffer(fb) {
    if (!fb) return
    _tmp1[0] = fb._id
    this._gl.glDeleteFramebuffers(1, _tmp1)
  }

  bindFramebuffer(target, fb) {
    this._gl.glBindFramebuffer(target, unwrap(fb))
    if (target === GL.FRAMEBUFFER || target === GL.DRAW_FRAMEBUFFER) this._boundFramebuffer = fb
    if (target === GL.FRAMEBUFFER || target === GL.READ_FRAMEBUFFER) this._boundReadFramebuffer = fb
  }

  checkFramebufferStatus(target) {
    return this._gl.glCheckFramebufferStatus(target)
  }

  framebufferTexture2D(target, attachment, textarget, tex, level) {
    this._gl.glFramebufferTexture2D(target, attachment, textarget, unwrap(tex), level)
  }

  framebufferTextureLayer(target, attachment, tex, level, layer) {
    this._gl.glFramebufferTextureLayer(target, attachment, unwrap(tex), level, layer)
  }

  framebufferRenderbuffer(target, attachment, rbtarget, rb) {
    this._gl.glFramebufferRenderbuffer(target, attachment, rbtarget, unwrap(rb))
  }

  blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter) {
    this._gl.glBlitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter)
  }

  readBuffer(src) { this._gl.glReadBuffer(src) }

  invalidateFramebuffer(target, attachments) {
    this._gl.glInvalidateFramebuffer(target, new Uint32Array(attachments))
  }

  invalidateSubFramebuffer(target, attachments, x, y, width, height) {
    this._gl.glInvalidateSubFramebuffer(target, new Uint32Array(attachments), x, y, width, height)
  }

  isFramebuffer(fb) { return fb ? this._gl.glIsFramebuffer(fb._id) : false }

  // ─── Renderbuffers ────────────────────────────────────────────────────

  createRenderbuffer() {
    this._gl.glGenRenderbuffers(1, _tmp1)
    return new WebGLRenderbuffer(_tmp1[0])
  }

  deleteRenderbuffer(rb) {
    if (!rb) return
    _tmp1[0] = rb._id
    this._gl.glDeleteRenderbuffers(1, _tmp1)
  }

  bindRenderbuffer(target, rb) {
    this._gl.glBindRenderbuffer(target, unwrap(rb))
    this._boundRenderbuffer = rb
  }

  renderbufferStorage(target, internalformat, width, height) {
    this._gl.glRenderbufferStorage(target, internalformat, width, height)
  }

  renderbufferStorageMultisample(target, samples, internalformat, width, height) {
    this._gl.glRenderbufferStorageMultisample(target, samples, internalformat, width, height)
  }

  isRenderbuffer(rb) { return rb ? this._gl.glIsRenderbuffer(rb._id) : false }

  // ─── Drawing ──────────────────────────────────────────────────────────

  drawArrays(mode, first, count) { this._gl.glDrawArrays(mode, first, count) }
  drawElements(mode, count, type, offset) { this._gl.glDrawElements(mode, count, type, offset) }
  drawArraysInstanced(mode, first, count, instanceCount) { this._gl.glDrawArraysInstanced(mode, first, count, instanceCount) }
  drawElementsInstanced(mode, count, type, offset, instanceCount) { this._gl.glDrawElementsInstanced(mode, count, type, offset, instanceCount) }
  drawRangeElements(mode, start, end, count, type, offset) { this._gl.glDrawRangeElements(mode, start, end, count, type, offset) }
  drawBuffers(buffers) { this._gl.glDrawBuffers(new Uint32Array(buffers)) }

  // ─── Readback ─────────────────────────────────────────────────────────

  readPixels(x, y, width, height, format, type, pixelsOrOffset, dstOffset) {
    if (pixelsOrOffset == null) return
    if (typeof pixelsOrOffset === 'number') {
      // PBO offset
      this._gl.glReadPixels(x, y, width, height, format, type, pixelsOrOffset)
    } else {
      const dst = dstOffset ? new Uint8Array(pixelsOrOffset.buffer, pixelsOrOffset.byteOffset + (dstOffset * pixelsOrOffset.BYTES_PER_ELEMENT)) : toUint8(pixelsOrOffset)
      this._gl.glReadPixels(x, y, width, height, format, type, dst instanceof Uint8Array ? dst : toUint8(dst))
    }
  }

  // ─── Sync ─────────────────────────────────────────────────────────────

  fenceSync(condition, flags) {
    const id = this._gl.glFenceSync(condition, flags)
    return id ? new WebGLSync(id) : null
  }

  deleteSync(sync) { if (sync) this._gl.glDeleteSync(sync._id) }
  isSync(sync) { return sync ? this._gl.glIsSync(sync._id) : false }

  clientWaitSync(sync, flags, timeout) {
    return sync ? this._gl.glClientWaitSync(sync._id, flags, timeout) : GL.WAIT_FAILED
  }

  waitSync(sync, flags, timeout) {
    if (sync) this._gl.glWaitSync(sync._id, flags, timeout)
  }

  getSyncParameter(sync, pname) {
    if (!sync) return null
    const buf = new Int32Array(1)
    this._gl.glGetSynciv(sync._id, pname, buf)
    return buf[0]
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  createQuery() {
    this._gl.glGenQueries(1, _tmp1)
    return new WebGLQuery(_tmp1[0])
  }

  deleteQuery(query) {
    if (!query) return
    _tmp1[0] = query._id
    this._gl.glDeleteQueries(1, _tmp1)
  }

  beginQuery(target, query) { this._gl.glBeginQuery(target, query._id) }
  endQuery(target) { this._gl.glEndQuery(target) }
  isQuery(query) { return query ? this._gl.glIsQuery(query._id) : false }

  getQuery(target, pname) {
    if (pname === 0x8865 /* CURRENT_QUERY */) {
      const buf = new Int32Array(1)
      this._gl.glGetQueryiv(target, pname, buf)
      return buf[0] ? new WebGLQuery(buf[0]) : null
    }
    return null
  }

  getQueryParameter(query, pname) {
    if (!query) return null
    if (pname === GL.QUERY_RESULT_AVAILABLE) return !!this._gl.glGetQueryObjectuiv(query._id, pname)
    return this._gl.glGetQueryObjectuiv(query._id, pname)
  }

  // ─── Samplers ─────────────────────────────────────────────────────────

  createSampler() {
    this._gl.glGenSamplers(1, _tmp1)
    return new WebGLSampler(_tmp1[0])
  }

  deleteSampler(sampler) {
    if (!sampler) return
    _tmp1[0] = sampler._id
    this._gl.glDeleteSamplers(1, _tmp1)
  }

  bindSampler(unit, sampler) { this._gl.glBindSampler(unit, unwrap(sampler)) }
  samplerParameteri(sampler, pname, param) { this._gl.glSamplerParameteri(sampler._id, pname, param) }
  samplerParameterf(sampler, pname, param) { this._gl.glSamplerParameterf(sampler._id, pname, param) }
  isSampler(sampler) { return sampler ? this._gl.glIsSampler(sampler._id) : false }

  getSamplerParameter(sampler, pname) {
    if (!sampler) return null
    // Float params: LOD and max anisotropy
    if (pname === GL.TEXTURE_MIN_LOD || pname === GL.TEXTURE_MAX_LOD || pname === GL.TEXTURE_MAX_ANISOTROPY_EXT) {
      const buf = new Float32Array(1)
      this._gl.glGetSamplerParameterfv(sampler._id, pname, buf)
      return buf[0]
    }
    // Integer params: filter, wrap, compare
    const buf = new Int32Array(1)
    this._gl.glGetSamplerParameteriv(sampler._id, pname, buf)
    return buf[0]
  }

  // ─── Transform Feedback ───────────────────────────────────────────────

  createTransformFeedback() {
    this._gl.glGenTransformFeedbacks(1, _tmp1)
    return new WebGLTransformFeedback(_tmp1[0])
  }

  deleteTransformFeedback(tf) {
    if (!tf) return
    _tmp1[0] = tf._id
    this._gl.glDeleteTransformFeedbacks(1, _tmp1)
  }

  bindTransformFeedback(target, tf) { this._gl.glBindTransformFeedback(target, unwrap(tf)) }
  beginTransformFeedback(primitiveMode) { this._gl.glBeginTransformFeedback(primitiveMode) }
  endTransformFeedback() { this._gl.glEndTransformFeedback() }
  pauseTransformFeedback() { this._gl.glPauseTransformFeedback() }
  resumeTransformFeedback() { this._gl.glResumeTransformFeedback() }
  isTransformFeedback(tf) { return tf ? this._gl.glIsTransformFeedback(tf._id) : false }

  transformFeedbackVaryings(prog, varyings, bufferMode) {
    this._gl.glTransformFeedbackVaryings(prog._id, varyings.length, varyings, bufferMode)
  }

  getTransformFeedbackVarying(prog, index) {
    const info = this._gl.glGetTransformFeedbackVarying(prog._id, index)
    if (!info) return null
    return new WebGLActiveInfo(info.name, info.size, info.type)
  }

  // ─── Uniform Buffer Objects ───────────────────────────────────────────

  bindBufferBase(target, index, buf) { this._gl.glBindBufferBase(target, index, unwrap(buf)) }
  bindBufferRange(target, index, buf, offset, size) { this._gl.glBindBufferRange(target, index, unwrap(buf), offset, size) }

  getUniformBlockIndex(prog, name) {
    return this._gl.glGetUniformBlockIndex(prog._id, name)
  }

  uniformBlockBinding(prog, blockIndex, blockBinding) {
    this._gl.glUniformBlockBinding(prog._id, blockIndex, blockBinding)
  }

  getActiveUniformBlockName(prog, blockIndex) {
    return this._gl.glGetActiveUniformBlockName(prog._id, blockIndex)
  }

  getActiveUniformBlockParameter(prog, blockIndex, pname) {
    const buf = new Int32Array(1)
    this._gl.glGetActiveUniformBlockiv(prog._id, blockIndex, pname, buf)
    if (pname === GL.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES) {
      const count = new Int32Array(1)
      this._gl.glGetActiveUniformBlockiv(prog._id, blockIndex, GL.UNIFORM_BLOCK_ACTIVE_UNIFORMS, count)
      const indices = new Int32Array(count[0])
      this._gl.glGetActiveUniformBlockiv(prog._id, blockIndex, pname, indices)
      return indices
    }
    if (pname === GL.UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER || pname === GL.UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER) {
      return !!buf[0]
    }
    return buf[0]
  }

  getUniformIndices(prog, uniformNames) {
    const indices = new Uint32Array(uniformNames.length)
    this._gl.glGetUniformIndices(prog._id, uniformNames.length, uniformNames, indices)
    return Array.from(indices)
  }

  getActiveUniforms(prog, uniformIndices, pname) {
    const result = new Int32Array(uniformIndices.length)
    this._gl.glGetActiveUniformsiv(prog._id, uniformIndices.length, new Uint32Array(uniformIndices), pname, result)
    if (pname === GL.UNIFORM_IS_ROW_MAJOR) {
      return Array.from(result, v => !!v)
    }
    return Array.from(result)
  }

  // ─── Indexed Parameter ────────────────────────────────────────────────

  getIndexedParameter(target, index) {
    // Buffer binding queries return WebGLBuffer (but we can't reconstruct wrapper objects from IDs)
    // Size/start queries return integers
    if (target === GL.TRANSFORM_FEEDBACK_BUFFER_BINDING || target === GL.UNIFORM_BUFFER_BINDING) {
      const buf = new Int32Array(1)
      this._gl.glGetIntegeri_v(target, index, buf)
      return buf[0] ? new WebGLBuffer(buf[0]) : null
    }
    if (target === GL.TRANSFORM_FEEDBACK_BUFFER_SIZE || target === GL.TRANSFORM_FEEDBACK_BUFFER_START ||
        target === GL.UNIFORM_BUFFER_SIZE || target === GL.UNIFORM_BUFFER_START) {
      const buf = new BigInt64Array ? new Int32Array(2) : new Int32Array(1)
      this._gl.glGetInteger64i_v(target, index, buf)
      // Return as number (safe for values < 2^53)
      if (buf.length === 2) return buf[0] + buf[1] * 0x100000000
      return buf[0]
    }
    // Fallback: integer query
    const buf = new Int32Array(1)
    this._gl.glGetIntegeri_v(target, index, buf)
    return buf[0]
  }

  // ─── Clear Buffers ────────────────────────────────────────────────────

  clearBufferfv(buffer, drawbuffer, values, srcOffset) {
    let arr = values instanceof Float32Array ? values : new Float32Array(values)
    if (srcOffset) arr = arr.subarray(srcOffset)
    this._gl.glClearBufferfv(buffer, drawbuffer, arr)
  }

  clearBufferiv(buffer, drawbuffer, values, srcOffset) {
    let arr = values instanceof Int32Array ? values : new Int32Array(values)
    if (srcOffset) arr = arr.subarray(srcOffset)
    this._gl.glClearBufferiv(buffer, drawbuffer, arr)
  }

  clearBufferuiv(buffer, drawbuffer, values, srcOffset) {
    let arr = values instanceof Uint32Array ? values : new Uint32Array(values)
    if (srcOffset) arr = arr.subarray(srcOffset)
    this._gl.glClearBufferuiv(buffer, drawbuffer, arr)
  }

  clearBufferfi(buffer, drawbuffer, depth, stencil) {
    this._gl.glClearBufferfi(buffer, drawbuffer, depth, stencil)
  }

  // ─── getParameter ─────────────────────────────────────────────────────

  getParameter(pname) {
    // Strings
    if (pname === GL.VENDOR || pname === GL.RENDERER || pname === GL.SHADING_LANGUAGE_VERSION) {
      return this._gl.glGetString(pname)
    }
    if (pname === GL.VERSION) return 'WebGL 2.0 (native-gles)'
    if (pname === GL.UNMASKED_VENDOR_WEBGL) return this._gl.glGetString(GL.VENDOR)
    if (pname === GL.UNMASKED_RENDERER_WEBGL) return this._gl.glGetString(GL.RENDERER)

    // WebGL-specific
    if (pname === GL.UNPACK_FLIP_Y_WEBGL) return this._unpackFlipY
    if (pname === GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL) return this._unpackPremultiplyAlpha
    if (pname === GL.UNPACK_COLORSPACE_CONVERSION_WEBGL) return this._unpackColorspaceConversion
    if (pname === GL.MAX_CLIENT_WAIT_TIMEOUT_WEBGL) return 0

    // Bound object queries — return tracked JS objects
    if (pname === GL.ARRAY_BUFFER_BINDING) return this._boundArrayBuffer
    if (pname === GL.ELEMENT_ARRAY_BUFFER_BINDING) return this._boundElementArrayBuffer
    if (pname === GL.FRAMEBUFFER_BINDING || pname === GL.DRAW_FRAMEBUFFER_BINDING) return this._boundFramebuffer
    if (pname === GL.READ_FRAMEBUFFER_BINDING) return this._boundReadFramebuffer
    if (pname === GL.RENDERBUFFER_BINDING) return this._boundRenderbuffer
    if (pname === GL.TEXTURE_BINDING_2D) return this._boundTexture2D
    if (pname === GL.TEXTURE_BINDING_CUBE_MAP) return this._boundTextureCubeMap
    if (pname === GL.TEXTURE_BINDING_3D) return this._boundTexture3D
    if (pname === GL.TEXTURE_BINDING_2D_ARRAY) return this._boundTexture2DArray
    if (pname === GL.VERTEX_ARRAY_BINDING) return this._boundVAO
    if (pname === GL.CURRENT_PROGRAM) return this._currentProgram
    if (pname === GL.SAMPLER_BINDING) return null
    if (pname === GL.TRANSFORM_FEEDBACK_BINDING) return null

    // Boolean queries
    if (pname === GL.DEPTH_WRITEMASK) {
      const buf = new Uint8Array(1)
      this._gl.glGetBooleanv(pname, buf)
      return !!buf[0]
    }
    if (pname === GL.SAMPLE_COVERAGE_INVERT) {
      const buf = new Uint8Array(1)
      this._gl.glGetBooleanv(pname, buf)
      return !!buf[0]
    }
    if (pname === GL.TRANSFORM_FEEDBACK_ACTIVE || pname === GL.TRANSFORM_FEEDBACK_PAUSED) {
      const buf = new Uint8Array(1)
      this._gl.glGetBooleanv(pname, buf)
      return !!buf[0]
    }

    // Boolean array
    if (pname === GL.COLOR_WRITEMASK) {
      const buf = new Uint8Array(4)
      this._gl.glGetBooleanv(pname, buf)
      return [!!buf[0], !!buf[1], !!buf[2], !!buf[3]]
    }

    // Float array queries
    if (pname === GL.DEPTH_RANGE || pname === GL.ALIASED_LINE_WIDTH_RANGE || pname === GL.ALIASED_POINT_SIZE_RANGE) {
      const buf = new Float32Array(2)
      this._gl.glGetFloatv(pname, buf)
      return buf
    }
    if (pname === GL.BLEND_COLOR || pname === GL.COLOR_CLEAR_VALUE) {
      const buf = new Float32Array(4)
      this._gl.glGetFloatv(pname, buf)
      return buf
    }

    // Integer array queries
    if (pname === GL.MAX_VIEWPORT_DIMS) {
      const buf = new Int32Array(2)
      this._gl.glGetIntegerv(pname, buf)
      return buf
    }
    if (pname === GL.VIEWPORT || pname === GL.SCISSOR_BOX) {
      const buf = new Int32Array(4)
      this._gl.glGetIntegerv(pname, buf)
      return buf
    }

    // Float scalar queries
    if (pname === GL.LINE_WIDTH || pname === GL.POLYGON_OFFSET_FACTOR || pname === GL.POLYGON_OFFSET_UNITS ||
        pname === GL.SAMPLE_COVERAGE_VALUE || pname === GL.DEPTH_CLEAR_VALUE) {
      const buf = new Float32Array(1)
      this._gl.glGetFloatv(pname, buf)
      return buf[0]
    }

    // Default: integer scalar
    const buf = new Int32Array(1)
    this._gl.glGetIntegerv(pname, buf)
    return buf[0]
  }

  getBufferParameter(target, pname) {
    if (pname === GL.BUFFER_SIZE) {
      // Use 64-bit query for large buffers
      const buf = new Int32Array(2)
      this._gl.glGetBufferParameteri64v(target, pname, buf)
      return buf[0] + buf[1] * 0x100000000
    }
    const buf = new Int32Array(1)
    this._gl.glGetBufferParameteriv(target, pname, buf)
    return buf[0]
  }

  getRenderbufferParameter(target, pname) {
    const buf = new Int32Array(1)
    this._gl.glGetRenderbufferParameteriv(target, pname, buf)
    return buf[0]
  }

  getFramebufferAttachmentParameter(target, attachment, pname) {
    const buf = new Int32Array(1)
    this._gl.glGetFramebufferAttachmentParameteriv(target, attachment, pname, buf)
    return buf[0]
  }

  getTexParameter(target, pname) {
    // Float params
    if (pname === GL.TEXTURE_MIN_LOD || pname === GL.TEXTURE_MAX_LOD || pname === GL.TEXTURE_MAX_ANISOTROPY_EXT) {
      const buf = new Float32Array(1)
      this._gl.glGetTexParameterfv(target, pname, buf)
      return buf[0]
    }
    const buf = new Int32Array(1)
    this._gl.glGetTexParameteriv(target, pname, buf)
    return buf[0]
  }

  getUniform(prog, loc) {
    if (!prog || !loc) return null
    // Determine uniform type to return correct format
    const numUniforms = this.getProgramParameter(prog, GL.ACTIVE_UNIFORMS)
    let uniformType = GL.FLOAT
    let uniformSize = 1
    for (let i = 0; i < numUniforms; i++) {
      const info = this.getActiveUniform(prog, i)
      if (!info) continue
      const uLoc = this.getUniformLocation(prog, info.name)
      if (uLoc && uLoc._id === loc._id) {
        uniformType = info.type
        uniformSize = info.size
        break
      }
    }

    // Integer types
    if (uniformType === GL.INT || uniformType === GL.BOOL || uniformType === GL.SAMPLER_2D ||
        uniformType === GL.SAMPLER_3D || uniformType === GL.SAMPLER_CUBE ||
        uniformType === GL.SAMPLER_2D_SHADOW || uniformType === GL.SAMPLER_2D_ARRAY ||
        uniformType === GL.SAMPLER_2D_ARRAY_SHADOW || uniformType === GL.SAMPLER_CUBE_SHADOW ||
        uniformType === GL.INT_SAMPLER_2D || uniformType === GL.INT_SAMPLER_3D ||
        uniformType === GL.INT_SAMPLER_CUBE || uniformType === GL.INT_SAMPLER_2D_ARRAY ||
        uniformType === GL.UNSIGNED_INT_SAMPLER_2D || uniformType === GL.UNSIGNED_INT_SAMPLER_3D ||
        uniformType === GL.UNSIGNED_INT_SAMPLER_CUBE || uniformType === GL.UNSIGNED_INT_SAMPLER_2D_ARRAY) {
      const buf = new Int32Array(1)
      this._gl.glGetUniformiv(prog._id, loc._id, buf)
      return buf[0]
    }
    if (uniformType === GL.INT_VEC2 || uniformType === GL.BOOL_VEC2) {
      const buf = new Int32Array(2); this._gl.glGetUniformiv(prog._id, loc._id, buf); return buf
    }
    if (uniformType === GL.INT_VEC3 || uniformType === GL.BOOL_VEC3) {
      const buf = new Int32Array(3); this._gl.glGetUniformiv(prog._id, loc._id, buf); return buf
    }
    if (uniformType === GL.INT_VEC4 || uniformType === GL.BOOL_VEC4) {
      const buf = new Int32Array(4); this._gl.glGetUniformiv(prog._id, loc._id, buf); return buf
    }

    // Unsigned integer types
    if (uniformType === GL.UNSIGNED_INT) {
      const buf = new Uint32Array(1); this._gl.glGetUniformuiv(prog._id, loc._id, buf); return buf[0]
    }
    if (uniformType === GL.UNSIGNED_INT_VEC2) {
      const buf = new Uint32Array(2); this._gl.glGetUniformuiv(prog._id, loc._id, buf); return buf
    }
    if (uniformType === GL.UNSIGNED_INT_VEC3) {
      const buf = new Uint32Array(3); this._gl.glGetUniformuiv(prog._id, loc._id, buf); return buf
    }
    if (uniformType === GL.UNSIGNED_INT_VEC4) {
      const buf = new Uint32Array(4); this._gl.glGetUniformuiv(prog._id, loc._id, buf); return buf
    }

    // Float types (default)
    const floatSizes = {
      [GL.FLOAT]: 1, [GL.FLOAT_VEC2]: 2, [GL.FLOAT_VEC3]: 3, [GL.FLOAT_VEC4]: 4,
      [GL.FLOAT_MAT2]: 4, [GL.FLOAT_MAT3]: 9, [GL.FLOAT_MAT4]: 16,
      [GL.FLOAT_MAT2x3]: 6, [GL.FLOAT_MAT2x4]: 8,
      [GL.FLOAT_MAT3x2]: 6, [GL.FLOAT_MAT3x4]: 12,
      [GL.FLOAT_MAT4x2]: 8, [GL.FLOAT_MAT4x3]: 12,
    }
    const sz = floatSizes[uniformType] || 1
    const fbuf = new Float32Array(sz)
    this._gl.glGetUniformfv(prog._id, loc._id, fbuf)
    return sz === 1 ? fbuf[0] : fbuf
  }

  getVertexAttrib(index, pname) {
    if (pname === GL.CURRENT_VERTEX_ATTRIB) {
      const buf = new Float32Array(4)
      this._gl.glGetVertexAttribfv(index, pname, buf)
      return buf
    }
    if (pname === GL.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) {
      const buf = new Int32Array(1)
      this._gl.glGetVertexAttribiv(index, pname, buf)
      return buf[0] ? new WebGLBuffer(buf[0]) : null
    }
    const buf = new Int32Array(1)
    this._gl.glGetVertexAttribiv(index, pname, buf)
    if (pname === GL.VERTEX_ATTRIB_ARRAY_ENABLED || pname === GL.VERTEX_ATTRIB_ARRAY_NORMALIZED || pname === GL.VERTEX_ATTRIB_ARRAY_INTEGER) {
      return !!buf[0]
    }
    return buf[0]
  }

  getVertexAttribOffset(index, pname) {
    return this._gl.glGetVertexAttribPointerv(index, pname || GL.VERTEX_ATTRIB_ARRAY_POINTER)
  }

  getInternalformatParameter(target, internalformat, pname) {
    if (pname === GL.SAMPLES) {
      const buf = new Int32Array(16)
      this._gl.glGetInternalformativ(target, internalformat, pname, buf)
      let count = 0
      for (let i = 0; i < 16; i++) { if (buf[i] === 0) break; count++ }
      return new Int32Array(buf.buffer, 0, count)
    }
    return new Int32Array(0)
  }

  // ─── Extensions ───────────────────────────────────────────────────────

  getSupportedExtensions() {
    const exts = []
    exts.push('WEBGL_debug_renderer_info')
    try {
      const numExts = new Int32Array(1)
      this._gl.glGetIntegerv(0x821D /* GL_NUM_EXTENSIONS */, numExts)
      const nativeExts = new Set()
      for (let i = 0; i < numExts[0]; i++) {
        const name = this._gl.glGetStringi(GL.EXTENSIONS, i)
        if (name) nativeExts.add(name)
      }
      if (nativeExts.has('GL_EXT_color_buffer_float')) exts.push('EXT_color_buffer_float')
      if (nativeExts.has('GL_OES_texture_float_linear')) exts.push('OES_texture_float_linear')
      if (nativeExts.has('GL_EXT_color_buffer_half_float')) exts.push('EXT_color_buffer_half_float')
      if (nativeExts.has('GL_EXT_texture_filter_anisotropic')) exts.push('EXT_texture_filter_anisotropic')
      if (nativeExts.has('GL_EXT_disjoint_timer_query')) exts.push('EXT_disjoint_timer_query_webgl2')
    } catch (e) {}
    return exts
  }

  getExtension(name) {
    if (name === 'WEBGL_debug_renderer_info') {
      return { UNMASKED_VENDOR_WEBGL: GL.UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL: GL.UNMASKED_RENDERER_WEBGL }
    }
    if (name === 'EXT_texture_filter_anisotropic' || name === 'WEBKIT_EXT_texture_filter_anisotropic' || name === 'MOZ_EXT_texture_filter_anisotropic') {
      return { TEXTURE_MAX_ANISOTROPY_EXT: GL.TEXTURE_MAX_ANISOTROPY_EXT, MAX_TEXTURE_MAX_ANISOTROPY_EXT: GL.MAX_TEXTURE_MAX_ANISOTROPY_EXT }
    }
    const supported = this.getSupportedExtensions()
    if (supported.includes(name)) return {}
    return null
  }

  // ─── Context attributes ───────────────────────────────────────────────

  getContextAttributes() {
    return {
      alpha: true,
      depth: true,
      stencil: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
      desynchronized: false,
    }
  }

  isContextLost() { return false }
  makeXRCompatible() { return Promise.resolve() }

  // ─── Fragment data location ───────────────────────────────────────────

  getFragDataLocation(prog, name) {
    return this._gl.glGetFragDataLocation(prog._id, name)
  }
}
