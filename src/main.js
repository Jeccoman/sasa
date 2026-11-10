import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";
import { createSwoop3D } from "./swoop3d.js";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const isMobile = () => innerWidth <= 860;

async function runLoader(onReveal) {
  document.body.classList.add("is-loading");
  const urls = ["/img/car_top.webp", "/img/boda_top.webp"];
  const num = $(".loader__num");
  const bar = $(".loader__bar span");
  const shown = { v: 0 };
  let loaded = 0;
  const bump = () => {
    loaded++;
    gsap.to(shown, {
      v: (loaded / (urls.length + 1)) * 100, duration: 0.6, ease: "power2.out", overwrite: true,
      onUpdate: () => { num.textContent = Math.round(shown.v); bar.style.transform = `scaleX(${shown.v / 100})`; },
    });
  };
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => { bump(); res(); }; i.src = src; });
  await Promise.all([...urls.map(load), Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(bump), new Promise((r) => setTimeout(r, reduced ? 0 : 900))]);

  await gsap.to(shown, {
    v: 100, duration: reduced ? 0 : 0.5, ease: "power2.inOut",
    onUpdate: () => { num.textContent = Math.round(shown.v); bar.style.transform = `scaleX(${shown.v / 100})`; },
  });
  const tl = gsap.timeline();
  tl.to(".loader__logo, .loader__bar, .loader__count", { y: -30, opacity: 0, duration: 0.4, ease: "power2.in", stagger: 0.04 })
    .to(".loader", { yPercent: -100, duration: reduced ? 0 : 1, ease: "expo.inOut" }, "-=0.1")
    .add(() => { document.body.classList.remove("is-loading"); onReveal(); }, reduced ? 0 : "-=0.55")
    .set(".loader", { display: "none" });
  return tl;
}

let smoother = null;
function initSmooth() {
  if (!reduced) {
    smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper", content: "#smooth-content",
      smooth: 1.1, smoothTouch: 0.1, effects: false, normalizeScroll: false,
    });
  }
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const target = $(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (smoother) smoother.scrollTo(target, true, "top top");
      else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    })
  );
}

function heroIntro() {
  const split = SplitText.create(".hero__line", { type: "chars", mask: "chars" });
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.from(split.chars, { yPercent: 110, duration: 1.3, stagger: 0.035 })
    .from(".hero__eyebrow", { y: 16, opacity: 0, duration: 0.8 }, 0.2)
    .from(".hero__lead", { y: 24, opacity: 0, duration: 1 }, 0.45)
    .from(".hero__ctas .btn", { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, 0.55)
    .from(".pickup", { scale: 0, duration: 0.8, ease: "back.out(2)" }, 0.6)
    .from(".car", { opacity: 0, scale: 1.6, duration: 1, ease: "power3.out" }, 0.7)
    .from(".eta", { opacity: 0, y: 10, duration: 0.6, ease: "power2.out" }, 1.1)
    .from(".route__ghost", { opacity: 0, duration: 1.2 }, 0.6);
  return tl;
}

function initRoute() {
  const sec = $("#route");
  const svg = $(".route__svg");
  const ghost = $(".route__ghost");
  const trail = $(".route__trail");
  const glow = $(".route__glow");
  const stopsG = $(".route__stops");
  const car = $(".car");
  const eta = $(".eta");
  const etaText = $(".eta__text");
  const pickup = $(".pickup");
  const steps = $$(".step");

  let total = 1, ys = [], sampleStep = 4, stopLens = [], stops = [];
  const state = { len: 0 };
  const setCarX = gsap.quickSetter(car, "x", "px");
  const setCarY = gsap.quickSetter(car, "y", "px");
  const setCarR = gsap.quickSetter(car, "rotation", "deg");

  function build() {
    const W = sec.offsetWidth, H = sec.offsetHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const hero = $(".hero");
    const ctas = $(".hero__ctas");
    const mob = isMobile();

    const start = mob
      ? { x: W * 0.5, y: ctas.offsetTop + ctas.offsetHeight + 120 }
      : { x: W * 0.62, y: hero.offsetHeight * 0.56 };
    const pts = [start];
    steps.forEach((s) => {
      const left = s.dataset.side === "left";
      const x = mob ? (left ? W * 0.86 : W * 0.14) : left ? W * 0.76 : W * 0.24;
      pts.push({ x, y: s.offsetTop + s.offsetHeight * (mob ? 0.62 : 0.5) });
    });
    const pin = $(".arrive__pin");
    const arrive = $(".arrive");
    pts.push({ x: W / 2, y: arrive.offsetTop + pin.offsetTop - 64 });

    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dy = b.y - a.y;
      d += ` C${a.x},${a.y + dy * 0.55} ${b.x},${b.y - dy * 0.55} ${b.x},${b.y}`;
    }
    [ghost, trail, glow].forEach((p) => p.setAttribute("d", d));
    total = trail.getTotalLength();
    [trail, glow].forEach((p) => { p.style.strokeDasharray = `${total} ${total}`; });

    ys = [];
    sampleStep = Math.max(2, total / 1500);
    for (let l = 0; l <= total; l += sampleStep) ys.push(trail.getPointAtLength(l).y);

    stopsG.innerHTML = "";
    stops = pts.slice(1, -1).map((p) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", 9);
      c.setAttribute("class", "route__stop");
      stopsG.appendChild(c);
      return c;
    });
    stopLens = pts.slice(1, -1).map((p) => lenAtY(p.y));
    gsap.set(pickup, { x: start.x, y: start.y });
    render();
  }

  function lenAtY(y) {
    let lo = 0, hi = ys.length - 1;
    if (y <= ys[0]) return 0;
    if (y >= ys[hi]) return total;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m] < y) lo = m + 1; else hi = m; }
    const y0 = ys[lo - 1], y1 = ys[lo];
    const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    return Math.min(total, (lo - 1 + f) * sampleStep);
  }

  let etaW = 0;
  function render() {
    if (!total || !trail.getAttribute("d")) return;
    const l = Math.max(0, Math.min(total, state.len));
    const p = trail.getPointAtLength(l);
    const a = trail.getPointAtLength(Math.min(total, l + 2));
    const b = trail.getPointAtLength(Math.max(0, l - 2));
    const ang = Math.atan2(a.y - b.y, a.x - b.x) * (180 / Math.PI);
    setCarX(p.x); setCarY(p.y); setCarR(ang + 90);

    const off = total - l;
    trail.style.strokeDashoffset = off;
    glow.style.strokeDashoffset = off;

    const prog = l / total;
    const done = prog > 0.995;
    eta.classList.toggle("is-done", done);
    const txt = prog < 0.004 ? "Driver arrived · Hop in" : done ? "You've arrived" : `Arriving in ${Math.max(1, Math.ceil((1 - prog) * 14))} min`;
    if (etaText.textContent !== txt) { etaText.textContent = txt; etaW = eta.offsetWidth; }
    if (!etaW) etaW = eta.offsetWidth;
    const right = p.x + 54 + etaW < sec.offsetWidth - 12;
    gsap.set(eta, { x: Math.max(12, right ? p.x + 54 : p.x - 54 - etaW), y: p.y - 58 });

    stops.forEach((c, i) => c.classList.toggle("is-passed", l >= stopLens[i] - 1));
  }

  const follow = gsap.quickTo(state, "len", { duration: reduced ? 0 : 0.7, ease: "power3.out", onUpdate: render });
  const st = ScrollTrigger.create({
    trigger: sec, start: "top top", end: "bottom bottom",
    onUpdate: (self) => follow(lenAtY(self.scroll() - self.start + innerHeight * 0.58)),
  });
  ScrollTrigger.addEventListener("refresh", () => { build(); state.len = lenAtY(st.scroll() - st.start + innerHeight * 0.58); render(); });
  build();

  steps.forEach((s) => {
    const split = SplitText.create(s.querySelector(".step__title"), { type: "lines", mask: "lines", autoSplit: true });
    const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } })
      .from(s.querySelector(".step__num"), { y: 20, opacity: 0, duration: 0.8 })
      .from(s.querySelector(".step__place"), { y: 20, opacity: 0, duration: 0.8 }, 0.05)
      .from(split.lines, { yPercent: 110, duration: 1.1, stagger: 0.08 }, 0.1)
      .from(s.querySelector(".step__body"), { y: 30, opacity: 0, duration: 1 }, 0.3);
    ScrollTrigger.create({ trigger: s, start: "top 72%", onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
  });

  const arriveTl = gsap.timeline({ paused: true })
    .from(".arrive__pin", { y: -80, scale: 0.4, opacity: 0, duration: 0.9, ease: "bounce.out" })
    .from(".arrive__text", { y: 30, opacity: 0, duration: 0.9, ease: "expo.out" }, 0.3);
  ScrollTrigger.create({ trigger: ".arrive", start: "top 75%", onEnter: () => arriveTl.play(), onLeaveBack: () => arriveTl.reverse() });
}

function initSwoop() {
  const stage = $(".swoop__stage");
  const slides = $$(".swoop__slide");
  const facts = $$(".swoop__facts li");
  const modes = $$(".swoop__modes li");
  const nav = $(".nav");
  const R = [9.2, 5.6, 6.8, 10, 9.4];
  const LOOK = [0.7, 0.8, 0.95, 1.0, 0.95];

  let three = null;
  try { three = createSwoop3D(stage); } catch (err) {
    console.warn("[sasaride] WebGL unavailable, using still image", err);
    stage.classList.add("no-webgl");
  }
  const rig = three?.rig ?? {};
  const slots = three?.slots ?? R.map(() => ({}));

  slides.forEach((sl) => {
    $$(".w", sl).forEach((w) => { w.innerHTML = `<span>${w.textContent}</span>`; });
    const k = $(".swoop__kicker", sl); k.innerHTML = `<span>${k.textContent}</span>`;
  });
  const parts = slides.map((sl) => [$(".swoop__kicker span", sl), ...$$(".w > span", sl)]);
  gsap.set(parts.flat(), { yPercent: 115 });
  gsap.set(facts, { y: 30, opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: "none" } });

  tl.to(".swoop__intro", { opacity: 0, y: -40, duration: 1, ease: "power1.in" }, 0.8)
    .to(rig, { phi: 1.32, theta: Math.PI - 0.82, r: R[0], lookY: LOOK[0], hero: 1, duration: 4.2, ease: "power2.inOut" }, 0)
    .to(rig, { N: 1, duration: 2.6, ease: "power1.inOut" }, 1)
    .to(".swoop__veil", { opacity: 1, duration: 1.4 }, 2.8)
    .to(parts[0], { yPercent: 0, duration: 1.2, stagger: 0.22, ease: "expo.out" }, 3.8)
    .to(".swoop__modes", { opacity: 1, duration: 0.8 }, 4.2)
    .to(facts, { y: 0, opacity: 1, duration: 0.9, stagger: 0.2, ease: "power3.out" }, 4.6);

  const marks = [3.8];
  let T = 7;
  for (let k = 1; k < R.length; k++) {
    const prev = slots[k - 1], next = slots[k];
    tl.to(prev, { z: 90, duration: 2.2, ease: "power2.in" }, T)
      .to(prev, { x: 3.5, duration: 0.8, ease: "power1.inOut" }, T + 0.55)
      .set(prev, { z: 200 }, T + 2.3)
      .to(parts[k - 1], { yPercent: -140, duration: 0.7, stagger: 0.06, ease: "power2.in" }, T);
    if (k === 1) tl.to(facts, { y: -20, opacity: 0, duration: 0.6, stagger: 0.05, ease: "power2.in" }, T);
    tl.fromTo(next, { x: 0, z: 60 }, { z: 0, duration: 2, ease: "power3.out", immediateRender: false }, T + 0.5)
      .to(rig, { r: R[k], lookY: LOOK[k], duration: 2, ease: "power2.inOut" }, T + 0.3)
      .fromTo(parts[k], { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: 0.18, ease: "expo.out", immediateRender: false }, T + 1.2);
    marks.push(T + 1);
    T += 3.3;
  }
  tl.to({}, { duration: 1.2 }, T - 1);

  const setMode = (time) => {
    let idx = 0;
    marks.forEach((m, i) => { if (time >= m) idx = i; });
    modes.forEach((li, i) => li.classList.toggle("is-on", i === idx));
  };
  tl.eventCallback("onUpdate", () => setMode(tl.time()));

  const flags = {};
  function setNav(key, on) {
    flags[key] = on;
    nav.classList.toggle("is-dark", Object.values(flags).some(Boolean));
  }
  ScrollTrigger.create({ trigger: "#eve", start: "top 40px", end: "bottom 40px", refreshPriority: -1,
    onToggle: (s) => { setNav("eve", s.isActive); if (s.isActive) setNav("swoop", false); } });
  ScrollTrigger.create({ trigger: "#download", start: "top 40px", end: "bottom top", onToggle: (s) => setNav("cta", s.isActive), refreshPriority: -1 });
  ScrollTrigger.create({ start: 40, end: "max", onToggle: (s) => nav.classList.toggle("is-scrolled", s.isActive) });

  if (reduced) {
    tl.time(5.6);
    if (three) { rig.speed = 0; three.renderOnce(); }
    return;
  }
  const pinST = ScrollTrigger.create({
    trigger: "#swoop", start: "top top", end: () => `+=${innerHeight * tl.duration() * 0.34}`,
    pin: true, scrub: 1, animation: tl, anticipatePin: 1, invalidateOnRefresh: true,
    onUpdate: (self) => setNav("swoop", tl.time() > 2.2 && self.progress < 0.995),
    onLeaveBack: () => setNav("swoop", false),
  });
  if (three) {
    gsap.ticker.add(() => {
      const y = pinST.scroll();
      if (y > pinST.start - innerHeight && y < pinST.end + innerHeight) three.start(gsap.ticker);
      else three.stop(gsap.ticker);
    });
    three.renderOnce();
  }
}

function initEve() {
  const msgs = $$(".eve .msg");
  const inner = $(".eve__inner");
  const thread = $(".eve__thread");
  if (!reduced) {
    gsap.timeline({ scrollTrigger: { trigger: "#eve", start: "top 70%" }, defaults: { ease: "expo.out" } })
      .from(".eve .eyebrow", { y: 20, opacity: 0, duration: 0.8 })
      .from(".eve__title .l", { yPercent: 110, opacity: 0, duration: 1.2, stagger: 0.12 }, 0.05)
      .from(".eve__lead, .eve__points li, .eve__copy .btn", { y: 30, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.3)
      .from(".eve__phone", { y: 80, rotation: 4, opacity: 0, duration: 1.4 }, 0.1);
  }
  if (reduced) return;
  const lift = (i) => () => Math.min(0, thread.clientHeight - (msgs[i].offsetTop + msgs[i].offsetHeight + 16));
  gsap.set(msgs, { opacity: 0, y: 14, scale: 0.9 });
  const tl = gsap.timeline();
  msgs.forEach((m, i) => {
    const me = m.classList.contains("msg--me");
    tl.to(inner, { y: lift(i), duration: 0.45, ease: "power2.out" }, i)
      .to(m, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(2)", transformOrigin: me ? "100% 100%" : "0% 100%" }, i + 0.08);
  });
  tl.to({}, { duration: 0.8 });
  const st = isMobile()
    ? { trigger: ".eve__phone", start: "top 75%", end: "bottom 35%", scrub: 0.8 }
    : { trigger: "#eve", start: "top top", end: () => `+=${innerHeight * 1.5}`, pin: true, scrub: 0.8, anticipatePin: 1 };
  ScrollTrigger.create({ ...st, animation: tl, invalidateOnRefresh: true });
}

function initDrive() {
  const sec = $("#drive");
  const toggle = $(".drive__toggle");
  const state = $(".drive__state");
  const box = $(".drive__requests");
  const REQS = [
    ["Boda", "Kariakoo"], ["Bajaji", "Sinza"], ["Car", "Mikocheni"], ["Boda", "Mwenge"],
    ["Taxi XL", "Posta"], ["Bajaji", "Ubungo"], ["Car", "Msasani"], ["Boda", "Tegeta"],
  ];
  let online = false, timer = null, n = 0, userSet = false, inView = false;

  function spawn() {
    const [type, place] = REQS[n++ % REQS.length];
    const ang = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.random() * 0.22;
    const x = 0.5 + Math.cos(ang) * r, y = 0.5 + Math.sin(ang) * r;
    const el = document.createElement("div");
    el.className = "drive__req" + (x > 0.55 ? " is-left" : "");
    el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
    el.innerHTML = `<i></i><span><b>${type}</b> · ${place}</span>`;
    box.appendChild(el);
    gsap.timeline({ onComplete: () => el.remove() })
      .from(el.querySelector("i"), { scale: 0, duration: 0.5, ease: "back.out(3)" })
      .from(el.querySelector("span"), { y: 10, opacity: 0, scale: 0.9, duration: 0.5, ease: "back.out(2)" }, 0.1)
      .to(el, { opacity: 0, duration: 0.5 }, 2.8);
  }
  function loop() {
    clearInterval(timer);
    if (online && inView && !reduced) { spawn(); timer = setInterval(spawn, 1300); }
  }
  function setOnline(on) {
    online = on;
    sec.classList.toggle("is-online", on);
    toggle.setAttribute("aria-pressed", on);
    state.textContent = on ? "Online" : "Offline";
    $(".drive__hint").textContent = on ? "You're online. Tap to go offline." : "Tap the switch to go online";
    if (!on) gsap.to(".drive__req", { opacity: 0, duration: 0.3, onComplete: () => (box.innerHTML = "") });
    loop();
  }
  toggle.addEventListener("click", () => { userSet = true; setOnline(!online); });

  ScrollTrigger.create({
    trigger: sec, start: "top 55%", end: "bottom top",
    onToggle: (s) => { inView = s.isActive; if (inView && !userSet && !online) gsap.delayedCall(0.6, () => !userSet && setOnline(true)); else loop(); },
  });

  if (reduced) return;
  const num = $(".drive__num"), count = { v: 0 };
  gsap.to(count, {
    v: 85, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: ".drive__stat", start: "top 85%" },
    onUpdate: () => (num.textContent = Math.round(count.v)),
  });
  const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 70%" }, defaults: { ease: "expo.out" } });
  tl.from(".drive .eyebrow", { y: 20, opacity: 0, duration: 0.8 })
    .from(".drive__title .l", { yPercent: 110, opacity: 0, duration: 1.2, stagger: 0.12 }, 0.05)
    .from(".drive__stat", { y: 30, opacity: 0, duration: 1 }, 0.2)
    .from(".drive__lead", { y: 30, opacity: 0, duration: 1 }, 0.3)
    .from(".drive__points li", { y: 30, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.4)
    .from(".drive__copy .btn", { y: 20, opacity: 0, duration: 0.8 }, 0.6)
    .from(".drive__map", { scale: 0.9, opacity: 0, duration: 1.4 }, 0.1)
    .from(".drive__toggle, .drive__hint", { y: 20, opacity: 0, duration: 0.8, stagger: 0.1 }, 0.4);
}

function initCta() {
  if (reduced) return;
  gsap.fromTo(".cta__car", { x: -80 }, {
    x: () => innerWidth + 80, ease: "none",
    scrollTrigger: { trigger: ".cta", start: "top bottom", end: "top top", scrub: 0.6, invalidateOnRefresh: true },
  });
  const split = SplitText.create(".cta__title span", { type: "chars", mask: "chars" });
  gsap.from(split.chars, { yPercent: 110, duration: 1.1, stagger: 0.025, ease: "expo.out", scrollTrigger: { trigger: ".cta", start: "top 60%" } });
  gsap.from(".cta__lead, .cta__btns .btn", { y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: ".cta__lead", start: "top 90%" } });
}

function initMagnetic() {
  if (!finePointer || reduced) return;
  $$(".magnetic").forEach((el) => {
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.3);
      y((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  });
}

function dropSplash() {
  const l = $(".loader");
  if (!l || l.style.display === "none") return;
  l.style.transition = "opacity .5s"; l.style.opacity = "0";
  setTimeout(() => { l.style.display = "none"; }, 500);
  document.body.classList.remove("is-loading");
}

(async function boot() {
  let hero = null;
  const failsafe = setTimeout(() => { dropSplash(); hero?.progress(1); }, 7000);
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    initSmooth();
    initRoute();
    initSwoop();
    initEve();
    initDrive();
    initCta();
    initMagnetic();
    ScrollTrigger.refresh();
    hero = heroIntro().pause();
    await runLoader(() => hero.play());
    clearTimeout(failsafe);
  } catch (err) {
    console.error("[sasaride] boot failed", err);
    clearTimeout(failsafe);
    hero?.progress(1);
    dropSplash();
  }
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 200); });
})();
