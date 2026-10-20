(function () {
  "use strict";

  var canvas = document.getElementById("grain");
  var ctx = canvas.getContext("2d");
  var readout = document.getElementById("readout");
  var plate = document.querySelector(".plate");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TEXT_SCALE = 1;
  var SPEED = 1;
  var CHAOS = 1;
  var VOIDS = 2;

  var URLS = [];
  var urlIndex = {};
  for (var i = 0; i < LINKS.length; i++) {
    var u = LINKS[i][1];
    if (!(u in urlIndex)) { urlIndex[u] = URLS.length; URLS.push(u); }
  }

  var SEP = "  ·  ";

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  var DECKS = 5;

  function weaveRibbons() {
    var order = shuffle(LINKS.slice());
    var decks = [], d;
    for (d = 0; d < DECKS; d++) decks.push({ text: "", ids: [] });
    for (var i = 0; i < order.length; i++) {
      var tok = order[i];
      var deck = decks[i % DECKS];
      var id = tok[1] == null ? -1 : urlIndex[tok[1]];
      for (var c = 0; c < tok[0].length; c++) deck.ids.push(id);
      for (c = 0; c < SEP.length; c++) deck.ids.push(-1);
      deck.text += tok[0] + SEP;
    }
    for (d = 0; d < DECKS; d++) {
      decks[d].ids = Int16Array.from(decks[d].ids);
      decks[d].len = decks[d].text.length;
    }
    return decks;
  }

  var RIBBONS = weaveRibbons();

  var SECTION_NAMES = ["Projects", "Code", "Links", "Social", "Views"];
  var SECTION_ORDER = [0, 1, 2, 3, 4];
  var LABEL_EVERY = 7;

  function sectionOf(name, url) {
    return 0;
  }

  function weaveSections() {
    var buckets = [], i, j, c;
    for (i = 0; i < SECTION_NAMES.length; i++) buckets.push([]);
    for (i = 0; i < LINKS.length; i++) {
      buckets[sectionOf(LINKS[i][0], LINKS[i][1])].push(LINKS[i]);
    }

    var out = [];
    for (var k = 0; k < SECTION_ORDER.length; k++) {
      i = SECTION_ORDER[k];
      if (!buckets[i].length) continue;

      var label = SECTION_NAMES[i].toUpperCase();
      var text = "", ids = [];

      for (j = 0; j < buckets[i].length; j++) {
        if (j % LABEL_EVERY === 0) {
          for (c = 0; c < label.length; c++) ids.push(-2);
          text += label;
          for (c = 0; c < SEP.length; c++) ids.push(-1);
          text += SEP;
        }
        var tok = buckets[i][j];
        var id = tok[1] in urlIndex ? urlIndex[tok[1]] : -1;
        for (c = 0; c < tok[0].length; c++) ids.push(id);
        text += tok[0];
        for (c = 0; c < SEP.length; c++) ids.push(-1);
        text += SEP;
      }

      out.push({ text: text, ids: Int16Array.from(ids), len: text.length });
    }
    return out;
  }

  var SECTIONS = weaveSections();

  var ALPHABET = (function () {
    var seen = {}, all = LINKS, i, c;
    for (i = 0; i < all.length; i++) {
      var s = all[i][0];
      for (c = 0; c < s.length; c++) seen[s[c]] = true;
    }
    for (c = 0; c < SEP.length; c++) seen[SEP[c]] = true;
    for (i = 0; i < SECTIONS.length; i++) {
      var t = SECTIONS[i].text;
      for (c = 0; c < t.length; c++) seen[t[c]] = true;
    }
    return Object.keys(seen);
  })();

  var knots = [];
  var swirls = [];
  var clock = 0;

  var WAVE1_A = 0.26, WAVE1_K = (Math.PI * 2) / 900;
  var WAVE2_A = 0.13, WAVE2_K = (Math.PI * 2) / 380;
  var TILT = 0.05;

  var vx = 0, vy = 0, vmag = 1;

  function velocity(x, y) {
    if (ordered) { vx = 1; vy = 0; vmag = 1; return; }
    var u = 1;
    var v = TILT +
      WAVE1_A * Math.sin(x * WAVE1_K + clock * 0.13) +
      WAVE2_A * Math.sin(x * WAVE2_K - clock * 0.18 + y * 0.0016);

    var i, dx, dy, r2, k;
    var kn = knots.length;

    for (i = 0; i < kn; i++) {
      k = knots[i];
      dx = x - k.x; dy = y - k.y;
      r2 = dx * dx + dy * dy;
      if (r2 > k.cut2) continue;
      if (r2 < k.a2) r2 = k.a2;
      var inv = (k.a2 * k.p * k.s) / (r2 * r2);
      u -= inv * (dx * dx - dy * dy);
      v -= inv * 2 * dx * dy;
    }

    for (i = 0; i < swirls.length; i++) {
      k = swirls[i];
      dx = x - k.x; dy = y - k.y;
      r2 = dx * dx + dy * dy;
      if (r2 > k.cut2) continue;
      var g = (k.g * k.s) / (r2 + k.core2);
      u -= dy * g;
      v += dx * g;
    }

    var m = Math.sqrt(u * u + v * v);
    vmag = m;
    if (m < 1e-6) { vx = 1; vy = 0; return; }
    vx = u / m; vy = v / m;
  }

  function now() { return performance.now(); }

  function drift(r) {
    return {
      orb: r * (0.6 + Math.random() * 0.7),
      ow: (0.04 + Math.random() * 0.08) * (Math.random() < 0.5 ? -1 : 1),
      op: Math.random() * Math.PI * 2,
      br: 0.1 + Math.random() * 0.14,
      bw: 0.05 + Math.random() * 0.09,
      bp: Math.random() * Math.PI * 2,
      pw: 0.03 + Math.random() * 0.05,
      pp: Math.random() * Math.PI * 2
    };
  }

  function makeKnot(x, y, a, delay, p) {
    var k = drift(12);
    k.hx = x; k.hy = y; k.x = x; k.y = y;
    k.a = a; k.a2 = a * a; k.cut2 = (a * 11) * (a * 11);
    k.p0 = p || 1; k.p = k.p0;
    k.born = now() + (delay || 0);
    k.s = reduceMotion ? 1 : 0;
    return k;
  }

  function makeSwirl(x, y, g, core, delay) {
    var k = drift(16);
    k.hx = x; k.hy = y; k.x = x; k.y = y;
    k.g0 = g; k.g = g;
    k.core2 = core * core; k.cut2 = (core * 9) * (core * 9);
    k.born = now() + (delay || 0);
    k.s = reduceMotion ? 1 : 0;
    return k;
  }

  function stir(k, knot) {
    var o = clock * k.ow + k.op;
    k.x = k.hx + Math.cos(o) * k.orb;
    k.y = k.hy + Math.sin(o) * k.orb * 0.7;
    var b = 1 + k.br * Math.sin(clock * k.bw + k.bp);
    if (knot) {
      var a = k.a * b;
      k.a2 = a * a;
      k.cut2 = (a * 11) * (a * 11);
      k.p = k.p0 * (1 + 0.35 * Math.sin(clock * k.pw + k.pp));
    } else {
      k.g = k.g0 * b;
    }
  }

  var ordered = false, flowAlpha = 1, sectionAlpha = 1;
  var orderExitAt = 0, flowInAt = 0;
  var dpr, W, H, LEFT, rowPitch, fontSize, advance, spacing, MARGIN, maxSteps;
  var glyphSize, gDx, gDy;
  var gPlain, gLink, gHover, gLabel;
  var veins = [];
  var hitX, hitY, hitU, hitN = 0, hitCap = 40000;
  var hoverId = -1;
  var mouse = { x: 0, y: 0, inside: false };

  function atlas(fill, glow) {
    var set = {};
    var ox = fontSize * 0.35, oy = fontSize * 1.15;
    for (var i = 0; i < ALPHABET.length; i++) {
      var ch = ALPHABET[i];
      var c = document.createElement("canvas");
      c.width = c.height = Math.ceil(glyphSize * dpr);
      var g = c.getContext("2d");
      g.scale(dpr, dpr);
      g.font = fontSize + "px Menlo, Monaco, 'Lucida Console', monospace";
      g.fillStyle = fill;
      if (glow) {
        g.shadowColor = glow;
        g.shadowBlur = fontSize * 0.6;
        g.fillText(ch, ox, oy);
        g.fillText(ch, ox, oy);
        g.shadowBlur = 0;
      }
      g.fillText(ch, ox, oy);
      set[ch] = c;
    }
    return set;
  }

  function paint() {
    gPlain = atlas("rgba(236, 224, 205, 0.26)", null);
    gLink = atlas("rgba(255, 247, 234, 0.8)", null);
    gHover = atlas("#ffd166", "rgba(255, 190, 60, 0.9)");
    gLabel = atlas("rgba(255, 201, 74, 0.55)", null);
  }

  function seedField() {
    knots = [];
    swirls = [];
    var n = W < 700 ? 2 : 3;
    var strong = Math.min(n - 1, 1 + (Math.random() < 0.5 ? 1 : 0));
    for (var i = 0; i < n; i++) {
      knots.push(makeKnot(
        W * (0.68 + Math.random() * 0.28),
        H * (0.08 + Math.random() * 0.84),
        Math.random() < 0.45 ? 18 + Math.random() * 10 : 26 + Math.random() * 20,
        300 + i * 200,
        i < strong ? 1.45 + Math.random() * 0.5 : 0.9 + Math.random() * 0.3
      ));
    }
    var sn = CHAOS === 0 ? 0 : (W < 700 ? 1 : 2) + CHAOS;
    for (i = 0; i < sn; i++) {
      swirls.push(makeSwirl(
        W * (0.28 + Math.random() * 0.64),
        H * (0.1 + Math.random() * 0.8),
        (45 + Math.random() * 55 + CHAOS * 15) * (Math.random() < 0.5 ? -1 : 1),
        70 + Math.random() * 50,
        400 + i * 250
      ));
    }
    var hn = VOIDS === 0 ? 0 : (W < 700 ? VOIDS - 1 : VOIDS);
    for (i = 0; i < hn; i++) {
      var hole = makeKnot(
        W * (0.52 + Math.random() * 0.42),
        H * (0.12 + Math.random() * 0.76),
        40 + Math.random() * 36,
        600 + i * 320,
        1.4 + Math.random() * 0.35
      );
      knots.push(hole);
    }
  }

  function orderRow(prev, k, ribbon, y, sect, speed) {
    var r = prev[k] && prev[k].section ? prev[k] : {
      section: true, jitter: 0, gap: 1, deck: k,
      amp: 0, rate: 0, phase: 0, swing: 0, scroll: 0,
      fly: 0, delay: sect * 0.06
    };
    r.vein = ribbon;
    r.y = y;
    r.sect = sect;
    r.speed = speed;
    return r;
  }

  function layoutOrdered() {
    var prev = veins;
    veins = [];
    var n = SECTIONS.length;

    var areaTop = LEFT + plate.offsetHeight * 1.28 + Math.max(14, H * 0.025);
    var areaBottom = H - Math.max(22, H * 0.03);
    var space = areaBottom - areaTop;

    rowPitch = Math.min(space / n, 54);
    if (rowPitch < 34) rowPitch = 34;

    var block = rowPitch * n;
    var top = areaTop + (space - block) / 2;
    if (top + block > H - 8) top = H - 8 - block;
    if (top < 8) top = 8;

    for (var i = 0; i < n; i++) {
      veins.push(orderRow(prev, i, SECTIONS[i], top + (i + 0.5) * rowPitch, i, 20 + i * 3));
    }
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);

    fontSize = (W < 640 ? 13 : W < 1400 ? 15 : 16.5) * TEXT_SCALE;
    advance = fontSize * 0.66;
    spacing = fontSize * 2.5;
    MARGIN = 140;
    maxSteps = Math.ceil((W + MARGIN * 2) / advance * (W < 700 ? 1.9 : 2.6)) + 40;

    glyphSize = fontSize * 2;
    gDx = -fontSize * 0.35;
    gDy = -fontSize * 0.79;

    paint();

    LEFT = Math.min(120, Math.max(24, W * 0.065));

    if (ordered) {
      layoutOrdered();
      hitX = new Float64Array(hitCap);
      hitY = new Float64Array(hitCap);
      hitU = new Int16Array(hitCap);
      return;
    }

    var OVER = W < 700 ? 6 : 9;
    var count = Math.ceil(H / spacing) + OVER * 2;
    var prev = veins;
    var i, d;

    var gaps = [], total = 0;
    for (i = 0; i < count; i++) {
      gaps.push(prev[i] ? prev[i].gap : 0.55 + Math.random() * 0.9);
      total += gaps[i];
    }
    var gk = count / total;

    var deckOf = [], seatOf = [], used = [], last = -1;
    for (i = 0; i < DECKS; i++) used.push(0);
    for (i = 0; i < count; i++) {
      if (prev[i]) {
        d = prev[i].deck;
      } else {
        do { d = (Math.random() * DECKS) | 0; } while (d === last);
      }
      deckOf.push(d);
      seatOf.push(used[d]++);
      last = d;
    }

    veins = [];
    var y = -OVER * spacing + spacing * 0.5;
    for (i = 0; i < count; i++) {
      var deck = deckOf[i];
      var ribbon = RIBBONS[deck];
      var slot = seatOf[i] + (Math.random() - 0.5) * 0.55;
      veins.push({
        y: y,
        gap: gaps[i],
        deck: deck,
        jitter: prev[i] ? prev[i].jitter : (Math.random() - 0.5) * 14,
        vein: ribbon,
        amp: prev[i] ? prev[i].amp : 9 + Math.random() * 8,
        rate: prev[i] ? prev[i].rate : 0.1 + Math.random() * 0.12,
        phase: prev[i] ? prev[i].phase : Math.random() * Math.PI * 2,
        swing: prev[i] ? prev[i].swing : (i & 1 ? 0 : Math.PI) + (Math.random() - 0.5) * 2,
        scroll: prev[i] ? prev[i].scroll : (slot / used[deck]) * ribbon.len * advance
      });
      y += gaps[i] * spacing * gk;
    }

    hitX = new Float64Array(hitCap);
    hitY = new Float64Array(hitCap);
    hitU = new Int16Array(hitCap);

    seedField();
  }

  function speedOf(row, i) {
    return SPEED * (
      30
      + 4 * Math.sin(i * 0.21 + clock * 0.15)
      + 3 * Math.sin(i * 0.07 - clock * 0.09)
      + row.amp * Math.sin(clock * row.rate + row.phase)
      + 6 * Math.sin(clock * 0.08 + row.swing)
    );
  }

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var i, k;
    for (i = 0; i < knots.length; i++) {
      k = knots[i];
      if (k.s < 1) {
        var p = (t - k.born) / 1100;
        k.s = p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
      }
      stir(k, true);
    }
    for (i = 0; i < swirls.length; i++) {
      k = swirls[i];
      if (k.s < 1) {
        var q = (t - k.born) / 1400;
        k.s = q <= 0 ? 0 : q >= 1 ? 1 : 1 - Math.pow(1 - q, 3);
      }
      stir(k, false);
    }

    var loX = -MARGIN * 1.4, hiX = W + MARGIN;
    var loY = -H * 1.1, hiY = H * 2.1;
    var half = advance * 0.5;
    var pad = advance * 2;
    hitN = 0;

    for (var li = 0; li < veins.length; li++) {
      var row = veins[li];
      var vein = row.vein;

      var sc, py;

      if (row.section) {
        if (row.fly <= 0 || sectionAlpha <= 0) continue;
        ctx.globalAlpha = row.fly * sectionAlpha;
        var ease = 1 - Math.pow(1 - row.fly, 3);
        sc = row.scroll - (1 - ease) * W * 0.55;
        py = row.y;
      } else {
        if (flowAlpha <= 0) continue;
        ctx.globalAlpha = flowAlpha;
        sc = row.scroll;
        py = row.y + row.jitter;
      }

      var shift = Math.floor(sc / advance);
      var f = sc / advance - shift;
      var idx = (((-shift) % vein.len) + vein.len) % vein.len;
      var px = -MARGIN;

      for (var s = 0; s < maxSteps; s++) {
        velocity(px, py);
        var mx = px + vx * half, my = py + vy * half;
        velocity(mx, my);
        var tx = vx, ty = vy;
        var cx = px + tx * advance, cy = py + ty * advance;

        var gx = px + (cx - px) * f;
        var gy = py + (cy - py) * f;

        var ch = vein.text[idx];
        var uid = vein.ids[idx];
        idx = idx + 1 === vein.len ? 0 : idx + 1;

        if (gx > -pad && gx < W + pad && gy > -pad && gy < H + pad) {
          if (ch !== " ") {
            var set = uid < 0
              ? (uid === -2 ? gLabel : gPlain)
              : (uid === hoverId ? gHover : gLink);
            var glyph = set[ch];
            if (glyph) {
              ctx.setTransform(dpr * tx, dpr * ty, -dpr * ty, dpr * tx, gx * dpr, gy * dpr);
              ctx.drawImage(glyph, gDx, gDy, glyphSize, glyphSize);
            }
          }
          if (uid >= 0 && hitN < hitCap) {
            hitX[hitN] = gx; hitY[hitN] = gy; hitU[hitN] = uid; hitN++;
          }
        }

        px = cx; py = cy;
        if (px > hiX || px < loX || py > hiY || py < loY) break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function hitTest(x, y) {
    var r2 = (fontSize * 0.9) * (fontSize * 0.9);
    var best = -1, bestD = r2;
    for (var i = 0; i < hitN; i++) {
      var dx = hitX[i] - x, dy = hitY[i] - y;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = hitU[i]; }
    }
    return best;
  }

  function refreshHover() {
    var id = mouse.inside ? hitTest(mouse.x, mouse.y) : -1;
    if (id !== hoverId) {
      hoverId = id;
      document.body.style.cursor = id >= 0 ? "pointer" : "default";
      return true;
    }
    return false;
  }

  var last = null;
  function frame(ts) {
    if (last === null) last = ts;
    var dt = Math.min(48, ts - last) / 1000;
    last = ts;
    clock += dt;

    var i, e;
    if (ordered) {
      var ob = 1;
      if (orderExitAt) {
        e = (ts - orderExitAt) / EXIT_MS;
        if (e > 1) e = 1;
        ob = 1 + e * (2 - e) * 26;
        sectionAlpha = e < 0.4 ? 1 : 1 - (e - 0.4) / 0.6;
      }
      var hov = drag !== null ? drag : (mouse.inside ? rowAt(mouse.y) : -1);
      for (i = 0; i < veins.length; i++) {
        var r = veins[i];
        if (r.delay > 0) { r.delay -= dt; continue; }
        if (r.fly < 1) {
          r.fly += dt / 0.7;
          if (r.fly > 1) r.fly = 1;
        }
        if (orderExitAt) r.scroll += r.speed * ob * dt;
        else if (r.sect !== hov) r.scroll += r.speed * dt;
      }
    } else {
      var boost = 1;
      if (exitAt) {
        e = (ts - exitAt) / EXIT_MS;
        if (e > 1) e = 1;
        boost = 1 + e * (2 - e) * 26;
        flowAlpha = e < 0.4 ? 1 : 1 - (e - 0.4) / 0.6;
      } else if (flowInAt) {
        e = (ts - flowInAt) / 950;
        if (e >= 1) { e = 1; flowInAt = 0; }
        var d = 1 - e;
        boost = 1 + d * d * d * 22;
        flowAlpha = e < 0.5 ? e / 0.5 : 1;
      }
      for (i = 0; i < veins.length; i++) {
        veins[i].scroll += speedOf(veins[i], i) * boost * dt;
      }
    }

    draw(ts);
    refreshHover();
    requestAnimationFrame(frame);
  }

  var readoutTimer;
  function flash(msg) {
    readout.textContent = msg;
    readout.classList.add("show");
    clearTimeout(readoutTimer);
    readoutTimer = setTimeout(function () {
      readout.classList.remove("show");
    }, 1100);
  }

  var modeBtn = document.getElementById("mode");
  var exitAt = 0;
  var EXIT_MS = 1000;

  var nameEl = document.getElementById("name");

  var pieces = [
    plate.querySelector(".scrim"),
    nameEl.children[0],
    nameEl.children[1],
    plate.querySelector(".links")
  ];

  function flipPieces(mutate, delays) {
    document.body.classList.add("entered");
    var first = [], i;
    for (i = 0; i < pieces.length; i++) first.push(pieces[i].getBoundingClientRect());

    mutate();

    for (i = 0; i < pieces.length; i++) {
      var last = pieces[i].getBoundingClientRect();
      pieces[i].style.transition = "none";
      pieces[i].style.animation = "none";
      pieces[i].style.transform =
        "translate(" + (first[i].left - last.left) + "px," + (first[i].top - last.top) + "px)";
    }

    requestAnimationFrame(function () {
      for (var j = 0; j < pieces.length; j++) {
        pieces[j].style.transition =
          "transform 0.85s cubic-bezier(0.4, 0, 0.2, 1) " + delays[j] + "s";
        pieces[j].style.transform = "";
      }
    });
  }

  var pending = 0, morph = 0;

  function morphLabel(to) {
    clearInterval(morph);
    var from = modeBtn.textContent;
    var len = Math.max(from.length, to.length);
    var noise = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var frames = 22, n = 0;

    morph = setInterval(function () {
      n++;
      var settled = (n / frames) * len;
      var out = "";
      for (var i = 0; i < len; i++) {
        if (i < settled) {
          if (i < to.length) out += to.charAt(i);
        } else if (i < from.length || i < to.length) {
          out += noise.charAt((Math.random() * noise.length) | 0);
        }
      }
      modeBtn.textContent = out;
      if (n >= frames) {
        clearInterval(morph);
        morph = 0;
        modeBtn.textContent = to;
      }
    }, 40);
  }

  function toOrder() {
    morphLabel("Flow");
    exitAt = now();
    flipPieces(function () {
      document.body.classList.add("ordered");
    }, [0.1, 0, 0.14, 0.28]);
    pending = setTimeout(function () {
      pending = 0;
      ordered = true;
      exitAt = 0;
      flowAlpha = 1;
      layout();
    }, EXIT_MS);
  }

  function toFlow() {
    morphLabel("Order");
    orderExitAt = now();
    sectionAlpha = 1;
    flipPieces(function () {
      document.body.classList.remove("ordered");
    }, [0.1, 0.28, 0.14, 0]);
    pending = setTimeout(function () {
      pending = 0;
      ordered = false;
      orderExitAt = 0;
      sectionAlpha = 1;
      flowAlpha = 0;
      flowInAt = now();
      veins = [];
      layout();
    }, EXIT_MS);
  }

  function rowAt(y) {
    var best = -1, bestD = 1e9;
    for (var i = 0; i < veins.length; i++) {
      if (!veins[i].section) continue;
      var d = Math.abs(veins[i].y - y);
      if (d < bestD) { bestD = d; best = veins[i].sect; }
    }
    return bestD < rowPitch * 0.5 ? best : -1;
  }

  function slide(sect, dx) {
    for (var i = 0; i < veins.length; i++) {
      if (veins[i].sect === sect) veins[i].scroll += dx;
    }
  }

  window.addEventListener("wheel", function (e) {
    if (!ordered) return;
    var sect = rowAt(e.clientY);
    if (sect < 0) return;
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    slide(sect, -d);
  }, { passive: true });

  var drag = null, dragX = 0, dragMoved = false;

  window.addEventListener("pointerdown", function (e) {
    dragMoved = false;
    if (!ordered || e.target.closest("a")) return;
    var sect = rowAt(e.clientY);
    if (sect < 0) return;
    drag = sect;
    dragX = e.clientX;
  });

  window.addEventListener("pointermove", function (e) {
    if (drag === null) return;
    var dx = e.clientX - dragX;
    if (!dragMoved && Math.abs(dx) > 4) dragMoved = true;
    slide(drag, dx);
    dragX = e.clientX;
  }, { passive: true });

  window.addEventListener("pointerup", function () { drag = null; });

  modeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    if (pending) return;
    if (ordered) toFlow(); else toOrder();
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();
      if (reduceMotion) draw(now());
    }, 160);
  });

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.inside = true;
    if (reduceMotion && refreshHover()) draw(now());
  }, { passive: true });

  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) mouse.inside = false;
  });
  window.addEventListener("blur", function () { mouse.inside = false; });

  document.documentElement.addEventListener("mouseleave", function () {
    mouse.inside = false;
    if (hoverId >= 0) {
      hoverId = -1;
      document.body.style.cursor = "default";
    }
  });

  window.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    if (!(ordered && dragMoved)) {
      var id = hitTest(e.clientX, e.clientY);
      if (id >= 0) {
        var url = URLS[id];
        if (url.charAt(0) === "/" || url.indexOf("mailto:") === 0) {
          window.location.href = url;
        } else {
          window.open(url, "_blank", "noopener");
        }
        return;
      }
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || ordered) return;
    var key = e.key;

    if (key === "-" || key === "_" || key === "=" || key === "+") {
      TEXT_SCALE = Math.max(0.6, Math.min(2.4, TEXT_SCALE + (key === "-" || key === "_" ? -0.1 : 0.1)));
      layout();
      if (reduceMotion) draw(now());
      flash("text " + TEXT_SCALE.toFixed(1) + "×");
    } else if (key === "[" || key === "]") {
      SPEED = Math.max(0, Math.min(4, SPEED + (key === "[" ? -0.25 : 0.25)));
      flash("speed " + SPEED.toFixed(2) + "×");
    } else if (key === "c" || key === "C") {
      CHAOS = (CHAOS + 1) % 4;
      seedField();
      flash("chaos " + CHAOS);
    } else if (key === "v" || key === "V") {
      VOIDS = (VOIDS + 1) % 4;
      seedField();
      flash("voids " + VOIDS);
    } else if (key === "r" || key === "R") {
      seedField();
      flash("field reseeded");
    }
  });

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    layout();
    if (!reduceMotion) {
      flowAlpha = 0;
      flowInAt = now();
    }
    draw(now());
    canvas.classList.add("on");
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
    setTimeout(boot, 1500);
  } else {
    boot();
  }
})();