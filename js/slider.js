var _scene, _camera, _renderer, _mouse, raycaster;
var mouse_event = {}, slider_velocity = 0, intersected = null;

const height = 50;
const _width = height * 1.4;
const slider_width = 600;
const slider_height = 150;
const labels = ['Agar.io', 'Particle-Engine', 'Civio', 'Endless-City', 'Fitmed', 'Flappy-Pixie', 'Kiteprint', 'WebGL-Minecraft'];
var slides = [];
var images = [];

var clickOn = null;
var switching = false;
var slider_pos = 0;

var xDown = null;
var yDown = null;

function init() {

    _scene = new THREE.Scene();
    _camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
    _camera.position.z += 125;
    _camera.position.y += 25;
    _mouse = new THREE.Vector2();
    raycaster = new THREE.Raycaster();

    _renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#slider'), alpha: true, antialias: true });
    _renderer.setSize(window.innerWidth, window.innerHeight);

    var textureloader = new THREE.TextureLoader();

    var loader = new THREE.FontLoader();
    loader.load('js/helvetiker_regular.typeface.json', function (font) {

        for (let label of labels) {

            let slide = new THREE.Group();

            let material = new THREE.MeshBasicMaterial({ map: textureloader.load(`img/${label}.png`), userData: label });
            let geometry = new THREE.PlaneGeometry(_width, height, 1);
            let img = new THREE.Mesh(geometry, material);

            let coords = noOverlap(slides);
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

            slides.push(slide);
            _scene.add(slide);

        }

        images = slides.map(slide => slide.children[0]);

        if (window.location.pathname == '/index.html' ||
            window.location.pathname == '/about.html') {
            slider_pos = -1;
            slides.forEach((e) => e.position.x -= slider_width);
        }
        else if (window.location.pathname == '/skills.html' ||
            window.location.pathname == '/contact.html') {
            slider_pos = 1;
            slides.forEach((e) => e.position.x += slider_width);
        }

        render();

    });

}

function render() {
    requestAnimationFrame(render);

    if (!slider_pos) {
        for (let i = 0; i < slides.length; i++) {
            slides[i].position.x += slider_velocity;
            if (slides[i].position.x < -slider_width / 2 || slides[i].position.x > slider_width / 2) slides[i].position.x = -slides[i].position.x;
        }
    }

    slider_velocity *= .94;

    _camera.position.x += (-_mouse.x - _camera.position.x) * 1.4;
    _camera.position.y += (-_mouse.y - _camera.position.y) * 1.4;
    _camera.lookAt(_scene.position);

    _renderer.render(_scene, _camera);
};

function onMouseMove(event) {

    raycaster.setFromCamera(_mouse, _camera);

    let intersects = raycaster.intersectObjects(images);

    if (intersects.length > 0) raycastOn(intersects);
    else if (intersected) raycastOff();

    let new_x = (event.clientX / window.innerWidth) * 2 - 1;

    slider_velocity += mouse_event[1] ? (new_x - _mouse.x) * 10 : 0;

    _mouse.x = new_x;
    _mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown(event) {
    mouse_event[event.which] = true;
    clickOn = intersected;
}

function onMouseUp(event) {
    mouse_event[event.which] = false;
    if (intersected && clickOn == intersected) window.open(`https://github.com/Tomasz-Zielinski/${intersected.material.userData}`, '_blank');
}

function onScroll(event) {
    slider_velocity += (event.deltaY / 100);
}

function raycastOn(intersects) {
    if (intersected && intersected != intersects[0].object) raycastOff();
    intersected = intersects[0].object;
    TweenMax.to(intersected.parent.position, 0.6, { z: 10 + Math.random() * 5, ease: Power2.easeOut });
    TweenMax.to(intersected.parent.children[2].position, 0.4, { y: intersected.parent.children[0].position.y + (height / 2) * 1.1, ease: Power2.easeOut });
}

function raycastOff() {
    TweenMax.to(intersected.parent.position, 0.6, { z: 0 + Math.random() * 5, ease: Power2.easeOut });
    TweenMax.to(intersected.parent.children[2].position, 0.4, { y: intersected.parent.children[0].position.y, ease: Power2.easeOut });
    intersected = null;
}

function onKeyDown(event) {
    switch (event.keyCode) {
        case 37: changePage(-1); break;
        case 39: changePage(1); break;
    }
}

function changePage(direction) {
    let arr = document.querySelectorAll('nav a');
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].classList.contains('nav-current')) {
            if ((i == 0 && direction == -1) || (i == 4 && direction == 1) || switching) return;
            document.querySelectorAll('nav a')[i + direction].click();
            break;
        }
    }
}

function noOverlap(slides) {

    if (slides.length == 0) return { x: (Math.random() - 0.5) * slider_width, y: (Math.random() - 0.5) * slider_height };

    let x, y, overlap = true;

    while (overlap) {
        x = (Math.random() - 0.5) * slider_width;
        for (let s of slides) {
            overlap = (x > s.position.x - _width / 1.5 && x < s.position.x + _width / 1.5);
            if (overlap) break;
        }
    }
    overlap = true;
    while (overlap) {
        y = (Math.random() - 0.5) * slider_height;
        for (let s of slides) {
            overlap = (y > s.position.y + height / 2.5 && y < s.position.y - height / 2.5);
            if (overlap) break;
        }
    }

    return { x, y };

}

function onTouchMove(event) {


    let new_y = (event.touches[0].clientY / window.innerHeight) * 2 - 1;

    slider_velocity -= Math.abs(new_y - _mouse.y) * 2;

    _mouse.y = new_y;


    if (!xDown || !yDown) return;

    var xUp = event.touches[0].clientX;
    var yUp = event.touches[0].clientY;
    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 1) changePage(1)
        else changePage(-1);
    } else {
        if (yDiff > 0) {
            /* up swipe */
        } else {
            /* down swipe */
        }
    }

    xDown = null;
    yDown = null;

}

function onTouchStart(event) {
    xDown = event.touches[0].clientX;
    yDown = event.touches[0].clientY;
};

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('wheel', onScroll, false);
window.addEventListener('keydown', onKeyDown, false);
window.addEventListener('touchmove', onTouchMove, false);
window.addEventListener('touchstart', onTouchStart, false);

init();