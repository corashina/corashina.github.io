import React, { Component } from 'react'
import * as THREE from 'three'
import styles from "./styles/canvas.module.scss"
import { vShader, fShader } from './utils/shader'
import { TransitionPortal } from "gatsby-plugin-transition-link"

export default class Canvas extends Component {
    componentDidMount() {

        this.animate = this.animate.bind(this)
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
            new THREE.PlaneBufferGeometry(2000, 2000, 400, 400),
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

        this.renderer = new THREE.WebGLRenderer({ canvas: this.refs.canvas, antialias: true})

        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.gammaInput = this.renderer.gammaOutput = true

        this.animate()
    }
    animate() {
        requestAnimationFrame( this.animate )
    
        // this.camera.position.x += (mouseX - camera.position.x) * 0.01;
        // this.camera.position.y += (-mouseY - camera.position.y) * 0.01;
        this.camera.lookAt(new THREE.Vector3(0, 0, 0))

        this.plane.material.uniforms.u_time.value += this.clock.getDelta() / 4;

        this.renderer.render(this.scene, this.camera)

    }
    render() {
        
        return (
            <TransitionPortal>
                <canvas className={styles.canvas} ref='canvas'></canvas>
            </TransitionPortal> 
        )
    }
}