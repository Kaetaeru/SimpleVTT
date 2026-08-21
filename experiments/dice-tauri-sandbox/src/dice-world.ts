import * as THREE from "three";
import * as CANNON from "cannon-es";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;

export type PhysicsSettings = {
  gravity: number;
  floorFriction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  throwSpeed: number;
  spinSpeed: number;
  spawnHeight: number;
};

export type ThrowOptions = {
  sides: DieSides[];
  keepPrevious: boolean;
  diceCollision: boolean;
};

export type WorldStats = {
  diceCount: number;
  movingCount: number;
  elapsedMs: number | null;
  settledMs: number | null;
};

type FaceDescriptor = {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  value: number;
};

type DieRuntime = {
  group: THREE.Group;
  body: CANNON.Body;
};

type Bounds = {
  halfWidth: number;
  minZ: number;
  maxZ: number;
};

const DICE_GROUP = 2;
const SURFACE_GROUP = 1;
const BRONZE = 0xb87333;
const BRONZE_DARK = 0x3c1e0d;
const NUMBER_COLOR = "#f8e2bc";
const MASS_BY_SIDES: Record<DieSides, number> = {
  4: 0.82,
  6: 1.08,
  8: 0.9,
  10: 0.96,
  12: 1.04,
  20: 0.98,
};

function d10Geometry() {
  const radius = 0.86;
  const height = 1.04;
  const vertices: number[] = [0, height, 0, 0, -height, 0];
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    vertices.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  const indices: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const current = 2 + index;
    const next = 2 + ((index + 1) % 5);
    indices.push(0, current, next);
    indices.push(1, next, current);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function geometryFor(sides: DieSides) {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(0.9, 0);
    case 6:
      return new THREE.BoxGeometry(1.24, 1.24, 1.24);
    case 8:
      return new THREE.OctahedronGeometry(0.94, 0);
    case 10:
      return d10Geometry();
    case 12:
      return new THREE.DodecahedronGeometry(0.91, 0);
    case 20:
      return new THREE.IcosahedronGeometry(0.94, 0);
  }
}

function faceDescriptors(source: THREE.BufferGeometry, expectedCount: number) {
  const geometry = source.toNonIndexed();
  const position = geometry.getAttribute("position");
  const clusters: Array<{ normal: THREE.Vector3; center: THREE.Vector3; count: number }> = [];

  for (let index = 0; index < position.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index);
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const existing = clusters.find((cluster) => cluster.normal.dot(normal) > 0.994);
    if (existing) {
      existing.center.add(center);
      existing.count += 1;
    } else {
      clusters.push({ normal, center, count: 1 });
    }
  }
  geometry.dispose();

  return clusters.slice(0, expectedCount).map((cluster, index) => ({
    normal: cluster.normal.clone(),
    center: cluster.center.clone().multiplyScalar(1 / cluster.count),
    value: index + 1,
  }));
}

function numberTexture(value: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context를 만들 수 없습니다.");

  context.clearRect(0, 0, 192, 192);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = value >= 10 ? "800 70px Georgia, serif" : "800 82px Georgia, serif";
  context.lineJoin = "round";
  context.lineWidth = 13;
  context.strokeStyle = "rgba(29, 13, 4, .86)";
  context.strokeText(String(value), 96, 101);
  context.fillStyle = NUMBER_COLOR;
  context.fillText(String(value), 96, 101);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function attachFaceNumbers(group: THREE.Group, faces: FaceDescriptor[], sides: DieSides) {
  const sizeBySides: Record<DieSides, number> = {
    4: 0.46,
    6: 0.5,
    8: 0.42,
    10: 0.38,
    12: 0.36,
    20: 0.32,
  };
  const forward = new THREE.Vector3(0, 0, 1);

  for (const face of faces) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeBySides[sides], sizeBySides[sides]),
      new THREE.MeshBasicMaterial({
        map: numberTexture(face.value),
        transparent: true,
        depthWrite: false,
        alphaTest: 0.04,
        side: THREE.FrontSide,
      }),
    );
    const normal = face.normal.clone().normalize();
    label.position.copy(face.center).addScaledVector(normal, 0.018);
    label.quaternion.setFromUnitVectors(forward, normal);
    group.add(label);
  }
}

function colliderFor(source: THREE.BufferGeometry, sides: DieSides) {
  if (sides === 6) return new CANNON.Box(new CANNON.Vec3(0.62, 0.62, 0.62));

  const geometry = mergeVertices(source.clone(), 1e-4);
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  if (!index) {
    geometry.dispose();
    return new CANNON.Sphere(0.78);
  }

  const vertices: CANNON.Vec3[] = [];
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    vertices.push(new CANNON.Vec3(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex)));
  }

  const faces: number[][] = [];
  for (let faceIndex = 0; faceIndex < index.count; faceIndex += 3) {
    faces.push([index.getX(faceIndex), index.getX(faceIndex + 1), index.getX(faceIndex + 2)]);
  }
  geometry.dispose();

  try {
    return new CANNON.ConvexPolyhedron({ vertices, faces });
  } catch {
    return new CANNON.Sphere(0.78);
  }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose();
      material.dispose();
    }
  });
}

export class DiceWorld {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
  private readonly diceMaterial = new CANNON.Material("dice");
  private readonly floorMaterial = new CANNON.Material("floor");
  private readonly wallMaterial = new CANNON.Material("wall");
  private readonly floorBody: CANNON.Body;
  private readonly floorMesh: THREE.Mesh;
  private readonly boundaryDebug: THREE.LineLoop;
  private readonly dice: DieRuntime[] = [];
  private wallBodies: CANNON.Body[] = [];
  private bounds: Bounds = { halfWidth: 5, minZ: -5, maxZ: 5 };
  private settings: PhysicsSettings;
  private diceCollision = true;
  private raf = 0;
  private lastFrame = performance.now();
  private lastThrowAt: number | null = null;
  private settledAt: number | null = null;
  private statsCallback: ((stats: WorldStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, settings: PhysicsSettings) {
    this.canvas = canvas;
    this.settings = { ...settings };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    // Screen plane == table plane. The camera looks straight down at the
    // tabletop; there is no 45-degree or side-view pitch. Perspective is kept
    // only so dice above the table retain a small amount of depth scaling.
    this.camera.position.set(0, 18, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xffe6c4, 0x1b2732, 2.05));
    const key = new THREE.DirectionalLight(0xffc986, 4.1);
    key.position.set(-5.5, 9, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7d96bf, 1.35);
    rim.position.set(6, 5, -7);
    this.scene.add(rim);

    this.floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x171b1f, roughness: 0.91, metalness: 0.02 }),
    );
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 14;
    this.world.solver.tolerance = 0.001;

    this.floorBody = new CANNON.Body({
      mass: 0,
      material: this.floorMaterial,
      shape: new CANNON.Plane(),
      collisionFilterGroup: SURFACE_GROUP,
      collisionFilterMask: DICE_GROUP,
    });
    this.floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.floorBody);

    this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.floorMaterial, {
      friction: this.settings.floorFriction,
      restitution: this.settings.restitution,
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.wallMaterial, {
      friction: 0.24,
      restitution: Math.min(0.42, this.settings.restitution + 0.05),
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
      friction: 0.26,
      restitution: Math.min(0.36, this.settings.restitution),
    }));

    this.boundaryDebug = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xd9954c, transparent: true, opacity: 0.75 }),
    );
    this.boundaryDebug.visible = false;
    this.scene.add(this.boundaryDebug);

    this.resize();
    window.addEventListener("resize", this.resize);
    this.raf = requestAnimationFrame(this.animate);
  }

  onStats(callback: (stats: WorldStats) => void) {
    this.statsCallback = callback;
  }

  setSettings(next: PhysicsSettings) {
    this.settings = { ...next };
    this.world.gravity.set(0, -this.settings.gravity, 0);
    for (const runtime of this.dice) {
      runtime.body.linearDamping = this.settings.linearDamping;
      runtime.body.angularDamping = this.settings.angularDamping;
    }
    const floorContact = this.world.getContactMaterial(this.diceMaterial, this.floorMaterial);
    if (floorContact) {
      floorContact.friction = this.settings.floorFriction;
      floorContact.restitution = this.settings.restitution;
    }
    const diceContact = this.world.getContactMaterial(this.diceMaterial, this.diceMaterial);
    if (diceContact) diceContact.restitution = Math.min(0.36, this.settings.restitution);
  }

  setDiceCollision(enabled: boolean) {
    this.diceCollision = enabled;
    for (const runtime of this.dice) {
      runtime.body.collisionFilterMask = SURFACE_GROUP | (enabled ? DICE_GROUP : 0);
      runtime.body.wakeUp();
    }
  }

  setDebugBounds(visible: boolean) {
    this.boundaryDebug.visible = visible;
  }

  throw(options: ThrowOptions) {
    if (!options.keepPrevious) this.clear();
    this.setDiceCollision(options.diceCollision);
    this.lastThrowAt = performance.now();
    this.settledAt = null;

    const total = options.sides.length;
    const spread = Math.min(this.bounds.halfWidth * 1.1, Math.max(1.4, total * 0.72));
    const startZ = this.bounds.minZ + 0.8;

    options.sides.forEach((sides, index) => {
      const normalized = total <= 1 ? 0 : index / (total - 1) - 0.5;
      const x = normalized * spread + (Math.random() - 0.5) * 0.52;
      const y = this.settings.spawnHeight + Math.random() * 0.36 + index * 0.035;
      const z = startZ + Math.random() * 0.2;
      const runtime = this.createDie(sides, x, y, z);

      const lateral = (Math.random() - 0.5) * 3.2;
      const forward = this.settings.throwSpeed * (0.91 + Math.random() * 0.17);
      runtime.body.velocity.set(lateral, -2.4 - Math.random() * 1.4, forward);

      const axis = new CANNON.Vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      if (axis.lengthSquared() < 0.01) axis.set(1, 0.7, 0.3);
      axis.normalize();
      const spin = this.settings.spinSpeed * (0.78 + Math.random() * 0.42);
      runtime.body.angularVelocity.set(axis.x * spin, axis.y * spin, axis.z * spin);
      runtime.body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      runtime.body.wakeUp();
    });
  }

  clear() {
    while (this.dice.length > 0) {
      const runtime = this.dice.pop();
      if (!runtime) continue;
      this.world.removeBody(runtime.body);
      this.scene.remove(runtime.group);
      disposeObject(runtime.group);
    }
    this.lastThrowAt = null;
    this.settledAt = null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.clear();
    this.removeWalls();
    this.world.removeBody(this.floorBody);
    this.floorMesh.geometry.dispose();
    (this.floorMesh.material as THREE.Material).dispose();
    this.boundaryDebug.geometry.dispose();
    (this.boundaryDebug.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  private createDie(sides: DieSides, x: number, y: number, z: number) {
    const geometry = geometryFor(sides);
    geometry.computeVertexNormals();
    const faces = faceDescriptors(geometry, sides);

    const material = new THREE.MeshStandardMaterial({
      color: BRONZE,
      emissive: BRONZE_DARK,
      emissiveIntensity: 0.16,
      roughness: 0.3,
      metalness: 0.33,
      flatShading: true,
    });
    const core = new THREE.Mesh(geometry, material);
    core.castShadow = true;
    core.receiveShadow = true;

    const group = new THREE.Group();
    group.add(core);
    group.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 18),
      new THREE.LineBasicMaterial({ color: 0x3a1f10, transparent: true, opacity: 0.72 }),
    ));
    attachFaceNumbers(group, faces, sides);
    group.position.set(x, y, z);
    this.scene.add(group);

    const body = new CANNON.Body({
      mass: MASS_BY_SIDES[sides],
      material: this.diceMaterial,
      shape: colliderFor(geometry, sides),
      position: new CANNON.Vec3(x, y, z),
      linearDamping: this.settings.linearDamping,
      angularDamping: this.settings.angularDamping,
      allowSleep: true,
      sleepSpeedLimit: 0.22,
      sleepTimeLimit: 0.24,
      collisionFilterGroup: DICE_GROUP,
      collisionFilterMask: SURFACE_GROUP | (this.diceCollision ? DICE_GROUP : 0),
    });
    this.world.addBody(body);

    const runtime: DieRuntime = { group, body };
    this.dice.push(runtime);
    return runtime;
  }

  private resize = () => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.rebuildBounds();
  };

  private rebuildBounds() {
    const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = (x: number, y: number) => {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      return raycaster.ray.intersectPlane(tablePlane, new THREE.Vector3());
    };

    const topLeft = hit(-0.94, 0.94);
    const topRight = hit(0.94, 0.94);
    const bottomLeft = hit(-0.94, -0.94);
    const bottomRight = hit(0.94, -0.94);

    if (topLeft && topRight && bottomLeft && bottomRight) {
      this.bounds = {
        halfWidth: Math.max(3, Math.min(Math.abs(topLeft.x), Math.abs(topRight.x), Math.abs(bottomLeft.x), Math.abs(bottomRight.x)) - 0.4),
        minZ: Math.min(topLeft.z, topRight.z, bottomLeft.z, bottomRight.z) + 0.45,
        maxZ: Math.max(topLeft.z, topRight.z, bottomLeft.z, bottomRight.z) - 0.45,
      };
    }

    this.removeWalls();
    const wallHalfHeight = 2.6;
    const thickness = 0.25;
    const depth = this.bounds.maxZ - this.bounds.minZ;
    const centerZ = (this.bounds.maxZ + this.bounds.minZ) / 2;

    this.addWall(new CANNON.Vec3(thickness, wallHalfHeight, depth / 2 + thickness), new CANNON.Vec3(-this.bounds.halfWidth - thickness, wallHalfHeight, centerZ));
    this.addWall(new CANNON.Vec3(thickness, wallHalfHeight, depth / 2 + thickness), new CANNON.Vec3(this.bounds.halfWidth + thickness, wallHalfHeight, centerZ));
    this.addWall(new CANNON.Vec3(this.bounds.halfWidth + thickness, wallHalfHeight, thickness), new CANNON.Vec3(0, wallHalfHeight, this.bounds.minZ - thickness));
    this.addWall(new CANNON.Vec3(this.bounds.halfWidth + thickness, wallHalfHeight, thickness), new CANNON.Vec3(0, wallHalfHeight, this.bounds.maxZ + thickness));

    const points = [
      new THREE.Vector3(-this.bounds.halfWidth, 0.018, this.bounds.minZ),
      new THREE.Vector3(this.bounds.halfWidth, 0.018, this.bounds.minZ),
      new THREE.Vector3(this.bounds.halfWidth, 0.018, this.bounds.maxZ),
      new THREE.Vector3(-this.bounds.halfWidth, 0.018, this.bounds.maxZ),
    ];
    this.boundaryDebug.geometry.dispose();
    this.boundaryDebug.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  private addWall(halfExtents: CANNON.Vec3, position: CANNON.Vec3) {
    const body = new CANNON.Body({
      mass: 0,
      material: this.wallMaterial,
      shape: new CANNON.Box(halfExtents),
      position,
      collisionFilterGroup: SURFACE_GROUP,
      collisionFilterMask: DICE_GROUP,
    });
    this.world.addBody(body);
    this.wallBodies.push(body);
  }

  private removeWalls() {
    for (const wall of this.wallBodies) this.world.removeBody(wall);
    this.wallBodies = [];
  }

  private animate = (now: number) => {
    const delta = Math.min(0.04, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.world.step(1 / 60, delta, 5);

    let movingCount = 0;
    for (const runtime of this.dice) {
      runtime.group.position.set(runtime.body.position.x, runtime.body.position.y, runtime.body.position.z);
      runtime.group.quaternion.set(runtime.body.quaternion.x, runtime.body.quaternion.y, runtime.body.quaternion.z, runtime.body.quaternion.w);
      if (runtime.body.sleepState !== CANNON.Body.SLEEPING) movingCount += 1;
    }

    if (this.lastThrowAt !== null && movingCount === 0 && this.dice.length > 0 && this.settledAt === null) {
      this.settledAt = now;
    }

    this.statsCallback?.({
      diceCount: this.dice.length,
      movingCount,
      elapsedMs: this.lastThrowAt === null ? null : now - this.lastThrowAt,
      settledMs: this.lastThrowAt === null || this.settledAt === null ? null : this.settledAt - this.lastThrowAt,
    });

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.animate);
  };
}
