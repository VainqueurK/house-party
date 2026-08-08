"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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
type ProgressRef = MutableRefObject<number>;

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

function MarketStall({
  position,
  rotation = 0,
  color,
}: {
  position: [number, number, number];
  rotation?: number;
  color: string;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow position-y={0.72}>
        <boxGeometry args={[2.1, 0.16, 1.05]} />
        <meshStandardMaterial color="#6d4431" roughness={1} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} castShadow position={[x, 1.45, 0]}>
          <boxGeometry args={[0.1, 2.85, 0.1]} />
          <meshStandardMaterial color="#493128" roughness={1} />
        </mesh>
      ))}
      <mesh castShadow position-y={2.55} rotation-z={0.02}>
        <boxGeometry args={[2.45, 0.12, 1.5]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      {[-0.62, 0, 0.62].map((x, index) => (
        <mesh key={x} castShadow position={[x, 0.93, 0]}>
          <sphereGeometry args={[0.18 + index * 0.02, 10, 8]} />
          <meshStandardMaterial
            color={["#c94e3f", "#e2b94f", "#638f55"][index]}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function NightImpact({ state, progress }: { state: PalermoState; progress: ProgressRef }) {
  const group = useRef<THREE.Group>(null);
  const attackedId =
    state.cinematic?.kind === "night" ? state.cinematic.attackedId : undefined;
  const index = state.players.findIndex((player) => player.id === attackedId);
  const target = homePosition(Math.max(0, index), state.players.length);
  const active = state.phase === "night-result" && Boolean(attackedId);
  useFrame(() => {
    if (!group.current) return;
    const strike = THREE.MathUtils.smoothstep(progress.current, 0.31, 0.42);
    const fade = 1 - THREE.MathUtils.smoothstep(progress.current, 0.58, 0.78);
    group.current.scale.setScalar(0.25 + strike * 2.3);
    group.current.visible = strike * fade > 0.01;
    group.current.rotation.z = -0.6 + progress.current * 0.3;
    group.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial)
        child.material.opacity = strike * fade;
    });
  });
  if (!active) return null;
  const protectedAttack =
    state.cinematic?.kind === "night" && state.cinematic.protected;
  const color = protectedAttack ? "#8dffe1" : "#ff4858";
  return (
    <group ref={group} position={[target[0], 1.35, target[2] + 0.3]}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.58, 0.07, 10, 42]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={5}
          transparent
        />
      </mesh>
      {!protectedAttack && (
        <mesh rotation-z={-0.45}>
          <boxGeometry args={[1.7, 0.08, 0.08]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={6}
            transparent
          />
        </mesh>
      )}
      <pointLight color={color} intensity={18} distance={5} />
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
  const routeOrder = [2, 3, 4, 0, 1, 5];
  return homes[
    routeOrder[index % Math.min(routeOrder.length, Math.max(count, 1))]
  ];
}

function residentRoute(
  start: [number, number, number],
  end: [number, number, number],
  progress: number,
) {
  const length = Math.hypot(start[0], start[2]) || 1;
  const lane = new THREE.Vector3(
    (start[0] / length) * 5,
    0,
    (start[2] / length) * 4.45,
  );
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  if (progress < 0.36) {
    const laneProgress = THREE.MathUtils.smootherstep(progress / 0.36, 0, 1);
    return from.lerp(lane, laneProgress);
  }
  const homeProgress = THREE.MathUtils.smootherstep(
    (progress - 0.36) / 0.64,
    0,
    1,
  );
  return lane.lerp(to, homeProgress);
}

function AnimatedResident({
  variant,
  progress,
  state,
  killed,
  ejected,
}: {
  variant: string;
  progress: ProgressRef;
  state: PalermoState;
  killed: boolean;
  ejected: boolean;
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
  const currentAction = useRef<string | undefined>(undefined);

  useEffect(() => {
    const idle = actions.idle;
    idle?.reset().play();
    currentAction.current = idle ? "idle" : undefined;
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions]);

  useFrame(() => {
    const phaseProgress = progress.current;
    const walkingHome = state.phase === "night" && phaseProgress < 0.28;
    const walkingToSquare = state.phase === "discussion" && phaseProgress < 0.1;
    const desired = killed
      ? "die"
      : ejected
        ? "emote-no"
        : walkingHome || walkingToSquare
          ? "walk"
          : "idle";
    if (currentAction.current !== desired && actions[desired]) {
      const previous = currentAction.current
        ? actions[currentAction.current]
        : undefined;
      const next = actions[desired];
      next?.reset().play();
      if (previous && next) next.crossFadeFrom(previous, 0.28, true);
      currentAction.current = desired;
    }
    const death = actions.die;
    if (killed && death) {
      death.paused = true;
      death.time =
        death.getClip().duration *
        THREE.MathUtils.smoothstep(phaseProgress, 0.18, 0.62);
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
  progress: ProgressRef;
}) {
  const group = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
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
  useFrame((_, delta) => {
    if (!group.current) return;
    const phaseProgress = progress.current;
    let x = position[0];
    let y = 0;
    let z = position[2];
    let scale = 1;
    let visible = player.alive;
    let facing = Math.atan2(-position[0], -position[2]);

    if (state.phase === "night") {
      const travel = THREE.MathUtils.smoothstep(phaseProgress, 0.02, 0.23);
      const routed = residentRoute(position, home, travel);
      const next = residentRoute(position, home, Math.min(1, travel + 0.015));
      x = routed.x;
      z = routed.z;
      y = Math.sin(travel * Math.PI) * 0.08;
      facing = Math.atan2(next.x - routed.x, next.z - routed.z);
      const doorwayFade = THREE.MathUtils.smoothstep(phaseProgress, 0.22, 0.28);
      scale = 1 - doorwayFade * 0.65;
      visible = player.alive && doorwayFade < 0.99;
    } else if (state.phase === "night-result") {
      x = home[0];
      z = home[2];
      facing = Math.atan2(-home[0], -home[2]);
      visible = isNightTarget;
    } else if (state.phase === "discussion") {
      const returnToSquare = THREE.MathUtils.smoothstep(
        phaseProgress,
        0.01,
        0.09,
      );
      const reverseProgress = 1 - returnToSquare;
      const routed = residentRoute(position, home, reverseProgress);
      const next = residentRoute(
        position,
        home,
        Math.max(0, reverseProgress - 0.015),
      );
      x = routed.x;
      z = routed.z;
      y = Math.sin(returnToSquare * Math.PI) * 0.08;
      facing =
        returnToSquare < 0.98
          ? Math.atan2(next.x - routed.x, next.z - routed.z)
          : Math.atan2(-position[0], -position[2]);
    } else if (isVoteTarget) {
      const eject = THREE.MathUtils.smoothstep(phaseProgress, 0.07, 0.48);
      const lift = eject * eject * (3 - 2 * eject);
      x = THREE.MathUtils.lerp(position[0], 0, lift);
      z = THREE.MathUtils.lerp(position[2], 0, lift);
      y = lift * 6.4 + Math.sin(lift * Math.PI) * 0.45;
      scale = 1 - THREE.MathUtils.smoothstep(phaseProgress, 0.43, 0.62) * 0.92;
      visible = scale > 0.09;
      group.current.rotation.y += delta * (2.4 + lift * 8);
      group.current.rotation.z = Math.sin(lift * Math.PI * 4) * 0.22;
    }

    group.current.position.set(x, y, z);
    group.current.scale.setScalar(scale);
    if (!isVoteTarget) {
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        facing,
        9,
        delta,
      );
      group.current.rotation.z = THREE.MathUtils.damp(
        group.current.rotation.z,
        0,
        10,
        delta,
      );
    }
    group.current.visible = visible || isCinematicTarget || isVoteTarget;
    if (label.current) {
      label.current.style.opacity = visible ? "1" : "0";
      label.current.style.transform = `scale(${Math.max(0.75, scale)})`;
    }
  });
  return (
    <group ref={group}>
      <AnimatedResident
        variant={CHARACTER_VARIANTS[index % CHARACTER_VARIANTS.length]}
        progress={progress}
        state={state}
        killed={isCinematicTarget}
        ejected={isVoteTarget}
      />
      <Html
        center
        position={[0, 2.35, 0]}
        distanceFactor={9}
        style={{ pointerEvents: "none" }}
      >
        <div ref={label} className="resident-label">
          <span>{player.emoji}</span>
          {player.name}
        </div>
      </Html>
    </group>
  );
}

function ShadowFigure({
  state,
  progress,
}: {
  state: PalermoState;
  progress: ProgressRef;
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
    const phaseProgress = progress.current;
    const approach = THREE.MathUtils.smoothstep(phaseProgress, 0.02, 0.38);
    const retreat =
      state.cinematic?.kind === "night" && state.cinematic.protected
        ? THREE.MathUtils.smoothstep(phaseProgress, 0.4, 0.85)
        : 0;
    const amount = THREE.MathUtils.smootherstep(approach * (1 - retreat), 0, 1);
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
        intensity={4}
        distance={3}
      />
    </group>
  );
}

function Assassin({ progress }: { progress: ProgressRef }) {
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
      THREE.MathUtils.smoothstep(progress.current, 0.16, 0.46);
  });
  return <primitive object={assassin} scale={2.75} />;
}

function Protection({
  state,
  progress,
}: {
  state: PalermoState;
  progress: ProgressRef;
}) {
  const shield = useRef<THREE.Group>(null);
  const active =
    state.phase === "night-result" &&
    state.cinematic?.kind === "night" &&
    state.cinematic.protected &&
    Boolean(state.cinematic.attackedId);
  const attackedId =
    state.cinematic?.kind === "night" ? state.cinematic.attackedId : undefined;
  const index = state.players.findIndex((player) => player.id === attackedId);
  const target = homePosition(Math.max(0, index), state.players.length);
  useFrame(() => {
    if (!shield.current) return;
    const arrive = THREE.MathUtils.smoothstep(progress.current, 0.04, 0.2);
    const pulse = 1 + Math.sin(progress.current * Math.PI * 14) * 0.035;
    shield.current.scale.setScalar((0.08 + arrive * 1.52) * pulse);
  });
  if (!active) return null;
  return (
    <group position={target}>
      <group ref={shield} position-y={1}>
        <mesh>
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
          scale={[1.7, 1.9, 1.7]}
          size={5}
          speed={1.2}
          color="#a8ffe7"
          opacity={0.9}
        />
      </group>
    </group>
  );
}

function VoteSpotlight({
  state,
  progress,
}: {
  state: PalermoState;
  progress: ProgressRef;
}) {
  const spotlight = useRef<THREE.SpotLight>(null);
  const active =
    state.phase === "vote-result" &&
    state.cinematic?.kind === "vote" &&
    Boolean(state.cinematic.eliminatedId);
  const eliminatedId =
    state.cinematic?.kind === "vote" ? state.cinematic.eliminatedId : undefined;
  const index = state.players.findIndex((player) => player.id === eliminatedId);
  const target = playerPosition(Math.max(0, index), state.players.length);
  useFrame(() => {
    if (!spotlight.current) return;
    spotlight.current.intensity =
      THREE.MathUtils.smoothstep(progress.current, 0.03, 0.12) * 90;
    spotlight.current.target.position.set(target[0], 0, target[2]);
    spotlight.current.target.updateMatrixWorld();
  });
  if (!active) return null;
  return (
    <spotLight
      ref={spotlight}
      position={[target[0], 7, target[2] + 1]}
      color="#ffb365"
      intensity={0}
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
  progress: ProgressRef;
}) {
  const portal = useRef<THREE.Group>(null);
  const active =
    state.phase === "vote-result" &&
    state.cinematic?.kind === "vote" &&
    Boolean(state.cinematic.eliminatedId);
  useFrame(() => {
    if (!portal.current) return;
    const reveal = THREE.MathUtils.smoothstep(progress.current, 0.04, 0.15);
    portal.current.scale.setScalar(reveal);
    portal.current.rotation.y = progress.current * Math.PI * 0.8;
  });
  if (!active) return null;
  return (
    <group ref={portal} position={[0, 6.1, 0]} scale={0.01}>
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
  const progress = useRef(0);
  const cameraLook = useRef(new THREE.Vector3(0, 0.7, 0));
  const duration = Math.max(1, PHASE_LENGTHS[state.phase] * 1000);
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
    progress.current = THREE.MathUtils.clamp(
      1 - (state.endsAt - Date.now()) / duration,
      0,
      1,
    );
    const drift = Math.sin(performance.now() * 0.00012) * 0.09;
    const angle = 0.72 + drift;
    let desired: THREE.Vector3;
    let desiredLook: THREE.Vector3;
    if (
      state.phase === "night-result" &&
      state.cinematic?.kind === "night" &&
      state.cinematic.attackedId
    ) {
      const attackedId = state.cinematic.attackedId;
      const index = state.players.findIndex(
        (player) => player.id === attackedId,
      );
      const target = new THREE.Vector3(
        ...homePosition(Math.max(0, index), state.players.length),
      );
      const radial = target.clone().setY(0).normalize();
      const dolly = THREE.MathUtils.lerp(5.5, 4.35, progress.current);
      desired = target.clone().addScaledVector(radial, -dolly).setY(3.25);
      desiredLook = target.clone().setY(1.1);
    } else if (state.phase === "vote-result") {
      const revealLift = THREE.MathUtils.smoothstep(progress.current, 0.18, 0.58);
      desired = new THREE.Vector3(7.4, 3.8 + revealLift * 0.7, 7.7);
      desiredLook = new THREE.Vector3(0, 0.9 + revealLift * 2.2, 0);
    } else {
      const radius = 12.4;
      desired = new THREE.Vector3(
        Math.sin(angle) * radius,
        isNight ? 6.8 : 6.3,
        Math.cos(angle) * radius,
      );
      desiredLook = new THREE.Vector3(0, 0.85, 0);
    }
    const cameraEase = 1 - Math.exp(-delta * 1.65);
    camera.position.lerp(desired, cameraEase);
    cameraLook.current.lerp(desiredLook, cameraEase);
    camera.lookAt(cameraLook.current);
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
      <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[4.9, 5.25, 48]} />
        <meshStandardMaterial color={isNight ? "#3b3c50" : "#b88969"} roughness={1} />
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
      <MarketStall position={[-5.2, 0, 3.8]} rotation={0.5} color="#b84842" />
      <MarketStall position={[5.25, 0, 3.25]} rotation={-0.55} color="#d1a445" />
      <Asset name="fire-basket" position={[-4.1, 0, 1.85]} scale={0.9} />
      <Asset name="fire-basket" position={[4.2, 0, -1.65]} scale={0.9} />
      <Asset name="fence-damaged" position={[8.7, 0, 3.8]} rotation={[0, -0.9, 0]} />
      <Asset name="coffin-old" position={[9.3, 0, 3.25]} rotation={[0, -0.7, 0]} scale={0.8} />
      <Asset name="hay-bale-bundled" position={[-7.4, 0, 3.6]} rotation={[0, 0.45, 0]} />
      <Asset name="lantern-glass" position={[0.55, 0.55, -4.65]} scale={0.8} />
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
      <NightImpact state={state} progress={progress} />
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
  "fire-basket",
  "fence-damaged",
  "coffin-old",
  "hay-bale-bundled",
  "lantern-glass",
  "pine-crooked",
  "lightpost-single",
  "bench",
  "gravestone-round",
  "gravestone-cross",
].forEach((name) => useGLTF.preload(`${ASSET}/${name}.glb`));

CHARACTER_VARIANTS.forEach((name) =>
  useGLTF.preload(`${CHARACTER_ASSET}/${name}.glb`),
);
