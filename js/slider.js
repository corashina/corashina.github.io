var _scene, _camera, _renderer, mouse, raycaster, mouseEvent, sliderVelocity = 0;
var intersected = null;

const height = 50;
const _width = height * 1.4;
const sliderWidth = 600;
const sliderHeight = 150;
const labels = ['Agar.io', 'Astro', 'Civio', 'Endless-City', 'Fitmed', 'Flappy-Pixie', 'Kiteprint', 'WebGL-Minecraft'];
var slides = [];
var images = [];
var sliderOn = false;
var clickOn = null;
var switching = false;

function init() {

    _scene = new THREE.Scene();
    _camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
    _camera.position.z += 125;
    _camera.position.y += 25;
    mouse = new THREE.Vector2();
    raycaster = new THREE.Raycaster();
    mouseEvent = {};
    sliderVelocity = 0;

    _renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#slider'), alpha: true, antialias: true });
    _renderer.setSize(window.innerWidth, window.innerHeight);

    var textureloader = new THREE.TextureLoader();

    var loader = new THREE.FontLoader();
    loader.load('js/helvetiker_regular.typeface.json', function (font) {

        for (let label of labels) {

            let slide = new THREE.Group();

            let material = new THREE.MeshBasicMaterial({ map: textureloader.load(`img/${label}.png`), userData: label });
            let img = new THREE.Mesh(new THREE.PlaneGeometry(_width, height, 1), material);

            slide.position.set(noOverlapX(slides), noOverlapY(slides), -Math.random() * 10);
            slide.add(img);

            var matLite = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xefefef), side: THREE.FrontSide });

            var geometry = new THREE.ShapeBufferGeometry(font.generateShapes(label, 100));

            geometry.computeBoundingBox();
            geometry.translate(- 0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x), 0, 0);

            var text = new THREE.Mesh(geometry, matLite);
            text.scale.set(0.04, 0.04, 0.04);
            text.position.y += (height / 2 * 1.1);
            slide.add(text)

            slides.push(slide);
            _scene.add(slide);

        }

        images = slides.map(slide => slide.children[0]);

        if (window.location.pathname != '/work.html') slides.forEach((e) => e.position.x += sliderWidth);

        render();

    });

}

function render() {
    requestAnimationFrame(render);

    if (sliderOn) {
        for (let i = 0; i < slides.length; i++) {
            slides[i].position.x += sliderVelocity;
            if (slides[i].position.x < -sliderWidth / 2 || slides[i].position.x > sliderWidth / 2) slides[i].position.x = -slides[i].position.x;
        }
    }

    sliderVelocity *= .94;

    if (mouseEvent[1]) _camera.fov += (1 / (_camera.fov - 88));
    else if (_camera.fov > 90) _camera.fov -= (_camera.fov - 88) / 100;
    _camera.updateProjectionMatrix();

    _camera.position.x += (-mouse.x - _camera.position.x) * 1.1;
    _camera.position.y += (-mouse.y - _camera.position.y) * 1.1;
    _camera.lookAt(_scene.position);

    _renderer.render(_scene, _camera);
};

function noOverlapX(slides) {

    if (slides.length == 0) return (Math.random() - 0.5) * sliderWidth;

    let randomX = null, overlap = true;

    while (overlap) {
        randomX = (Math.random() - 0.5) * sliderWidth;
        for (let s of slides) {
            overlap = (randomX > s.position.x - _width / 1.5 && randomX < s.position.x + _width / 1.5);
            if (overlap) break;
        }
    }

    return randomX;

}


function noOverlapY(slides) {

    if (slides.length == 0) return (Math.random() - 0.5) * sliderHeight;

    let randomY = null, overlap = true;

    while (overlap) {
        randomY = (Math.random() - 0.5) * sliderHeight;
        for (let s of slides) {
            overlap = (randomY > s.position.y + height / 2.5 && randomY < s.position.y - height / 2.5);
            if (overlap) break;
        }
    }

    return randomY;

}

function onMouseMove(event) {

    raycaster.setFromCamera(mouse, _camera);

    var intersects = raycaster.intersectObjects(images);

    if (intersects.length > 0) {
        intersected = intersects[0].object;
        TweenMax.to(intersected.parent.position, 0.6, { z: 10, ease: Power2.easeOut });
    } else {
        if (intersected) TweenMax.to(intersected.parent.position, 0.6, { z: 0 + Math.random() * 5, ease: Power2.easeOut });
        intersected = null;
    }

    let new_x = (event.clientX / window.innerWidth) * 2 - 1;
    let new_y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (mouseEvent[1]) sliderVelocity += (new_x - mouse.x) * 10;

    mouse.x = new_x;
    mouse.y = new_y;
}

function onMouseDown(event) {
    mouseEvent[event.which] = true;
    clickOn = intersected;
}

function onMouseUp(event) {
    mouseEvent[event.which] = false;
    if (intersected && clickOn == intersected) window.open(`https://github.com/Tomasz-Zielinski/${intersected.material.userData}`, '_blank');
}

function onScroll(event) {
    sliderVelocity += (event.deltaY / 100);
}

function onKeyDown(event) {
    switch (event.keyCode) {
        case 37: changePage(-1); break;
        case 39: changePage(1); break;
    }
}

function changePage(direction) {
    let arr = document.querySelectorAll('.socials ul li a')
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].classList.contains('current')) {
            if ((i == 0 && direction == -1) || (i == 4 && direction == 1) || switching) return;
            document.querySelectorAll('.socials ul li a')[i + direction].click();
            break;
        }
    }
}

window.addEventListener('mousemove', (event) => onMouseMove(event), false);
window.addEventListener('mousedown', (event) => onMouseDown(event), false);
window.addEventListener('mouseup', (event) => onMouseUp(event), false);
window.addEventListener('wheel', (event) => onScroll(event), false);
window.addEventListener('keydown', (event) => onKeyDown(event), false);

init();