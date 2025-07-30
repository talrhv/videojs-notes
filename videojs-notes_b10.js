/*! @name videojs-sticky-notes @version 1.0.5 @license MIT */
(function (global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    // CommonJS
    var videojsLib = require('video.js');
    var preactLib;
    try { preactLib = require('preact'); } catch (e) { preactLib = global.preact; }
    module.exports = factory(videojsLib, preactLib);
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['video.js','preact'], function(videojsLib, preactLib){
      return factory(videojsLib, preactLib || global.preact);
    });
  } else {
    // Browser global
    factory(global.videojs, global.preact);
  }
}(this, function (videojs, preact) {
  'use strict';
  if (!videojs) throw new Error('video.js is required');
  if (!preact || !preact.h || !preact.render) throw new Error('Preact is required');

  const { h, render } = preact;
  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes   = options.notes || [];
      player.ready(() => this.renderMarkers());
    }
    addNote(n) { this.notes.push(n); this.renderMarkers(); }
    updateNote(id, d) {
      const note = this.notes.find(x=>x.id===id);
      if (note) Object.assign(note,d);
      this.renderMarkers();
    }
    removeNote(id) { this.notes = this.notes.filter(x=>x.id!==id); this.renderMarkers(); }

    renderMarkers() {
      const duration = this.player_.duration();
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (!bar) return;
      bar.querySelectorAll('.vjs-note-marker').forEach(el=>el.remove());
      this.notes.forEach(note=>{
        if (note.time<0||note.time>duration) return;
        const mk = document.createElement('div');
        mk.className='vjs-note-marker';
        mk.style.left=(note.time/duration*100)+'%';
        const tip=document.createElement('span');
        tip.className='note-tip-read';
        tip.textContent = note.text||'';
        mk.appendChild(tip);
        mk.addEventListener('click',e=>{e.stopPropagation(); showNoteModal(note);});
        bar.appendChild(mk);
      });
    }
  }
  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  let currentModal = null;
  function closeNoteModal() {
    if (currentModal) {
      render(null, currentModal.container);
      currentModal.backdrop.remove();
      currentModal.container.remove();
      currentModal = null;
    }
  }
  function showNoteModal(note) {
    closeNoteModal();
    const backdrop=document.createElement('div');
    backdrop.className='vjs-note-modal-backdrop';
    document.body.appendChild(backdrop);
    const container=document.createElement('div');
    container.className='vjs-note-modal';
    document.body.appendChild(container);
    if (note.component) {
      // If component is VNode
      if (typeof note.component==='object' && note.component!==null && note.component.type) {
        render(note.component, container);
      } else {
        render(h(note.component, {note, close: closeNoteModal}), container);
      }
    }
    currentModal={backdrop,container};
  }

  class StickyNotes extends Plugin {
    constructor(player, options) {
      super(player, options);
      const opts = options || {};
      player.one('loadedmetadata', () => {
        player.noteMarkersProgressBarControl =
          new NoteMarkersProgressBarControl(player, opts);
      });
    }

    addNote(n)       { this.player.noteMarkersProgressBarControl.addNote(n); }
    updateNote(i,d)  { this.player.noteMarkersProgressBarControl.updateNote(i,d); }
    removeNote(i)    { this.player.noteMarkersProgressBarControl.removeNote(i); }
    closeNoteModal() { closeNoteModal(); }
    notes(arr) {
      if (!Array.isArray(arr)) return;
      const ctrl = this.player.noteMarkersProgressBarControl;
      ctrl.notes = arr.slice();
      ctrl.renderMarkers();
    }
  }
  StickyNotes.VERSION = '1.0.5';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
