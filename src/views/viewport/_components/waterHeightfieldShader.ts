export function injectHeightfield(
  vertexShader: string,
  fragmentShader: string,
) {
  const vertex = vertexShader
    .replace(
      "uniform float time;",
      `uniform float time;
				uniform sampler2D tHeight;
				uniform sampler2D tLand;
				uniform float uHeightScale;
				uniform float uSimExtent;`,
    )
    .replace(
      "void main() {",
      `void main() {
					vec2 huv = vec2( position.x, -position.y ) / ( 2.0 * uSimExtent ) + 0.5;
					float hMask = step( 0.0, huv.x ) * step( huv.x, 1.0 ) * step( 0.0, huv.y ) * step( huv.y, 1.0 );
					float land = texture2D( tLand, huv ).r;
					float h = texture2D( tHeight, huv ).r * uHeightScale * hMask * ( 1.0 - land );
					vec3 displaced = position + vec3( 0.0, 0.0, h );`,
    )
    .replaceAll("vec4( position, 1.0 )", "vec4( displaced, 1.0 )");

  const fragment = fragmentShader
    .replace(
      "uniform vec3 waterColor;",
      `uniform vec3 waterColor;
				uniform sampler2D tHeight;
				uniform sampler2D tLand;
				uniform float uSimExtent;
				uniform float uWakeDistort;
				uniform float uWakeFoam;`,
    )
    .replace(
      `vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );`,
      `vec3 surfaceNormal = vec3( 0.0, 1.0, 0.0 );
					vec2 huv = worldPosition.xz / ( 2.0 * uSimExtent ) + 0.5;
					float inSim = step( 0.0, huv.x ) * step( huv.x, 1.0 ) * step( 0.0, huv.y ) * step( huv.y, 1.0 );
					float wakeMask = inSim * ( 1.0 - texture2D( tLand, huv ).r );
					float wakeFoam = 0.0;
					if ( wakeMask > 0.5 ) {
						vec4 info = texture2D( tHeight, huv );
						vec2 n2 = info.ba;
						float ny = sqrt( max( 0.0, 1.0 - dot( n2, n2 ) ) );
						vec3 wakeNormal = normalize( vec3( n2.x, ny, n2.y ) );
						float chop = clamp( abs( info.r ) * 3.4 + length( n2 ) * 2.2, 0.0, 1.0 );
						surfaceNormal = normalize( mix( surfaceNormal, wakeNormal, chop ) );
						wakeFoam = clamp( abs( info.r ) * 3.8 + length( n2 ) * 1.8, 0.0, 1.0 ) * uWakeFoam;
					}`,
    )
    .replace(
      "vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;",
      "vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * ( distortionScale + uWakeDistort * wakeFoam );",
    )
    .replace(
      "vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;",
      `vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					scatter = mix( scatter, vec3( 0.78, 0.88, 0.94 ), wakeFoam );`,
    )
    .replace(
      "vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );",
      `vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );
					albedo = mix( albedo, vec3( 0.84, 0.92, 0.97 ), wakeFoam * 0.82 );`,
    );

  return { vertex, fragment };
}
