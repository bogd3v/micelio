// The 3D side of <micelio-scene> (ADR 0006, section 6): only the Three.js modules a turntable needs, loaded on demand by
// `app/islands/scene.ts`. It owns every GPU object and releases all of them in `dispose()`.
import { AmbientLight, Box3, DirectionalLight, Group, HemisphereLight, LoadingManager, PerspectiveCamera, Scene, TextureLoader, Vector3, WebGLRenderer } from 'three'
import type { Object3D, Material, Mesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js'

const FIELD_OF_VIEW = 40
/** Turntable speed, in radians per second */
const TURN = 0.5
const MAX_PIXEL_RATIO = 2

export interface SceneView {
  /** Matches the canvas to the size of its box (CSS pixels). */
  resize: (width: number, height: number) => void
  /** Starts or stops the render loop; the first frame is drawn at once when it starts. */
  run: (running: boolean) => void
  dispose: () => void
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'))
    reader.readAsDataURL(blob)
  })
}

// Images embedded in the .glb become data: URLs read by an <img>: the policy allows `data:` in img-src in every mode, while a
// blob: URL (GLTFLoader's own way) is not allowed in static builds and fetch() of either would need connect-src (ADR 0004)
function embeddedImages(parser: GLTFParser): GLTFLoaderPlugin {
  parser.textureLoader = new TextureLoader(parser.options.manager)
  return {
    name: 'MICELIO_embedded_images',
    async beforeRoot(): Promise<void> {
      const images = (parser.json as { images?: { bufferView?: number, mimeType?: string, uri?: string }[] }).images ?? []
      await Promise.all(images.map(async (image) => {
        if (image.bufferView === undefined) return
        const bytes = await parser.getDependency('bufferView', image.bufferView) as ArrayBuffer
        image.uri = await readDataUrl(new Blob([bytes], { type: image.mimeType }))
        delete image.bufferView
      }))
    },
  }
}

// The model is one self-contained .glb: anything it names outside itself is refused
function loader(): GLTFLoader {
  const manager = new LoadingManager()
  manager.setURLModifier((url) => {
    if (url.startsWith('data:')) return url
    throw new Error('A model may not load other files')
  })
  return new GLTFLoader(manager).register(embeddedImages)
}

function release(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Partial<Mesh>
    mesh.geometry?.dispose()
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) (value as { dispose: () => void }).dispose()
      }
      material.dispose()
    }
  })
}

/** Parses the model and draws it on `canvas`, turning. Rejects when WebGL2 is not available or the model is not a usable .glb. */
export async function createScene(canvas: HTMLCanvasElement, model: ArrayBuffer, onFrame: () => void): Promise<SceneView> {
  const gltf = await loader().parseAsync(model, '')
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  const scene = new Scene()
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 1000)
  const turntable = new Group()
  let frame = 0
  let last = 0

  try {
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    renderer.setClearColor(0x000000, 0)
    scene.add(new HemisphereLight(0xffffff, 0x445566, 1.6), new AmbientLight(0xffffff, 0.6))
    const sun = new DirectionalLight(0xffffff, 2.4)
    sun.position.set(3, 4, 5)
    scene.add(sun, turntable)

    // The model turns around its own centre, and the camera backs off until all of it fits
    const box = new Box3().setFromObject(gltf.scene)
    const centre = box.getCenter(new Vector3())
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-3)
    gltf.scene.position.sub(centre)
    turntable.add(gltf.scene)
    const distance = radius / Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
    camera.position.set(0, radius * 0.3, distance)
    camera.near = distance / 100
    camera.far = distance * 100
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  } catch (error) {
    release(gltf.scene)
    renderer.dispose()
    renderer.forceContextLoss()
    throw error
  }

  function draw(time: number): void {
    // The first frame after a pause continues where the model stopped
    turntable.rotation.y += last ? Math.min((time - last) / 1000, 0.1) * TURN : 0
    last = time
    renderer.render(scene, camera)
    onFrame()
  }

  return {
    resize(width, height) {
      if (width < 1 || height < 1) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (!frame) return
      renderer.render(scene, camera)
    },
    run(running) {
      renderer.setAnimationLoop(running ? time => draw(time) : null)
      if (running) frame = 1
      else last = 0
    },
    dispose() {
      renderer.setAnimationLoop(null)
      release(scene)
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
