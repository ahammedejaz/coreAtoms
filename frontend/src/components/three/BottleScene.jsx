/**
 * BottleScene.jsx — The Core Atoms jar in three dimensions: the cap
 * unscrews and swings aside, tablets pour through the neck and settle in
 * layers behind smoked glass, and the cap screws back on. The label is
 * drawn from the product's own name and category (see labelTexture.js), so
 * every formula gets its own bottle even though the catalogue has two
 * photographs.
 *
 * Nothing spins for effect. The jar leans a few degrees toward the pointer
 * and floats on a slow breath; that is all. The sequence itself is pure
 * maths in sequence.js and can run on a clock (`driver.mode = "auto"`) or
 * follow a scroll value (`driver.mode = "value"`).
 *
 * The scene is heavy enough (transmission, contact shadows, an environment
 * map) that it is only mounted on desktop with WebGL, loads as its own
 * chunk, and stops rendering while it is off screen.
 *
 * @param {{ product?: object, driver?: { mode: "auto"|"value", delay?: number, duration?: number, replayKey?: number, value?: { get: () => number } }, className?: string, mouse?: boolean, shadow?: boolean, spilled?: boolean }} props
 * @module components/three/BottleScene
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { buildLabelTexture } from "./labelTexture";
import { BODY_HEIGHT, restPositions, capPose, pillPose, accentFor, formFor } from "./sequence";

const PILL_COUNT = 90;

/* ── Geometry, built once per page ──────────────────────────────────── */
const lathe = (pts, segs = 72) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);

let GEO = null;
function geometries() {
  if (GEO) return GEO;
  GEO = {
    body: lathe([[0, 0], [0.84, 0], [0.95, 0.04], [1, 0.14], [1, 2.02], [0.975, 2.13], [0.9, 2.2], [0.82, 2.25], [0.8, BODY_HEIGHT]]),
    cap: lathe([[0, 0], [1.04, 0], [1.04, 0.44], [1.015, 0.52], [0.93, 0.57], [0.6, 0.58], [0, 0.58]], 72),
    label: new THREE.CylinderGeometry(1.008, 1.008, 1.05, 96, 1, true),
    capsule: new THREE.CapsuleGeometry(0.1, 0.2, 5, 14),
    tablet: lathe([[0, -0.032], [0.1, -0.032], [0.15, -0.016], [0.165, 0], [0.15, 0.016], [0.1, 0.032], [0, 0.032]], 28),
  };
  return GEO;
}

function twoToneTexture(accent) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4efe6"; ctx.fillRect(0, 0, 4, 64);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 4, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── The jar ─────────────────────────────────────────────────────────── */
function Jar({ product, driver, mouse, spilled }) {
  const group = useRef(null);
  const cap = useRef(null);
  const pillRefs = useRef([]);
  const [labelMap, setLabelMap] = useState(null);
  const geo = geometries();
  const form = formFor(product);
  const accent = accentFor(product?.category, product?.name);

  useEffect(() => {
    let on = true;
    buildLabelTexture(product).then((t) => { if (on) setLabelMap(t); });
    return () => { on = false; };
  }, [product]);

  const rest = useMemo(() => restPositions(PILL_COUNT, 11, form === "tablet" ? 0.25 : 0.22, form === "tablet" ? 8 : 9, form === "tablet" ? 0.16 : 0.19), [form]);
  const pillMaterial = useMemo(() => (
    form === "tablet"
      ? new THREE.MeshStandardMaterial({ color: "#f1ebe0", roughness: 0.78, metalness: 0 })
      : new THREE.MeshPhysicalMaterial({ map: twoToneTexture(accent), roughness: 0.28, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.1 })
  ), [form, accent]);
  useEffect(() => () => { pillMaterial.map?.dispose?.(); pillMaterial.dispose(); }, [pillMaterial]);

  const startRef = useRef(null);
  const replayRef = useRef(driver?.replayKey);
  const pointer = useRef({ x: 0, y: 0 });
  const lean = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mouse) return;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mouse]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    let p;
    if (spilled) {
      p = 1;
    } else if (driver?.mode === "value" && driver.value) {
      p = Math.min(1, Math.max(0, Number(driver.value.get?.() ?? driver.value) || 0));
    } else {
      if (startRef.current === null || replayRef.current !== driver?.replayKey) {
        startRef.current = t;
        replayRef.current = driver?.replayKey;
      }
      const delay = (driver?.delay ?? 900) / 1000;
      const dur = (driver?.duration ?? 5600) / 1000;
      p = Math.min(1, Math.max(0, (t - startRef.current - delay) / dur));
    }

    // Cap
    if (cap.current) {
      if (spilled) {
        cap.current.position.set(1.9, 0.29, 0.9);
        cap.current.rotation.set(Math.PI / 2, 0.4, 0.3);
      } else {
        const c = capPose(p);
        cap.current.position.set(c.x, c.y, c.z);
        cap.current.rotation.set(c.rx, c.ry, c.rz);
      }
    }

    // Tablets
    for (let i = 0; i < PILL_COUNT; i++) {
      const m = pillRefs.current[i];
      if (!m) continue;
      const r = rest[i];
      let pose;
      if (spilled) {
        // Scattered across the floor in front of the fallen jar.
        const a = (i / PILL_COUNT) * Math.PI * 2 * 3.7;
        const d = 0.6 + (i % 9) * 0.22;
        pose = { x: Math.cos(a) * d + 0.4, y: 0.04, z: Math.sin(a) * d * 0.6 + 1.1, rx: Math.PI / 2, ry: r.ry, rz: 0, scale: i % 3 === 0 ? 0 : 1 };
      } else {
        pose = pillPose(r, p);
      }
      m.position.set(pose.x, pose.y, pose.z);
      m.rotation.set(pose.rx, pose.ry, pose.rz);
      m.visible = pose.scale > 0;
      m.scale.setScalar(pose.scale || 1);
    }

    // The whole jar: a slow breath and a lean toward the pointer.
    if (group.current) {
      if (spilled) {
        group.current.rotation.set(0, 0.3, -Math.PI / 2 + 0.06);
        group.current.position.set(-0.3, 1.0, 0);
      } else {
        lean.current.x += ((mouse ? pointer.current.x : 0) * 0.26 - lean.current.x) * 0.05;
        lean.current.y += ((mouse ? pointer.current.y : 0) * 0.08 - lean.current.y) * 0.05;
        group.current.rotation.y = lean.current.x + Math.sin(t * 0.35) * 0.04;
        group.current.rotation.x = lean.current.y;
        group.current.position.y = Math.sin(t * 1.1) * 0.025;
      }
    }
  });

  return (
    <group ref={group}>
      {/* Smoked glass body. Plain alpha blending rather than transmission:
          it shows the tablets inside on every renderer and costs nothing. */}
      <mesh geometry={geo.body} renderOrder={2} castShadow>
        <meshPhysicalMaterial
          color="#0f1522"
          transparent
          opacity={0.6}
          depthWrite={false}
          roughness={0.14}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Label wrap */}
      <mesh geometry={geo.label} position={[0, 1.03, 0]} rotation={[0, Math.PI, 0]}>
        {labelMap
          ? <meshStandardMaterial key="labelled" map={labelMap} roughness={0.62} metalness={0} side={THREE.DoubleSide} />
          : <meshStandardMaterial key="plain" color="#0b0e15" roughness={0.62} metalness={0} side={THREE.DoubleSide} />}
      </mesh>

      {/* Cap */}
      <mesh ref={cap} geometry={geo.cap} position={[0, BODY_HEIGHT, 0]} castShadow>
        <meshPhysicalMaterial color="#0c0f16" roughness={0.4} metalness={0.12} clearcoat={0.55} clearcoatRoughness={0.22} envMapIntensity={0.9} />
      </mesh>

      {/* Tablets */}
      <group frustumCulled={false}>
        {rest.map((_, i) => (
          <mesh
            key={i}
            ref={(el) => { pillRefs.current[i] = el; }}
            geometry={form === "tablet" ? geo.tablet : geo.capsule}
            material={pillMaterial}
            frustumCulled={false}
            renderOrder={1}
            castShadow
          />
        ))}
      </group>
    </group>
  );
}

/** Aims the camera at the middle of the jar once. */
function Rig() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 1.55, 0); }, [camera]);
  return null;
}

export default function BottleScene({ product, driver, className = "", mouse = true, shadow = true, spilled = false }) {
  const hostRef = useRef(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={className}>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 2.1, 10], fov: 30, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={active ? "always" : "never"}
        resize={{ scroll: false }}
        style={{ background: "transparent" }}
      >
        <Rig />
        <ambientLight intensity={0.5} color="#fff3e2" />
        <directionalLight position={[3.5, 6, 4]} intensity={2.1} color="#fff7ec" />
        <directionalLight position={[-4, 3, 2.5]} intensity={0.6} color="#dbe7ff" />
        <pointLight position={[-2.6, 3.4, -3.2]} intensity={32} color="#f59e0b" distance={14} decay={2} />
        <Environment resolution={128}>
          <Lightformer intensity={2.4} rotation-x={Math.PI / 2} position={[0, 5, -1.5]} scale={[9, 9, 1]} color="#ffffff" />
          <Lightformer intensity={1.1} rotation-y={Math.PI / 2} position={[-6, 2, 0]} scale={[6, 3, 1]} color="#ffe2bd" />
          <Lightformer intensity={0.7} rotation-y={-Math.PI / 2} position={[6, 2, 0]} scale={[6, 3, 1]} color="#cfe0ff" />
        </Environment>
        <Jar product={product} driver={driver} mouse={mouse} spilled={spilled} />
        {shadow && <ContactShadows position={[0, 0.002, 0]} opacity={0.62} scale={7.5} blur={2.2} far={2.6} resolution={256} color="#08132a" />}
      </Canvas>
    </div>
  );
}
