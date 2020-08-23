const drag = document.getElementById('draggable');

document.getElementById('drag-header').addEventListener('mousedown', function(e) {
  var offsetX = e.clientX - parseInt(window.getComputedStyle(drag).left);
  var offsetY = e.clientY - parseInt(window.getComputedStyle(drag).top);
  
  function mouseMoveHandler(e) {
    drag.style.top = (e.clientY - offsetY) + 'px';
    drag.style.left = (e.clientX - offsetX) + 'px';
  }

  window.addEventListener('mousemove', mouseMoveHandler);
	
  window.addEventListener('mouseup', () =>  {
		window.removeEventListener('mousemove', mouseMoveHandler);
	}, {once: true});
});

document.getElementById('drag-header').ondblclick = () => {
	drag.style.top = '0px';
	drag.style.left = '0px';
}

/// ws shit
let connections = document.getElementById('connections');
let songs = document.getElementById('songs');
let ws = new WebSocket("ws://127.0.0.1:8080");
ws.onmessage = (e) => {
	const resp = JSON.parse(e.data);
	switch (resp.name){
	case 'travelers':
		connections.innerHTML = resp.value === 1 ? `Feeling lonely?` : `${resp.Value} lost souls.`
		break;
	case 'sounds':
		songs.innerHTML = `${resp.value} Tracks.`
	}
}

document.getElementById('transfer').onchange = async (e) => {
	e.preventDefault();

	const resp = await fetch('http://localhost:8080/transfer', {
    method: 'POST',
    body: new FormData(document.getElementById('frm'))
  })
				.then(resp => console.log(resp));
}
