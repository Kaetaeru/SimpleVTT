import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { readAppearancePreference } from "./app/appearancePreferences";
import { diceFaceLabel, getDiceVisualPreset, type DiceVisualPreset } from "./app/diceVisualPresets";

export type PhysicsDie = { sides: 4 | 6 | 8 | 10 | 12 | 20; value: number };

type FaceDescriptor = {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  value: number;
};

type DieRuntime = {
  mesh: THREE.Group;
  body: CANNON.Body;
  faces: FaceDescriptor[];
  desiredIndex: number;
  targetQuaternion: THREE.Quaternion | null;
  coreGeometry: THREE.BufferGeometry;
  edgeGeometry: THREE.EdgesGeometry;
};

type TableBounds = {
  halfWidth: number;
  minZ: number;
  maxZ: number;
};

type VisualAssets = {
  coreMaterial: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  textures: Map<number, THREE.CanvasTexture>;
  labelMaterials: Map<number, THREE.MeshBasicMaterial>;
  labelGeometries: Map<PhysicsDie["sides"], THREE.PlaneGeometry>;
};

const DICE_GROUP = 2;
const SURFACE_GROUP = 1;
const CINEMATIC_CAMERA_HEIGHT = 18;
const CINEMATIC_CAMERA_FOV = 36;

const MASS_BY_SIDES: Record<PhysicsDie["sides"], number> = {
  4: 0.82,
  6: 1.08,
  8: 0.9,
  10: 0.96,
  12: 1.04,
  20: 0.98,
};

const LABEL_SIZE_BY_SIDES: Record<PhysicsDie["sides"], number> = {
  4: 0.46,
  6: 0.5,
  8: 0.42,
  10: 0.38,
  12: 0.36,
  20: 0.32,
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
    // Outward-facing winding. The old production geometry was inside-out.
    indices.push(0, next, current);
    indices.push(1, current, next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function dieGeometry(sides: PhysicsDie["sides"]) {
  if (sides === 4) return new THREE.TetrahedronGeometry(0.9, 0);
  if (sides === 6) return new THREE.BoxGeometry(1.24, 1.24, 1.24);
  if (sides === 8) return new THREE.OctahedronGeometry(0.94, 0);
  if (sides === 10) return d10Geometry();
  if (sides === 12) return new THREE.DodecahedronGeometry(0.91, 0);
  return new THREE.IcosahedronGeometry(0.94, 0);
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

  return clusters.slice(0, expectedCount).map((cluster, index) => ({
    normal: cluster.normal.clone(),
    center: cluster.centerSum.clone().multiplyScalar(1 / cluster.count),
    value: index + 1,
  }));
}

function cannonShape(source: THREE.BufferGeometry, sides: PhysicsDie["sides"]) {
  if (sides === 6) return new CANNON.Box(new CANNON.Vec3(0.62, 0.62, 0.62));

  // Render geometry may duplicate a vertex for every face normal/UV. Physics
  // needs one shared convex hull, otherwise d20 contact solving can stall.
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute("position");
  const vertices: CANNON.Vec3[] = [];
  const vertexLookup = new Map<string, number>();
  const faces: number[][] = [];

  const vertexIndexFor = (vertex: THREE.Vector3) => {
    const precision = 100000;
    const key = `${Math.round(vertex.x * precision)},${Math.round(vertex.y * precision)},${Math.round(vertex.z * precision)}`;
    const existing = vertexLookup.get(key);
    if (existing !== undefined) return existing;
    const next = vertices.length;
    vertices.push(new CANNON.Vec3(vertex.x, vertex.y, vertex.z));
    vertexLookup.set(key, next);
    return next;
  };

  for (let offset = 0; offset < position.count; offset += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, offset);
    const b = new THREE.Vector3().fromBufferAttribute(position, offset + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, offset + 2);

    const ia = vertexIndexFor(a);
    let ib = vertexIndexFor(b);
    let ic = vertexIndexFor(c);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(centroid) < 0) {
      const swap = ib;
      ib = ic;
      ic = swap;
    }
    faces.push([ia, ib, ic]);
  }
  geometry.dispose();

  try {
    if (sides === 20 && (vertices.length !== 12 || faces.length !== 20)) {
      return new CANNON.Sphere(0.78);
    }
    return new CANNON.ConvexPolyhedron({ vertices, faces });
  } catch {
    return new CANNON.Sphere(0.78);
  }
}

function createVisualAssets(preset: DiceVisualPreset): VisualAssets {
  return {
    coreMaterial: new THREE.MeshStandardMaterial({
      color: preset.body.color,
      emissive: preset.body.emissive,
      emissiveIntensity: preset.body.emissiveIntensity,
      roughness: preset.body.roughness,
      metalness: preset.body.metalness,
      flatShading: true,
      transparent: preset.body.opacity < 0.999,
      opacity: preset.body.opacity,
    }),
    edgeMaterial: new THREE.LineBasicMaterial({
      color: preset.edge.color,
      transparent: true,
      opacity: preset.edge.opacity,
    }),
    textures: new Map(),
    labelMaterials: new Map(),
    labelGeometries: new Map(),
  };
}

function labelGeometry(assets: VisualAssets, sides: PhysicsDie["sides"]) {
  const existing = assets.labelGeometries.get(sides);
  if (existing) return existing;
  const size = LABEL_SIZE_BY_SIDES[sides];
  const geometry = new THREE.PlaneGeometry(size, size);
  assets.labelGeometries.set(sides, geometry);
  return geometry;
}

function numberTexture(assets: VisualAssets, preset: DiceVisualPreset, value: number) {
  const existing = assets.textures.get(value);
  if (existing) return existing;

  const text = diceFaceLabel(preset, value);
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context를 만들 수 없습니다.");

  context.clearRect(0, 0, 192, 192);
  context.textAlign = "center";
  context.textBaseline = "middle";
  const fontSize = preset.marking.mode === "rune" ? 84 : value >= 10 ? 70 : 82;
  context.font = `800 ${fontSize}px ${preset.marking.fontFamily}`;
  context.lineJoin = "round";
  context.lineWidth = 13;
  context.strokeStyle = preset.marking.stroke;
  context.shadowColor = preset.marking.glowColor;
  context.shadowBlur = preset.marking.glowBlur;
  context.strokeText(text, 96, 101);
  context.fillStyle = preset.marking.fill;
  context.fillText(text, 96, 101);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  assets.textures.set(value, texture);
  return texture;
}

function numberMaterial(assets: VisualAssets, preset: DiceVisualPreset, value: number) {
  const existing = assets.labelMaterials.get(value);
  if (existing) return existing;
  const material = new THREE.MeshBasicMaterial({
    map: numberTexture(assets, preset, value),
    transparent: true,
    depthWrite: false,
    alphaTest: 0.04,
    side: THREE.FrontSide,
  });
  assets.labelMaterials.set(value, material);
  return material;
}

function attachFaceLabels(
  group: THREE.Group,
  faces: FaceDescriptor[],
  sides: PhysicsDie["sides"],
  assets: VisualAssets,
  preset: DiceVisualPreset,
) {
  if (preset.marking.mode === "none") return;
  const forward = new THREE.Vector3(0, 0, 1);
  const geometry = labelGeometry(assets, sides);
  for (const face of faces) {
    const label = new THREE.Mesh(geometry, numberMaterial(assets, preset, face.value));
    const normal = face.normal.clone().normalize();
    label.position.copy(face.center).addScaledVector(normal, 0.018);
    label.quaternion.setFromUnitVectors(forward, normal);
    group.add(label);
  }
}

function buildDie(
  scene: THREE.Scene,
  world: CANNON.World,
  dieMaterial: CANNON.Material,
  die: PhysicsDie,
  index: number,
  total: number,
  cinematic: boolean,
  bounds: TableBounds | null,
  assets: VisualAssets,
  preset: DiceVisualPreset,
): DieRuntime {
  const geometry = dieGeometry(die.sides);
  geometry.computeVertexNormals();
  const faces = faceDescriptors(geometry, die.sides);

  const core = new THREE.Mesh(geometry, assets.coreMaterial);
  core.castShadow = true;
  core.receiveShadow = true;
  const edgeGeometry = new THREE.EdgesGeometry(geometry, 18);
  const edges = new THREE.LineSegments(edgeGeometry, assets.edgeMaterial);

  const group = new THREE.Group();
  group.add(core, edges);
  attachFaceLabels(group, faces, die.sides, assets, preset);

  let x: number;
  let y: number;
  let z: number;
  if (cinematic && bounds) {
    const spread = Math.min(bounds.halfWidth * 1.05, Math.max(1.4, total * 0.72));
    const normalized = total <= 1 ? 0 : index / (total - 1) - 0.5;
    x = normalized * spread + (Math.random() - 0.5) * 0.52;
    y = 3.15 + Math.random() * 0.3 + index * 0.035;
    z = bounds.minZ + 0.95 + Math.random() * 0.18;
  } else {
    const spacing = 1.85;
    x = (index - (total - 1) / 2) * spacing;
    y = 3.4 + index * 0.24;
    z = index % 2 ? -0.3 : 0.3;
  }
  group.position.set(x, y, z);
  scene.add(group);

  const body = new CANNON.Body({
    mass: MASS_BY_SIDES[die.sides],
    material: dieMaterial,
    shape: cannonShape(geometry, die.sides),
    position: new CANNON.Vec3(x, y, z),
    linearDamping: cinematic ? 0.14 : 0.14,
    angularDamping: cinematic ? 0.17 : 0.08,
    allowSleep: true,
    sleepSpeedLimit: 0.22,
    sleepTimeLimit: 0.24,
    collisionFilterGroup: DICE_GROUP,
    collisionFilterMask: SURFACE_GROUP | DICE_GROUP,
  });

  if (cinematic) {
    const lateral = (Math.random() - 0.5) * 2.8;
    const forward = 13.5 * (0.91 + Math.random() * 0.17);
    body.velocity.set(lateral, -2.3 - Math.random() * 1.2, forward);
    const rollDirection = Math.random() > 0.5 ? 1 : -1;
    const spin = 21 * (0.82 + Math.random() * 0.32);
    body.angularVelocity.set(
      rollDirection * spin,
      (Math.random() - 0.5) * spin * 0.55,
      (Math.random() - 0.5) * spin * 0.4,
    );
  } else {
    body.velocity.set((Math.random() - 0.5) * 2.4, -0.4, (Math.random() - 0.5) * 2.2);
    body.angularVelocity.set(8 + Math.random() * 8, 7 + Math.random() * 10, 6 + Math.random() * 9);
  }

  body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  world.addBody(body);

  return {
    mesh: group,
    body,
    faces,
    desiredIndex: Math.max(0, Math.min(faces.length - 1, die.value - 1)),
    targetQuaternion: null,
    coreGeometry: geometry,
    edgeGeometry,
  };
}

function disposeVisualAssets(assets: VisualAssets) {
  assets.coreMaterial.dispose();
  assets.edgeMaterial.dispose();
  for (const texture of assets.textures.values()) texture.dispose();
  for (const material of assets.labelMaterials.values()) material.dispose();
  for (const geometry of assets.labelGeometries.values()) geometry.dispose();
  assets.textures.clear();
  assets.labelMaterials.clear();
  assets.labelGeometries.clear();
}

export function PhysicsDice3D({
  dice,
  compact = false,
  reducedMotion = false,
  cinematic = false,
  className = "",
}: {
  dice: PhysicsDie[];
  compact?: boolean;
  reducedMotion?: boolean;
  cinematic?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !dice.length) return;

    const preference = readAppearancePreference();
    const preset = getDiceVisualPreset(preference.diceTheme);
    const assets = createVisualAssets(preset);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(cinematic ? CINEMATIC_CAMERA_FOV : 34, 1, 0.1, 100);
    if (cinematic) {
      // The Play screen itself is the table. Camera image plane and table are
      // parallel; optical axis points straight down.
      camera.position.set(0, CINEMATIC_CAMERA_HEIGHT, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, 5.4, compact ? 8.6 : 9.8);
      camera.lookAt(0, 0.7, 0);
    }

    scene.add(new THREE.HemisphereLight(0xffead0, 0x18202a, 2.15));
    const key = new THREE.DirectionalLight(0xffd39a, 3.4);
    key.position.set(-4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f86ad, 1.25);
    rim.position.set(5, 5, -4);
    scene.add(rim);

    const floorY = cinematic ? 0 : -1.05;
    const floorMesh = cinematic
      ? new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.27, transparent: true }))
      : new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x0c1119, roughness: 0.78, metalness: 0.05 }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = floorY;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, cinematic ? -20 : -18.5, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    const solver = world.solver as CANNON.GSSolver;
    solver.iterations = 12;
    solver.tolerance = 0.001;

    const dieMaterial = new CANNON.Material("dice");
    const floorMaterial = new CANNON.Material("floor");
    const wallMaterial = new CANNON.Material("wall");
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial, floorMaterial, {
      friction: cinematic ? 0.48 : 0.34,
      restitution: cinematic ? 0.22 : 0.42,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial, dieMaterial, {
      friction: 0.26,
      restitution: cinematic ? 0.22 : 0.36,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial, wallMaterial, {
      friction: 0.24,
      restitution: 0.27,
    }));

    const floorBody = new CANNON.Body({
      mass: 0,
      material: floorMaterial,
      shape: new CANNON.Plane(),
      position: new CANNON.Vec3(0, floorY, 0),
      collisionFilterGroup: SURFACE_GROUP,
      collisionFilterMask: DICE_GROUP,
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    const resizeRenderer = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resizeRenderer();

    const tableBounds = (): TableBounds | null => {
      if (!cinematic) return null;
      const halfVisibleZ = Math.tan(THREE.MathUtils.degToRad(CINEMATIC_CAMERA_FOV / 2)) * CINEMATIC_CAMERA_HEIGHT;
      const halfVisibleX = halfVisibleZ * camera.aspect;
      const margin = 0.72;
      return {
        halfWidth: Math.max(3.2, halfVisibleX - margin),
        minZ: -Math.max(3.2, halfVisibleZ - margin),
        maxZ: Math.max(3.2, halfVisibleZ - margin),
      };
    };

    let wallBodies: CANNON.Body[] = [];
    const removeWalls = () => {
      for (const wall of wallBodies) world.removeBody(wall);
      wallBodies = [];
    };
    const addWall = (halfExtents: CANNON.Vec3, position: CANNON.Vec3) => {
      const wall = new CANNON.Body({
        mass: 0,
        material: wallMaterial,
        shape: new CANNON.Box(halfExtents),
        position,
        collisionFilterGroup: SURFACE_GROUP,
        collisionFilterMask: DICE_GROUP,
      });
      world.addBody(wall);
      wallBodies.push(wall);
    };
    const rebuildWalls = () => {
      removeWalls();
      const bounds = tableBounds();
      if (!bounds) return;
      const wallHalfHeight = 3.2;
      const thickness = 0.28;
      const depth = bounds.maxZ - bounds.minZ;
      const centerZ = (bounds.maxZ + bounds.minZ) / 2;
      addWall(new CANNON.Vec3(thickness, wallHalfHeight, depth / 2 + thickness), new CANNON.Vec3(-bounds.halfWidth - thickness, wallHalfHeight, centerZ));
      addWall(new CANNON.Vec3(thickness, wallHalfHeight, depth / 2 + thickness), new CANNON.Vec3(bounds.halfWidth + thickness, wallHalfHeight, centerZ));
      addWall(new CANNON.Vec3(bounds.halfWidth + thickness, wallHalfHeight, thickness), new CANNON.Vec3(0, wallHalfHeight, bounds.minZ - thickness));
      addWall(new CANNON.Vec3(bounds.halfWidth + thickness, wallHalfHeight, thickness), new CANNON.Vec3(0, wallHalfHeight, bounds.maxZ + thickness));
    };
    rebuildWalls();

    const runtimes = dice.map((die, index) => buildDie(
      scene,
      world,
      dieMaterial,
      die,
      index,
      dice.length,
      cinematic,
      tableBounds(),
      assets,
      preset,
    ));

    const observer = new ResizeObserver(() => {
      resizeRenderer();
      rebuildWalls();
    });
    observer.observe(host);

    const start = performance.now();
    let last = start;
    let frame = 0;
    let raf = 0;
    const up = new THREE.Vector3(0, 1, 0);

    const animate = (now: number) => {
      const rawDelta = Math.max(0, (now - last) / 1000);
      last = now;
      const elapsed = now - start;

      if (!reducedMotion) {
        if (rawDelta > 0.1) world.step(1 / 60);
        else world.step(1 / 60, Math.max(0.001, Math.min(rawDelta, 1 / 30)), 3);
      }

      for (const runtime of runtimes) {
        if (!runtime.targetQuaternion) {
          runtime.mesh.position.set(runtime.body.position.x, runtime.body.position.y, runtime.body.position.z);
          runtime.mesh.quaternion.set(
            runtime.body.quaternion.x,
            runtime.body.quaternion.y,
            runtime.body.quaternion.z,
            runtime.body.quaternion.w,
          );
        }

        const settleAt = reducedMotion ? 0 : cinematic ? 1000 : 1250;
        if (elapsed >= settleAt && !runtime.targetQuaternion) {
          const face = runtime.faces[runtime.desiredIndex];
          const normal = face?.normal ?? new THREE.Vector3(0, 1, 0);
          const worldNormal = normal.clone().applyQuaternion(runtime.mesh.quaternion).normalize();
          const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, up);
          runtime.targetQuaternion = correction.multiply(runtime.mesh.quaternion.clone()).normalize();
          runtime.body.velocity.setZero();
          runtime.body.angularVelocity.setZero();
          runtime.body.sleep();
        }

        if (runtime.targetQuaternion) {
          runtime.mesh.quaternion.slerp(runtime.targetQuaternion, reducedMotion ? 1 : cinematic ? 0.28 : 0.105);
        }
      }

      renderer.render(scene, camera);
      frame += 1;
      const renderUntil = reducedMotion ? 520 : cinematic ? 1500 : 2350;
      if (elapsed < renderUntil || frame < 3) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeWalls();
      for (const runtime of runtimes) {
        world.removeBody(runtime.body);
        scene.remove(runtime.mesh);
        runtime.coreGeometry.dispose();
        runtime.edgeGeometry.dispose();
      }
      world.removeBody(floorBody);
      floorMesh.geometry.dispose();
      (floorMesh.material as THREE.Material).dispose();
      disposeVisualAssets(assets);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dice, compact, reducedMotion, cinematic]);

  return (
    <div
      ref={hostRef}
      className={`physics-dice-canvas ${compact ? "compact" : ""} ${cinematic ? "cinematic" : ""} ${className}`.trim()}
      role="img"
      aria-label={dice.map((die) => `d${die.sides} ${die.value}`).join(", ")}
    />
  );
}
