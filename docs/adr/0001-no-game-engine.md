# No game engine: plain TypeScript on an HTML canvas

We build the game in plain TypeScript drawing to a `<canvas>`, bundled with Vite, instead of using an engine such as Phaser. A side-scrolling platformer with one Level needs only simple physics (gravity, jumping, tile collisions), which is small enough to write ourselves; owning it keeps the code small, keeps the game rules free of engine types so they can be unit-tested in isolation, and avoids learning an engine's lifecycle. The cost is that tilemaps, physics and asset loading are ours to write, and moving to an engine later would mean rewriting the game loop and physics.

## Considered Options

- **Phaser 3**: faster start thanks to built-in arcade physics and tilemap support, but rules end up tangled with engine scene objects and are harder to test.
- **Plain TypeScript + canvas** (chosen).
