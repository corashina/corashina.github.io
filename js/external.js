document.getElementsByClassName('arrows')[0].addEventListener('click', function(e) {
    document.getElementsByClassName('about')[0].scrollIntoView({behavior:"smooth", block:"start", inline:"nearest"});
})

typeout('.typeout', ['a programmer', 'a computer-scientist', 'a designer', 'a developer'], {
  numLoops: 3,
  callback: function(el) {
    el.innerHTML += ".";
  }
});
window.sr = ScrollReveal();
sr.reveal('.about');
sr.reveal('.technologies');
sr.reveal('.image');
sr.reveal('.projects');
sr.reveal('.hoverable');
sr.reveal('.wrapp');

document.body.style.opacity = 1;
