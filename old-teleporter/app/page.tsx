const SAMPLE = '/splats/ceramic-500k-demo.spz'

export default function Home() {
  return (
    <main className="home">
      <section className="card">
        <p className="kicker">TreeHacks Webviewer</p>
        <h1>SPZ WebXR Viewer</h1>
        <p>
          Launch the Quest-friendly WebVR/WebXR viewer and load any `.spz` scene.
          The viewer page includes URL loading, local file loading, and immersive
          VR entry support.
        </p>

        <div className="actions">
          <a className="btn primary" href="/viewer">
            Open Viewer
          </a>
          <a
            className="btn"
            href={`/viewer?src=${encodeURIComponent(SAMPLE)}`}
          >
            Open Sample Scene
          </a>
        </div>

        <ul>
          <li>For Meta Quest, run over HTTPS (or localhost during local dev).</li>
          <li>The viewer uses `gaussian-splats-3d` WebXR VR mode with SPZ input.</li>
          <li>If remote files fail, check CORS headers on the SPZ hosting server.</li>
        </ul>
      </section>
    </main>
  )
}
