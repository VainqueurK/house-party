"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Html, Sparkles, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  PHASE_LENGTHS,
  type PalermoPlayer,
  type PalermoState,
} from "../lib/palermo";

type Quality = "cinematic" | "performance";

const ASSET = "/assets/kenney-graveyard";
const CHARACTER_ASSET = "/assets/kenney-mini-characters";
const CHARACTER_VARIANTS = [
  "character-female-a",
  "character-male-a",
  "character-female-b",
  "character-male-c",
  "character-female-d",
  "character-male-b",
  "character-female-e",
  "character-male-f",
  "character-female-c",
  "character-male-d",
  "character-female-f",
  "character-male-e",
];

function Asset({
  name,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(`${ASSET}/${name}.glb`);
  const clone = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);
  return (
    <primitive
      object={clone}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}

function House({
  position,
  rotation = 0,
  color,
  tall = false,
}: {
  position: [number, number, number];
  rotation?: number;
  color: string;
  tall?: boolean;
}) {
  const height = tall ? 3.7 : 2.8;
  const shutter = color === "#b88071" ? "#315c64" : "#486d69";
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow receiveShadow position-y={height / 2}>
        <boxGeometry args={[3.2, height, 2.5]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh castShadow position-y={height + 0.65} rotation-y={Math.PI / 4}>
        <coneGeometry args={[2.45, 1.35, 4]} />
        <meshStandardMaterial color="#8f3f36" roughness={1} />
      </mesh>
      {[
        [-0.85, 1.25],
        [0.85, 1.25],
        [-0.85, 2.35],
        [0.85, 2.35],
      ].map(([x, y], index) => (
        <group key={index} position={[x, Math.min(y, height - 0.45), 1.275]}>
          <mesh>
            <boxGeometry args={[0.52, 0.68, 0.05]} />
            <meshStandardMaterial
              color="#ffd780"
              emissive="#e9a94b"
              emissiveIntensity={0.9}
            />
          </mesh>
          <mesh position={[-0.36, 0, 0.025]} rotation-y={-0.14}>
            <boxGeometry args={[0.17, 0.72, 0.07]} />
            <meshStandardMaterial color={shutter} roughness={0.9} />
          </mesh>
          <mesh position={[0.36, 0, 0.025]} rotation-y={0.14}>
            <boxGeometry args={[0.17, 0.72, 0.07]} />
            <meshStandardMaterial color={shutter} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, height - 0.48, 1.42]} castShadow>
        <boxGeometry args={[1.72, 0.13, 0.58]} />
        <meshStandardMaterial color="#d1b298" roughness={0.9} />
      </mesh>
      {[-0.76, -0.38, 0, 0.38, 0.76].map((x) => (
        <mesh key={x} position={[x, height - 0.2, 1.66]}>
          <boxGeometry args={[0.035, 0.54, 0.035]} />
          <meshStandardMaterial color="#2d343c" metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.04, 1.66]}>
        <boxGeometry args={[1.62, 0.035, 0.035]} />
        <meshStandardMaterial color="#2d343c" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.85, 1.27]}>
        <planeGeometry args={[0.7, 1.65]} />
        <meshStandardMaterial color="#49332d" />
      </mesh>
      <mesh position={[0, 1.72, 1.55]} rotation-x={-0.18} castShadow>
        <boxGeometry args={[1.6, 0.06, 0.8]} />
        <meshStandardMaterial color="#efe0bd" roughness={1} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0.23, 1.48]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.19, 0.38, 10]} />
            <meshStandardMaterial color="#a84e39" roughness={1} />
          </mesh>
          <mesh position-y={0.34}>
            <sphereGeometry args={[0.26, 10, 8]} />
            <meshStandardMaterial color="#3f7956" roughness={1} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.08, 1.3]} receiveShadow>
        <boxGeometry args={[2.8, 0.15, 0.46]} />
        <meshStandardMaterial color="#a78a72" roughness={1} />
      </mesh>
    </group>
  );
}

function Fountain() {
  return (
    <group position={[0, 0, 0]}>
      <mesh receiveShadow position-y={0.22}>
        <cylinderGeometry args={[1.35, 1.55, 0.45, 24]} />
        <meshStandardMaterial color="#8aa0a0" roughness={0.86} />
      </mesh>
      <mesh position-y={0.47}>
        <cylinderGeometry args={[1.1, 1.1, 0.18, 24]} />
        <meshStandardMaterial
          color="#335c69"
          metalness={0.12}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position-y={1.15}>
        <cylinderGeometry args={[0.16, 0.28, 1.4, 12]} />
        <meshStandardMaterial color="#9bada9" />
      </mesh>
      <mesh castShadow position-y={1.82}>
        <sphereGeometry args={[0.33, 16, 10]} />
        <meshStandardMaterial color="#c4b7a2" />
      </mesh>
    </group>
  );
}

function playerPosition(
  index: number,
  count: number,
): [number, number, number] {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * 3.9, 0, Math.sin(angle) * 3.2];
}

function homePosition(index: number, count: number): [number, number, number] {
  const homes: [number, number, number][] = [
    [-6.85, 0, -3.05],
    [-4.05, 0, -5.85],
    [-0.35, 0, -6.25],
    [3.25, 0, -5.95],
    [6.35, 0, -4.15],
    [-6.9, 0, -0.15],
  ];
  return homes[index % Math.min(homes.length, Math.max(count, 1))];
}

function AnimatedResident({
  variant,
  mode,
  progress,
}: {
  variant: string;
  mode: "idle" | "walk" | "die" | "eject";
  progress: number;
}) {
  const { scene, animations } = useGLTF(`${CHARACTER_ASSET}/${variant}.glb`);
  const character = useMemo(() => {
    const copy = cloneSkeleton(scene);
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);
  const { actions } = useAnimations(animations, character);

  useEffect(() => {
    Object.values(actions).forEach((action) => action?.stop());
    const name =
      mode === "walk"
        ? "walk"
        : mode === "die"
          ? "die"
          : mode === "eject"
            ? "emote-no"
            : "idle";
    const action = actions[name];
    if (!action) return;
    action.reset().fadeIn(0.16).play();
    if (mode === "die") {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.paused = true;
    }
    return () => {
      action.fadeOut(0.12);
    };
  }, [actions, mode]);

  useFrame(() => {
    const death = actions.die;
    if (mode === "die" && death) {
      death.paused = true;
      death.time =
        death.getClip().duration *
        THREE.MathUtils.smoothstep(progress, 0.18, 0.62);
    }
  });

  return <primitive object={character} scale={2.65} />;
}

function Resident({
  player,
  index,
  count,
  state,
  progress,
}: {
  player: PalermoPlayer;
  index: number;
  count: number;
  state: PalermoState;
  progress: number;
}) {
  const group = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  const position = playerPosition(index, count);
  const home = homePosition(index, count);
  const isNightTarget =
    state.phase === "night-result" &&
    state.cinematic?.kind === "night" &&
    state.cinematic.attackedId === player.id;
  const isCinematicTarget =
    state.phase === "night-result" &&
    state.cinematic?.kind === "night" &&
    state.cinematic.killedId === player.id;
  const isVoteTarget =
    state.phase === "vote-result" &&
    state.cinematic?.kind === "vote" &&
    state.cinematic.eliminatedId === player.id;
  const showResident =
    (player.alive &&
      (state.phase !== "night-result" || isNightTarget) &&
      (state.phase !== "night" || progress < 0.82)) ||
    isCinematicTarget ||
    isVoteTarget;
  useFrame((_, delta) => {
    if (!group.current) return;
    const goingHome = state.phase === "night";
    const atHome = state.phase === "night-result" && isNightTarget;
    const walk = goingHome
      ? THREE.MathUtils.smoothstep(progress, 0.05, 0.72)
      : atHome
        ? 1
        : 0;
    const eject = isVoteTarget
      ? THREE.MathUtils.smoothstep(progress, 0.08, 0.38)
      : 0;
    const desiredX = THREE.MathUtils.lerp(position[0], home[0], walk);
    const desiredZ = THREE.MathUtils.lerp(position[2], home[2], walk);
    if (!initialized.current) {
      group.current.position.set(desiredX, eject * 7.5, desiredZ);
      group.current.rotation.y = Math.atan2(-position[0], -position[2]);
      initialized.current = true;
    }
    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      THREE.MathUtils.lerp(desiredX, 0, eject),
      8,
      delta,
    );
    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z,
      THREE.MathUtils.lerp(desiredZ, 0, eject),
      8,
      delta,
    );
    group.current.rotation.z = Math.sin(eject * Math.PI * 5) * eject * 0.32;
    if (eject > 0) group.current.rotation.y += eject * delta * 6;
    else
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        Math.atan2(-position[0], -position[2]),
        7,
        delta,
      );
    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      eject * 5.2,
      7,
      delta,
    );
    group.current.visible = showResident;
  });
  const animationMode = isCinematicTarget
    ? "die"
    : isVoteTarget
      ? "eject"
      : state.phase === "night"
        ? "walk"
        : "idle";
  return (
    <group ref={group}>
      <AnimatedResident
        variant={CHARACTER_VARIANTS[index % CHARACTER_VARIANTS.length]}
        mode={animationMode}
        progress={progress}
      />
      {showResident && (
        <Html
          center
          position={[0, 2.35, 0]}
          distanceFactor={9}
          style={{ pointerEvents: "none" }}
        >
          <div className="resident-label">
            <span>{player.emoji}</span>
            {player.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function ShadowFigure({
  state,
  progress,
}: {
  state: PalermoState;
  progress: number;
}) {
  const group = useRef<THREE.Group>(null);
  const targetIndex = state.players.findIndex(
    (player) =>
      player.id ===
      (state.cinematic?.kind === "night"
        ? state.cinematic.attackedId
        : undefined),
  );
  const target = homePosition(Math.max(0, targetIndex), state.players.length);
  useFrame(() => {
    if (!group.current) return;
    const approach = THREE.MathUtils.smoothstep(progress, 0.02, 0.38);
    const retreat =
      state.cinematic?.kind === "night" && state.cinematic.protected
        ? THREE.MathUtils.smoothstep(progress, 0.4, 0.85)
        : 0;
    const amount = approach * (1 - retreat);
    group.current.position.set(
      THREE.MathUtils.lerp(-7, target[0] * 0.82, amount),
      0,
      THREE.MathUtils.lerp(4.5, target[2] * 0.82, amount),
    );
    group.current.lookAt(target[0], 0.7, target[2]);
  });
  if (
    state.phase !== "night-result" ||
    !state.cinematic ||
    state.cinematic.kind !== "night" ||
    !state.cinematic.attackedId
  )
    return null;
  return (
    <group ref={group}>
      <Assassin progress={progress} />
      <mesh castShadow position={[0, 1.16, -0.18]} rotation-x={0.12}>
        <coneGeometry args={[0.72, 2.2, 12]} />
        <meshStandardMaterial color="#090810" roughness={1} />
      </mesh>
      <pointLight
        position={[0, 1.4, 0.15]}
        color="#b33035"
        intensity={progress > 0.48 ? 4 : 0.4}
        distance={3}
      />
    </group>
  );
}

function Assassin({ progress }: { progress: number }) {
  const { scene, animations } = useGLTF(
    `${CHARACTER_ASSET}/character-male-e.glb`,
  );
  const assassin = useMemo(() => {
    const copy = cloneSkeleton(scene);
    const material = new THREE.MeshStandardMaterial({
      color: "#090812",
      roughness: 0.92,
      emissive: "#22070c",
      emissiveIntensity: 0.35,
    });
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
        child.castShadow = true;
      }
    });
    return copy;
  }, [scene]);
  const { actions } = useAnimations(animations, assassin);
  useEffect(() => {
    const action = actions["attack-melee-right"];
    action?.reset().play();
    if (action) action.paused = true;
    return () => {
      action?.stop();
    };
  }, [actions]);
  useFrame(() => {
    const action = actions["attack-melee-right"];
    if (!action) return;
    action.paused = true;
    action.time =
      action.getClip().duration *
      THREE.MathUtils.smoothstep(progress, 0.16, 0.46);
  });
  return <primitive object={assassin} scale={2.75} />;
}

function Protection({
  state,
  progress,
}: {
  state: PalermoState;
  progress: number;
}) {
  if (
    state.phase !== "night-result" ||
    state.cinematic?.kind !== "night" ||
    !state.cinematic.protected ||
    !state.cinematic.attackedId
  )
    return null;
  const cinematic = state.cinematic;
  const index = state.players.findIndex(
    (player) => player.id === cinematic.attackedId,
  );
  const target = homePosition(Math.max(0, index), state.players.length);
  const scale = 0.1 + THREE.MathUtils.smoothstep(progress, 0.04, 0.2) * 1.5;
  return (
    <group position={target}>
      <mesh position-y={1} scale={scale}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial
          color="#82e7ca"
          emissive="#41dcb0"
          emissiveIntensity={2.6}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Sparkles
        count={28}
        scale={[2.5, 2.8, 2.5]}
        size={5}
        speed={1.2}
        color="#a8ffe7"
        opacity={0.9}
      />
    </group>
  );
}

function VoteSpotlight({
  state,
  progress,
}: {
  state: PalermoState;
  progress: number;
}) {
  if (
    state.phase !== "vote-result" ||
    state.cinematic?.kind !== "vote" ||
    !state.cinematic.eliminatedId
  )
    return null;
  const cinematic = state.cinematic;
  const index = state.players.findIndex(
    (player) => player.id === cinematic.eliminatedId,
  );
  const target = playerPosition(Math.max(0, index), state.players.length);
  return (
    <spotLight
      position={[target[0], 7, target[2] + 1]}
      target-position={target}
      color="#ffb365"
      intensity={progress > 0.05 ? 90 : 0}
      angle={0.25}
      penumbra={0.75}
      castShadow
    />
  );
}

function VotePortal({
  state,
  progress,
}: {
  state: PalermoState;
  progress: number;
}) {
  if (
    state.phase !== "vote-result" ||
    state.cinematic?.kind !== "vote" ||
    !state.cinematic.eliminatedId
  )
    return null;
  const reveal = THREE.MathUtils.smoothstep(progress, 0.04, 0.15);
  return (
    <group position={[0, 6.1, 0]} scale={reveal}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.45, 0.18, 12, 48]} />
        <meshStandardMaterial
          color="#ffbd62"
          emissive="#dc5b42"
          emissiveIntensity={4}
        />
      </mesh>
      <pointLight color="#ff765d" intensity={22} distance={7} />
      <Sparkles
        count={34}
        scale={[3.4, 1, 3.4]}
        size={4}
        speed={1.5}
        color="#ffd58a"
      />
    </group>
  );
}

function Scene({ state, quality }: { state: PalermoState; quality: Quality }) {
  const { camera, scene } = useThree();
  const [progress, setProgress] = useState(0);
  const duration = Math.max(1, PHASE_LENGTHS[state.phase] * 1000);
  useEffect(() => {
    const update = () =>
      setProgress(
        THREE.MathUtils.clamp(1 - (state.endsAt - Date.now()) / duration, 0, 1),
      );
    update();
    const timer = window.setInterval(update, 80);
    return () => window.clearInterval(timer);
  }, [duration, state.endsAt, state.phase]);
  const isNight =
    state.phase === "night" ||
    state.phase === "night-result" ||
    state.phase === "role-reveal";
  useEffect(() => {
    scene.fog = new THREE.FogExp2(
      isNight ? "#090b1b" : "#d98f68",
      isNight ? 0.033 : 0.018,
    );
  }, [isNight, scene]);
  useFrame((_, delta) => {
    const cinematic =
      state.phase === "night-result" || state.phase === "vote-result";
    const drift = Math.sin(performance.now() * 0.00012) * 0.09;
    const angle = 0.72 + drift;
    const radius = cinematic ? 10.6 : 12.6;
    const desired = new THREE.Vector3(
      Math.sin(angle) * radius,
      cinematic ? 7.1 : isNight ? 9.2 : 9.8,
      Math.cos(angle) * radius,
    );
    camera.position.lerp(desired, 1 - Math.exp(-delta * 1.25));
    camera.lookAt(0, 0.7, 0);
  });

  return (
    <>
      <color attach="background" args={[isNight ? "#090b1b" : "#db916c"]} />
      <ambientLight
        intensity={isNight ? 0.5 : 1.15}
        color={isNight ? "#8290df" : "#fff0d2"}
      />
      <directionalLight
        castShadow={quality === "cinematic"}
        position={isNight ? [-5, 9, 2] : [6, 11, 4]}
        intensity={isNight ? 2.25 : 3.2}
        color={isNight ? "#8998ff" : "#fff1c9"}
        shadow-mapSize={[
          quality === "cinematic" ? 2048 : 512,
          quality === "cinematic" ? 2048 : 512,
        ]}
      />
      <pointLight
        position={[0, 5, 0]}
        intensity={isNight ? 28 : 2}
        color={isNight ? "#6372d8" : "#ffd18c"}
        distance={17}
      />
      <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.04}>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial
          color={isNight ? "#25263b" : "#c99872"}
          roughness={1}
        />
      </mesh>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={0}>
        <circleGeometry args={[6.2, 48]} />
        <meshStandardMaterial
          color={isNight ? "#303145" : "#d8b28c"}
          roughness={0.95}
        />
      </mesh>
      <Fountain />
      <House position={[-7.7, 0, -3.8]} rotation={0.45} color="#d98462" tall />
      <House position={[-4.2, 0, -7.1]} rotation={0.08} color="#dcb075" />
      <House position={[-0.4, 0, -7.6]} rotation={0} color="#c98567" tall />
      <House position={[3.4, 0, -7.35]} rotation={-0.06} color="#b88071" tall />
      <House position={[7.1, 0, -5.2]} rotation={-0.38} color="#df9b6c" />
      <House position={[-8.2, 0, 0.1]} rotation={1.2} color="#d7ad7d" />
      <Asset
        name="crypt-large"
        position={[8.8, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={1.05}
      />
      <Asset name="pine-crooked" position={[-8.7, 0, 0.2]} scale={1.15} />
      <Asset name="lightpost-single" position={[-3.3, 0, 2.6]} scale={1.15} />
      <Asset
        name="lightpost-single"
        position={[3.3, 0, -2.6]}
        rotation={[0, Math.PI, 0]}
        scale={1.15}
      />
      <Asset name="bench" position={[-1.8, 0, -4.7]} rotation={[0, 0.12, 0]} />
      <Asset
        name="bench"
        position={[1.8, 0, 4.7]}
        rotation={[0, Math.PI + 0.12, 0]}
      />
      <Asset
        name="gravestone-round"
        position={[9.1, 0, 2.2]}
        rotation={[0, -1.2, 0]}
      />
      <Asset
        name="gravestone-cross"
        position={[8.2, 0, 2.8]}
        rotation={[0, -1.2, 0]}
      />
      {state.players.map((player, index) => (
        <Resident
          key={player.id}
          player={player}
          index={index}
          count={state.players.length}
          state={state}
          progress={progress}
        />
      ))}
      <ShadowFigure state={state} progress={progress} />
      <Protection state={state} progress={progress} />
      <VoteSpotlight state={state} progress={progress} />
      <VotePortal state={state} progress={progress} />
      {isNight && quality === "cinematic" && (
        <Sparkles
          count={70}
          scale={[18, 7, 18]}
          position={[0, 4, 0]}
          size={1.4}
          speed={0.18}
          opacity={0.28}
          color="#d9e0ff"
        />
      )}
    </>
  );
}

class StageBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FlatFallback({ state }: { state: PalermoState }) {
  return (
    <div
      className={`cinematic-fallback ${state.phase.includes("night") ? "night" : "day"}`}
      data-testid="cinematic-fallback"
    >
      <div className="fallback-town">
        <span>▰</span>
        <span>▱</span>
        <span>▰</span>
        <i>☾</i>
      </div>
    </div>
  );
}

export default function PalermoStage({
  state,
  quality = "cinematic",
}: {
  state: PalermoState;
  quality?: Quality;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebgl(
        Boolean(
          window.WebGLRenderingContext &&
            (canvas.getContext("webgl2") || canvas.getContext("webgl")),
        ),
      );
    } catch {
      setWebgl(false);
    }
  }, []);
  if (webgl === false)
    return (
      <div
        className="palermo-stage"
        data-testid="palermo-3d-stage"
        data-quality={quality}
        data-cinematic={state.cinematic?.kind ?? "ambient"}
      >
        <FlatFallback state={state} />
      </div>
    );
  return (
    <div
      className="palermo-stage"
      data-testid="palermo-3d-stage"
      data-quality={quality}
      data-cinematic={state.cinematic?.kind ?? "ambient"}
    >
      {webgl === null ? (
        <div className="stage-loading">Waking Palermo…</div>
      ) : (
        <StageBoundary fallback={<FlatFallback state={state} />}>
          <Canvas
            shadows={quality === "cinematic"}
            dpr={quality === "cinematic" ? [1, 1.5] : 1}
            camera={{ position: [10, 8, 10], fov: 42, near: 0.1, far: 80 }}
            gl={{
              antialias: quality === "cinematic",
              powerPreference: "high-performance",
            }}
          >
            <Suspense fallback={null}>
              <Scene state={state} quality={quality} />
            </Suspense>
          </Canvas>
        </StageBoundary>
      )}
    </div>
  );
}

[
  "crypt-large",
  "pine-crooked",
  "lightpost-single",
  "bench",
  "gravestone-round",
  "gravestone-cross",
].forEach((name) => useGLTF.preload(`${ASSET}/${name}.glb`));

CHARACTER_VARIANTS.forEach((name) =>
  useGLTF.preload(`${CHARACTER_ASSET}/${name}.glb`),
);
