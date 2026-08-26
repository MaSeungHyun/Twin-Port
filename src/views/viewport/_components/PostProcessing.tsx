import {
  BLOOM_INTENSITY,
  BLOOM_LUMINANCE_THRESHOLD,
} from "@/constants/environment";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Vector2 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/** three.js jsm EffectComposer + UnrealBloomPass */
export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useLayoutEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(gl.getPixelRatio());
    composerRef.current = composer;

    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new Vector2(size.width, size.height),
        BLOOM_INTENSITY,
        0.4,
        BLOOM_LUMINANCE_THRESHOLD,
      ),
    );
    composer.addPass(new OutputPass());
    composer.setSize(size.width, size.height);

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera, size.height, size.width]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [gl, size.height, size.width]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}
