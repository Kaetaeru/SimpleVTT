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
  targetQuaternion:THREE.Quaternion|null;
};

const DEMO_BRONZE="#c77d38";
const DEMO_NUMBER="#f7dfae";

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
    indices.push(0,current,next);
    indices.push(1,next,current);
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

function uniqueFaceNormals(source:THREE.BufferGeometry,sides:number) {
  const geometry=source.toNonIndexed();
  const position=geometry.getAttribute("position");
  const normals:THREE.Vector3[]=[];
  for (let i=0;i<position.count;i+=3) {
    const a=new THREE.Vector3().fromBufferAttribute(position,i);
    const b=new THREE.Vector3().fromBufferAttribute(position,i+1);
    const c=new THREE.Vector3().fromBufferAttribute(position,i+2);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (!normals.some((candidate)=>candidate.dot(normal)>.994)) normals.push(normal);
  }
  geometry.dispose();
  return normals.slice(0,sides);
}

function cannonShape(source:THREE.BufferGeometry) {
  const geometry=mergeVertices(source.clone(),1e-4);
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
  canvas.width=128; canvas.height=128;
  const context=canvas.getContext("2d")!;
  context.clearRect(0,0,128,128);
  context.font="800 52px Georgia, serif";
  context.textAlign="center"; context.textBaseline="middle";
  context.lineJoin="round";
  context.lineWidth=8;
  context.strokeStyle="rgba(22,12,6,.82)";
  context.strokeText(String(value),64,67);
  context.fillStyle=DEMO_NUMBER;
  context.fillText(String(value),64,67);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function buildDie(scene:THREE.Scene,world:CANNON.World,die:PhysicsDie,index:number,total:number,cinematic:boolean):DieRuntime {
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

  const faceNormals=uniqueFaceNormals(geometry,die.sides);
  faceNormals.forEach((normal,faceIndex)=>{
    const texture=numberTexture(faceIndex+1);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false}));
    sprite.position.copy(normal).multiplyScalar(die.sides===6?.66:.82);
    sprite.scale.set(.38,.38,.38);
    group.add(sprite);
  });

  const spacing=cinematic?1.45:1.85;
  const x=(index-(total-1)/2)*spacing;
  if (cinematic) group.position.set(x*.55,.75+index*.09,-8.4-index*.36);
  else group.position.set(x,3.4+index*.24,(index%2?-.3:.3));
  scene.add(group);

  const body=new CANNON.Body({mass:1.1,shape:cannonShape(geometry),linearDamping:cinematic?.10:.14,angularDamping:cinematic?.10:.08});
  body.position.set(group.position.x,group.position.y,group.position.z);
  if (cinematic) {
    body.velocity.set((Math.random()-.5)*2.8,-.5-Math.random()*.8,10.4+Math.random()*2.4);
    body.angularVelocity.set((Math.random()>.5?1:-1)*(18+Math.random()*9),(Math.random()>.5?1:-1)*(17+Math.random()*10),(Math.random()>.5?1:-1)*(16+Math.random()*9));
  } else {
    body.velocity.set((Math.random()-.5)*2.4,-.4,(Math.random()-.5)*2.2);
    body.angularVelocity.set(8+Math.random()*8,7+Math.random()*10,6+Math.random()*9);
  }
  body.quaternion.setFromEuler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  world.addBody(body);
  return {mesh:group,body,faceNormals,desiredIndex:Math.max(0,Math.min(faceNormals.length-1,die.value-1)),targetQuaternion:null};
}

function cleanupGroup(group:THREE.Group) {
  group.traverse((node:THREE.Object3D)=>{
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      const materials:THREE.Material[]=Array.isArray(node.material)?node.material:[node.material];
      materials.forEach((material:THREE.Material)=>material.dispose());
    }
    if (node instanceof THREE.Sprite) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
}

export function PhysicsDice3D({dice,compact=false,reducedMotion=false,cinematic=false,className=""}:{dice:PhysicsDie[];compact?:boolean;reducedMotion?:boolean;cinematic?:boolean;className?:string}) {
  const hostRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const host=hostRef.current;
    if (!host||!dice.length) return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000,0);
    host.replaceChildren(renderer.domElement);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(cinematic?38:34,1,.1,100);
    if (cinematic) {
      camera.position.set(0,3.15,8.9);
      camera.lookAt(0,-.45,-1.15);
    } else {
      camera.position.set(0,5.4,compact?8.6:9.8);
      camera.lookAt(0,.7,0);
    }
    scene.add(new THREE.HemisphereLight(0xffead0,0x18202a,2.15));
    const key=new THREE.DirectionalLight(0xffd39a,3.4); key.position.set(-4,7,5); key.castShadow=true; scene.add(key);
    const rim=new THREE.DirectionalLight(0x6f86ad,1.25); rim.position.set(5,3,-4); scene.add(rim);

    const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(40,30),new THREE.MeshStandardMaterial({color:0x0c1119,roughness:.78,metalness:.05,transparent:true,opacity:cinematic?.08:.96}));
    floorMesh.rotation.x=-Math.PI/2; floorMesh.position.y=-1.05; floorMesh.receiveShadow=true; scene.add(floorMesh);

    const world=new CANNON.World({gravity:new CANNON.Vec3(0,cinematic?-16.5:-18.5,0)});
    world.allowSleep=true;
    const dieMaterial=new CANNON.Material("dice");
    const floorMaterial=new CANNON.Material("floor");
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,floorMaterial,{friction:cinematic?.42:.34,restitution:cinematic?.30:.42}));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,dieMaterial,{friction:.28,restitution:cinematic?.26:.36}));
    const floorBody=new CANNON.Body({mass:0,material:floorMaterial,shape:new CANNON.Plane()});
    floorBody.quaternion.setFromEuler(-Math.PI/2,0,0); floorBody.position.y=-1.05; world.addBody(floorBody);

    const runtimes=dice.map((die,index)=>buildDie(scene,world,die,index,dice.length,cinematic));
    runtimes.forEach((runtime)=>runtime.body.material=dieMaterial);
    const resize=()=>{
      const rect=host.getBoundingClientRect();
      const width=Math.max(1,Math.round(rect.width));
      const height=Math.max(1,Math.round(rect.height));
      renderer.setSize(width,height,false);
      camera.aspect=width/height; camera.updateProjectionMatrix();
    };
    resize();
    const observer=new ResizeObserver(resize); observer.observe(host);

    const start=performance.now();
    let last=start;
    let frame=0;
    let raf=0;
    const up=new THREE.Vector3(0,1,0);
    const animate=(now:number)=>{
      const dt=Math.min(.04,(now-last)/1000); last=now;
      const elapsed=now-start;
      if (!reducedMotion) world.step(1/60,dt,4);
      runtimes.forEach((runtime)=>{
        if (!runtime.targetQuaternion) {
          runtime.mesh.position.set(runtime.body.position.x,runtime.body.position.y,runtime.body.position.z);
          runtime.mesh.quaternion.set(runtime.body.quaternion.x,runtime.body.quaternion.y,runtime.body.quaternion.z,runtime.body.quaternion.w);
        }
        const settleAt=reducedMotion?0:cinematic?960:1250;
        if (elapsed>=settleAt && !runtime.targetQuaternion) {
          const normal=runtime.faceNormals[runtime.desiredIndex]??new THREE.Vector3(0,1,0);
          const worldNormal=normal.clone().applyQuaternion(runtime.mesh.quaternion).normalize();
          const correction=new THREE.Quaternion().setFromUnitVectors(worldNormal,up);
          runtime.targetQuaternion=correction.multiply(runtime.mesh.quaternion.clone()).normalize();
          runtime.body.velocity.setZero(); runtime.body.angularVelocity.setZero(); runtime.body.sleep();
        }
        if (runtime.targetQuaternion) runtime.mesh.quaternion.slerp(runtime.targetQuaternion,reducedMotion?1:cinematic?.28:.105);
      });
      renderer.render(scene,camera);
      frame++;
      const renderUntil=reducedMotion?520:cinematic?1450:2350;
      if (elapsed<renderUntil||frame<3) raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);
    return ()=>{
      cancelAnimationFrame(raf); observer.disconnect();
      runtimes.forEach((runtime)=>{world.removeBody(runtime.body);cleanupGroup(runtime.mesh);scene.remove(runtime.mesh);});
      world.removeBody(floorBody); floorMesh.geometry.dispose(); (floorMesh.material as THREE.Material).dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  },[dice,compact,reducedMotion,cinematic]);
  return <div ref={hostRef} className={`physics-dice-canvas ${compact?"compact":""} ${cinematic?"cinematic":""} ${className}`.trim()} role="img" aria-label={dice.map((die)=>`d${die.sides} ${die.value}`).join(", ")}/>;
}
