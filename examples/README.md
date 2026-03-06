# webgl-node examples

Example applications demonstrating [webgl-node](https://github.com/monteslu/webgl-node) with three.js and SDL windowing.

## Examples

| Example | Description |
|---------|-------------|
| [threejs-simple](threejs-simple/) | Minimal rotating cube with lighting — good starting point |
| [threejs-ocean](threejs-ocean/) | Ocean scene adapted from the [three.js official example](https://threejs.org/examples/#webgl_shaders_ocean) with Sky, Water, and textured objects |

## Running

Each example is self-contained with its own `package.json`. To run one:

```bash
cd <example>
npm install
npm start
```

## Requirements

- Node.js 22+
- GPU with OpenGL ES 3.0 support
- `@kmamal/sdl` requires SDL2 development libraries on your system
