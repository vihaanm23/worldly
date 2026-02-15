# SPZ WebXR Viewer (Meta Quest first)

This project is now a WebVR-style SPZ viewer that targets Meta Quest browsers using WebXR.

## What it does

- Loads `.spz` splats directly (plus `.ply`, `.splat`, `.ksplat`) via `@sparkjsdev/spark`
- Runs in browser and supports `immersive-vr` sessions
- Lets you navigate in desktop and XR:
  - Desktop: mouse/touch drag + wheel + `WASD`
  - XR: headset + controller thumbsticks
- Supports both:
  - URL-based loading with query param: `?spz=<url>`
  - Local file loading from the file picker

## Run

```bash
npm install
npm run dev
```

Dev server uses HTTPS certs via Vite + `mkcert`, which is required for WebXR on most devices.

## Load your SPZ

- Default sample:
  - `./splats/demo.spz`
- Custom URL:
  - `https://<your-host>:8081/?spz=https://example.com/model.spz`
- Local file:
  - Use the file input in the top-right of the viewer

## Quest testing notes

- Open the HTTPS URL from Quest Browser
- Enter VR using the rendered WebXR button
- If remote files fail to load, confirm CORS headers allow cross-origin fetch
