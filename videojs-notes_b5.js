/*!
 * @name videojs-sticky-notes
 * @version 1.0.3
 * @license MIT
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory(require('video.js'), require('preact'))
    : typeof define === 'function' && define.amd
      ? define(['video.js','preact'], factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         factory(global.videojs, global.preact));
}(this, function (videojs, preact) {
  'use strict';

  const { h, render } = preact;
  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

  // ---------------------------------------------------------
  // קומפוננטת המחלקה שמציירת את הסימנים על ה־progress bar
  // ---------------------------------------------------------
  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes   = options.notes || [];
      player.ready(() => this.renderMarkers());
    }

    addNote(noteObj) {
      this.notes.push(noteObj);
      this.renderMarkers();
    }
    updateNote(id, data) {
      const n = this.notes.find(x => x.id === id);
      if (n) Object.assign(n, data);
      this.renderMarkers();
    }
    removeNote(id) {
      this.notes = this.notes.filter(x => x.id !== id);
      this.renderMarkers();
    }

    renderMarkers() {
      const duration = this.player_.duration();
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (!bar) return;

      // נקה סימנים קודמים
      bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';

        // Tooltip לקריאה בלבד
        const tip = document.createElement('span');
        tip.className = 'note-tip-read';
        tip.textContent = note.text || '';
        mk.appendChild(tip);

        // לחיצה: מצדיקה modal עם הקומפוננטה
        mk.addEventListener('click', e => {
          e.stopPropagation();
          showNoteModal(note, mk);
        });

        bar.appendChild(mk);
      });
    }
  }
  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  // ---------------------------------------------------------
  // פונקציות עזר להצגת ה‑Modal עם הקומפוננטה
  // ---------------------------------------------------------
  let currentModal = null;
  function closeNoteModal() {
    if (currentModal) {
      render(null, currentModal.container);
      currentModal.backdrop.remove();
      currentModal.container.remove();
      currentModal = null;
    }
  }
  function showNoteModal(note, markerEl) {
    closeNoteModal();

    // backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'vjs-note-modal-backdrop';
    document.body.appendChild(backdrop);

    // modal container
    const container = document.createElement('div');
    container.className = 'vjs-note-modal';
    document.body.appendChild(container);

    // render Preact component
    const node = h(note.component, {
      note,
      close: closeNoteModal
    });
    render(node, container);

    currentModal = { backdrop, container };
  }

  // ---------------------------------------------------------
  // Plugin Wrapper
  // ---------------------------------------------------------
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
    updateNote(id,d) { this.player.noteMarkersProgressBarControl.updateNote(id,d); }
    removeNote(id)   { this.player.noteMarkersProgressBarControl.removeNote(id); }
    notes(arr) {
      if (Array.isArray(arr)) {
        const ctrl = this.player.noteMarkersProgressBarControl;
        ctrl.notes = arr.slice();
        ctrl.renderMarkers();
      }
    }
  }
  StickyNotes.VERSION = '1.0.3';
  videojs.registerPlugin('stickyNotes', StickyNotes);
}));
