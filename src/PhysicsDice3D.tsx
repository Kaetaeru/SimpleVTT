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

function dieGeometry(sides:PhysicsDie["sides"]) {
  if (sides===4) return new THREE.TetrahedronGeometry(.82,0);
  if (sides===6) return new THREE.BoxGeometry(1.25,1.25,1.25,1,1,1);
  if (sides===8) return new THREE.OctahedronGeometry(.9,0);
  if (sides===10) return new THREE.CylinderGeometry(.78,.78,1.22,10,1,false,Math.PI/10);
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
    if (sides===10 && Math.abs(normal.y)>.72) continue;
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
  context.fillStyle="rgba(12,14,18,.88)";
  context.beginPath(); context.arc(64,64,35,0,Math.PI*2); context.fill();
  context.strokeStyle="rgba(255,255,255,.45)"; context.lineWidth=3; context.stroke();
  context.fillStyle="#fff";
  context.font="700 48px Georgia, serif";
  context.textAlign="center"; context.textBaseline="middle";
  context.fillText(String(value),64,67);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function buildDie(scene:THREE.Scene,world:CANNON.World,die:PhysicsDie,index:number,total:number):DieRuntime {
  const geometry=dieGeometry(die.sides);
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({
    color:new THREE.Color("#262d38"),
    roughness:.42,
    metalness:.18,
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
    sprite.scale.set(.42,.42,.42);
    group.add(sprite);
  });

  const spacing=1.85;
  const x=(index-(total-1)/2)*spacing;
  group.position.set(x,3.4+index*.24,(index%2?-.3:.3));
  scene.add(group);

  const body=new CANNON.Body({mass:1.1,shape:cannonShape(geometry),linearDamping:.14,angularDamping:.08});
  body.position.set(group.position.x,group.position.y,group.position.z);
  body.velocity.set((Math.random()-.5)*2.4,-.4,(Math.random()-.5)*2.2);
  body.angularVelocity.set(8+Math.random()*8,7+Math.random()*10,6+Math.random()*9);
  body.quaternion.setFromEuler(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  world.addBody(body);
  return {mesh:group,body,faceNormals,desiredIndex:Math.max(0,Math.min(faceNormals.length-1,die.value-1)),targetQuaternion:null};
}

function cleanupGroup(group:THREE.Group) {
  group.traverse((node)=>{
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      const materials=Array.isArray(node.material)?node.material:[node.material];
      materials.forEach((material)=>material.dispose());
    }
    if (node instanceof THREE.Sprite) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
}

export function PhysicsDice3D({dice,compact=false,reducedMotion=false,className=""}:{dice:PhysicsDie[];compact?:boolean;reducedMotion?:boolean;className?:string}) {
  const hostRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const host=hostRef.current;
    if (!host||!dice.length) return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,5.4,compact?8.6:9.8);
    camera.lookAt(0,.7,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x18202a,2.15));
    const key=new THREE.DirectionalLight(0xffffff,3.2); key.position.set(-4,7,5); key.castShadow=true; scene.add(key);

    const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(40,24),new THREE.MeshStandardMaterial({color:0x10151d,roughness:.78,metalness:.05,transparent:true,opacity:.96}));
    floorMesh.rotation.x=-Math.PI/2; floorMesh.position.y=-1.05; floorMesh.receiveShadow=true; scene.add(floorMesh);

    const world=new CANNON.World({gravity:new CANNON.Vec3(0,-18.5,0)});
    world.allowSleep=true;
    const dieMaterial=new CANNON.Material("dice");
    const floorMaterial=new CANNON.Material("floor");
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,floorMaterial,{friction:.34,restitution:.42}));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial,dieMaterial,{friction:.28,restitution:.36}));
    const floorBody=new CANNON.Body({mass:0,material:floorMaterial,shape:new CANNON.Plane()});
    floorBody.quaternion.setFromEuler(-Math.PI/2,0,0); floorBody.position.y=-1.05; world.addBody(floorBody);

    const runtimes=dice.map((die,index)=>buildDie(scene,world,die,index,dice.length));
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
        const settleAt=reducedMotion?0:1250;
        if (elapsed>=settleAt && !runtime.targetQuaternion) {
          const normal=runtime.faceNormals[runtime.desiredIndex]??new THREE.Vector3(0,1,0);
          const worldNormal=normal.clone().applyQuaternion(runtime.mesh.quaternion).normalize();
          const correction=new THREE.Quaternion().setFromUnitVectors(worldNormal,up);
          runtime.targetQuaternion=correction.multiply(runtime.mesh.quaternion.clone()).normalize();
          runtime.body.velocity.setZero(); runtime.body.angularVelocity.setZero(); runtime.body.sleep();
        }
        if (runtime.targetQuaternion) runtime.mesh.quaternion.slerp(runtime.targetQuaternion,reducedMotion?1:.105);
      });
      renderer.render(scene,camera);
      frame++;
      if (elapsed<(reducedMotion?700:2350)||frame<3) raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);
    return ()=>{
      cancelAnimationFrame(raf); observer.disconnect();
      runtimes.forEach((runtime)=>{world.removeBody(runtime.body);cleanupGroup(runtime.mesh);scene.remove(runtime.mesh);});
      world.removeBody(floorBody); floorMesh.geometry.dispose(); (floorMesh.material as THREE.Material).dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  },[dice,compact,reducedMotion]);
  return <div ref={hostRef} className={`physics-dice-canvas ${compact?"compact":""} ${className}`.trim()} role="img" aria-label={dice.map((die)=>`d${die.sides} ${die.value}`).join(", ")}/>;
}
