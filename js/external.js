<<<<<<< HEAD
var rellax = new Rellax('.rellax', {
    center: true
});

document
    .getElementsByClassName("arrows")[0]
    .addEventListener("click", function (e) {
=======
document
    .getElementsByClassName("arrows")[0]
    .addEventListener("click", function(e) {
>>>>>>> a830982eb84b1a0cad3a9d834a47c79247088b0d
        document.getElementsByClassName("about")[0].scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest"
<<<<<<< HEAD
        })
=======
        });
>>>>>>> a830982eb84b1a0cad3a9d834a47c79247088b0d
    });

typeout(
    ".typeout",
    ["a programmer", "a computer-scientist", "a designer", "a developer"],
    {
<<<<<<< HEAD
        numLoops: 12,
        callback: function (el) {
=======
        numLoops: 3,
        callback: function(el) {
>>>>>>> a830982eb84b1a0cad3a9d834a47c79247088b0d
            el.innerHTML += ".";
        }
    }
);
document.getElementById(
    "copyright-date"
).textContent = new Date().getFullYear();
document.body.style.opacity = 1;
<<<<<<< HEAD
AOS.init({ disable: 'phone' });
=======
>>>>>>> a830982eb84b1a0cad3a9d834a47c79247088b0d
