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
  authoritativeValues: number[];
  keepPrevious: boolean;
  diceCollision: boolean;
};

export type WorldStats = {
  diceCount: number;
  movingCount: number;
  elapsedMs: number | null;
  settledMs: number | null;
  phase: "idle" | "rolling" | "converging" | "resolved";
  authoritativeValues: number[];
};

type FaceDescriptor = {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  value: number;
};

type DieRuntime = {
  sides: DieSides;
  group: THREE.Group;
  body: CANNON.Body;
  faces: FaceDescriptor[];
  authoritativeValue: number;
  guidanceQuaternion: THREE.Quaternion | null;
  displayStartQuaternion: THREE.Quaternion | null;
  convergenceProgress: number;
  enteredTable: boolean;
  resolved: boolean;
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
const GUIDANCE_START_MS = 680;
const CONVERGENCE_LOCK_MS = 980;
const CONVERGENCE_DURATION_MS = 220;
const CONVERGENCE_STAGGER_MS = 18;
const CAMERA_LAUNCH_OFFSET = 1.55;
const CAMERA_LAUNCH_GATE = 0.35;
const CAMERA_LAUNCH_SCALE = 1.45;
const CAMERA_LAUNCH_SCALE_MS = 320;
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
    indices.push(0, next, current);
    indices.push(1, current, next);
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
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute("position");
  const clusters: Array<{ normal: THREE.Vector3; centerSum: THREE.Vector3; count: number }> = [];

  for (let index = 0; index < position.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index);
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const existing = clusters.find((cluster) => cluster.normal.dot(normal) > 0.994);
    if (existing) {
      existing.centerSum.add(center);
      existing.count += 1;
    } else {
      clusters.push({ normal, centerSum: center, count: 1 });
    }
  }
  geometry.dispose();

  return clusters
    .slice(0, expectedCount)
    .map((cluster, index) => ({
      normal: cluster.normal.clone(),
      center: cluster.centerSum.clone().multiplyScalar(1 / cluster.count),
      value: index + 1,
    }));
}

function numberTexture(value: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context를 만들 수 없습니다.");

  context.clearRect(0, 0, canvas.width, canvas.height);
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
    const plane = new THREE.Mesh(
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
    plane.position.copy(face.center).addScaledVector(normal, 0.018);
    plane.quaternion.setFromUnitVectors(forward, normal);
    group.add(plane);
  }
}

function colliderFor(source: THREE.BufferGeometry, sides: DieSides) {
  if (sides === 6) return new CANNON.Box(new CANNON.Vec3(0.62, 0.62, 0.62));

  // Merge by position only. PolyhedronGeometry keeps separate vertices per face
  // because their normals differ, which produces disconnected Cannon faces and
  // can crash convex-vs-convex collision (most visibly with two d20s).
  const colliderSource = source.clone();
  for (const attribute of Object.keys(colliderSource.attributes)) {
    if (attribute !== "position") colliderSource.deleteAttribute(attribute);
  }
  const geometry = mergeVertices(colliderSource, 1e-4);
  colliderSource.dispose();
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
  private currentThrow: DieRuntime[] = [];
  private wallBodies: CANNON.Body[] = [];
  private bounds: Bounds = { halfWidth: 6, minZ: -6, maxZ: 5 };
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

    // The camera sensor is parallel to the table: screen space is the table.
    // Screen-down maps to the player/camera side (+Z), where throws enter.
    this.camera.position.set(0, 16, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    const hemisphere = new THREE.HemisphereLight(0xffe6c4, 0x1b2732, 2.05);
    this.scene.add(hemisphere);

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
      if (runtime.resolved) continue;
      runtime.body.collisionFilterMask = (runtime.enteredTable ? SURFACE_GROUP : 0) | (enabled ? DICE_GROUP : 0);
      runtime.body.wakeUp();
    }
  }

  setDebugBounds(visible: boolean) {
    this.boundaryDebug.visible = visible;
  }

  throw(options: ThrowOptions) {
    if (options.authoritativeValues.length !== options.sides.length) {
      throw new Error("권위 결과 개수와 주사위 개수가 일치해야 합니다.");
    }
    if (!options.keepPrevious) this.clear();
    this.setDiceCollision(options.diceCollision);
    this.currentThrow = [];
    this.lastThrowAt = performance.now();
    this.settledAt = null;

    const total = options.sides.length;
    const spread = Math.min(this.bounds.halfWidth * 1.1, Math.max(1.4, total * 0.72));
    const startZ = this.bounds.maxZ + CAMERA_LAUNCH_OFFSET;

    options.sides.forEach((sides, index) => {
      const authoritativeValue = options.authoritativeValues[index];
      if (!Number.isInteger(authoritativeValue) || authoritativeValue < 1 || authoritativeValue > sides) {
        throw new Error(`d${sides} 권위 결과가 범위를 벗어났습니다.`);
      }
      const normalized = total <= 1 ? 0 : index / (total - 1) - 0.5;
      const x = normalized * spread + (Math.random() - 0.5) * 0.52;
      const y = this.settings.spawnHeight + Math.random() * 0.36 + index * 0.035;
      const z = startZ + Math.random() * 0.2;
      const runtime = this.createDie(sides, authoritativeValue, x, y, z);
      this.currentThrow.push(runtime);

      const lateral = (Math.random() - 0.5) * 3.2;
      const forward = this.settings.throwSpeed * (0.91 + Math.random() * 0.17);
      runtime.body.velocity.set(lateral, -2.4 - Math.random() * 1.4, -forward);

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
    this.currentThrow = [];
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

  private createDie(sides: DieSides, authoritativeValue: number, x: number, y: number, z: number) {
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
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 18),
      new THREE.LineBasicMaterial({ color: 0x3a1f10, transparent: true, opacity: 0.72 }),
    );
    group.add(edges);
    attachFaceNumbers(group, faces, sides);
    group.position.set(x, y, z);
    group.scale.setScalar(CAMERA_LAUNCH_SCALE);
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
      collisionFilterMask: this.diceCollision ? DICE_GROUP : 0,
    });
    this.world.addBody(body);

    const runtime: DieRuntime = {
      sides,
      group,
      body,
      faces,
      authoritativeValue,
      guidanceQuaternion: null,
      displayStartQuaternion: null,
      convergenceProgress: 0,
      enteredTable: false,
      resolved: false,
    };
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
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersect = (x: number, y: number) => {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    };

    const topLeft = intersect(-0.96, 0.92);
    const topRight = intersect(0.96, 0.92);
    const bottomLeft = intersect(-0.96, -0.9);
    const bottomRight = intersect(0.96, -0.9);

    if (topLeft && topRight && bottomLeft && bottomRight) {
      const backHalfWidth = Math.min(Math.abs(topLeft.x), Math.abs(topRight.x));
      const frontHalfWidth = Math.min(Math.abs(bottomLeft.x), Math.abs(bottomRight.x));
      this.bounds = {
        halfWidth: Math.max(3.2, Math.min(backHalfWidth, frontHalfWidth) - 0.45),
        minZ: Math.min(topLeft.z, topRight.z) + 0.5,
        maxZ: Math.max(bottomLeft.z, bottomRight.z) - 0.55,
      };
    }

    this.removeWalls();
    const height = 2.8;
    const thickness = 0.28;
    const depth = this.bounds.maxZ - this.bounds.minZ;
    const centerZ = (this.bounds.maxZ + this.bounds.minZ) / 2;

    this.addWall(new CANNON.Vec3(thickness, height, depth / 2 + thickness), new CANNON.Vec3(-this.bounds.halfWidth - thickness, height, centerZ));
    this.addWall(new CANNON.Vec3(thickness, height, depth / 2 + thickness), new CANNON.Vec3(this.bounds.halfWidth + thickness, height, centerZ));
    this.addWall(new CANNON.Vec3(this.bounds.halfWidth + thickness, height, thickness), new CANNON.Vec3(0, height, this.bounds.minZ - thickness));
    this.addWall(new CANNON.Vec3(this.bounds.halfWidth + thickness, height, thickness), new CANNON.Vec3(0, height, this.bounds.maxZ + thickness));

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

    const elapsed = this.lastThrowAt === null ? null : now - this.lastThrowAt;
    let movingCount = 0;
    let converging = false;
    const up = new THREE.Vector3(0, 1, 0);

    for (const [index, runtime] of this.currentThrow.entries()) {
      const guidanceAt = GUIDANCE_START_MS + index * CONVERGENCE_STAGGER_MS;
      const lockAt = CONVERGENCE_LOCK_MS + index * CONVERGENCE_STAGGER_MS;

      if (!runtime.displayStartQuaternion) {
        runtime.group.position.set(runtime.body.position.x, runtime.body.position.y, runtime.body.position.z);
        runtime.group.quaternion.set(runtime.body.quaternion.x, runtime.body.quaternion.y, runtime.body.quaternion.z, runtime.body.quaternion.w);
      }

      if (!runtime.enteredTable && runtime.body.position.z <= this.bounds.maxZ - CAMERA_LAUNCH_GATE) {
        runtime.enteredTable = true;
        runtime.body.collisionFilterMask = SURFACE_GROUP | (this.diceCollision ? DICE_GROUP : 0);
        runtime.body.wakeUp();
      }

      if (elapsed !== null) {
        const launchProgress = Math.min(1, Math.max(0, elapsed / CAMERA_LAUNCH_SCALE_MS));
        const launchEase = launchProgress * launchProgress * (3 - 2 * launchProgress);
        runtime.group.scale.setScalar(CAMERA_LAUNCH_SCALE + (1 - CAMERA_LAUNCH_SCALE) * launchEase);
      }

      if (elapsed !== null && elapsed >= guidanceAt && !runtime.guidanceQuaternion) {
        const desiredFace = runtime.faces.find((face) => face.value === runtime.authoritativeValue) ?? runtime.faces[0];
        const localNormal = desiredFace?.normal ?? up;
        const worldNormal = localNormal.clone().applyQuaternion(runtime.group.quaternion).normalize();
        const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, up);
        runtime.guidanceQuaternion = correction.multiply(runtime.group.quaternion.clone()).normalize();
      }

      if (elapsed !== null && elapsed >= guidanceAt && elapsed < lockAt && runtime.guidanceQuaternion) {
        converging = true;
        runtime.body.linearDamping = Math.max(this.settings.linearDamping, 0.3);
        runtime.body.angularDamping = Math.max(this.settings.angularDamping, 0.36);

        const current = new THREE.Quaternion(runtime.body.quaternion.x, runtime.body.quaternion.y, runtime.body.quaternion.z, runtime.body.quaternion.w);
        const error = runtime.guidanceQuaternion.clone().multiply(current.invert()).normalize();
        if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w);
        const halfSin = Math.sqrt(error.x * error.x + error.y * error.y + error.z * error.z);
        if (halfSin > 1e-4) {
          const angle = 2 * Math.atan2(halfSin, Math.max(1e-4, error.w));
          const speed = Math.min(9, angle * 7.5);
          const desiredX = (error.x / halfSin) * speed;
          const desiredY = (error.y / halfSin) * speed;
          const desiredZ = (error.z / halfSin) * speed;
          runtime.body.angularVelocity.x += (desiredX - runtime.body.angularVelocity.x) * 0.2;
          runtime.body.angularVelocity.y += (desiredY - runtime.body.angularVelocity.y) * 0.2;
          runtime.body.angularVelocity.z += (desiredZ - runtime.body.angularVelocity.z) * 0.2;
          runtime.body.wakeUp();
        }
      }

      if (elapsed !== null && elapsed >= lockAt && runtime.guidanceQuaternion && !runtime.displayStartQuaternion) {
        runtime.displayStartQuaternion = runtime.group.quaternion.clone();
        runtime.body.velocity.setZero();
        runtime.body.angularVelocity.setZero();
        runtime.body.quaternion.set(
          runtime.guidanceQuaternion.x,
          runtime.guidanceQuaternion.y,
          runtime.guidanceQuaternion.z,
          runtime.guidanceQuaternion.w,
        );
        runtime.body.collisionFilterMask = 0;
        runtime.body.sleep();
      }

      if (elapsed !== null && runtime.displayStartQuaternion && runtime.guidanceQuaternion) {
        const rawProgress = Math.min(1, Math.max(0, (elapsed - lockAt) / CONVERGENCE_DURATION_MS));
        const eased = rawProgress * rawProgress * (3 - 2 * rawProgress);
        runtime.convergenceProgress = rawProgress;
        runtime.group.quaternion.slerpQuaternions(runtime.displayStartQuaternion, runtime.guidanceQuaternion, eased);
        runtime.resolved = rawProgress >= 1;
        if (!runtime.resolved) converging = true;
      }

      if (!runtime.resolved) movingCount += 1;
    }

    if (this.lastThrowAt !== null && this.currentThrow.length > 0 && this.currentThrow.every((runtime) => runtime.resolved) && this.settledAt === null) {
      this.settledAt = now;
    }

    const phase: WorldStats["phase"] = this.lastThrowAt === null
      ? "idle"
      : this.settledAt !== null
        ? "resolved"
        : converging
          ? "converging"
          : "rolling";

    this.statsCallback?.({
      diceCount: this.dice.length,
      movingCount,
      elapsedMs: elapsed,
      settledMs: this.lastThrowAt === null || this.settledAt === null ? null : this.settledAt - this.lastThrowAt,
      phase,
      authoritativeValues: this.currentThrow.map((runtime) => runtime.authoritativeValue),
    });

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.animate);
  };
}
