let loops = [];
let agudos = [];

let filter;
let started = false;
let loaded = false;

// play area
let centerX, centerY;
let radiusX, radiusY;

let currentLoop = null;
let currentLoopIndex = -1;

// cores por loop (4)
let loopColors = [
  [255, 120, 40],   // loop1: laranja
  [60, 140, 255],   // loop2: azul
  [80, 200, 120],   // loop3: verde
  [255, 80, 180]    // loop4: rosa
];

// velocidade do rato
let prevX = 0;
let prevY = 0;

// rasto
let trail = [];
let maxTrail = 140;

// pulsação
let pulsePhase = 0;

// fundo nublado
let clouds = [];

function preload() {
  soundFormats('mp3');

  loops[0] = loadSound("sounds/loop1.mp3");
  loops[1] = loadSound("sounds/loop2.mp3");
  loops[2] = loadSound("sounds/loop3.mp3");
  loops[3] = loadSound("sounds/loop4.mp3");

  agudos[0] = loadSound("sounds/agudo1.mp3");
}

function setup() {
  const holder = document.getElementById("sketch-holder");
  const w = holder?.offsetWidth || windowWidth;
  const h = holder?.offsetHeight || windowHeight;

  const c = createCanvas(w, h);
  c.parent("sketch-holder");

  filter = new p5.LowPass();

  // loops passam pelo filtro
  loops.forEach(s => {
    s.disconnect();
    s.connect(filter);
    s.setVolume(0);
    s.rate(1);
  });

  // agudos vão diretos ao master (sem filtro)
  agudos.forEach(s => {
    s.disconnect();
    s.connect();
    s.setVolume(0);
  });

  calculateEllipse();
  generateClouds();

  loaded = true;
}

function windowResized() {
  const holder = document.getElementById("sketch-holder");
  const w = holder?.offsetWidth || windowWidth;
  const h = holder?.offsetHeight || windowHeight;

  resizeCanvas(w, h);
  calculateEllipse();
  generateClouds(); // re-cria nuvens para o novo tamanho
}

function calculateEllipse() {
  // usa width/height do canvas (não windowWidth/windowHeight)
  radiusX = width * 0.35;
  radiusY = height * 0.2;

  // canto superior esquerdo
  centerX = radiusX + 20;
  centerY = radiusY + 20;
}

function generateClouds() {
  clouds = [];
  for (let i = 0; i < 30; i++) {
    clouds.push({
      x: random(-radiusX, radiusX),
      y: random(-radiusY, radiusY),
      r: random(40, 120),
      offset: random(1000)
    });
  }
}

function draw() {
  clear();

  let nx = (mouseX - centerX) / radiusX;
  let ny = (mouseY - centerY) / radiusY;
  let inside = nx * nx + ny * ny < 1;
  let d = sqrt(nx * nx + ny * ny);

  let speed = dist(mouseX, mouseY, prevX, prevY);

  // CAMADA 1: cor base
  if (currentLoopIndex !== -1) {
    let col = loopColors[currentLoopIndex];
    let alpha = map(d, 0, 1, 60, 25);

    noStroke();
    fill(col[0], col[1], col[2], alpha);
    ellipse(centerX, centerY, radiusX * 2, radiusY * 2);
  }

  // CAMADA 2: nuvens (aditivo, só dentro)
  if (currentLoopIndex !== -1 && inside) {
    pulsePhase += 0.01;

    let col = loopColors[currentLoopIndex];
    let motion = map(speed, 0, 30, 0.2, 2.5, true);

    noStroke();
    for (let c of clouds) {
      let dx = nx * motion * 10;
      let dy = ny * motion * 10;

      let cx = centerX + c.x + dx * sin(frameCount * 0.01 + c.offset);
      let cy = centerY + c.y + dy * cos(frameCount * 0.01 + c.offset);

      let ex = (cx - centerX) / radiusX;
      let ey = (cy - centerY) / radiusY;

      if (ex * ex + ey * ey < 1) {
        let alpha = 12 + sin(frameCount * 0.02 + c.offset) * 10;
        fill(col[0], col[1], col[2], alpha);
        ellipse(cx, cy, c.r, c.r);
      }
    }
  }

  // contorno da elipse
  noFill();
  stroke(57, 255, 20);
  strokeWeight(3);
  ellipse(centerX, centerY, radiusX * 2, radiusY * 2);

  // marcador do centro
  let cp = sin(frameCount * 0.03) * 2;
  noStroke();
  fill(0);
  ellipse(centerX, centerY, 10 + cp, 10 + cp);

  if (started && inside) {
    // pitch exponencial (quase nada em lento, óbvio em rápido)
    let t = constrain(speed / 30, 0, 1);
    t = pow(t, 3.0);
    let pitch = 1.0 + t * (2.5 - 1.0);
    if (currentLoop) currentLoop.rate(pitch);

    // filtro radial
    let freq = map(d, 0, 1, 4000, 600);
    filter.freq(freq);

    // pan horizontal
    let pan = constrain(nx, -1, 1);

    if (!currentLoop) {
      startNewLoop(pan);
    } else {
      currentLoop.pan(pan);
    }

    // rasto
    let steps = floor(map(speed, 0, 30, 1, 6, true));
    for (let i = 0; i < steps; i++) {
      let tt = i / steps;
      trail.push({
        x: lerp(prevX, mouseX, tt),
        y: lerp(prevY, mouseY, tt),
        life: 255,
        size: map(speed, 0, 30, 5, 18, true)
      });
    }

    if (trail.length > maxTrail) {
      trail.splice(0, trail.length - maxTrail);
    }
  } else {
    stopCurrentLoop();
  }

  prevX = mouseX;
  prevY = mouseY;

  // desenhar rasto
  noStroke();
  for (let i = trail.length - 1; i >= 0; i--) {
    let tr = trail[i];
    let col = currentLoopIndex !== -1 ? loopColors[currentLoopIndex] : [0, 0, 0];
    fill(col[0], col[1], col[2], tr.life);
    ellipse(tr.x, tr.y, tr.size, tr.size);
    tr.life -= 4;
    if (tr.life <= 0) trail.splice(i, 1);
  }
}

function mousePressed() {
  if (!loaded) return;

  if (!started) {
    userStartAudio();
    started = true;
    return;
  }

  let nx = (mouseX - centerX) / radiusX;
  let ny = (mouseY - centerY) / radiusY;
  let inside = nx * nx + ny * ny < 1;

  if (inside) {
    let s = random(agudos);
    s.stop();
    s.pan(constrain(nx, -1, 1));
    s.setVolume(0.45);
    s.play();

    stopCurrentLoop();
    startNewLoop(constrain(nx, -1, 1));
  }
}

function startNewLoop(pan) {
  currentLoopIndex = floor(random(loops.length));
  currentLoop = loops[currentLoopIndex];
  currentLoop.loop();
  currentLoop.pan(pan);
  currentLoop.rate(1);
  currentLoop.setVolume(0.6, 0.5);
}

function stopCurrentLoop() {
  if (currentLoop) {
    currentLoop.stop();
    currentLoop = null;
    currentLoopIndex = -1;
  }
}
