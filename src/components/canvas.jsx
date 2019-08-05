import React from 'react'
import * as THREE from 'three'
import { vShader, fShader } from './utils/shader'
import styles from './styles/canvas.module.scss'

class Canvas extends React.Component {
  constructor(props) {
    super(props);

    this.update = this.update.bind(this);
    this.resize = this.resize.bind(this);

    this.colorMain = 0xcccccc;
    this.colorBg = 0x222222;
    this._lastTime = Date.now();

    this._lastPageY = 0;
    this._transitionStartTime = 0;
    this._transitionDuration = 0;
    this._transitionIsBackward = false;

    if (typeof window !== "undefined")  window.CANVAS_BACKGROUND = this;

  }

  componentDidMount() {
    window.addEventListener("resize", this.resize);
    this.init();
  }

  componentWillUnmount() {
        cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.mount.removeChild(this.renderer.domElement);
    window.removeEventListener("resize", this.resize);
  }

  setColors(colorMain, colorBg) {
    this.renderer.setClearColor(colorBg);
  }

  init() {

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100)

    this.mount.appendChild(this.renderer.domElement)

    this.resize()
    this.initScene()
    this.setColors(this.colorMain, this.colorBg);
    
    if (!this.frameId)  this.frameId = requestAnimationFrame(this.update);

  }

  update() {
    this.updateScene();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.update);
  }

  resize() {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  initScene() {
          
        this.scene = new THREE.Scene()
        this.clock = new THREE.Clock()
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000)
        this.camera.position.set(0, 0, 1800)

        var uniforms = {
            u_amplitude: { value: 300.0 },
            u_frequency: { value: 0.005 },
            u_time: { value: 0.0 }
        };

        this.plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(2000, 2000, 40, 40),
            new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vShader,
                fragmentShader: fShader,
                side: THREE.BackSide,
                wireframe: true
            })
        )
        this.plane.position.z = 1000

        this.scene.add(this.plane)

  }

  updateScene() {
        
        // this.camera.position.x += (mouseX - camera.position.x) * 0.01;
        // this.camera.position.y += (-mouseY - camera.position.y) * 0.01;
        this.camera.lookAt(new THREE.Vector3(0, 0, 0))

        this.plane.material.uniforms.u_time.value += this.clock.getDelta() / 4;
  }

  triggerTransition(duration) {
    this._transitionStartTime = this._lastTime;
    this._transitionDuration = duration;
  }

  render() {
    return (
      <div
        id="canvas-wrap"
        className={styles.wrap}
        ref={(mount) => {
          this.mount = mount;
        }}
      />
    );
  }
}

export default Canvas

