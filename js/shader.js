window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'UA-117328709-1');

const fShader = `
uniform float   u_amplitude;
uniform float 	u_frequency;
uniform float   u_time;

void main() {
    gl_FragColor = vec4(0.433, 0.433, 0.433, 0);
}`;

const vShader = `precision highp float;

uniform float   u_amplitude;
uniform float 	u_frequency;
uniform float   u_time;

vec3 mod289(vec3 x)
{
return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec3 P)
{
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}

void main() {

    float displacement = u_amplitude * cnoise( u_frequency * position + u_time );

    vec3 newPosition = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );

}`;

var camera, scene, renderer, composer, container, plane;
var clock = new THREE.Clock();
var uniforms = { u_amplitude: { value: 300.0 }, u_frequency: { value: 0.005 }, u_time: { value: 0.0 } }
var mouseX = 0, mouseY = 0;
var windowHalfX = window.innerWidth / 2, windowHalfY = window.innerHeight / 2;

init();
animate();

function init() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 0, 1800);

    plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000, 400, 400), new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vShader,
        fragmentShader: fShader,
        side: THREE.BackSide,
        wireframe: true,
    }));
    plane.position.z = 1000;
    
    scene.add(plane);

    renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas') });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.gammaInput = renderer.gammaOutput = true;

    light1 = new THREE.PointLight(0xff0000);
    light1.position.set(250, 0, 100);
    scene.add(light1);

    var uniformss = THREE.UniformsUtils.merge([
        THREE.UniformsLib['lights'],
        { diffuse: { type: 'c', value: new THREE.Color(0xff00ff) } }
    ]);

    var effectVignette = new THREE.ShaderPass(THREE.VignetteShader);
    effectVignette.uniforms["offset"].value = 0.95;
    effectVignette.uniforms["darkness"].value = 1.6;
    effectVignette.renderToScreen = true;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.ShaderPass(THREE.HorizontalBlurShader));
    composer.addPass(new THREE.ShaderPass(THREE.VerticalBlurShader));
    composer.addPass(new THREE.ClearMaskPass());

    composer.addPass(effectVignette);

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    camera.position.x += ( mouseX - camera.position.x ) * 0.01;
    camera.position.y += ( -mouseY - camera.position.y ) * 0.01;
    camera.lookAt( new THREE.Vector3(0,0,0) );

    plane.material.uniforms.u_time.value += clock.getDelta() / 4;

    composer.render(clock.getDelta());
}

var mX, mY, distance;

window.addEventListener('mousemove', (e) => {

    mouseX = ( e.clientX - windowHalfX );
    mouseY = ( e.clientY - windowHalfY );

    mX = e.pageX;
    mY = e.pageY;

    if (Barba.Pjax.getCurrentUrl().includes('about')) {
        document.querySelectorAll('.image').forEach(el => {

            elem = el.getBoundingClientRect();
            distance = Math.floor(Math.sqrt(Math.pow(mX - (elem.left + (elem.width / 2)), 2) + Math.pow(mY - (elem.top + (elem.height / 2)), 2)));

            let val = 400 / Math.min(Math.max(distance, 100), 1000);
            el.setAttribute("style", `-webkit-filter:grayscale(${distance / 10}%); opacity: ${val}`);
        })
    } else if (Barba.Pjax.getCurrentUrl().includes('work')) {

        document.querySelectorAll('.projects-item').forEach(el => {

            elem = el.getBoundingClientRect();
            distance = Math.floor(Math.sqrt(Math.pow(mX - (elem.left + (elem.width / 2)), 2) + Math.pow(mY - (elem.top + (elem.height / 2)), 2)));

            let val = 100 / Math.min(Math.max(distance, 100), 1000);
            el.setAttribute("style", `-webkit-filter:grayscale(${distance / 10}%); opacity: ${val}`);
        })
    }

})