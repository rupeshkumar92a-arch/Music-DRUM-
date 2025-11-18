// project1.js - Drum Kit behavior, keyboard, touch + audio visualizer

(() => {
  // Keys assigned in order to the pads (map to the 7 pads as they appear in HTML)
  const KEY_MAP = ['W','A','S','D','J','K','L'];

  // Elements
  const pads = Array.from(document.querySelectorAll('.s1 > div'));
  const canvas = document.createElement('canvas');
  canvas.id = 'visualizer';
  const main = document.querySelector('main');
  main.insertBefore(canvas, main.firstChild);
  const ctx = canvas.getContext('2d');

  // Add control panel (volume, speed, mute)
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.innerHTML = `
    <div class="left">
      <button class="btn" id="muteBtn">Mute</button>
      <label>Volume</label><input id="volume" type="range" min="0" max="1" step="0.01" value="0.9">
      <label>Speed</label><input id="speed" type="range" min="0.5" max="1.6" step="0.01" value="1">
    </div>
    <div class="right">
      <button class="btn" id="metronomeToggle">Metronome Off</button>
    </div>
  `;
  main.appendChild(controls);

  // Helper text
  const helper = document.createElement('div');
  helper.className = 'helper';
  helper.innerText = 'Tap / Click a pad or press W A S D J K L keys. Use volume & speed controls below.';
  main.appendChild(helper);

  // Grab audio elements and map them
  const audios = pads.map((pad, i) => {
    const audio = pad.querySelector('audio');
    if (!audio) console.warn('No audio found in pad index', i);
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    // show key label on pad
    const label = document.createElement('div');
    label.className = 'key-label';
    label.innerText = KEY_MAP[i] || '?';
    pad.appendChild(label);

    // optionally show file name
    const name = document.createElement('div');
    name.className = 'sound-name';
    const src = audio && audio.src ? audio.src.split('/').pop().replace(/\.[^/.]+$/, '') : '';
    name.innerText = src;
    pad.appendChild(name);

    // make pad focusable for keyboard accessibility
    pad.tabIndex = 0;

    return audio;
  });

  // Setup Web Audio API
  let audioCtx, masterGain, analyser;
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    // connect each audio element to the audio context
    audios.forEach((audioEl) => {
      try {
        const srcNode = audioCtx.createMediaElementSource(audioEl);
        srcNode.connect(masterGain);
      } catch (err) {
        // Some browsers disallow multiple creates for same element in dev reloads; ignore if error
        console.warn('Could not create MediaElementSource:', err);
      }
    });
  }

  // start/resume ctx on first gesture
  function resumeAudioContext() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Visualizer drawing
  function fitCanvas() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function drawVisualizer() {
    if (!analyser) return;
    requestAnimationFrame(drawVisualizer);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width / devicePixelRatio;
    const H = canvas.height / devicePixelRatio;

    // draw bars
    const barCount = 64;
    const step = Math.floor(bufferLength / barCount);
    const barWidth = (W / barCount) * 0.7;
    let x = (W - (barCount * barWidth)) / 2;
    for (let i = 0; i < barCount; i++) {
      const v = dataArray[i * step] / 255;
      const barHeight = v * H * 0.95;
      const hue = 45 + v * 50; // yellow-ish to orange
      ctx.fillStyle = `rgba(${255},${220 - v * 80},${90 - v * 30}, ${0.95})`;
      // glow shadow
      ctx.shadowBlur = v * 28;
      ctx.shadowColor = 'rgba(255,222,89,0.55)';
      ctx.fillRect(x, H - barHeight, barWidth, barHeight);
      x += barWidth + 6;
    }
    ctx.shadowBlur = 0;
  }

  // Play sound with visual feedback
  function playPad(index) {
    if (!audios[index]) return;
    initAudio();
    resumeAudioContext();

    const audio = audios[index];
    audio.currentTime = 0;
    // respect speed control
    audio.playbackRate = Number(document.getElementById('speed').value || 1);
    audio.volume = Number(document.getElementById('volume').value || 0.9);
    const p = pads[index];

    // play & animate
    audio.play().catch((e) => {
      // some browsers need user gesture; ignore errors
      console.warn('play failed', e);
    });
    p.classList.add('playing','ripple');
    // remove ripple after animation
    setTimeout(()=> p.classList.remove('ripple'), 500);
    // remove playing after short time
    setTimeout(()=> p.classList.remove('playing'), 280);
  }

  // Event listeners for pads
  pads.forEach((pad, idx) => {
    pad.addEventListener('click', (e) => {
      initAudio();
      resumeAudioContext();
      playPad(idx);
    });
    // keyboard activation on Enter / Space when focused
    pad.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        playPad(idx);
      }
    });
    // touch support - taps
    pad.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      initAudio();
      resumeAudioContext();
      playPad(idx);
    }, {passive: false});
  });

  // Global keyboard listener
  window.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();
    const idx = KEY_MAP.indexOf(key);
    if (idx !== -1) {
      playPad(idx);
      // small visual focus for a11y
      pads[idx].focus({preventScroll:true});
    }
  });

  // Controls behavior
  const vol = document.getElementById('volume');
  const speed = document.getElementById('speed');
  const muteBtn = document.getElementById('muteBtn');
  const metronomeToggle = document.getElementById('metronomeToggle');
  let isMuted = false;
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    masterGain && (masterGain.gain.value = isMuted ? 0 : Number(vol.value));
    muteBtn.innerText = isMuted ? 'Unmute' : 'Mute';
    muteBtn.classList.toggle('active');
  });
  vol.addEventListener('input', () => {
    const v = Number(vol.value);
    if (masterGain) masterGain.gain.value = v;
  });
  speed.addEventListener('input', () => {
    // runtime affects next playback (we set playbackRate when playing)
  });

  // Simple metronome optional (click track)
  let metroInterval = null;
  metronomeToggle.addEventListener('click', () => {
    if (metroInterval) {
      clearInterval(metroInterval);
      metroInterval = null;
      metronomeToggle.innerText = 'Metronome Off';
      return;
    }
    // create synthetic click using oscillator
    initAudio();
    let bpm = 90;
    metronomeToggle.innerText = 'Metronome On';
    metroInterval = setInterval(() => {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(masterGain);
      o.start();
      // short click envelope
      g.gain.setValueAtTime(0.2, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.05);
      setTimeout(()=> {
        try { o.stop(); } catch(e){}
      }, 70);
    }, (60000 / bpm));
  });

  // Resize handling + start drawing when audio is initialized
  function onResize() {
    fitCanvas();
  }
  window.addEventListener('resize', onResize);
  // initialize canvas size and start animation loop even before audio init
  fitCanvas();
  // start animation loop with dummy analyser until real one present
  requestAnimationFrame(function initialLoop() {
    requestAnimationFrame(initialLoop);
    // if audio analyser is ready, start real draw
    if (analyser) {
      drawVisualizer();
      return;
    }
    // draw a subtle idle animation
    const W = canvas.width / devicePixelRatio;
    const H = canvas.height / devicePixelRatio;
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.beginPath();
    const t = performance.now() / 900;
    for (let i=0;i<60;i++){
      const x = (W * i/60);
      const amp = (Math.sin(t + i*0.3) + 1) * 6;
      ctx.fillStyle = `rgba(255,222,89, ${0.035 + i*0.002})`;
      ctx.fillRect(x, H/2 - amp/2, 6, amp);
    }
  });

  // Once audio is created, start real drawing
  const origInit = initAudio;
  initAudio = function() {
    origInit();
    // ensure analyser exist and start draw
    if (analyser) drawVisualizer();
  };

  // Unlock audio context on first user gesture for mobile
  ['click','touchstart','keydown'].forEach(evt => {
    window.addEventListener(evt, function unlock() {
      if (!audioCtx) initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      window.removeEventListener(evt, unlock);
    }, {passive:true});
  });

})();
