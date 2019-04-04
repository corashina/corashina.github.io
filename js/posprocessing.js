THREE.HorizontalBlurShader = {

    uniforms: {

        "tDiffuse": { value: null },
        "h": { value: 1.0 / 512.0 }

    },

    vertexShader: [

        "varying vec2 vUv;",

        "void main() {",

        "vUv = uv;",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}"

    ].join("\n"),

    fragmentShader: [

        "uniform sampler2D tDiffuse;",
        "uniform float h;",

        "varying vec2 vUv;",

        "void main() {",

        "vec4 sum = vec4( 0.0 );",

        "sum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * h, vUv.y ) ) * 0.051;",
        "sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * h, vUv.y ) ) * 0.0918;",
        "sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * h, vUv.y ) ) * 0.12245;",
        "sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * h, vUv.y ) ) * 0.1531;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;",
        "sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * h, vUv.y ) ) * 0.1531;",
        "sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * h, vUv.y ) ) * 0.12245;",
        "sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * h, vUv.y ) ) * 0.0918;",
        "sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * h, vUv.y ) ) * 0.051;",

        "gl_FragColor = sum;",

        "}"

    ].join("\n")

};

THREE.VerticalBlurShader = {

    uniforms: {

        "tDiffuse": { value: null },
        "v": { value: 1.0 / 512.0 }

    },

    vertexShader: [

        "varying vec2 vUv;",

        "void main() {",

        "vUv = uv;",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}"

    ].join("\n"),

    fragmentShader: [

        "uniform sampler2D tDiffuse;",
        "uniform float v;",

        "varying vec2 vUv;",

        "void main() {",

        "vec4 sum = vec4( 0.0 );",

        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * v ) ) * 0.051;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * v ) ) * 0.0918;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * v ) ) * 0.12245;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * v ) ) * 0.1531;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * v ) ) * 0.1531;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * v ) ) * 0.12245;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * v ) ) * 0.0918;",
        "sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * v ) ) * 0.051;",

        "gl_FragColor = sum;",

        "}"

    ].join("\n")

};

THREE.VignetteShader = {

    uniforms: {

        "tDiffuse": { value: null },
        "offset": { value: 1.0 },
        "darkness": { value: 1.0 }

    },

    vertexShader: [

        "varying vec2 vUv;",

        "void main() {",

        "vUv = uv;",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}"

    ].join("\n"),

    fragmentShader: [

        "uniform float offset;",
        "uniform float darkness;",

        "uniform sampler2D tDiffuse;",

        "varying vec2 vUv;",

        "void main() {",

        "vec4 texel = texture2D( tDiffuse, vUv );",
        "vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );",
        "gl_FragColor = vec4( mix( texel.rgb, vec3( 1.0 - darkness ), dot( uv, uv ) ), texel.a );",

        "}"

    ].join("\n")

};

THREE.CopyShader = {

    uniforms: {

        "tDiffuse": { value: null },
        "opacity": { value: 1.0 }

    },

    vertexShader: [

        "varying vec2 vUv;",

        "void main() {",

        "vUv = uv;",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}"

    ].join("\n"),

    fragmentShader: [

        "uniform float opacity;",

        "uniform sampler2D tDiffuse;",

        "varying vec2 vUv;",

        "void main() {",

        "vec4 texel = texture2D( tDiffuse, vUv );",
        "gl_FragColor = opacity * texel;",

        "}"

    ].join("\n")

};

THREE.EffectComposer = function (renderer, renderTarget) {

    this.renderer = renderer;

    if (renderTarget === undefined) {

        var parameters = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        };

        var size = renderer.getDrawingBufferSize();
        renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, parameters);
        renderTarget.texture.name = 'EffectComposer.rt1';

    }

    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = 'EffectComposer.rt2';

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;

    this.passes = [];

    // dependencies

    if (THREE.CopyShader === undefined) {

        console.error('THREE.EffectComposer relies on THREE.CopyShader');

    }

    if (THREE.ShaderPass === undefined) {

        console.error('THREE.EffectComposer relies on THREE.ShaderPass');

    }

    this.copyPass = new THREE.ShaderPass(THREE.CopyShader);

};

Object.assign(THREE.EffectComposer.prototype, {

    swapBuffers: function () {

        var tmp = this.readBuffer;
        this.readBuffer = this.writeBuffer;
        this.writeBuffer = tmp;

    },

    addPass: function (pass) {

        this.passes.push(pass);

        var size = this.renderer.getDrawingBufferSize();
        pass.setSize(size.width, size.height);

    },

    insertPass: function (pass, index) {

        this.passes.splice(index, 0, pass);

    },

    render: function (delta) {

        var maskActive = false;

        var pass, i, il = this.passes.length;

        for (i = 0; i < il; i++) {

            pass = this.passes[i];

            if (pass.enabled === false) continue;

            pass.render(this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive);

            if (pass.needsSwap) {

                if (maskActive) {

                    var context = this.renderer.context;

                    context.stencilFunc(context.NOTEQUAL, 1, 0xffffffff);

                    this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, delta);

                    context.stencilFunc(context.EQUAL, 1, 0xffffffff);

                }

                this.swapBuffers();

            }

            if (THREE.MaskPass !== undefined) {

                if (pass instanceof THREE.MaskPass) {

                    maskActive = true;

                } else if (pass instanceof THREE.ClearMaskPass) {

                    maskActive = false;

                }

            }

        }

    },

    reset: function (renderTarget) {

        if (renderTarget === undefined) {

            var size = this.renderer.getDrawingBufferSize();

            renderTarget = this.renderTarget1.clone();
            renderTarget.setSize(size.width, size.height);

        }

        this.renderTarget1.dispose();
        this.renderTarget2.dispose();
        this.renderTarget1 = renderTarget;
        this.renderTarget2 = renderTarget.clone();

        this.writeBuffer = this.renderTarget1;
        this.readBuffer = this.renderTarget2;

    },

    setSize: function (width, height) {

        this.renderTarget1.setSize(width, height);
        this.renderTarget2.setSize(width, height);

        for (var i = 0; i < this.passes.length; i++) {

            this.passes[i].setSize(width, height);

        }

    }

});


THREE.Pass = function () {

    this.enabled = true;

    this.needsSwap = true;

    this.clear = false;

    this.renderToScreen = false;

};

Object.assign(THREE.Pass.prototype, {

    setSize: function (width, height) { },

    render: function (renderer, writeBuffer, readBuffer, delta, maskActive) {

        console.error('THREE.Pass: .render() must be implemented in derived pass.');

    }

});

THREE.RenderPass = function (scene, camera, overrideMaterial, clearColor, clearAlpha) {

    THREE.Pass.call(this);

    this.scene = scene;
    this.camera = camera;

    this.overrideMaterial = overrideMaterial;

    this.clearColor = clearColor;
    this.clearAlpha = (clearAlpha !== undefined) ? clearAlpha : 0;

    this.clear = true;
    this.clearDepth = false;
    this.needsSwap = false;

};

THREE.RenderPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

    constructor: THREE.RenderPass,

    render: function (renderer, writeBuffer, readBuffer, delta, maskActive) {

        var oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        this.scene.overrideMaterial = this.overrideMaterial;

        var oldClearColor, oldClearAlpha;

        if (this.clearColor) {

            oldClearColor = renderer.getClearColor().getHex();
            oldClearAlpha = renderer.getClearAlpha();

            renderer.setClearColor(this.clearColor, this.clearAlpha);

        }

        if (this.clearDepth) {

            renderer.clearDepth();

        }

        renderer.render(this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear);

        if (this.clearColor) {

            renderer.setClearColor(oldClearColor, oldClearAlpha);

        }

        this.scene.overrideMaterial = null;
        renderer.autoClear = oldAutoClear;
    }

});

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.ShaderPass = function (shader, textureID) {

    THREE.Pass.call(this);

    this.textureID = (textureID !== undefined) ? textureID : "tDiffuse";

    if (shader instanceof THREE.ShaderMaterial) {

        this.uniforms = shader.uniforms;

        this.material = shader;

    } else if (shader) {

        this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);

        this.material = new THREE.ShaderMaterial({

            defines: Object.assign({}, shader.defines),
            uniforms: this.uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader

        });

    }

    this.camera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
    this.scene = new THREE.Scene();

    this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
    this.quad.frustumCulled = false; // Avoid getting clipped
    this.scene.add(this.quad);

};

THREE.ShaderPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

    constructor: THREE.ShaderPass,

    render: function (renderer, writeBuffer, readBuffer, delta, maskActive) {

        if (this.uniforms[this.textureID]) {

            this.uniforms[this.textureID].value = readBuffer.texture;

        }

        this.quad.material = this.material;

        if (this.renderToScreen) {

            renderer.render(this.scene, this.camera);

        } else {

            renderer.render(this.scene, this.camera, writeBuffer, this.clear);

        }

    }

});

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.MaskPass = function (scene, camera) {

    THREE.Pass.call(this);

    this.scene = scene;
    this.camera = camera;

    this.clear = true;
    this.needsSwap = false;

    this.inverse = false;

};

THREE.MaskPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

    constructor: THREE.MaskPass,

    render: function (renderer, writeBuffer, readBuffer, delta, maskActive) {

        var context = renderer.context;
        var state = renderer.state;

        // don't update color or depth

        state.buffers.color.setMask(false);
        state.buffers.depth.setMask(false);

        // lock buffers

        state.buffers.color.setLocked(true);
        state.buffers.depth.setLocked(true);

        // set up stencil

        var writeValue, clearValue;

        if (this.inverse) {

            writeValue = 0;
            clearValue = 1;

        } else {

            writeValue = 1;
            clearValue = 0;

        }

        state.buffers.stencil.setTest(true);
        state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
        state.buffers.stencil.setFunc(context.ALWAYS, writeValue, 0xffffffff);
        state.buffers.stencil.setClear(clearValue);

        // draw into the stencil buffer

        renderer.render(this.scene, this.camera, readBuffer, this.clear);
        renderer.render(this.scene, this.camera, writeBuffer, this.clear);

        // unlock color and depth buffer for subsequent rendering

        state.buffers.color.setLocked(false);
        state.buffers.depth.setLocked(false);

        // only render where stencil is set to 1

        state.buffers.stencil.setFunc(context.EQUAL, 1, 0xffffffff);  // draw if == 1
        state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);

    }

});


THREE.ClearMaskPass = function () {

    THREE.Pass.call(this);

    this.needsSwap = false;

};

THREE.ClearMaskPass.prototype = Object.create(THREE.Pass.prototype);

Object.assign(THREE.ClearMaskPass.prototype, {

    render: function (renderer, writeBuffer, readBuffer, delta, maskActive) {

        renderer.state.buffers.stencil.setTest(false);

    }

});
