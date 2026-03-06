# threejs-ocean

Adapted from the three.js [Ocean](https://threejs.org/examples/#webgl_shaders_ocean) official example, ported to run in Node.js via [webgl-node](https://github.com/monteslu/webgl-node) with an SDL window. Enhanced with additional textured scene objects.

## Features

- Infinite ocean with animated water normals and sun reflection (three.js `Water` shader)
- Procedural atmospheric sky with sun via three.js `Sky` shader (Preetham model)
- Earth globe with satellite imagery texture
- Brick pillar with diffuse + bump maps
- Wooden crate with hardwood textures
- Shiny torus knot
- Ring of 12 colorful icosahedrons
- Orbiting camera and animated objects
- Orbiting warm/cool point lights
- ACES Filmic tone mapping
- Resizable window

## Run

```bash
npm install
npm start
```

## Based On

Adapted from the [three.js webgl_shaders_ocean example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html) by three.js contributors (MIT license).

## Texture Credits

Textures are from the [three.js examples](https://github.com/mrdoob/three.js/tree/master/examples/textures) repository (MIT license).

## Credits

- [three.js](https://threejs.org/) — JavaScript 3D library by [mrdoob](https://github.com/mrdoob) and contributors
- [@kmamal/sdl](https://github.com/nicksrandall/kmamal-sdl) — Node.js SDL2 bindings by [kmamal](https://github.com/nicksrandall)
- [native-gles](https://github.com/monteslu/native-gles) — EGL/GLES3 bindings for Node.js
- [sharp](https://github.com/lovell/sharp) — High-performance image processing for Node.js
