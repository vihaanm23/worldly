declare module '@mkkellogg/gaussian-splats-3d' {
  import type * as THREE from 'three'

  export const WebXRMode: {
    None: number
    VR: number
    AR: number
  }

  export interface ViewerOptions {
    rootElement?: HTMLElement
    selfDrivenMode?: boolean
    renderer?: THREE.WebGLRenderer
    camera?: THREE.Camera
    useBuiltInControls?: boolean
    cameraUp?: [number, number, number]
    initialCameraPosition?: [number, number, number]
    initialCameraLookAt?: [number, number, number]
    sharedMemoryForWorkers?: boolean
    inMemoryCompressionLevel?: number
    webXRMode?: number
    webXRSessionInit?: XRSessionInit
  }

  export interface AddSplatSceneOptions {
    progressiveLoad?: boolean
    showLoadingUI?: boolean
    rotation?: [number, number, number, number]
    position?: [number, number, number]
    scale?: [number, number, number]
  }

  export class Viewer {
    constructor(options?: ViewerOptions)
    start(): void
    update(): void
    render(): void
    dispose(): Promise<void>
    addSplatScene(
      path: string,
      options?: AddSplatSceneOptions
    ): Promise<unknown>
  }
}
