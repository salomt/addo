/**
 *  ADDO - Simple Addictive Organ
 *   
 * Code for virtual keyboard and set of sliders for playing notes on it.
 * The keyboard has to be defined in html. The sliders are generated dynamically.
 *
 *  @author Tommi Salomaa <tommi.salomaa@gmail.com>
 */

'use strict;'

// disable the context menu 
window.oncontextmenu = function(event) {
  event.preventDefault();
  event.stopPropagation();
  return false;
};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const numPartialsPerVoice = 8;
const masterGain = 1 / numPartialsPerVoice;
let masterOctave = 4;

const attackTime = 0.001;
const releaseTime = 0.5;

let sliders = [];

// not in use yet
let adsr = {attack : 0.1, decay : 0.5, sustain : 0.33, decay : 0.7 };

const pressedNotes = new Map();
let clickedKey = '';

let keysTouched = 0;

// initialize sliders
let sliderContainer = document.querySelector('#slider-container');
for (var i=0; i<numPartialsPerVoice; i++) {
    let slider = document.createElement('input');
    slider.classList.add('partial-slider');
    slider.classList.add(i.toString());
    slider.type = 'range';
    slider.setAttribute("orient", "vertical");  // for FireFox
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = (i == 0 ? 0.75 : 0);

    // if sound is playing, change the partial gain if the slider is changed 
    slider.addEventListener('input', function () {
        if (pressedNotes.size) {
            for (let [key, value] of pressedNotes) {
                const voice = value;
                voice.gain[slider.classList[1]].gain.value = slider.value * masterGain;
            }
        };
    }, false);
    
    sliderContainer.append(slider);
    sliders.push(slider);
}


const keys = {
  A: { element: document.querySelector('.c'),  note: 'C',  octaveOffset: 0 },
  W: { element: document.querySelector('.cs'), note: 'C#', octaveOffset: 0 },
  S: { element: document.querySelector('.d'),  note: 'D',  octaveOffset: 0 },
  E: { element: document.querySelector('.ds'), note: 'D#', octaveOffset: 0 },
  D: { element: document.querySelector('.e'),  note: 'E',  octaveOffset: 0 },
  F: { element: document.querySelector('.f'),  note: 'F',  octaveOffset: 0 },
  T: { element: document.querySelector('.fs'), note: 'F#', octaveOffset: 0 },
  G: { element: document.querySelector('.g'),  note: 'G',  octaveOffset: 0 },
  Y: { element: document.querySelector('.gs'), note: 'G#', octaveOffset: 0 },
  H: { element: document.querySelector('.a'),  note: 'A',  octaveOffset: 1 },
  U: { element: document.querySelector('.as'), note: 'A#', octaveOffset: 1 },
  J: { element: document.querySelector('.b'),  note: 'B',  octaveOffset: 1 },
  K: { element: document.querySelector('.c2'), note: 'C',  octaveOffset: 1 },
};

// if this is a touchscreen device, remove the letters from the keys (prevents the long press search menu)
if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)) {
  for (const [key, { element }] of Object.entries(keys)) {
      element.innerHTML = '';
  }
}

const getHz = (note = 'A', octave = 4) => {
  const A4 = 440;
  let N = 0;
  switch (note) {
    default:
    case 'A':
      N = 0;
      break;
    case 'A#':
    case 'Bb':
      N = 1;
      break;
    case 'B':
      N = 2;
      break;
    case 'C':
      N = 3;
      break;
    case 'C#':
    case 'Db':
      N = 4;
      break;
    case 'D':
      N = 5;
      break;
    case 'D#':
    case 'Eb':
      N = 6;
      break;
    case 'E':
      N = 7;
      break;
    case 'F':
      N = 8;
      break;
    case 'F#':
    case 'Gb':
      N = 9;
      break;
    case 'G':
      N = 10;
      break;
    case 'G#':
    case 'Ab':
      N = 11;
      break;
  }
  N += 12 * (octave - 4);
  return A4 * Math.pow(2, N / 12);
};

// key down event listener
document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();  
    
    if (key === 'Z' && masterOctave > 1) masterOctave--;
    if (key === 'X' && masterOctave < 6) masterOctave++;
    
    if (!key || pressedNotes.get(key)) {
        return;
    }
    playKey(key);
});

// key up event listener
document.addEventListener('keyup', (e) => {
  const key = e.key.toUpperCase();
  if (!key) {
    return;
  }
  //sconsole.log('keyup - stop ' + key);
  stopKey(key);
});

// mouse down event listener
for (const [key, { element }] of Object.entries(keys)) {
    element.addEventListener('mousedown', () => {
        playKey(key);
        clickedKey = key;
        //console.log('mouse - start ' + key);
    });

    element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keysTouched++;
      playKey(key);
      //console.log('touch - start' + key);
    });

    element.addEventListener('touchend', (e) => {
      e.preventDefault();
      keysTouched--;
      stopKey(key);
      //console.log('touchend - stop ' + key);
    });

    element.addEventListener('touchmove', (e) => {
      e.preventDefault();
      keysTouched--;
      //stopKey(key);
      //console.log('touchmove - stop ' + key);
    });
}

// mouse up event listener
document.addEventListener('mouseup', (e) => {
  stopKey(clickedKey);
  //console.log('mouseup - stop ' + clickedKey);
});


// plays note matching the given key
function playKey(key) {
    
    if (!keys[key] || pressedNotes.has(key) || clickedKey != '') {
        return;
    }
    
    // one generator is 8 oscillators (partials)
    // one gain is 8 oscGains
    // one voice is one generator and one gain
    
    let generator = [];
    let gain = [];
    
    for (var i=0; i<numPartialsPerVoice; i++) {        
        let partial = audioContext.createOscillator();
        let freq = getHz(keys[key].note, (keys[key].octaveOffset || 0) + masterOctave);
        if (Number.isFinite(freq)) {
            partial.frequency.value = freq * (i + 1);
        }
        let oscGain = audioContext.createGain();
        //oscGain.gain.value = sliders[i].value * masterGain; 
        partial.connect(oscGain);
        oscGain.connect(audioContext.destination);
        generator.push(partial);
        gain.push(oscGain);
        
        generator[i].start();

        gain[i].gain.setValueAtTime(0, audioContext.currentTime);
        gain[i].gain.linearRampToValueAtTime(sliders[i].value * masterGain, audioContext.currentTime + attackTime);
    }
        
    let voice = { generator: generator, gain : gain };
    pressedNotes.set(key, voice);   
    keys[key].element.classList.add('pressed');
}


// stops note matching the given key
function stopKey(key) {
  
    if (!keys[key]) {
        return;
    }

    keys[key].element.classList.remove('pressed');
    const voice = pressedNotes.get(key);

    for (var i=0; i<numPartialsPerVoice; i++) {
      voice.gain[i].gain.setTargetAtTime(0, releaseTime - attackTime, releaseTime * 0.1);
      voice.generator[i].stop(audioContext.currentTime + attackTime + releaseTime);
    }

    pressedNotes.delete(key); 
    clickedKey = '';

}


function releaseNote(releaseTime) {

}


