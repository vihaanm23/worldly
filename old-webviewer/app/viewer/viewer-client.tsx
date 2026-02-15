'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import * as THREE from 'three'
import type { Viewer as SplatsViewer } from '@mkkellogg/gaussian-splats-3d'

const SAMPLE_SOURCE = '/splats/ceramic-500k-demo.spz'
const MOVE_SPEED_MPS = 2.0
const STRAFE_SPEED_MPS = 2.0
const LOOK_SENSITIVITY = 0.0025
const MAX_PITCH = Math.PI / 2 - 0.05
const STICK_DEADZONE = 0.18
const SNAP_TURN_ANGLE = Math.PI / 8
const SNAP_TURN_COOLDOWN_SEC = 0.24
const UPSIDE_DOWN_FIX_ROTATION: [number, number, number, number] = [1, 0, 0, 0]

type SplatsModule = typeof import('@mkkellogg/gaussian-splats-3d')

function stickPair(axes: readonly number[]) {
  const pairs: Array<[number, number]> = [
    [0, 1],
    [2, 3],
  ]

  let bestX = 0
  let bestY = 0
  let bestMag = 0

  for (const [xIndex, yIndex] of pairs) {
    const x = axes[xIndex] ?? 0
    const y = axes[yIndex] ?? 0
    const mag = Math.abs(x) + Math.abs(y)
    if (mag > bestMag) {
      bestMag = mag
      bestX = x
      bestY = y
    }
  }

  return { x: bestX, y: bestY }
}

function applyDeadzone(value: number) {
  return Math.abs(value) < STICK_DEADZONE ? 0 : value
}

export default function ViewerClient() {
  const objectUrlRef = useRef<string | null>(null)
  const viewerRef = useRef<SplatsViewer | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const cameraRigRef = useRef<THREE.Group | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<(() => void) | null>(null)
  const controlsCleanupRef = useRef<(() => void) | null>(null)
  const forwardRef = useRef(new THREE.Vector3())
  const rightRef = useRef(new THREE.Vector3())
  const upRef = useRef(new THREE.Vector3(0, 1, 0))
  const inputRef = useRef({
    keys: new Set<string>(),
    dragging: false,
    lastX: 0,
    lastY: 0,
  })
  const loopRef = useRef({
    lastTimeSec: 0,
    lastSnapTurnSec: 0,
  })

  const [source, setSource] = useState(SAMPLE_SOURCE)
  const [status, setStatus] = useState('Initializing viewer...')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [compatNote, setCompatNote] = useState('')

  const querySource = useMemo(() => {
    if (typeof window === 'undefined') return null
    const src = new URL(window.location.href).searchParams.get('src')
    return src?.trim() || null
  }, [])

  useEffect(() => {
    if (querySource) {
      setSource(querySource)
    }
  }, [querySource])

  useEffect(() => {
    const notes: string[] = []
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      notes.push('WebXR requires HTTPS or localhost.')
    }
    if (!navigator.xr) {
      notes.push('WebXR is unavailable in this browser.')
    }
    setCompatNote(notes.join(' '))
  }, [])

  const setStatusMessage = (message: string, isError = false) => {
    setStatus(message)
    setError(isError)
  }

  const updateQuery = (nextSource: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('src', nextSource)
    window.history.replaceState(null, '', url)
  }

  const setupDesktopInput = (
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    cameraRig: THREE.Group
  ) => {
    const onKeyDown = (event: KeyboardEvent) => {
      inputRef.current.keys.add(event.code)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      inputRef.current.keys.delete(event.code)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (event.target !== renderer.domElement) return

      inputRef.current.dragging = true
      inputRef.current.lastX = event.clientX
      inputRef.current.lastY = event.clientY
      renderer.domElement.setPointerCapture(event.pointerId)
    }

    const onPointerUp = (event: PointerEvent) => {
      inputRef.current.dragging = false
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!inputRef.current.dragging) return
      if (renderer.xr.isPresenting) return

      const dx = event.clientX - inputRef.current.lastX
      const dy = event.clientY - inputRef.current.lastY
      inputRef.current.lastX = event.clientX
      inputRef.current.lastY = event.clientY

      cameraRig.rotation.y -= dx * LOOK_SENSITIVITY
      camera.rotation.x = THREE.MathUtils.clamp(
        camera.rotation.x - dy * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH
      )
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    controlsCleanupRef.current = () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      inputRef.current.keys.clear()
      inputRef.current.dragging = false
    }
  }

  const cleanupViewer = async () => {
    if (controlsCleanupRef.current) {
      controlsCleanupRef.current()
      controlsCleanupRef.current = null
    }

    if (viewerRef.current) {
      await viewerRef.current.dispose()
      viewerRef.current = null
    }

    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null)
      rendererRef.current.dispose()
      rendererRef.current.domElement.remove()
      rendererRef.current = null
    }

    if (resizeRef.current) {
      window.removeEventListener('resize', resizeRef.current)
      resizeRef.current = null
    }

    cameraRef.current = null
    cameraRigRef.current = null
  }

  const applyDesktopNavigation = (deltaSec: number) => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const cameraRig = cameraRigRef.current
    if (!renderer || !camera || !cameraRig) return
    if (renderer.xr.isPresenting) return

    const keys = inputRef.current.keys
    let forwardInput = 0
    let strafeInput = 0

    if (keys.has('KeyW') || keys.has('ArrowUp')) forwardInput += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) forwardInput -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) strafeInput += 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) strafeInput -= 1

    if (forwardInput === 0 && strafeInput === 0) return

    const forward = forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
    forward.y = 0
    if (forward.lengthSq() > 0) {
      forward.normalize()
    }

    const right = rightRef.current.crossVectors(forward, upRef.current)
    if (right.lengthSq() > 0) {
      right.normalize()
    }

    if (forwardInput !== 0) {
      cameraRig.position.addScaledVector(forward, forwardInput * MOVE_SPEED_MPS * deltaSec)
    }
    if (strafeInput !== 0) {
      cameraRig.position.addScaledVector(right, strafeInput * STRAFE_SPEED_MPS * deltaSec)
    }
  }

  const applyXrLocomotion = (deltaSec: number, nowSec: number) => {
    const renderer = rendererRef.current
    const cameraRig = cameraRigRef.current
    if (!renderer || !cameraRig) return
    if (!renderer.xr.isPresenting) return

    const session = renderer.xr.getSession()
    if (!session) return

    let moveX = 0
    let moveY = 0
    let turnX = 0
    let sawLeft = false

    for (const inputSource of Array.from(session.inputSources)) {
      const gamepad = inputSource.gamepad
      if (!gamepad || gamepad.axes.length < 2) continue

      const stick = stickPair(gamepad.axes)
      if (inputSource.handedness === 'left') {
        moveX = stick.x
        moveY = stick.y
        sawLeft = true
      } else if (inputSource.handedness === 'right') {
        turnX = stick.x
        if (!sawLeft) {
          moveX = stick.x
          moveY = stick.y
        }
      } else {
        moveX = stick.x
        moveY = stick.y
      }
    }

    moveX = applyDeadzone(moveX)
    moveY = applyDeadzone(moveY)
    turnX = applyDeadzone(turnX)

    if (Math.abs(turnX) > 0.75) {
      if (nowSec - loopRef.current.lastSnapTurnSec > SNAP_TURN_COOLDOWN_SEC) {
        cameraRig.rotation.y += -Math.sign(turnX) * SNAP_TURN_ANGLE
        loopRef.current.lastSnapTurnSec = nowSec
      }
    }

    const xrCamera = renderer.xr.getCamera()
    const forward = forwardRef.current.set(0, 0, -1).applyQuaternion(xrCamera.quaternion)
    forward.y = 0
    if (forward.lengthSq() > 0) {
      forward.normalize()
    }

    const right = rightRef.current.crossVectors(forward, upRef.current)
    if (right.lengthSq() > 0) {
      right.normalize()
    }

    if (moveY !== 0) {
      cameraRig.position.addScaledVector(forward, -moveY * MOVE_SPEED_MPS * deltaSec)
    }
    if (moveX !== 0) {
      cameraRig.position.addScaledVector(right, moveX * STRAFE_SPEED_MPS * deltaSec)
    }
  }

  const createViewer = async (mod: SplatsModule) => {
    await cleanupViewer()

    if (!stageRef.current) {
      throw new Error('Viewer container is unavailable.')
    }

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.xr.enabled = true

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500)
    camera.position.set(0, 1.6, 0)
    camera.rotation.x = -0.1

    const cameraRig = new THREE.Group()
    cameraRig.position.set(0, 0, 2.4)
    cameraRig.add(camera)

    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    stageRef.current.innerHTML = ''
    stageRef.current.appendChild(renderer.domElement)

    setupDesktopInput(renderer, camera, cameraRig)

    const viewer = new mod.Viewer({
      rootElement: stageRef.current,
      selfDrivenMode: false,
      renderer,
      camera,
      useBuiltInControls: false,
      cameraUp: [0, 1, 0],
      sharedMemoryForWorkers: false,
      inMemoryCompressionLevel: 1,
      webXRMode: mod.WebXRMode.VR,
      webXRSessionInit: {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      },
    })

    loopRef.current.lastTimeSec = performance.now() / 1000
    renderer.setAnimationLoop(() => {
      const nowSec = performance.now() / 1000
      const deltaSec = Math.min(nowSec - loopRef.current.lastTimeSec, 0.05)
      loopRef.current.lastTimeSec = nowSec

      applyDesktopNavigation(deltaSec)
      applyXrLocomotion(deltaSec, nowSec)
      cameraRig.updateMatrixWorld(true)
      viewer.update()
      viewer.render()
    })

    viewerRef.current = viewer
    rendererRef.current = renderer
    cameraRef.current = camera
    cameraRigRef.current = cameraRig
    resizeRef.current = handleResize

    return viewer
  }

  const loadScene = async (input: string, initializing = false) => {
    const nextSource = input.trim()
    if (!nextSource) {
      setStatusMessage('Provide a valid .spz URL first.', true)
      return
    }

    setBusy(true)
    setStatusMessage(initializing ? 'Loading viewer runtime...' : 'Preparing scene...')

    try {
      const mod = await import('@mkkellogg/gaussian-splats-3d')
      const viewer = await createViewer(mod)
      setStatusMessage('Streaming SPZ data...')

      await viewer.addSplatScene(nextSource, {
        progressiveLoad: true,
        showLoadingUI: true,
        rotation: UPSIDE_DOWN_FIX_ROTATION,
      })

      updateQuery(nextSource)
      setSource(nextSource)
      setStatusMessage(
        'Scene loaded. Desktop: drag + WASD. Quest: left stick move, right stick snap-turn.'
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load scene.'
      setStatusMessage(`Load failed: ${message}`, true)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadScene(querySource || SAMPLE_SOURCE, true)

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      void cleanupViewer()
    }
    // querySource is stable for route lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setSource(objectUrl)
    await loadScene(objectUrl)
  }

  return (
    <main className="viewer-page">
      <div className="viewer-stage" ref={stageRef} />

      <section className="viewer-ui">
        <h1>SPZ Viewer for Quest (WebXR VR)</h1>
        <div className="viewer-row">
          <input
            type="url"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://example.com/scene.spz"
          />
          <button disabled={busy} onClick={() => void loadScene(source)}>
            Load URL
          </button>
        </div>

        <div className="viewer-row">
          <label className="viewer-file-label" htmlFor="local-file-input">
            Load Local .spz
          </label>
          <input
            id="local-file-input"
            className="viewer-file-input"
            type="file"
            accept=".spz"
            disabled={busy}
            onChange={(e) => void onLocalFile(e)}
          />
          <button
            disabled={busy}
            onClick={() => {
              setSource(SAMPLE_SOURCE)
              void loadScene(SAMPLE_SOURCE)
            }}
          >
            Load Sample
          </button>
        </div>

        <p>
          Desktop: hold left mouse and drag to look, use WASD to move. Quest VR:
          left stick moves, right stick snap-turns.
        </p>
        {compatNote ? <p>{compatNote}</p> : null}
        <p className={error ? 'viewer-error' : ''}>{status}</p>
      </section>
    </main>
  )
}
