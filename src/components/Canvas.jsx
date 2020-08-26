import React from 'react'
import * as THREE from 'three'
import { vShader, fShader } from './utils/shader'

import styles from './styles/canvas.module.scss'

class Canvas extends React.Component {
  constructor(props) {
    super(props)

    this.update = this.update.bind(this)
    this.resize = this.resize.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)

    this.mouseX = 0
    this.mouseY = 0

    this.colorMain = '#cccccc'
    this.colorBg = '#222222'

    this.lastTime = Date.now()
    this.transitionStartTime = 0
    this.transitionDuration = 0

    if (typeof window !== 'undefined')  window.canvas = this

  }

  componentDidMount() {
    window.addEventListener('resize', this.resize)
    window.addEventListener('mousemove', this.onMouseMove)
    this.init()
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.frameId)
    this.frameId = undefined
    this.mount.removeChild(this.renderer.domElement)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('mousemove', this.onMouseMove)
  }

  setColors(colorMain, colorBg) {
    this.renderer.setClearColor(colorBg)
    this.colorMain = colorMain
    this.uniforms.u_color.value = colorMain === '#000000' ? 0.8 : 0.2
  }

  onMouseMove(event) {
    this.mouseX = event.clientX - window.innerWidth / 2
    this.mouseY = event.clientY - window.innerHeight / 2
  }

  init() {

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100)

    this.mount.appendChild(this.renderer.domElement)

    this.resize()
    this.initScene()
    this.renderer.setClearColor(this.colorBg)
    
    if (!this.frameId)  this.frameId = requestAnimationFrame(this.update)

    const loading = document.getElementsByClassName('loading');

    if(loading.length > 0) {
      document.body.removeChild(loading[0])
    }

  }

  update() {

    this.camera.position.x += (this.mouseX - this.camera.position.x) * 0.01
    this.camera.position.y += (-this.mouseY - this.camera.position.y) * 0.01
    this.camera.lookAt(new THREE.Vector3(0, 0, 0))
    this.plane.material.uniforms.u_time.value += this.clock.getDelta() / 4
    
    this.renderer.render(this.scene, this.camera)
    this.frameId = requestAnimationFrame(this.update)

  }

  resize() {
    this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight)
    this.camera.aspect = this.mount.clientWidth / this.mount.clientHeight
    this.camera.updateProjectionMatrix()
  }

  initScene() {
          
        this.scene = new THREE.Scene()
        this.clock = new THREE.Clock()
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000)
        this.camera.position.set(0, 0, 1000)

        this.uniforms = {
            u_amplitude: { value: 300.0 },
            u_frequency: { value: 0.005 },
            u_time: { value: 0.0 },
            u_color: { value: 0.2}
        }

        this.plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(4000, 4000, 80, 80),
            new THREE.ShaderMaterial({
                uniforms: this.uniforms,
                vertexShader: vShader,
                fragmentShader: fShader,
                side: THREE.BackSide,
                wireframe: true
            })
        )

        this.scene.add(this.plane)

  }

  triggerTransition(duration) {
    this.transitionStartTime = this.lastTime
    this.transitionDuration = duration
  }

  render() {
    return (
      <div
        className={styles.wrap}
        ref={(mount) => this.mount = mount}
      />
    )
  }
}

export default Canvas

