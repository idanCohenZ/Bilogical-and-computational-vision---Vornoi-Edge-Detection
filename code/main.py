// =====================================================
// GLOBALS
// =====================================================

let points = [];
let delaunay, voronoi;
let gloria;

let isStippling = true;

// Edge storage
let allEdges = [];
let finalEdges = [];
let edgeChains = [];

// Adaptive parameters
let HIGH_THRESHOLD = 0;
let LOW_THRESHOLD = 0;
let CONNECT_DIST = 0;

// Smoothing
let SMOOTH_ITERATIONS = 2;

// =====================================================
// PRELOAD
// =====================================================

function preload() {
  gloria = loadImage("gloria_pickle.jpg");
}

// =====================================================
// SETUP
// =====================================================

function setup() {
  createCanvas(600, 532);
  pixelDensity(1);

  generateRandomPoints(6000);

  delaunay = calculateDelaunay(points);
  voronoi = delaunay.voronoi([0, 0, width, height]);
}

// =====================================================
// DRAW
// =====================================================

function draw() {
  background(255);

  if (isStippling) {
    displayPoints();
    updatePoints();

    fill(0);
    noStroke();
    text("Click to extract adaptive Voronoi edges", 10, 20);

  } else {
    computeDelaunayEdges();
    computeAdaptiveParameters();
    applyHysteresis();
    buildEdgeChains();
    smoothEdgeChains();
    displaySmoothedEdges();
  }
}

// =====================================================
// INTERACTION
// =====================================================

function mousePressed() {
  if (isStippling) {
    isStippling = false;
    console.log("Running full adaptive edge pipeline");
  }
}

// =====================================================
// STAGE 1 — CVT STIPPLING
// =====================================================

function generateRandomPoints(n) {
  for (let i = 0; i < n; i++) {
    let x = random(width);
    let y = random(height);
    let col = gloria.get(x, y);
    if (random(100) > brightness(col)) {
      points.push(createVector(x, y));
    } else {
      i--;
    }
  }
}

function displayPoints() {
  stroke(0);
  strokeWeight(3);
  for (let p of points) point(p.x, p.y);
}

function updatePoints() {
  let centroids = Array(points.length).fill().map(() => createVector(0, 0));
  let weights = Array(points.length).fill(0);

  gloria.loadPixels();
  let idx = 0;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let i = (x + y * width) * 4;
      let bright = (gloria.pixels[i] + gloria.pixels[i + 1] + gloria.pixels[i + 2]) / 3;
      let w = 1 - bright / 255;

      idx = delaunay.find(x, y, idx);
      centroids[idx].add(createVector(x * w, y * w));
      weights[idx] += w;
    }
  }

  for (let i = 0; i < points.length; i++) {
    if (weights[i] > 0) centroids[i].div(weights[i]);
    points[i].lerp(centroids[i], 0.1);
  }

  delaunay = calculateDelaunay(points);
  voronoi = delaunay.voronoi([0, 0, width, height]);
}

function calculateDelaunay(points) {
  let arr = [];
  for (let p of points) arr.push(p.x, p.y);
  return new d3.Delaunay(arr);
}

// =====================================================
// STAGE 2–3 — CONTRAST COMPUTATION
// =====================================================

function getIntensity(v) {
  let x = constrain(floor(v.x), 0, width - 1);
  let y = constrain(floor(v.y), 0, height - 1);
  let c = gloria.get(x, y);
  return (red(c) + green(c) + blue(c)) / 3;
}

function computeDelaunayEdges() {
  allEdges = [];

  for (let i = 0; i < points.length; i++) {
    let Ii = getIntensity(points[i]);

    for (let j of delaunay.neighbors(i)) {
      if (j < i) continue;

      let Ij = getIntensity(points[j]);
      let contrast = abs(Ii - Ij);
      let len = p5.Vector.dist(points[i], points[j]);

      allEdges.push({
        a: points[i].copy(),
        b: points[j].copy(),
        strength: contrast,
        length: len,
        used: false
      });
    }
  }
}

// =====================================================
// STAGE 4 — ADAPTIVE PARAMETERS
// =====================================================

function computeAdaptiveParameters() {
  let contrasts = allEdges.map(e => e.strength).sort((a, b) => a - b);
  let lengths = allEdges.map(e => e.length).sort((a, b) => a - b);

  HIGH_THRESHOLD = percentile(contrasts, 90);
  LOW_THRESHOLD = 0.5 * HIGH_THRESHOLD;
  CONNECT_DIST = 0.75 * percentile(lengths, 50);
}

function percentile(arr, p) {
  let i = floor((p / 100) * arr.length);
  return arr[constrain(i, 0, arr.length - 1)];
}

// =====================================================
// STAGE 5 — GRAPH HYSTERESIS
// =====================================================

function applyHysteresis() {
  finalEdges = [];

  let strong = allEdges.filter(e => e.strength >= HIGH_THRESHOLD);
  let weak = allEdges.filter(e => e.strength >= LOW_THRESHOLD && e.strength < HIGH_THRESHOLD);

  let stack = [...strong];
  for (let e of strong) {
    e.used = true;
    finalEdges.push(e);
  }

  while (stack.length > 0) {
    let cur = stack.pop();
    for (let e of weak) {
      if (e.used) continue;
      if (edgesTouch(cur, e)) {
        e.used = true;
        finalEdges.push(e);
        stack.push(e);
      }
    }
  }
}

function edgesTouch(e1, e2) {
  return (
    p5.Vector.dist(e1.a, e2.a) < CONNECT_DIST ||
    p5.Vector.dist(e1.a, e2.b) < CONNECT_DIST ||
    p5.Vector.dist(e1.b, e2.a) < CONNECT_DIST ||
    p5.Vector.dist(e1.b, e2.b) < CONNECT_DIST
  );
}

// =====================================================
// STAGE 6 — EDGE CHAINING
// =====================================================

function buildEdgeChains() {
  edgeChains = [];
  let unused = new Set(finalEdges);

  while (unused.size > 0) {
    let chain = [];
    let edge = unused.values().next().value;
    unused.delete(edge);

    chain.push(edge.a.copy(), edge.b.copy());

    let growing = true;
    while (growing) {
      growing = false;
      for (let e of Array.from(unused)) {
        if (extendChain(chain, e)) {
          unused.delete(e);
          growing = true;
          break;
        }
      }
    }

    edgeChains.push(chain);
  }
}

function extendChain(chain, e) {
  let head = chain[0];
  let tail = chain[chain.length - 1];

  if (p5.Vector.dist(e.a, tail) < CONNECT_DIST) {
    chain.push(e.b.copy()); return true;
  }
  if (p5.Vector.dist(e.b, tail) < CONNECT_DIST) {
    chain.push(e.a.copy()); return true;
  }
  if (p5.Vector.dist(e.a, head) < CONNECT_DIST) {
    chain.unshift(e.b.copy()); return true;
  }
  if (p5.Vector.dist(e.b, head) < CONNECT_DIST) {
    chain.unshift(e.a.copy()); return true;
  }
  return false;
}

// =====================================================
// STAGE 7 — SMOOTHING
// =====================================================

function smoothEdgeChains() {
  for (let i = 0; i < edgeChains.length; i++) {
    let chain = edgeChains[i];
    for (let k = 0; k < SMOOTH_ITERATIONS; k++) {
      chain = chaikin(chain);
    }
    edgeChains[i] = chain;
  }
}

function chaikin(pts) {
  if (pts.length < 3) return pts;

  let res = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    let Q = p5.Vector.lerp(pts[i], pts[i + 1], 0.25);
    let R = p5.Vector.lerp(pts[i], pts[i + 1], 0.75);
    res.push(Q, R);
  }
  res.push(pts[pts.length - 1]);
  return res;
}

// =====================================================
// STAGE 8 — DRAW
// =====================================================

function displaySmoothedEdges() {
  noFill();
  stroke(0);
  strokeWeight(1);

  for (let chain of edgeChains) {
    beginShape();
    for (let p of chain) vertex(p.x, p.y);
    endShape();
  }
}
