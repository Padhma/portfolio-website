(function () {
  "use strict";
  var main = document.querySelector("main");
  var panels = Array.from(main.querySelectorAll(".section"));
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reflow = window.matchMedia("(max-width:767px), (max-height:700px)");
  var current = Math.max(0, panels.findIndex(function (p) { return "#" + p.id === location.hash; }));
  var animation = 0;
  var animating = false;
  var gestureBusy = false;
  var gestureTimer;
  var wheelAmount = 0;

  function announce() {
    document.querySelectorAll('.nav-list a').forEach(function (a) {
      if (a.hash === "#" + panels[current].id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }
  function goTo(index, focus, instant) {
    current = Math.max(0, Math.min(panels.length - 1, index));
    cancelAnimationFrame(animation);
    var start = main.scrollTop;
    var end = panels[current].offsetTop;
    var began;
    announce();
    if (focus) panels[current].focus({ preventScroll: true });
    if (instant || reduced.matches) {
      main.style.scrollSnapType = "";
      main.scrollTop = end;
      animating = false;
      return;
    }
    if (reflow.matches) {
      main.style.scrollSnapType = "";
      main.scrollTo({ top: end, behavior: "smooth" });
      animating = false;
      return;
    }
    animating = true;
    main.style.scrollSnapType = "none";
    function frame(time) {
      if (began === undefined) began = time;
      var t = Math.min(1, (time - began) / 650);
      var eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      main.scrollTop = start + (end - start) * eased;
      if (t < 1) animation = requestAnimationFrame(frame);
      else {
        main.scrollTop = end;
        main.style.scrollSnapType = "";
        animating = false;
      }
    }
    animation = requestAnimationFrame(frame);
  }
  function advance(direction) {
    if (!animating) goTo(current + direction, true);
  }
  // One wheel/trackpad gesture advances one panel. Momentum events belong to
  // that gesture until input has been quiet for 220ms.
  main.addEventListener("wheel", function (event) {
    if (reflow.matches) return;
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) return;
    event.preventDefault();
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(function () { gestureBusy = false; wheelAmount = 0; }, 220);
    if (gestureBusy || animating) return;
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? main.clientHeight : 1);
    wheelAmount += delta;
    if (Math.abs(wheelAmount) < 24) return;
    gestureBusy = true;
    advance(wheelAmount > 0 ? 1 : -1);
  }, { passive: false });

  document.addEventListener("keydown", function (event) {
    if (reflow.matches) return;
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === " " && event.target.closest("a,button")) return;
    var direction = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, " ": event.shiftKey ? -1 : 1 }[event.key];
    if (direction) { event.preventDefault(); advance(direction); }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); goTo(event.key === "Home" ? 0 : panels.length - 1, true);
    }
  });
  var touch;
  main.addEventListener("touchstart", function (event) {
    if (reflow.matches) return;
    if (event.touches.length === 1) touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    else touch = null;
  }, { passive: true });
  main.addEventListener("touchmove", function (event) {
    if (reflow.matches || !touch || event.touches.length !== 1) return;
    var dx = event.touches[0].clientX - touch.x;
    var dy = event.touches[0].clientY - touch.y;
    if (Math.abs(dy) > Math.abs(dx)) event.preventDefault();
  }, { passive: false });
  main.addEventListener("touchend", function (event) {
    if (reflow.matches || !touch || !event.changedTouches.length) return;
    var dx = event.changedTouches[0].clientX - touch.x;
    var dy = event.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) advance(dy < 0 ? 1 : -1);
  }, { passive: true });
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var index = panels.findIndex(function (panel) { return "#" + panel.id === link.hash; });
      if (link.hash === "#main") index = 0;
      if (index < 0) return;
      event.preventDefault();
      history.replaceState(null, "", "#" + panels[index].id);
      goTo(index, true);
    });
  });
  window.addEventListener("hashchange", function () {
    var index = panels.findIndex(function (panel) { return "#" + panel.id === location.hash; });
    if (index >= 0) goTo(index, false);
  });
  main.addEventListener("focusin", function (event) {
    if (reflow.matches) return;
    var index = panels.indexOf(event.target.closest(".section"));
    if (index >= 0 && index !== current) goTo(index, false);
  });
  window.addEventListener("resize", function () { if (!reflow.matches) goTo(current, false, true); });
  goTo(current, false, true);

  document.querySelectorAll("[data-shelf]").forEach(function (shelf) {
    var prev = document.querySelector('[data-shelf-prev][aria-controls="' + shelf.id + '"]');
    var next = document.querySelector('[data-shelf-next][aria-controls="' + shelf.id + '"]');
    if (!prev || !next) return;
    function sync() {
      prev.disabled = shelf.scrollLeft <= 1;
      next.disabled = shelf.scrollLeft >= shelf.scrollWidth - shelf.clientWidth - 1;
    }
    function step() {
      var track = shelf.firstElementChild;
      var card = track && track.firstElementChild;
      if (!card) return shelf.clientWidth;
      return card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    }
    function slide(dir) { shelf.scrollBy({ left: dir * step(), behavior: reduced.matches ? "instant" : "smooth" }); }
    prev.addEventListener("click", function () { slide(-1); });
    next.addEventListener("click", function () { slide(1); });
    shelf.addEventListener("scroll", sync, { passive: true });
    new ResizeObserver(sync).observe(shelf);
    prev.parentElement.hidden = false;
    sync();
  });
})();

// Dotted connections follow the Experience cards when the layout changes.
(function () {
  "use strict";
  var map = document.querySelector(".experience-roadmap");
  if (!map) return;
  var track = map.querySelector(".roadmap-stops");
  var svg = map.querySelector(".roadmap-paths");
  var stops = Array.from(track.querySelectorAll(".experience-chip"));
  function draw() {
    var origin = map.getBoundingClientRect();
    var boxes = stops.map(function (card) {
      var rect = card.getBoundingClientRect();
      return { left: rect.left - origin.left + map.scrollLeft, right: rect.right - origin.left + map.scrollLeft,
        top: rect.top - origin.top, bottom: rect.bottom - origin.top };
    });
    var narrow = window.matchMedia("(max-width:700px)").matches;
    var currentPlane = map.querySelector(".roadmap-doodle--current");
    var startPlane = map.querySelector(".roadmap-doodle--start");
    currentPlane.style.left = (narrow ? boxes[0].left + 20 : boxes[0].right + 3) + "px";
    currentPlane.style.top = (narrow ? boxes[0].top - 92 : Math.max(1, boxes[0].top - 15)) + "px";
    var last = boxes[boxes.length - 1];
    startPlane.style.left = (narrow ? last.left + 20 : last.left - 134) + "px";
    startPlane.style.top = (narrow ? last.top - 92 : last.bottom - 55) + "px";
    svg.setAttribute("width", track.offsetWidth);
    svg.setAttribute("height", map.clientHeight);
    svg.replaceChildren();
    boxes.slice(0, -1).forEach(function (a, index) {
      var b = boxes[index + 1];
      var x1, y1, x2, y2, d;
      if (Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) {
        var right = b.left > a.left;
        x1 = right ? a.right + 4 : a.left - 4;
        x2 = right ? b.left - 4 : b.right + 4;
        y1 = (a.top + a.bottom) / 2;
        y2 = (b.top + b.bottom) / 2;
        var midX = (x1 + x2) / 2;
        var bend = index % 2 === 0 ? 20 : -20;
        d = "M " + x1 + " " + y1 + " C " + midX + " " + (y1 + bend) + " " + midX + " " + (y2 - bend) + " " + x2 + " " + y2;
      } else {
        x1 = (a.left + a.right) / 2;
        x2 = (b.left + b.right) / 2;
        y1 = a.bottom + 4;
        y2 = b.top - 4;
        var midY = (y1 + y2) / 2;
        var sway = a.left > track.offsetWidth / 2 ? 26 : -26;
        d = "M " + x1 + " " + y1 + " C " + (x1 + sway) + " " + midY + " " + (x2 + sway) + " " + midY + " " + x2 + " " + y2;
      }
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
  }
  var observer = new ResizeObserver(draw);
  observer.observe(track);
  observer.observe(map);
  if (document.fonts) document.fonts.ready.then(draw);
  draw();
})();

// Play each airplane doodle when it enters view; leave a still illustration after landing.
(function () {
  "use strict";
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var states = Array.from(document.querySelectorAll(".roadmap-doodle")).map(function (doodle) {
    return { element: doodle, visible: false, animations: [] };
  });
  function stop(state) {
    state.animations.forEach(function (animation) { animation.cancel(); });
    state.animations = [];
  }
  function play(state) {
    stop(state);
    if (motion.matches || !state.visible) return;
    var trail = state.element.querySelector(".doodle-trail");
    var plane = state.element.querySelector(".doodle-airplane");
    var reveal = state.element.querySelector(".doodle-reveal");
    var length = trail.getTotalLength();
    var end = trail.getPointAtLength(length);
    var points = [];
    var lastAngle;
    for (var i = 0; i <= 90; i++) {
      var distance = length * i / 90;
      var point = trail.getPointAtLength(distance);
      var before = trail.getPointAtLength(Math.max(0, distance - .5));
      var after = trail.getPointAtLength(Math.min(length, distance + .5));
      var angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      if (lastAngle !== undefined) {
        while (angle - lastAngle > 180) angle -= 360;
        while (angle - lastAngle < -180) angle += 360;
      }
      lastAngle = angle;
      points.push({ x: point.x - end.x, y: point.y - end.y, angle: angle });
    }
    var finalAngle = points[points.length - 1].angle;
    var frames = points.map(function (point, index) {
      return { offset: .65 * index / 90,
        transform: "translate(" + point.x + "px," + point.y + "px) rotate(" + (point.angle - finalAngle) + "deg)",
        opacity: Math.min(1, index / 5) };
    });
    frames.push(
      { offset: .77, transform: "translate(2px,-3px) rotate(3deg)", opacity: 1 },
      { offset: .9, transform: "translate(-1px,1px) rotate(-2deg)", opacity: 1 },
      { offset: 1, transform: "translate(0,0) rotate(0deg)", opacity: 1 }
    );
    var delay = state.element.classList.contains("roadmap-doodle--current") ? 650 : 0;
    state.animations.push(plane.animate(frames, { duration: 4200, delay: delay, easing: "linear", fill: "backwards" }));
    state.animations.push(reveal.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 2730, delay: delay, easing: "linear", fill: "backwards" }));
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var state = states.find(function (item) { return item.element === entry.target; });
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .3;
      if (state.visible) play(state);
      else stop(state);
    });
  }, { root: document.querySelector("main"), threshold: [0, .3] });
  states.forEach(function (state) { observer.observe(state.element); });
  motion.addEventListener("change", function () { states.forEach(play); });
  document.addEventListener("visibilitychange", function () {
    states.forEach(function (state) { if (document.hidden) stop(state); else play(state); });
  });
})();

// A projected globe makes a complete turn on entry, with the same motion policy as the airplanes.
(function () {
  "use strict";
  var globe = document.querySelector(".education-globe");
  if (!globe) return;
  var land = globe.querySelector("[data-globe-land]");
  var grid = globe.querySelector("[data-globe-grid]");
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var ns = "http://www.w3.org/2000/svg";
  var continents = [
    [[-168,67],[-150,70],[-135,60],[-125,50],[-124,40],[-116,30],[-105,23],[-98,17],[-88,16],[-82,9],[-77,8],[-82,20],[-80,26],[-83,30],[-76,36],[-66,45],[-54,52],[-64,60],[-85,66],[-105,72],[-135,72]],
    [[-81,10],[-70,12],[-60,7],[-50,0],[-35,-6],[-40,-20],[-52,-30],[-60,-40],[-68,-55],[-75,-47],[-72,-30],[-79,-10]],
    [[-17,35],[-4,36],[10,37],[26,32],[33,22],[43,12],[50,10],[42,-1],[40,-15],[31,-29],[18,-35],[11,-25],[10,-5],[-2,5],[-15,12]],
    [[-11,36],[-9,44],[-2,49],[8,55],[5,62],[17,71],[30,70],[41,59],[58,55],[66,62],[100,72],[135,70],[170,61],[150,52],[143,42],[127,36],[120,21],[108,10],[103,1],[98,12],[91,22],[79,7],[71,23],[53,27],[44,12],[36,31],[28,40],[18,40],[13,45],[4,43]],
    [[112,-11],[129,-12],[137,-17],[146,-16],[154,-28],[146,-39],[132,-34],[115,-35]],
    [[-53,60],[-43,60],[-22,70],[-20,81],[-45,84],[-60,76]],
    [[47,-13],[51,-16],[49,-25],[44,-24]],
    [[130,32],[140,36],[145,44],[141,45],[135,36]],
    [[166,-35],[178,-38],[173,-46],[167,-47],[171,-41]]
  ];
  function path(parent) {
    var node = document.createElementNS(ns, "path");
    parent.appendChild(node);
    return node;
  }
  var landPaths = continents.map(function () { return path(land); });
  var gridPaths = Array.from({ length: 10 }, function () { return path(grid); });
  var frame = 0;
  var visible = false;
  function project(lon, lat, turn) {
    var longitude = (lon + turn) * Math.PI / 180;
    var latitude = lat * Math.PI / 180;
    return { x: Math.cos(latitude) * Math.sin(longitude), y: -Math.sin(latitude), z: Math.cos(latitude) * Math.cos(longitude) };
  }
  function coordinate(point) { return (90 + 54 * point.x).toFixed(2) + " " + (76 + 54 * point.y).toFixed(2); }
  function landShape(shape, turn) {
    var points = [];
    shape.forEach(function (point, index) {
      var next = shape[(index + 1) % shape.length];
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(point[0] - next[0]), Math.abs(point[1] - next[1])) / 4));
      for (var i = 0; i < steps; i++) points.push(project(point[0] + (next[0] - point[0]) * i / steps, point[1] + (next[1] - point[1]) * i / steps, turn));
    });
    var front = [];
    points.forEach(function (point, index) {
      var previous = points[(index + points.length - 1) % points.length];
      if ((point.z >= 0) !== (previous.z >= 0)) {
        var t = previous.z / (previous.z - point.z);
        var x = previous.x + (point.x - previous.x) * t;
        var y = previous.y + (point.y - previous.y) * t;
        var radius = Math.hypot(x, y) || 1;
        front.push({ x: x / radius, y: y / radius });
      }
      if (point.z >= 0) front.push(point);
    });
    return front.length ? "M" + front.map(coordinate).join("L") + "Z" : "";
  }
  function gridLine(points) {
    var penDown = false;
    return points.map(function (point) {
      if (point.z < 0) { penDown = false; return ""; }
      var command = penDown ? "L" : "M";
      penDown = true;
      return command + coordinate(point);
    }).join("");
  }
  function render(turn) {
    continents.forEach(function (shape, index) { landPaths[index].setAttribute("d", landShape(shape, turn)); });
    var lines = [];
    [-60, -30, 0, 30, 60].forEach(function (latitude) {
      var points = [];
      for (var lon = -180; lon <= 180; lon += 3) points.push(project(lon, latitude, turn));
      lines.push(gridLine(points));
    });
    [-120, -60, 0, 60, 120].forEach(function (longitude) {
      var points = [];
      for (var lat = -90; lat <= 90; lat += 3) points.push(project(longitude, lat, turn));
      lines.push(gridLine(points));
    });
    lines.forEach(function (line, index) { gridPaths[index].setAttribute("d", line); });
  }
  function stop() { cancelAnimationFrame(frame); render(0); }
  function play() {
    stop();
    if (!visible || motion.matches || document.hidden) return;
    var began;
    function tick(time) {
      if (began === undefined) began = time;
      var t = Math.min(1, (time - began) / 4200);
      var eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      render(eased * 360);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .3;
    if (visible) play(); else stop();
  }, { root: document.querySelector("main"), threshold: [0, .3] }).observe(globe);
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
  render(0);
})();

// The quill dips into the bottle, lifts, and returns to the paper without animating ink.
(function () {
  "use strict";
  var writing = document.querySelector(".papers-writing");
  if (!writing) return;
  var quill = writing.querySelector(".papers-quill");
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var animation;
  var visible = false;
  function stop() {
    if (animation) animation.cancel();
    animation = null;
  }
  function play() {
    stop();
    if (!visible || motion.matches || document.hidden) return;
    animation = quill.animate([
      { offset: 0, transform: "translate(0,0) rotate(0deg)" },
      { offset: .05, transform: "translate(-18px,0) rotate(-4deg)" },
      { offset: .12, transform: "translate(30px,-38px) rotate(-12deg)" },
      { offset: .18, transform: "translate(98px,-30px) rotate(-18deg)" },
      { offset: .23, transform: "translate(98px,-9px) rotate(-18deg)" },
      { offset: .28, transform: "translate(98px,-9px) rotate(-12deg)" },
      { offset: .33, transform: "translate(98px,-35px) rotate(-14deg)" },
      { offset: .40, transform: "translate(-10px,-16px) rotate(3deg)" },
      { offset: .45, transform: "translate(-18px,0) rotate(-4deg)" },
      { offset: .51, transform: "translate(24px,-3px) rotate(6deg)" },
      { offset: .57, transform: "translate(34px,-32px) rotate(-8deg)" },
      { offset: .64, transform: "translate(98px,-30px) rotate(-18deg)" },
      { offset: .69, transform: "translate(98px,-9px) rotate(-18deg)" },
      { offset: .75, transform: "translate(98px,-9px) rotate(-11deg)" },
      { offset: .80, transform: "translate(98px,-34px) rotate(-14deg)" },
      { offset: .88, transform: "translate(-12px,-18px) rotate(6deg)" },
      { offset: .93, transform: "translate(-18px,0) rotate(-4deg)" },
      { offset: .97, transform: "translate(10px,-3px) rotate(4deg)" },
      { offset: 1, transform: "translate(0,0) rotate(0deg)" }
    ], { duration: 7200, easing: "ease-in-out", fill: "backwards" });
  }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .3;
    if (visible) play(); else stop();
  }, { root: document.querySelector("main"), threshold: [0, .3] }).observe(writing);
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
})();

// A pair of hammer strikes forges a sword, followed by a brief polished sparkle.
(function () {
  "use strict";
  var forge = document.querySelector(".projects-forge");
  if (!forge) return;
  var hammer = forge.querySelector(".forge-hammer");
  var sword = forge.querySelector(".forge-sword");
  var stone = forge.querySelector(".forge-stone");
  var impact = forge.querySelector(".forge-impact");
  var stars = Array.from(forge.querySelectorAll(".forge-star"));
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var animations = [];
  var visible = false;
  function stop() {
    animations.forEach(function (animation) { animation.cancel(); });
    animations = [];
  }
  function play() {
    stop();
    if (!visible || motion.matches || document.hidden) return;
    animations.push(hammer.animate([
      { offset: 0, transform: "translate(0,-12px) rotate(-75deg)", opacity: 0 },
      { offset: .08, transform: "translate(0,0) rotate(-70deg)", opacity: 1 },
      { offset: .20, transform: "rotate(-12deg)", opacity: 1 },
      { offset: .23, transform: "rotate(0deg)", opacity: 1 },
      { offset: .27, transform: "rotate(-25deg)", opacity: 1 },
      { offset: .35, transform: "rotate(-55deg)", opacity: 1 },
      { offset: .44, transform: "rotate(0deg)", opacity: 1 },
      { offset: .48, transform: "rotate(-22deg)", opacity: 1 },
      { offset: .56, transform: "translate(-10px,-12px) rotate(-65deg)", opacity: 1 },
      { offset: .65, transform: "translate(-20px,-18px) rotate(-75deg)", opacity: 0 },
      { offset: 1, transform: "translate(-20px,-18px) rotate(-75deg)", opacity: 0 }
    ], { duration: 4800, easing: "ease-in-out", fill: "backwards" }));
    [1104, 2112].forEach(function (delay) {
      animations.push(stone.animate([
        { transform: "translateY(0)" }, { transform: "translateY(2px)", offset: .35 }, { transform: "translateY(0)" }
      ], { duration: 180, delay: delay, easing: "ease-out" }));
      animations.push(impact.animate([
        { opacity: 0, transform: "scale(.3)" },
        { opacity: 1, transform: "scale(1)", offset: .2 },
        { opacity: 0, transform: "scale(1.5)" }
      ], { duration: 400, delay: delay, easing: "ease-out" }));
    });
    animations.push(sword.animate([
      { opacity: 0, transform: "translateY(96px) scale(.85)" },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: .72 },
      { opacity: 1, transform: "translateY(-3px) rotate(2deg)", offset: .85 },
      { opacity: 1, transform: "translateY(0) rotate(0deg)" }
    ], { duration: 1300, delay: 2300, easing: "ease-out", fill: "backwards" }));
    stars.forEach(function (star, index) {
      animations.push(star.animate([
        { opacity: 0, transform: "scale(0) rotate(-30deg)" },
        { opacity: 1, transform: "scale(1.25) rotate(8deg)", offset: .25 },
        { opacity: .25, transform: "scale(.6) rotate(-8deg)", offset: .5 },
        { opacity: 1, transform: "scale(1.15) rotate(4deg)", offset: .75 },
        { opacity: 1, transform: "scale(1) rotate(0deg)" }
      ], { duration: 1000, delay: 3450 + index * 140, easing: "ease-in-out", fill: "backwards" }));
    });
  }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .3;
    if (visible) play(); else stop();
  }, { root: document.querySelector("main"), threshold: [0, .3] }).observe(forge);
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
})();

// Orbiting electrons use the same finite, on-entry motion as the other illustrations.
(function () {
  "use strict";
  var atom = document.querySelector(".papers-atom");
  if (!atom) return;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var orbits = Array.from(atom.querySelectorAll(".atom-orbit")).map(function (orbit, index) {
    return { electrons: Array.from(orbit.querySelectorAll(".atom-electron")),
      trails: Array.from(orbit.querySelectorAll(".atom-trail")),
      phase: [0, Math.PI / 2, Math.PI / 4][index], turns: [2, 3, 2][index] };
  });
  var frame = 0;
  var visible = false;
  function point(angle) { return { x: 90 + 24 * Math.cos(angle), y: 90 + 68 * Math.sin(angle) }; }
  function render(progress) {
    orbits.forEach(function (orbit) {
      orbit.electrons.forEach(function (electron, index) {
        var angle = orbit.phase + progress * Math.PI * 2 * orbit.turns + index * Math.PI;
        var position = point(angle);
        electron.setAttribute("cx", position.x.toFixed(2));
        electron.setAttribute("cy", position.y.toFixed(2));
        var trail = [];
        for (var i = 0; i <= 12; i++) {
          var p = point(angle - .45 + .45 * i / 12);
          trail.push((i === 0 ? "M" : "L") + p.x.toFixed(2) + " " + p.y.toFixed(2));
        }
        orbit.trails[index].setAttribute("d", trail.join(""));
      });
    });
  }
  function stop() { cancelAnimationFrame(frame); render(0); }
  function play() {
    stop();
    if (!visible || motion.matches || document.hidden) return;
    var began;
    function tick(time) {
      if (began === undefined) began = time;
      var t = Math.min(1, (time - began) / 4800);
      var eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      render(eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .3;
    if (visible) play(); else stop();
  }, { root: document.querySelector("main"), threshold: [0, .3] }).observe(atom);
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
  render(0);
})();

// Homepage cat stretches into a loaf; the photo sparkles remain static.
(function () {
  "use strict";
  var home = document.querySelector("#about");
  var cat = home && home.querySelector(".home-cat");
  if (!cat) return;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var animations = [];
  var visible = false;
  var loaded = document.readyState === "complete";
  function animate(selector, frames, options) {
    var element = cat.querySelector(selector);
    if (element) animations.push(element.animate(frames, options));
  }
  function stop() {
    animations.forEach(function (animation) { animation.cancel(); });
    animations = [];
  }
  function playCat() {
    animate(".cat-stretch-pose", [
      { opacity: 1, transform: "scale(1,1)" },
      { opacity: 1, transform: "scale(1,1)", offset: .72 },
      { opacity: 0, transform: "scale(.92,.92)" }
    ], { duration: 3200, easing: "ease-in-out", fill: "backwards" });
    animate(".cat-stretch-body", [
      { transform: "scale(.96,1.03)" },
      { transform: "scale(1.06,.93)", offset: .55 },
      { transform: "scale(1,1)" }
    ], { duration: 2700, easing: "ease-in-out" });
    animate(".cat-loaf-pose", [
      { opacity: 0, transform: "translateY(-7px) scale(.97,1.04)" },
      { opacity: 0, transform: "translateY(-7px) scale(.97,1.04)", offset: .7 },
      { opacity: 1, transform: "translateY(2px) scale(1,.98)", offset: .92 },
      { opacity: 1, transform: "translateY(0) scale(1,1)" }
    ], { duration: 3600, easing: "ease-in-out", fill: "backwards" });
  }
  function play() {
    stop();
    if (!loaded || !visible || motion.matches || document.hidden) return;
    playCat();
  }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .65;
    if (visible) play(); else stop();
  }, { root: document.querySelector("main"), threshold: [0, .65] }).observe(home);
  if (!loaded) window.addEventListener("load", function () { loaded = true; play(); }, { once: true });
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
})();
