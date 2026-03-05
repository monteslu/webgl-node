export class WebGLBuffer { constructor(id) { this._id = id } }
export class WebGLTexture { constructor(id) { this._id = id } }
export class WebGLFramebuffer { constructor(id) { this._id = id } }
export class WebGLRenderbuffer { constructor(id) { this._id = id } }
export class WebGLProgram { constructor(id) { this._id = id } }
export class WebGLShader { constructor(id) { this._id = id } }
export class WebGLVertexArrayObject { constructor(id) { this._id = id } }
export class WebGLSampler { constructor(id) { this._id = id } }
export class WebGLQuery { constructor(id) { this._id = id } }
export class WebGLSync { constructor(id) { this._id = id } }
export class WebGLTransformFeedback { constructor(id) { this._id = id } }
export class WebGLUniformLocation { constructor(id) { this._id = id } }

export class WebGLActiveInfo {
  constructor(name, size, type) {
    this.name = name
    this.size = size
    this.type = type
  }
}

export class WebGLShaderPrecisionFormat {
  constructor(rangeMin, rangeMax, precision) {
    this.rangeMin = rangeMin
    this.rangeMax = rangeMax
    this.precision = precision
  }
}

export function unwrap(obj) {
  return obj ? obj._id : 0
}

export function toUint8(data) {
  if (data == null) return null
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return null
}
