window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "UA-117328709-1");

document.querySelector('#nav-home').addEventListener('click', () => document.querySelector('.contact').scrollIntoView({behavior: "smooth"}))
document.querySelector('#nav-about').addEventListener('click', () => document.querySelector('.about').scrollIntoView({behavior: "smooth"}))
document.querySelector('#nav-work').addEventListener('click', () => document.querySelector('.projects').scrollIntoView({behavior: "smooth"}))
document.querySelector('#nav-contact').addEventListener('click', () => document.querySelector('.contact').scrollIntoView({behavior: "smooth"}))

!(function n(e, t, r) {
  function o(u, f) {
    if (!t[u]) {
      if (!e[u]) {
        var a = "function" == typeof require && require;
        if (!f && a) return a(u, !0);
        if (i) return i(u, !0);
        var c = new Error("Cannot find module '" + u + "'");
        throw ((c.code = "MODULE_NOT_FOUND"), c);
      }
      var l = (t[u] = { exports: {} });
      e[u][0].call(
        l.exports,
        function(n) {
          var t = e[u][1][n];
          return o(t ? t : n);
        },
        l,
        l.exports,
        n,
        e,
        t,
        r
      );
    }
    return t[u].exports;
  }
  for (
    var i = "function" == typeof require && require, u = 0;
    u < r.length;
    u++
  )
    o(r[u]);
  return o;
})(
  {
    1: [
      function(n, e, t) {
        !(function(n, r) {
          "function" == typeof define && define.amd
            ? define(r)
            : "object" == typeof t
            ? (e.exports = r())
            : (n.aqueue = r());
        })(this, function() {
          function n() {}
          var e = function(e, t) {
            function r() {
              u ||
                ((u = !0),
                setTimeout(function() {
                  f();
                }, 0));
            }
            var o = [],
              i = -1,
              e = e || n,
              t = t || !1,
              u = !1,
              f = function() {
                var n = [].slice.call(arguments),
                  r = n.shift(),
                  a = null;
                return r || !u || (i === o.length - 1 && !t)
                  ? (r && e.apply(this, [].slice.call(arguments)),
                    void (u = !1))
                  : ((i = (i + 1) % o.length),
                    (a = o[i]),
                    (n = n.concat(a[1])),
                    n.push(f),
                    void a[0].apply(f, n));
              },
              a = function() {
                var n = [].slice.call(arguments),
                  e = n.shift();
                return e && "function" == typeof e && (o.push([e, n]), r()), a;
              };
            return a;
          };
          return e;
        });
      },
      {}
    ],
    2: [
      function(n) {
        (function(e) {
          function t(n, e) {
            var t = {};
            for (var r in n)
              n.hasOwnProperty(r) &&
                (t[r] = "undefined" != typeof e[r] ? e[r] : n[r]);
            return t;
          }
          function r(n, e) {
            n.className += " " + e;
          }
          var o = n("aqueue"),
            i = {
              interval: 3e3,
              completeClass: "typeout-complete",
              callback: function() {},
              numLoops: 1,
              max: 110,
              min: 40
            },
            u = function(n, e, u) {
              function f() {
                var n = p.innerHTML.trim();
                "" !== n && ((m = !1), u.words.unshift(n), (p.innerHTML = "")),
                  a();
              }
              function a() {
                var n = 0,
                  e = u.words.length;
                u.words.forEach(function() {
                  return (
                    h(c, u.words[n]),
                    n === e - 1
                      ? (y++,
                        1 / 0 !== y && y === u.numLoops
                          ? h(d, null)
                          : (h(v, u.interval)(l), a()))
                      : (h(v, u.interval)(l), n++, void (n === e && (n = 0)))
                  );
                });
              }
              function c(n, e) {
                var t = 0,
                  r = n.length,
                  o = setInterval(function() {
                    r > t
                      ? ((p.innerHTML += n[t]), t++)
                      : (window.clearInterval(o), e());
                  }, s());
              }
              function l(n) {
                var e = setInterval(function() {
                  var t = p.innerHTML,
                    r = t.length;
                  r || (clearInterval(e), n()),
                    (p.innerHTML = t.substring(0, r - 1));
                }, s());
              }
              function s() {
                var n = u.max,
                  e = u.min;
                return Math.floor(Math.random() * (n - e + 1) + e);
              }
              function v(n, e) {
                setTimeout(function() {
                  e();
                }, n);
              }
              function d() {
                r(p, u.completeClass), u.callback(p);
              }
              (u = t(i, u || {})), (u.words = e);
              var p = document.querySelector(n),
                m = !0,
                h = o(),
                y = 0;
              f();
            };
          e.typeout = u;
        }.call(
          this,
          "undefined" != typeof global
            ? global
            : "undefined" != typeof self
            ? self
            : "undefined" != typeof window
            ? window
            : {}
        ));
      },
      { aqueue: 1 }
    ]
  },
  {},
  [2]
);
typeout(".typeout", ["a student", "an engineer", "a designer", "a developer"], {
  numLoops: 12,
  callback: el => (el.innerHTML += ".")
});

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
var uniforms = {
  u_amplitude: { value: 300.0 },
  u_frequency: { value: 0.005 },
  u_time: { value: 0.0 }
};
var mouseX = 0,
  mouseY = 0;
var windowHalfX = window.innerWidth / 2,
  windowHalfY = window.innerHeight / 2;

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.set(0, 0, 1800);

  plane = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(2000, 2000, 400, 400),
    new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vShader,
      fragmentShader: fShader,
      side: THREE.BackSide,
      wireframe: true
    })
  );
  plane.position.z = 1000;

  scene.add(plane);

  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("canvas")
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.gammaInput = renderer.gammaOutput = true;

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

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  camera.position.x += (mouseX - camera.position.x) * 0.01;
  camera.position.y += (-mouseY - camera.position.y) * 0.01;
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  plane.material.uniforms.u_time.value += clock.getDelta() / 4;

  composer.render(clock.getDelta());
}

var mX, mY, distance;

window.addEventListener("mousemove", e => {
  mouseX = e.clientX - windowHalfX;
  mouseY = e.clientY - windowHalfY;

  mX = e.pageX;
  mY = e.pageY;

    document.querySelectorAll(".image").forEach(el => {
      elem = el.getBoundingClientRect();
      distance = Math.floor(
        Math.sqrt(
          Math.pow(mX - (elem.left + elem.width / 2), 2) +
            Math.pow(mY - (elem.top + elem.height / 2), 2)
        )
      );
       
      let val = 400 / Math.min(Math.max(distance, 100), 1000);
      el.setAttribute("style", `-webkit-filter:grayscale(${distance / 100}%); opacity: ${val}`);
    });

    let titles = document.querySelectorAll(".title");

    document.querySelectorAll(".work-item").forEach((el, i) => {
      elem = el.getBoundingClientRect();
      distance = Math.floor(
        Math.sqrt(
          Math.pow(mX - (elem.left + elem.width / 2), 2) +
            Math.pow(mY - (elem.top + elem.height / 2), 2)
        )
      );
            
      let val = 100 / Math.min(Math.max(distance, 100), 1000);
      el.setAttribute("style", `filter: grayscale(${distance / 10}%); -webkit-filter:grayscale(${distance / 10}%); opacity: ${val}`);
      titles[i].setAttribute("style",`opacity: ${distance / window.innerWidth}`);
    });
  
});
