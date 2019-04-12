var slider = {

    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000),
    renderer: new THREE.WebGLRenderer({ canvas: document.querySelector('#slider'), alpha: true, antialias: true }),
    mouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),

    intersected: null,
    clicked: null,
    switching: false,

    width: 70,
    height: 50,
    slider_width: 600,
    slider_height: 150,
    position: 0,
    velocity: 0,

    slides: [],
    images: [],

    mouse_event: {},

    labels: ['Agar.io', 'Particle-Engine', 'Civio', 'Endless-City', 'Fitmed', 'Flappy-Pixie', 'Kiteprint', 'WebGL-Minecraft'],

    xDown: null,
    yDown: null,

    init: function () {

        _this.camera.position.z += 125;

        _this.renderer.setSize(window.innerWidth, window.innerHeight);

        var textureloader = new THREE.TextureLoader();

        var loader = new THREE.FontLoader();
        loader.load('js/helvetiker_regular.typeface.json', function (font) {

            for (let label of _this.labels) {

                let slide = new THREE.Group();

                let material = new THREE.MeshBasicMaterial({ map: textureloader.load(`img/${label}.png`), userData: label });
                let geometry = new THREE.PlaneGeometry(_this.width, _this.height, 1);
                let img = new THREE.Mesh(geometry, material);

                let coords = _this.noOverlap(_this.slides);
                slide.position.set(coords.x, coords.y, -Math.random() * 10);
                slide.add(img);

                let outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000, side: THREE.FrontSide });
                let outlineMesh = new THREE.Mesh(geometry, outlineMaterial);
                outlineMesh.position.copy(img.position);
                outlineMesh.scale.multiplyScalar(1.03);
                outlineMesh.position.z -= 0.1;
                slide.add(outlineMesh);

                let matLite = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xefefef), side: THREE.FrontSide });

                geometry = new THREE.ShapeBufferGeometry(font.generateShapes(label, 100));

                geometry.computeBoundingBox();
                geometry.translate(- 0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x), 0, 0);

                var text = new THREE.Mesh(geometry, matLite);
                text.scale.set(0.04, 0.04, 0.04);
                text.position.z -= 1;
                slide.add(text)

                _this.slides.push(slide);
                _this.scene.add(slide);

            }

            _this.images = _this.slides.map(slide => slide.children[0]);

            if (window.location.pathname == "/" || window.location.pathname == '/index.html' ||
                window.location.pathname == '/about.html') {
                _this.position = -1;
                _this.slides.forEach((e) => e.position.x -= _this.slider_width);
            }
            else if (window.location.pathname == '/skills.html' ||
                window.location.pathname == '/contact.html') {
                _this.position = 1;
                _this.slides.forEach((e) => e.position.x += _this.slider_width)
            }

            _this.render();

        });

        window.addEventListener('mousemove', _this.onMouseMove, false);
        window.addEventListener('mousedown', _this.onMouseDown, false);
        window.addEventListener('mouseup', _this.onMouseUp, false);
        window.addEventListener('wheel', _this.onScroll, false);
        window.addEventListener('keydown', _this.onKeyDown, false);
        window.addEventListener('touchmove', _this.onTouchMove, false);
        window.addEventListener('touchstart', _this.onTouchStart, false);

    },

    render: function () {
        requestAnimationFrame(_this.render);

        if (!_this.position) {
            for (let i = 0; i < _this.slides.length; i++) {
                _this.slides[i].position.x += _this.velocity;
                if (_this.slides[i].position.x < -_this.slider_width / 2 || _this.slides[i].position.x > _this.slider_width / 2) _this.slides[i].position.x = -_this.slides[i].position.x;
            }
        }

        _this.velocity *= .94;

        _this.camera.position.x += (-_this.mouse.x - _this.camera.position.x) * 1.4;
        _this.camera.position.y += (-_this.mouse.y - _this.camera.position.y) * 1.4;
        _this.camera.lookAt(_this.scene.position);

        _this.renderer.render(_this.scene, _this.camera);
    },

    onMouseMove: function (event) {

        _this.raycaster.setFromCamera(_this.mouse, _this.camera);

        let intersects = _this.raycaster.intersectObjects(_this.images);

        if (intersects.length > 0) _this.raycastOn(intersects);
        else if (_this.intersected) _this.raycastOff();

        let new_x = (event.clientX / window.innerWidth) * 2 - 1;

        _this.velocity += _this.mouse_event[1] ? (new_x - _this.mouse.x) * 10 : 0;

        _this.mouse.x = new_x;
        _this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    onMouseDown: function (event) {
        _this.mouse_event[event.which] = true;
        _this.clicked = _this.intersected;
    },

    onMouseUp: function (event) {
        _this.mouse_event[event.which] = false;
        if (_this.intersected && _this.clicked == _this.intersected) window.open(`https://github.com/Tomasz-Zielinski/${_this.intersected.material.userData}`, '_blank');
    },

    onScroll: function (event) {
        _this.velocity += (event.deltaY / 100);
    },

    raycastOn: function (intersects) {
        if (_this.intersected && _this.intersected != intersects[0].object) _this.raycastOff();
        _this.intersected = intersects[0].object;
        TweenMax.to(_this.intersected.parent.position, 0.6, { z: 10 + Math.random() * 5, ease: Power2.easeOut });
        TweenMax.to(_this.intersected.parent.children[2].position, 0.4, { y: _this.intersected.parent.children[0].position.y + (_this.height / 2) * 1.1, ease: Power2.easeOut });
    },

    raycastOff: function () {
        TweenMax.to(_this.intersected.parent.position, 0.6, { z: 0 + Math.random() * 5, ease: Power2.easeOut });
        TweenMax.to(_this.intersected.parent.children[2].position, 0.4, { y: _this.intersected.parent.children[0].position.y, ease: Power2.easeOut });
        _this.intersected = null;
    },

    onKeyDown: (event) => {
        switch (event.keyCode) {
            case 37: _this.changePage(-1); break;
            case 39: _this.changePage(1); break;
        }
    },

    changePage: function (direction) {
        let arr = document.querySelectorAll('nav a');
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].classList.contains('nav-current')) {
                if ((i == 0 && direction == -1) || (i == 4 && direction == 1) || _this.switching) return;
                document.querySelectorAll('nav a')[i + direction].click();
                break;
            }
        }
    },

    noOverlap: function () {

        if (_this.slides.length == 0) return { x: (Math.random() - 0.5) * _this.slider_width, y: (Math.random() - 0.5) * _this.slider_height };

        let x, y, overlap = true;

        while (overlap) {
            x = (Math.random() - 0.5) * _this.slider_width;
            for (let s of _this.slides) {
                overlap = (x > s.position.x - _this.width / 1.5 && x < s.position.x + _this.width / 1.5);
                if (overlap) break;
            }
        }
        overlap = true;
        while (overlap) {
            y = (Math.random() - 0.5) * _this.slider_height;
            for (let s of _this.slides) {
                overlap = (y > s.position.y + _this.height / 2.5 && y < s.position.y - _this.height / 2.5);
                if (overlap) break;
            }
        }

        return { x, y };

    },

    onTouchMove: function (event) {

        let new_y = (event.touches[0].clientY / window.innerHeight) * 2 - 1;

        _this.velocity -= Math.abs(new_y - _this.mouse.y) * 2;

        _this.mouse.y = new_y;

        if (!xDown || !yDown) return;

        var xUp = event.touches[0].clientX;
        var yUp = event.touches[0].clientY;
        var xDiff = xDown - xUp;
        var yDiff = yDown - yUp;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (xDiff > 1) slider.changePage(1)
            else slider.changePage(-1);
        }

        xDown = null;
        yDown = null;

    },

    onTouchStart: function (event) {
        xDown = event.touches[0].clientX;
        yDown = event.touches[0].clientY;
    }
}

var _this = slider;

_this.init();