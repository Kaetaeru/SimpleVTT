import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type PhysicsDie = { sides:4|6|8|10|12|20; value:number };

type DieRuntime = {
  mesh:THREE.Group;
  body:CANNON.Body;
  faceNormals:THREE.Vector3[];
  desiredIndex:number;
  guidanceQuaternion:THREE.Quaternion|null;
  displayStartQuaternion:THREE.Quaternion|null;
  convergenceProgress:number;
  enteredTable:boolean;
  resolved:boolean;
};

const DEMO_BRONZE="#c77d38";
const DEMO_NUMBER="#f7dfae";
const DICE_GROUP=2;
const SURFACE_GROUP=1;
const FLOOR_Y=-1.05;
const MASS_BY_SIDES:Record<PhysicsDie["sides"],number>={4:.82,6:1.08,8:.9,10:.96,12:1.04,20:.98};
const PRODUCT_PHYSICS={
  gravity:22,
  floorFriction:.52,
  restitution:.18,
  linearDamping:.16,
  angularDamping:.2,
  throwSpeed:14.5,
  spinSpeed:22,
  spawnHeight:3,
} as const;
const GUIDANCE_START_MS=680;
const CONVERGENCE_LOCK_MS=980;
const CONVERGENCE_DURATION_MS=220;
const CONVERGENCE_STAGGER_MS=18;
const CAMERA_LAUNCH_OFFSET=1.55;
const CAMERA_LAUNCH_GATE=.35;
const CAMERA_LAUNCH_SCALE=1.45;
const CAMERA_LAUNCH_SCALE_MS=320;

type TableBounds={halfWidth:number;minZ:number;maxZ:number;focusZ:number};

function pentagonalBipyramidGeometry() {
  const radius=.82;
  const height=1.02;
  const vertices:number[]=[0,height,0,0,-height,0];
  for (let i=0;i<5;i++) {
    const angle=-Math.PI/2+(i*Math.PI*2)/5;
    vertices.push(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
  }
  const indices:number[]=[];
  for (let i=0;i<5;i++) {
    const current=2+i;
    const next=2+((i+1)%5);
    indices.push(0,next,current);
    indices.push(1,current,next);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function dieGeometry(sides:PhysicsDie["sides"]) {
  if (sides===4) return new THREE.TetrahedronGeometry(.82,0);
  if (sides===6) return new THREE.BoxGeometry(1.25,1.25,1.25,1,1,1);
  if (sides===8) return new THREE.OctahedronGeometry(.9,0);
  if (sides===10) return pentagonalBipyramidGeometry();
  if (sides===12) return new THREE.DodecahedronGeometry(.88,0);
  return new THREE.IcosahedronGeometry(.9,0);
}

function faceDescriptors(source:THREE.BufferGeometry,sides:number) {
  const geometry=source.index?source.toNonIndexed():source.clone();
  const position=geometry.getAttribute("position");
  const clusters:Array<{normal:THREE.Vector3;center:THREE.Vector3;count:number}>=[];
  for (let i=0;i<position.count;i+=3) {
    const a=new THREE.Vector3().fromBufferAttribute(position,i);
    const b=new THREE.Vector3().fromBufferAttribute(position,i+1);
    const c=new THREE.Vector3().fromBufferAttribute(position,i+2);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center=a.clone().add(b).add(c).multiplyScalar(1/3);
    const existing=clusters.find((candidate)=>candidate.normal.dot(normal)>.994);
    if (existing) { existing.center.add(center); existing.count++; }
    else clusters.push({normal,center,count:1});
  }
  geometry.dispose();
  return clusters.slice(0,sides).map((face,index)=>({
    normal:face.normal,
    center:face.center.multiplyScalar(1/face.count),
    value:index+1,
  }));
}

function cannonShape(source:THREE.BufferGeometry,sides:PhysicsDie["sides"]) {
  if (sides===6) return new CANNON.Box(new CANNON.Vec3(.625,.625,.625));
  // Merge by position only. Face normals otherwise keep polyhedron vertices
  // disconnected and Cannon can crash during convex-vs-convex collision.
  const colliderSource=source.clone();
  for (const attribute of Object.keys(colliderSource.attributes)) {
    if (attribute!=="position") colliderSource.deleteAttribute(attribute);
  }
  const geometry=mergeVertices(colliderSource,1e-4);
  colliderSource.dispose();
  const position=geometry.getAttribute("position");
  const index=geometry.index;
  if (!index) return new CANNON.Sphere(.74);
  const vertices:Array<CANNON.Vec3>=[];
  for (let i=0;i<position.count;i++) vertices.push(new CANNON.Vec3(position.getX(i),position.getY(i),position.getZ(i)));
  const faces:number[][]=[];
  for (let i=0;i<index.count;i+=3) faces.push([index.getX(i),index.getX(i+1),index.getX(i+2)]);
  geometry.dispose();
  try { return new CANNON.ConvexPolyhedron({vertices,faces}); }
  catch { return new CANNON.Sphere(.74); }
}

function numberTexture(value:number) {
  const canvas=document.createElement("canvas");
  canvas.width=192; canvas.height=192;
  const context=canvas.getContext("2d")!;
  context.clearRect(0,0,192,192);
  context.font=value>=10?"800 70px Georgia, serif":"800 82px Georgia, serif";
  context.textAlign="center"; context.textBaseline="middle";
  context.lineJoin="round";
  context.lineWidth=13;
  context.strokeStyle="rgba(22,12,6,.82)";
  context.strokeText(String(value),96,101);
  context.fillStyle=DEMO_NUMBER;
  context.fillText(String(value),96,101);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function buildDie(scene:THREE.Scene,world:CANNON.World,dieMaterial:CANNON.Material,bounds:TableBounds,die:PhysicsDie,index:number,total:number,cinematic:boolean):DieRuntime {
  const geometry=dieGeometry(die.sides);
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({
    color:new THREE.Color(DEMO_BRONZE),
    emissive:new THREE.Color("#211006"),
    emissiveIntensity:.18,
    roughness:.3,
    metalness:.28,
    flatShading:true,
  });
  const meshCore=new THREE.Mesh(geometry,material);
  meshCore.castShadow=true; meshCore.receiveShadow=true;
  const group=new THREE.Group();
  group.add(meshCore);
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry,18),
    new THREE.LineBasicMaterial({color:0x3a1f10,transparent:true,opacity:.72}),
  ));

  const faces=faceDescriptors(geometry,die.sides);
  const numberSize:Record<PhysicsDie["sides"],number>={4:.46,6:.5,8:.42,10:.38,12:.36,20:.32};
  const forward=new THREE.Vector3(0,0,1);
  faces.forEach((face)=>{
    const number=new THREE.Mesh(
      new THREE.PlaneGeometry(numberSize[die.sides],numberSize[die.sides]),
      new THREE.MeshBasicMaterial({map:numberTexture(face.value),transparent:true,depthWrite:false,alphaTest:.04,side:THREE.FrontSide}),
    );
    number.position.copy(face.center).addScaledVector(face.normal,.018);
    number.quaternion.setFromUnitVectors(forward,face.normal);
    group.add(number);
  });

  const spread=Math.min(bounds.halfWidth*1.1,Math.max(1.4,total*.72));
  const normalized=total<=1?0:index/(total-1)-.5;
  const x=normalized*spread+(Math.random()-.5)*.45;
  // With the sensor parallel to the table, +Z is the player/camera side of
  // screen space. Start just beyond that edge and travel into the table.
  const z=cinematic?bounds.maxZ+CAMERA_LAUNCH_OFFSET+Math.random()*.2:Math.min(bounds.maxZ-.8,bounds.minZ+2.2+(index%2?.35:-.35));
  group.position.set(x,PRODUCT_PHYSICS.spawnHeight+(cinematic?.7:0)+Math.random()*.3+index*.035,z);
  if (cinematic) group.scale.setScalar(CAMERA_LAUNCH_SCALE);
  scene.add(group);

  const body=new CANNON.Body({
    mass:MASS_BY_SIDES[die.sides],material:dieMaterial,shape:cannonShape(geometry,die.sides),
    linearDamping:PRODUCT_PHYSICS.linearDamping,angularDamping:PRODUCT_PHYSICS.angularDamping,
    allowSleep:true,sleepSpeedLimit:.22,sleepTimeLimit:.24,
    collisionFilterGroup:DICE_GROUP,collisionFilterMask:cinematic?DICE_GROUP:SURFACE_GROUP|DICE_GROUP,
  });
  body.position.set(group.position.x,group.position.y,group.position.z);
  if (cinematic) {
    body.velocity.set((Math.random()-.5)*3.2,-2.4-Math.random()*1.2,-PRODUCT_PHYSICS.throwSpeed*(.91+Math.random()*.17));
  } else {
    body.velocity.set((Math.random()-.5)*2.8,-1.8,7.8+Math.random()*2.2);
  }
  const axis=new CANNON.Vec3(Math.random()-.5,Math.random()-.5,Math.random()-.5);
  if (axis.lengthSquared()<.01) axis.set(1,.7,.3);
  axis.normalize();
  const spin=PRODUCT_PHYSICS.spinSpeed*(.78+Math.random()*.42);
  body.angularVelocity.set(axis.x*spin,axis.y*spin,axis.z*spin);
  body.quaternion.setFromEuler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  world.addBody(body);
  const faceNormals=faces.map((face)=>face.normal);
  return {
    mesh:group,
    body,
    faceNormals,
    desiredIndex:Math.max(0,Math.min(faceNormals.length-1,die.value-1)),
    guidanceQuaternion:null,
    displayStartQuaternion:null,
    convergenceProgress:0,
    enteredTable:!cinematic,
    resolved:false,
  };
}

function cleanupGroup(group:THREE.Group) {
  group.traverse((node:THREE.Object3D)=>{
    if (node instanceof THREE.Mesh||node instanceof THREE.LineSegments) {
      node.geometry.dispose();
      const materials:THREE.Material[]=Array.isArray(node.material)?node.material:[node.material];
      materials.forEach((material:THREE.Material)=>{
        if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
        material.dispose();
      });
    }
  });
}

export function PhysicsDice3D({dice,compact=false,reducedMotion=false,cinematic=false,className="",onResolved}:{dice:PhysicsDie[];compact?:boolean;reducedMotion?:boolean;cinematic?:boolean;className?:string;onResolved?:()=>void}) {
  const hostRef=useRef<HTMLDivElement>(null);
  const onResolvedRef=useRef(onResolved);
  useEffect(()=>{onResolvedRef.current=onResolved;},[onResolved]);
  useEffect(()=>{
    const host=hostRef.current;
    if (!host||!dice.length) return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    renderer.setClearColor(0x000000,0);
    host.replaceChildren(renderer.domElement);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(cinematic?38:34,1,.1,100);
    camera.position.set(0,cinematic?15:compact?9.4:12.5,0);
    camera.up.set(0,0,-1);
    camera.lookAt(0,FLOOR_Y,0);
    scene.add(new THREE.HemisphereLight(0xffead0,0x18202a,2.15));
    const key=new THREE.DirectionalLight(0xffd39a,3.4); key.position.set(-4,7,5); key.castShadow=true; scene.add(key);
    const rim=new THREE.DirectionalLight(0x6f86ad,1.25); rim.position.set(5,3,-4); scene.add(rim);

    const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x171b1f,roughness:.91,metalness:.02,transparent:true,opacity:cinematic?.055:.96}));
    floorMesh.rotation.x=-Math.PI/2; floorMesh.position.y=FLOOR_Y; floorMesh.receiveShadow=true; scene.add(floorMesh);

    const world=new CANNON.World({gravity:new CANNON.Vec3(0,-PRODUCT_PHYSICS.gravity,0)});
    world.allowSleep=true;
    world.broadphase=new CANNON.SAPBroadphase(world);
    const solver=world.solver as CANNON.GSSolver;
    solver.iterations=14;
    solver.tolerance=.001;
    const dieMaterial=new CANNON.Material("dice");
    const floorMaterial=new CANNON.Material("floor");
    const wallMaterial=new CANNON.Material("invisible-boundary");
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,floorMaterial,{friction:PRODUCT_PHYSICS.floorFriction,restitution:PRODUCT_PHYSICS.restitution}));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,wallMaterial,{friction:.24,restitution:.23}));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,dieMaterial,{friction:.26,restitution:.18}));
    const floorBody=new CANNON.Body({mass:0,material:floorMaterial,shape:new CANNON.Plane(),collisionFilterGroup:SURFACE_GROUP,collisionFilterMask:DICE_GROUP});
    floorBody.quaternion.setFromEuler(-Math.PI/2,0,0); floorBody.position.y=FLOOR_Y; world.addBody(floorBody);

    let bounds:TableBounds={halfWidth:6,minZ:-6,maxZ:5,focusZ:0};
    let wallBodies:CANNON.Body[]=[];
    const removeWalls=()=>{wallBodies.forEach((body)=>world.removeBody(body));wallBodies=[];};
    const addWall=(halfExtents:CANNON.Vec3,position:CANNON.Vec3)=>{
      const body=new CANNON.Body({mass:0,material:wallMaterial,shape:new CANNON.Box(halfExtents),position,collisionFilterGroup:SURFACE_GROUP,collisionFilterMask:DICE_GROUP});
      world.addBody(body); wallBodies.push(body);
    };
    const rebuildBounds=()=>{
      const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR_Y);
      const intersect=(x:number,y:number)=>{
        const raycaster=new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x,y),camera);
        return raycaster.ray.intersectPlane(plane,new THREE.Vector3());
      };
      const points=[intersect(-.96,.92),intersect(.96,.92),intersect(-.96,-.9),intersect(.96,-.9)];
      const focus=intersect(0,0);
      if (points.every((point):point is THREE.Vector3=>point!==null)) {
        const [topLeft,topRight,bottomLeft,bottomRight]=points;
        bounds={
          halfWidth:Math.max(3.2,Math.min(Math.abs(topLeft.x),Math.abs(topRight.x),Math.abs(bottomLeft.x),Math.abs(bottomRight.x))-.45),
          minZ:Math.min(topLeft.z,topRight.z)+.5,
          maxZ:Math.max(bottomLeft.z,bottomRight.z)-.55,
          focusZ:focus?.z??(Math.min(topLeft.z,topRight.z)+Math.max(bottomLeft.z,bottomRight.z))/2,
        };
      }
      removeWalls();
      const height=2.8,thickness=.28,depth=Math.max(2,bounds.maxZ-bounds.minZ),centerZ=(bounds.maxZ+bounds.minZ)/2;
      addWall(new CANNON.Vec3(thickness,height,depth/2+thickness),new CANNON.Vec3(-bounds.halfWidth-thickness,FLOOR_Y+height,centerZ));
      addWall(new CANNON.Vec3(thickness,height,depth/2+thickness),new CANNON.Vec3(bounds.halfWidth+thickness,FLOOR_Y+height,centerZ));
      addWall(new CANNON.Vec3(bounds.halfWidth+thickness,height,thickness),new CANNON.Vec3(0,FLOOR_Y+height,bounds.minZ-thickness));
      addWall(new CANNON.Vec3(bounds.halfWidth+thickness,height,thickness),new CANNON.Vec3(0,FLOOR_Y+height,bounds.maxZ+thickness));
    };
    const resize=()=>{
      const rect=host.getBoundingClientRect();
      const width=Math.max(1,Math.round(rect.width));
      const height=Math.max(1,Math.round(rect.height));
      renderer.setSize(width,height,false);
      camera.aspect=width/height; camera.updateProjectionMatrix();
      rebuildBounds();
    };
    resize();
    const observer=new ResizeObserver(resize); observer.observe(host);
    const runtimes=dice.map((die,index)=>buildDie(scene,world,dieMaterial,bounds,die,index,dice.length,cinematic));

    const start=performance.now();
    let last=start;
    let frame=0;
    let raf=0;
    let resolvedNotified=false;
    const up=new THREE.Vector3(0,1,0);
    const animate=(now:number)=>{
      const dt=Math.min(.04,(now-last)/1000); last=now;
      const elapsed=now-start;
      if (!reducedMotion) world.step(1/60,dt,5);
      runtimes.forEach((runtime,index)=>{
        const guidanceAt=reducedMotion?0:cinematic?GUIDANCE_START_MS:compact?500:900;
        const lockAt=reducedMotion?0:cinematic?CONVERGENCE_LOCK_MS:compact?760:1250;
        const duration=reducedMotion?180:cinematic?CONVERGENCE_DURATION_MS:260;
        const stagger=reducedMotion?0:index*CONVERGENCE_STAGGER_MS;
        const runtimeGuidanceAt=guidanceAt+stagger;
        const runtimeLockAt=lockAt+stagger;

        if (!runtime.displayStartQuaternion) {
          runtime.mesh.position.set(runtime.body.position.x,runtime.body.position.y,runtime.body.position.z);
          runtime.mesh.quaternion.set(runtime.body.quaternion.x,runtime.body.quaternion.y,runtime.body.quaternion.z,runtime.body.quaternion.w);
        }

        if (cinematic&&!reducedMotion&&!runtime.enteredTable&&runtime.body.position.z<=bounds.maxZ-CAMERA_LAUNCH_GATE) {
          runtime.enteredTable=true;
          runtime.body.collisionFilterMask=SURFACE_GROUP|DICE_GROUP;
          runtime.body.wakeUp();
        }

        if (cinematic) {
          const launchProgress=reducedMotion?1:Math.min(1,Math.max(0,elapsed/CAMERA_LAUNCH_SCALE_MS));
          const launchEase=launchProgress*launchProgress*(3-2*launchProgress);
          runtime.mesh.scale.setScalar(CAMERA_LAUNCH_SCALE+(1-CAMERA_LAUNCH_SCALE)*launchEase);
        }

        if (reducedMotion) {
          const centeredX=(index-(runtimes.length-1)/2)*1.35;
          runtime.mesh.position.set(centeredX,FLOOR_Y+.95,bounds.focusZ);
        }

        if (elapsed>=runtimeGuidanceAt && !runtime.guidanceQuaternion) {
          const normal=runtime.faceNormals[runtime.desiredIndex]??new THREE.Vector3(0,1,0);
          const worldNormal=normal.clone().applyQuaternion(runtime.mesh.quaternion).normalize();
          const correction=new THREE.Quaternion().setFromUnitVectors(worldNormal,up);
          runtime.guidanceQuaternion=correction.multiply(runtime.mesh.quaternion.clone()).normalize();
        }

        if (!reducedMotion&&elapsed>=runtimeGuidanceAt&&elapsed<runtimeLockAt&&runtime.guidanceQuaternion) {
          runtime.body.linearDamping=Math.max(PRODUCT_PHYSICS.linearDamping,.3);
          runtime.body.angularDamping=Math.max(PRODUCT_PHYSICS.angularDamping,.36);
          const current=new THREE.Quaternion(runtime.body.quaternion.x,runtime.body.quaternion.y,runtime.body.quaternion.z,runtime.body.quaternion.w);
          const error=runtime.guidanceQuaternion.clone().multiply(current.invert()).normalize();
          if (error.w<0) error.set(-error.x,-error.y,-error.z,-error.w);
          const halfSin=Math.sqrt(error.x*error.x+error.y*error.y+error.z*error.z);
          if (halfSin>1e-4) {
            const angle=2*Math.atan2(halfSin,Math.max(1e-4,error.w));
            const speed=Math.min(9,angle*7.5);
            const desiredX=error.x/halfSin*speed;
            const desiredY=error.y/halfSin*speed;
            const desiredZ=error.z/halfSin*speed;
            runtime.body.angularVelocity.x+=(desiredX-runtime.body.angularVelocity.x)*.2;
            runtime.body.angularVelocity.y+=(desiredY-runtime.body.angularVelocity.y)*.2;
            runtime.body.angularVelocity.z+=(desiredZ-runtime.body.angularVelocity.z)*.2;
            runtime.body.wakeUp();
          }
        }

        if (elapsed>=runtimeLockAt&&runtime.guidanceQuaternion&&!runtime.displayStartQuaternion) {
          runtime.displayStartQuaternion=runtime.mesh.quaternion.clone();
          runtime.body.velocity.setZero(); runtime.body.angularVelocity.setZero();
          runtime.body.quaternion.set(runtime.guidanceQuaternion.x,runtime.guidanceQuaternion.y,runtime.guidanceQuaternion.z,runtime.guidanceQuaternion.w);
          runtime.body.collisionFilterMask=0;
          runtime.body.sleep();
        }

        if (runtime.displayStartQuaternion&&runtime.guidanceQuaternion) {
          const rawProgress=Math.min(1,Math.max(0,(elapsed-runtimeLockAt)/duration));
          const eased=rawProgress*rawProgress*(3-2*rawProgress);
          runtime.convergenceProgress=rawProgress;
          runtime.mesh.quaternion.slerpQuaternions(runtime.displayStartQuaternion,runtime.guidanceQuaternion,eased);
          runtime.resolved=rawProgress>=1;
        }
      });
      if (!resolvedNotified&&runtimes.every((runtime)=>runtime.resolved)) {
        resolvedNotified=true;
        onResolvedRef.current?.();
      }
      renderer.render(scene,camera);
      frame++;
      const renderUntil=reducedMotion?520:cinematic?1460:2350;
      if (elapsed<renderUntil||frame<3) raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);
    return ()=>{
      cancelAnimationFrame(raf); observer.disconnect();
      runtimes.forEach((runtime)=>{world.removeBody(runtime.body);cleanupGroup(runtime.mesh);scene.remove(runtime.mesh);});
      removeWalls(); world.removeBody(floorBody); floorMesh.geometry.dispose(); (floorMesh.material as THREE.Material).dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  },[dice,compact,reducedMotion,cinematic]);
  return <div ref={hostRef} className={`physics-dice-canvas ${compact?"compact":""} ${cinematic?"cinematic":""} ${className}`.trim()} role="img" aria-label={dice.map((die)=>`d${die.sides} ${die.value}`).join(", ")}/>;
}
