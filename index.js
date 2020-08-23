const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws');
const formidable = require('formidable');
// I would like to remove this dep.
// Should be as simple as fs.watch and stating files
const chokidar = require('chokidar');

const config = require('./config.js');

// Magic from https://stackoverflow.com/a/2117523
// Modified because node crypto is ass.
const uuidv4 = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	(c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16));

let pipes = new Map();
let songs = 0;

// Sending data over all sockets at once
function send_sock(key, value) {
	for (const pipe of pipes.values()) {
		pipe.send(JSON.stringify({
			'name': key,
			'value': value
		}));
	}
}

const send_pipes = () => send_sock('travelers', pipes.size);
const send_songs = () => send_sock('sounds', songs);

chokidar.watch(config.songs_dir, { persistent: true })
	.on('add', () => {
		songs += 1;
		send_songs();
	})
	.on('unlink', () => {
		songs -= 1;
		send_songs();
	});

// Max filesize is set in nginx.
function handleUpload(req, res) {
	let form = new formidable.IncomingForm();	
	form.parse(req, (err, fields, files) => {
		const f = files.sounds;
		if (! /audio\/.*/.test(f.type))
			res.end() // error
		
		spawn('ffmpeg', ['-i', f.path, '-c:a', 'libvorbis', '-vn', `${config.songs_dir}/${uuidv4()}.ogg`])
		res.end()
	});
}

const serb = http.createServer((req, res) => {
	// Poor mans router, we don't need anything more complicated
	if (req.url === '/transfer' && req.method.toLowerCase() === 'post') {
		console.log('uploading...');
		handleUpload(req, res)
	}
}).listen(8080);

new WebSocket.Server({ server: serb })
	.on('connection', ws => {
		const uuid = uuidv4();
		
		pipes.set(uuid, ws);
		send_pipes();
		send_songs();
		
		ws.on('close', () => {
			pipes.delete(uuid);
			send_pipes();
		})
	});

console.log('Server listening on http://localhost:8080');
