(window.webpackJsonp=window.webpackJsonp||[]).push([[4],{249:function(e,t,a){"use strict";a.r(t);var n=a(0),l=a.n(n),r=a(268),o=a(256),c=a(250),i=a.n(c),s=a(246),m=a.n(s);t.default=function(e){var t=e.location;return l.a.createElement(o.a,{location:t},l.a.createElement("h1",null,"Contact"),l.a.createElement("div",{className:m.a.section},l.a.createElement("div",null,l.a.createElement("h2",null,"find me"),l.a.createElement("ul",{className:i.a.contact},l.a.createElement("li",null,l.a.createElement("a",{href:"mailto:contact@tomasz-zielinski.com"},l.a.createElement(r.a,null),"contact@tomasz-zielinski.com")),l.a.createElement("li",null,l.a.createElement("a",{href:"/tomasz_zielinski.pdf"},l.a.createElement(r.b,null),"resume")),l.a.createElement("br",null),l.a.createElement("li",null,l.a.createElement("a",{href:"https://github.com/Tomasz-Zielinski"},l.a.createElement(r.c,null),"github ",l.a.createElement("span",null,"github.com/tomasz-zielinski"))),l.a.createElement("li",null,l.a.createElement("a",{href:"https://stackoverflow.com/users/7306664/tomasz-zieli%C5%84ski"},l.a.createElement(r.e,null),"stack overflow ",l.a.createElement("span",null,"stackoverflow.com/tomasz-zielinski"))),l.a.createElement("li",null,l.a.createElement("a",{href:"https://www.linkedin.com/in/tomasz-zielinski-a97999161/"},l.a.createElement(r.d,null),"linkedin ",l.a.createElement("span",null,"linkedin.com/in/tomasz-zielinski"))),l.a.createElement("li",null,l.a.createElement("a",{href:"http://twitter.com/corashina"},l.a.createElement(r.f,null),"twitter ",l.a.createElement("span",null,"twitter.com/corashina"))))),l.a.createElement("div",null,l.a.createElement("h2",null,"see also"),l.a.createElement("p",null,"hi"))))}},253:function(e,t,a){var n;e.exports=(n=a(255))&&n.default||n},254:function(e,t,a){"use strict";var n=a(0),l=a.n(n),r=a(84),o=a.n(r);a.d(t,"a",function(){return o.a});a(253),a(14).default.enqueue,l.a.createContext({})},255:function(e,t,a){"use strict";a.r(t);a(18);var n=a(0),l=a.n(n),r=a(111);t.default=function(e){var t=e.location,a=e.pageResources;return a?l.a.createElement(r.a,Object.assign({location:t,pageResources:a},a.json)):null}},256:function(e,t,a){"use strict";a(36);var n=a(0),l=a.n(n),r=a(257),o=a.n(r),c=(a(17),a(15),a(11),a(24),a(254)),i=a(258),s=(a(110),a(59),a(243)),m=a.n(s);var u=function(e){return("0"+parseInt(e,10).toString(16)).slice(-2)},d=function(e){if(/^#[0-9A-F]{6}$/i.test(e))return e;var t=e.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);return"#"+u(t[1])+u(t[2])+u(t[3])},p=function(e){var t,a;function n(t){var a;(a=e.call(this,t)||this).switchTheme=a.switchTheme.bind(function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(a));return"undefined"!=typeof window&&(document.body.className=document.body.className||"dark"),a.color="#fff"===a.color?"#000":"#fff",a.state={theme:"dark"},a}a=e,(t=n).prototype=Object.create(a.prototype),t.prototype.constructor=t,t.__proto__=a;var r=n.prototype;return r.switchTheme=function(e){e.target.style.backgroundColor=d(window.getComputedStyle(document.body).getPropertyValue("background-color"));var t="white"===this.state.theme?"dark":"white";this.setState({theme:t}),document.body.className=t;var a=d(window.getComputedStyle(document.body).getPropertyValue("background-color")),n=d(window.getComputedStyle(document.body).getPropertyValue("color"));window.CANVAS_BACKGROUND.setColors(n,a)},r.render=function(){return l.a.createElement("div",{className:m.a.theme},l.a.createElement("div",{style:{backgroundColor:this.color},onClick:this.switchTheme}))},n}(l.a.Component);var h=function(e){var t,a;function n(t){var a;return(a=e.call(this,t)||this).state={expanded:!1},a}a=e,(t=n).prototype=Object.create(a.prototype),t.prototype.constructor=t,t.__proto__=a;var r=n.prototype;return r.toggle=function(){this.setState(function(e){return{expanded:!e.expanded}})},r.render=function(){var e,t,a=this,n=this.props.location,r=this.state.expanded,o={Home:"/",Work:"/works",Contact:"/contact"},s=l.a.createElement("ul",null,Object.keys(o).map(function(e){var t=o[e];return l.a.createElement("li",{key:e},t===n.pathname?l.a.createElement("span",null,e):l.a.createElement(c.a,{to:t},e))}));return r?(e=l.a.createElement(i.b,{className:"menu-toggle",onClick:function(){return a.toggle()}}),t=l.a.createElement("div",{className:"menu-container expanded"},s)):(e=l.a.createElement(i.a,{className:"menu-toggle",onClick:function(){return a.toggle()}}),t=l.a.createElement("div",{className:"menu-container"},s)),l.a.createElement("nav",{className:"navbar"},l.a.createElement(p,null),e,t)},n}(l.a.Component),f=a(244),E=a.n(f);function v(){return l.a.createElement("div",{className:E.a.footer},l.a.createElement("p",null,"Copyright © ",(new Date).getFullYear()," Tomasz Zielinski"))}var w=a(245),k=a.n(w);t.a=function(e){var t=e.children,a=e.location,n=e.title,r=e.width,c=r?{maxWidth:r+"px"}:{};return l.a.createElement("div",{className:k.a.layout,style:c},l.a.createElement(o.a,{title:a.pathname.split("/").pop()},l.a.createElement("meta",{name:"description",title:n,content:"Tomasz Zielinski Portfolio Website"})),l.a.createElement(h,{location:a}),l.a.createElement("div",{className:"content"},t),l.a.createElement(v,null))}}}]);
//# sourceMappingURL=component---src-pages-contact-jsx-03d45ed3efa3f634a638.js.map