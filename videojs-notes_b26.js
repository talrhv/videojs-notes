/*! @name videojs-sticky-notes @version 1.2.0 @license MIT */
(function (global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('video.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['video.js'], factory);
  } else {
    factory(global.videojs);
  }
}(this, function (videojs) {
  'use strict';
  if (!videojs) throw new Error('video.js is required');

  const Component = videojs.getComponent('Component');
  const Plugin = videojs.getPlugin('plugin');

  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes = options.notes || [];
      player.ready(() => this.renderMarkers());
    }

    cleanup() {
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (bar) {
        bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());
      }
    }

    dispose() {
      this.cleanup();
      super.dispose();
    }

    addNote(n) {
      this.notes.push(n);
      this.renderMarkers();
    }

    updateNote(id, d) {
      const note = this.notes.find(x => x.id === id);
      if (note) Object.assign(note, d);
      this.renderMarkers();
    }

    removeNote(id) {
      this.notes = this.notes.filter(x => x.id !== id);
      this.renderMarkers();
    }

    renderMarkers() {
      this.cleanup();
      const duration = this.player_.duration();
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (!bar) return;

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';

        // Hover
        mk.addEventListener('mouseenter', () => {
          window.dispatchEvent(new CustomEvent('stickyNoteHover', {
            detail: { noteId: note.id }
          }));
        });

        // Leave
        mk.addEventListener('mouseleave', () => {
          window.dispatchEvent(new CustomEvent('stickyNoteLeave', {
            detail: { noteId: note.id }
          }));
        });

        // Click (open modal)
        mk.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this.player_.paused()) this.player_.pause();
          window.dispatchEvent(new CustomEvent('stickyNoteClick', {
            detail: { noteId: note.id }
          }));
        });

        bar.appendChild(mk);
      });
    }
  }

  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  class StickyNotes extends Plugin {
    constructor(player, options) {
      super(player, options);
      const opts = options || {};
      player.one('loadedmetadata', () => {
        player.noteMarkersProgressBarControl = new NoteMarkersProgressBarControl(player, opts);
      });
      player.one('dispose', () => this.dispose());
    }

    dispose() {
      this.player.noteMarkersProgressBarControl?.dispose();
      super.dispose();
    }

    addNote(n) {
      this.player.noteMarkersProgressBarControl?.addNote(n);
    }

    updateNote(i, d) {
      this.player.noteMarkersProgressBarControl?.updateNote(i, d);
    }

    removeNote(i) {
      this.player.noteMarkersProgressBarControl?.removeNote(i);
    }

    notes(arr) {
      if (!Array.isArray(arr)) return;
      const ctrl = this.player.noteMarkersProgressBarControl;
      if (ctrl) {
        ctrl.notes = arr.slice();
        ctrl.renderMarkers();
      }
    }
  }

  StickyNotes.VERSION = '1.2.0';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
