document
  .getElementsByClassName("arrows")[0]
  .addEventListener("click", function(e) {
    document.getElementsByClassName("about")[0].scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });
  });

typeout(
  ".typeout",
  ["a programmer", "a computer-scientist", "a designer", "a developer"],
  {
    numLoops: 3,
    callback: function(el) {
      el.innerHTML += ".";
    }
  }
);
document.getElementById(
  "copyright-date"
).textContent = new Date().getFullYear();
document.body.style.opacity = 1;
