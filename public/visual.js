// This is adapted from somewhere on the internet.
// I'm not smart enough to implement the finicky `render' algorithm
// myself, and since the original script made extensive use of globals
// I've done my best to clean it up.

let analyser, analyserBufferLength;

let w = window.innerWidth;
let h = window.innerHeight;

let center2D = {
	x: w / 2,
	y: h / 2
};

let canvas;
let context;

var imageData;
var data;

let mouseActive = false;
let mouseDown = false;
let mousePos = { x:0, y:0 };
let paused = false;

const fov = 250;
const speed = 0.25
const particleDistanceTop = 10;

let particles = [];
let particlesSky = [];

const make_element = (tag, options) => Object.assign(document.createElement(tag), options);

function init() {
	/// Audio ///
	const audio = make_element('audio', {
		src:'http://localhost:8888/radio.ogg',
		autoplay: true,
		crossOrigin: 'anonymous',
		onended: hack,
		onerror: hack,
		type: 'application/ogg'
	});

	// Not sure if this works
	function hack() {
		console.log('hack?');
		audio.src = audio.currentSrc;
		audio.play();
	}

	const audioContext = new AudioContext();

  analyser = audioContext.createAnalyser();
  analyser.connect(audioContext.destination);
  analyser.smoothingTimeConstant = 0.75;
  analyser.fftSize = 512 * 16;
  analyserBufferLength = analyser.frequencyBinCount;

  audioContext.createMediaElementSource(audio).connect(analyser);

	/// Canvas ///
  canvas = make_element('canvas', {
		width: w,
		height: h,
		
		onmousedown: () => paused = paused === true ? false : true,
		onmouseenter: () => mouseActive = true,
		onmouseleave: () => {
			mouseActive = false;
			mousePos.x = w / 2;
			mouseDown = false;
		},
		onmousemove: (e) => {
			const rect = canvas.getBoundingClientRect();
			mousePos.x =  e.clientX - rect.left;
			mousePos.y = e.clientY - rect.top;
		}
	});

  document.body.appendChild(canvas);
  context = canvas.getContext('2d');

	window.addEventListener('resize', onResize);
	
  imageData = context.getImageData( 0, 0, w, h );
  data = imageData.data;
	
  addParticles(particles, 1);
  addParticles(particlesSky, -1);
	
  context.putImageData(imageData, 0, 0);

	/// And off we go ~ ///
	animate();
};

function clearImageData() {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
};

function setPixel(x, y, r, g, b, a) {
  const i = (x + y * imageData.width) * 4;

  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
};

// This is black magic
// Don't think too hard about it
function drawLine(x1, y1, x2, y2, r, g, b, a) {
	x1 = x1 | 0;
	y1 = y1 | 0;
	x2 = x2 | 0;
	y2 = y2 | 0;
	
  var dx = Math.abs(x2 - x1);
  var dy = Math.abs(y2 - y1);

  var sx = ( x1 < x2 ) ? 1 : -1;
  var sy = ( y1 < y2 ) ? 1 : -1;

  var err = dx - dy;

  var lx = x1;
  var ly = y1;    

  while (true) {
    if (lx > 0 && lx < w && ly > 0 && ly < h){
      setPixel(lx, ly, r, g, b, a);
    }
		
    if ((lx === x2) && (ly === y2))
      break;

		var e2 = 2 * err;

		if (e2 > -dx){
      err -= dy; 
      lx += sx;
    }

		if (e2 < dy){
      err += dx; 
      ly += sy;
    }
  }
};

function addParticles(array, direction) {
	const audioBufferIndexMin = 8;
  const audioBufferIndexMax = 512;
	
	let audioBufferIndex = audioBufferIndexMin;
	
  for (var z = -fov; z < fov; z += 5) { 
		var particlesRow = [];

    for (var x = -fov; x < fov; x += 5) {
			particlesRow.push({
				x: x,
				// add `(minus)particledistancetop' when `direction' > 0
				y: Math.random() * 5 + (particleDistanceTop * dir > 0 ? 1 : -1),
				z: z,
				x2d: 0,
				y2d: 0,
				index: audioBufferIndex
			});
      
      audioBufferIndex++;

			// Reset audioBufferIndex
      if (audioBufferIndex > audioBufferIndexMax)
      	audioBufferIndex = audioBufferIndexMin;
    }

    array.push(particlesRow);
  }
};

function onResize(){  
  w = window.innerWidth;
  h = window.innerHeight;

	center2D = { x:w / 2, y:h / 2 };

  canvas.width = w;
  canvas.height = h;

  //2context.fillStyle = '#000000';
  //context.fillRect(0, 0, w, h);

  imageData = context.getImageData( 0, 0, w, h );
  data = imageData.data;
};



function scale_particle(particle) {
	const scale = fov / (fov + particle.z);

	particle.x2d = (particle.x * scale) + center2D.x;
	particle.y2d = (particle.y * scale) + center2D.y;
	particle.z -= speed;
	
	return particle;
}

function render() {
	let frequencySource;
	if (analyser) {
		// Next two lines make a flat graph
		// frequencySource = new Array(4096);
		// frequencySource.fill(0);
		frequencySource = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(frequencySource);
		if (paused)
			frequencySource.fill(0);
  }

	var sortArray = false;

  for (var i = 0; i < particles.length; i++) {
		var particlesRow = particles[i];
		
    for (var j = 0, k = particlesRow.length; j < k; j++) {
			let particle = scale_particle(particlesRow[j]);
      
      if (analyser)
				particle.y = (frequencySource[particle.index] / 10) + particleDistanceTop;

      if (particle.z < -fov){
        particle.z += (fov * 2);

        sortArray = true;
      }
      
      const lineColorValue = Math.round(i / particles.length * 155);
			
      if (j > 0){
        var p = particlesRow[j - 1];

        drawLine(particle.x2d, particle.y2d, p.x2d, p.y2d, 0, lineColorValue, 0, 255 );
      }
			
			if (i > 0 && i < particles.length - 1) {
				var pB = particles[i - 1][j];

				drawLine(particle.x2d, particle.y2d, pB.x2d, pB.y2d, 0, lineColorValue, 0, 255);
			}
    }
  }
	
	for (var i = 0, l = particlesSky.length; i < l; i++) {
		var particlesRow = particlesSky[ i ];

		for (var j = 0, k = particlesRow.length; j < k; j++) {
			var particle = scale_particle(particlesRow[j]);
			
			if (analyser)
				particle.y = -(frequencySource[particle.index] / 10) - particleDistanceTop;
			
			if ( particle.z < -fov ) {
				particle.z += ( fov * 2 );

				sortArray = true;
			}

			const lineColorValue = Math.round(i / l * 255);

			if (j > 0) {
				var p = particlesRow[j - 1];

				drawLine(particle.x2d, particle.y2d, p.x2d, p.y2d, 0, Math.round(lineColorValue / 2), lineColorValue, 255);
			}
			if (i > 0 && i < l - 1) {
				var pB = particlesSky[i - 1][j];

				drawLine(particle.x2d, particle.y2d, pB.x2d, pB.y2d, 0, Math.round(lineColorValue / 2), lineColorValue, 255);
			}
		}
	}

	if (sortArray) {
		particles = particles.sort((a, b) => (b[0].z - a[0].z));
		particlesSky = particlesSky.sort(( a, b ) => (b[ 0 ].z - a[ 0 ].z));
	}

	posX = mouseActive ? mousePos.x : (canvas.width / 2);
	center2D.x += (posX - center2D.x) * 0.015;
};

function animate() {
	clearImageData();
	render();
	context.putImageData(imageData, 0, 0);
	requestAnimationFrame(animate);
};

init();
