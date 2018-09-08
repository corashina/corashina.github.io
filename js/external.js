var rellax = new Rellax('.rellax', {
    center: true
});

document
    .getElementsByClassName("arrows")[0]
    .addEventListener("click", function (e) {
        document.getElementsByClassName("about")[0].scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest"
        })
    });

typeout(
    ".typeout",
    ["a programmer", "a computer-scientist", "a designer", "a developer"],
    {
        numLoops: 12,
        callback: function (el) {
            el.innerHTML += ".";
        }
    }
);
document.getElementById(
    "copyright-date"
).textContent = new Date().getFullYear();
document.body.style.opacity = 1;
AOS.init({ disable: 'phone' });