let points = [];
let delaunay, voronoi;
let picture = null;
let initialized = false;

let currentStage = 'NONE';
let stipplingStartTime = 0;
const STIPPLING_DURATION = 3000; 

let allEdges = [];
let finalEdges = [];
let edgeChains = [];
let sobelImage = null;

let HIGH_THRESHOLD = 0;
let LOW_THRESHOLD = 0;
let CONNECT_DIST = 0;
let SMOOTH_ITERATIONS = 3; // Increased for better results

function setup() {
  const canvas = createCanvas(1024, 512);
  canvas.id("vornoiCanvas");
  canvas.parent("result-canvas");
  pixelDensity(1);
}

function initWithPicture() {
  if (!picture) return;
  points = [];
  allEdges = [];
  finalEdges = [];
  edgeChains = [];
  resizeCanvas(picture.width, picture.height);
  generateRandomPoints(6000);
  delaunay = calculateDelaunay(points);
  voronoi = delaunay.voronoi([0, 0, width, height]);
  generateSobel();
  initialized = true;
  currentStage = 'VORONOI_INITIAL';
}

function draw() {
  if (!picture || !initialized) return;
  background(255);

  if (currentStage === 'STIPPLING') {
    updatePoints();
    if (millis() - stipplingStartTime > STIPPLING_DURATION) {
      runEdgePipeline();
      currentStage = 'STIPPLING_DONE'; 
    }
  }
  renderCurrentStage();
}

function renderCurrentStage() {
  switch (currentStage) {
    case 'VORONOI_INITIAL': drawVoronoiCells(); break;
    case 'STIPPLING':
    case 'STIPPLING_DONE': displayPoints(); break;
    case 'HYSTERESIS': 
      displayPoints(); 
      stroke(255, 0, 0); strokeWeight(1.5);
      for (let e of finalEdges) line(e.a.x, e.a.y, e.b.x, e.b.y);
      break;
    case 'SMOOTHING': displaySmoothedEdges(); break;
    case 'SOBEL': if (sobelImage) image(sobelImage, 0, 0); break;
  }
}

// STAGE CONTROLS
window.goToStage1 = () => { currentStage = 'VORONOI_INITIAL'; };
window.goToStage2 = () => { currentStage = 'STIPPLING'; stipplingStartTime = millis(); };
window.goToStage3 = () => { if (finalEdges.length === 0) runEdgePipeline(); currentStage = 'HYSTERESIS'; };
window.goToStage4 = () => { currentStage = 'SMOOTHING'; };
window.showSobel = () => { currentStage = 'SOBEL'; };

function runEdgePipeline() {
  computeDelaunayEdges();
  computeAdaptiveParameters();
  applyHysteresis();
  buildEdgeChains();
  smoothEdgeChains(); // This now includes Mean Kernel
}

// --- SMOOTHING ENGINE ---
function smoothEdgeChains() {
  for (let i = 0; i < edgeChains.length; i++) {
    // 1. Chaikin to add resolution/cut corners
    for (let k = 0; k < 2; k++) {
      edgeChains[i] = chaikin(edgeChains[i]);
    }
    // 2. Mean Kernel (Moving Average) to kill zig-zags
    edgeChains[i] = applyMeanFilter(edgeChains[i], 3); 
  }
}

function applyMeanFilter(pts, windowSize) {
  if (pts.length < windowSize) return pts;
  let smoothed = [];
  for (let i = 0; i < pts.length; i++) {
    let sumX = 0, sumY = 0, count = 0;
    for (let j = -windowSize; j <= windowSize; j++) {
      let idx = i + j;
      if (idx >= 0 && idx < pts.length) {
        sumX += pts[idx].x;
        sumY += pts[idx].y;
        count++;
      }
    }
    smoothed.push(createVector(sumX / count, sumY / count));
  }
  return smoothed;
}

function chaikin(pts) {
  if (pts.length < 3) return pts;
  let res = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    res.push(p5.Vector.lerp(pts[i], pts[i+1], 0.25), p5.Vector.lerp(pts[i], pts[i+1], 0.75));
  }
  res.push(pts[pts.length - 1]);
  return res;
}

// --- CORE UTILS ---
function updatePoints() {
  let centroids = Array(points.length).fill().map(() => createVector(0, 0));
  let weights = Array(points.length).fill(0);
  picture.loadPixels();
  let idx = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let i = (x + y * width) * 4;
      let w = 1 - (picture.pixels[i] + picture.pixels[i + 1] + picture.pixels[i + 2]) / 765;
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

function generateRandomPoints(n) {
  for (let i = 0; i < n; i++) {
    let x = random(width), y = random(height);
    if (random(100) > brightness(picture.get(x,y))) points.push(createVector(x, y));
    else i--;
  }
}

function drawVoronoiCells() {
  stroke(200); strokeWeight(0.5); noFill();
  let polygons = voronoi.cellPolygons();
  for (let poly of polygons) {
    beginShape();
    for (let p of poly) vertex(p[0], p[1]);
    endShape(CLOSE);
  }
}

function computeDelaunayEdges() {
  allEdges = [];
  for (let i = 0; i < points.length; i++) {
    let Ii = getIntensity(points[i]);
    for (let j of delaunay.neighbors(i)) {
      if (j < i) continue;
      let Ij = getIntensity(points[j]);
      allEdges.push({ a: points[i].copy(), b: points[j].copy(), strength: abs(Ii - Ij), length: p5.Vector.dist(points[i], points[j]), used: false });
    }
  }
}

function getIntensity(v) {
  let c = picture.get(constrain(v.x, 0, width - 1), constrain(v.y, 0, height - 1));
  return (red(c) + green(c) + blue(c)) / 3;
}

function computeAdaptiveParameters() {
  let contrasts = allEdges.map(e => e.strength).sort((a, b) => a - b);
  let lengths = allEdges.map(e => e.length).sort((a, b) => a - b);
  HIGH_THRESHOLD = contrasts[floor(contrasts.length * 0.9)];
  LOW_THRESHOLD = HIGH_THRESHOLD * 0.5;
  CONNECT_DIST = lengths[floor(lengths.length * 0.5)] * 0.8;
}

function applyHysteresis() {
  finalEdges = [];
  let strong = allEdges.filter(e => e.strength >= HIGH_THRESHOLD);
  let weak = allEdges.filter(e => e.strength >= LOW_THRESHOLD && e.strength < HIGH_THRESHOLD);
  let stack = [...strong];
  for (let e of strong) { e.used = true; finalEdges.push(e); }
  while (stack.length > 0) {
    let cur = stack.pop();
    for (let e of weak) {
      if (!e.used && (p5.Vector.dist(cur.a, e.a) < CONNECT_DIST || p5.Vector.dist(cur.b, e.b) < CONNECT_DIST)) {
        e.used = true; finalEdges.push(e); stack.push(e);
      }
    }
  }
}

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
        if (extendChain(chain, e)) { unused.delete(e); growing = true; break; }
      }
    }
    if (chain.length > 2) edgeChains.push(chain);
  }
}

function extendChain(chain, e) {
  let head = chain[0], tail = chain[chain.length - 1];
  if (p5.Vector.dist(e.a, tail) < CONNECT_DIST) { chain.push(e.b.copy()); return true; }
  if (p5.Vector.dist(e.b, tail) < CONNECT_DIST) { chain.push(e.a.copy()); return true; }
  if (p5.Vector.dist(e.a, head) < CONNECT_DIST) { chain.unshift(e.b.copy()); return true; }
  if (p5.Vector.dist(e.b, head) < CONNECT_DIST) { chain.unshift(e.a.copy()); return true; }
  return false;
}

function displayPoints() {
  stroke(0); strokeWeight(2);
  for (let p of points) point(p.x, p.y);
}

function displaySmoothedEdges() {
  noFill(); stroke(0); strokeWeight(1.5);
  for (let chain of edgeChains) {
    beginShape();
    for (let p of chain) vertex(p.x, p.y);
    endShape();
  }
}

function generateSobel() {
  sobelImage = createImage(picture.width, picture.height);
  picture.loadPixels();
  sobelImage.loadPixels();
  for (let x = 1; x < picture.width - 1; x++) {
    for (let y = 1; y < picture.height - 1; y++) {
      let gx = (-1 * getGray(x-1,y-1) + 1 * getGray(x+1,y-1) + -2 * getGray(x-1,y) + 2 * getGray(x+1,y) + -1 * getGray(x-1,y+1) + 1 * getGray(x+1,y+1));
      let gy = (-1 * getGray(x-1,y-1) - 2 * getGray(x,y-1) - 1 * getGray(x+1,y-1) + 1 * getGray(x-1,y+1) + 2 * getGray(x,y+1) + 1 * getGray(x+1,y+1));
      let val = sqrt(gx*gx + gy*gy);
      let idx = (x + y * picture.width) * 4;
      sobelImage.pixels[idx] = sobelImage.pixels[idx+1] = sobelImage.pixels[idx+2] = val;
      sobelImage.pixels[idx+3] = 255;
    }
  }
  sobelImage.updatePixels();
}

function getGray(x, y) {
  let i = (x + y * picture.width) * 4;
  return (picture.pixels[i] + picture.pixels[i+1] + picture.pixels[i+2]) / 3;
}

function calculateDelaunay(pts) {
  let arr = [];
  for (let p of pts) arr.push(p.x, p.y);
  return new d3.Delaunay(arr);
}

window.setPicture = (src) => {
  initialized = false;
  loadImage(src, img => { picture = img; initWithPicture(); });
};
