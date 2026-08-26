import { DECK_Y } from "@/constants/container";
import {
  SUN_COLOR,
  SUN_GLOW_OPACITY,
  SUN_GLOW_RADIUS,
  SUN_GLOW_Y_OFFSET,
  SUN_TARGET,
} from "@/constants/sunLight";
import { useMemo } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  SRGBColorSpace,
} from "three";

function createSunGlowTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** light target 기준 local — 바닥(DECK_Y) radial glow */
export default function SunGlow() {
  const glowMap = useMemo(() => createSunGlowTexture(), []);
  const glowLocalY = DECK_Y + SUN_GLOW_Y_OFFSET - SUN_TARGET[1];

  return (
    <mesh
      position={[0, glowLocalY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={6}
      raycast={() => null}
    >
      <circleGeometry args={[SUN_GLOW_RADIUS, 48]} />
      <meshBasicMaterial
        map={glowMap ?? undefined}
        color={SUN_COLOR}
        transparent
        opacity={SUN_GLOW_OPACITY}
        depthWrite={false}
        depthTest
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
