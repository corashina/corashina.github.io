export const vertexShader = [
  "uniform float uTime;",
  "uniform float uAmplitude;",
  "uniform vec2 uPointer;",
  "varying float vHeight;",
  "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
  "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}",
  "float fbm(vec2 p){float v=0.0;float w=0.5;for(int i=0;i<4;i++){v+=w*noise(p);p=p*2.03+vec2(7.1,3.7);w*=0.5;}return v;}",
  "void main(){vec2 q=position.xy*0.0022+vec2(uTime*0.018,-uTime*0.012);float terrain=fbm(q)*2.0-1.0;vec2 focus=uPointer*vec2(850,520);float influence=exp(-distance(position.xy,focus)*0.0025);float h=terrain*uAmplitude+influence*42.0;vHeight=h;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*h,1.0);}",
].join("\n");

export const fragmentShader = [
  "uniform vec3 uColor;",
  "uniform float uOpacity;",
  "varying float vHeight;",
  "void main(){float fade=smoothstep(-220.0,260.0,vHeight);gl_FragColor=vec4(uColor,uOpacity*mix(0.55,1.0,fade));}",
].join("\n");
