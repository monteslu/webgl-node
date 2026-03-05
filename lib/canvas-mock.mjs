export function createMockCanvas(width, height, glContext) {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: { width: '', height: '' },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null },
    getRootNode() { return {} },
    getBoundingClientRect() {
      return { x: 0, y: 0, width, height, top: 0, right: width, bottom: height, left: 0 }
    },
    getContext(type) {
      if (type === 'webgl2') return glContext
      return null
    },
  }
}
