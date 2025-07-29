(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory(require('video.js'))
    : typeof define === 'function' && define.amd
      ? define(['video.js'], factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         factory(global.videojs));
}(this, function (videojs) {
  'use strict';

  const VERSION = '1.0.2';
  const Component = videojs.getComponent('Component');
  const Plugin = videojs.getPlugin('plugin');

  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes = options.notes || [];
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

      bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';
        mk.dataset.id = note.id;

        // טול־טיפ מובנה
        const tooltip = document.createElement('span');
        tooltip.className = 'note-tooltip';
        tooltip.textContent = note.text || '';
        mk.appendChild(tooltip);

        // קליק פותח עורך (כעת inline)
        mk.addEventListener('click', (e) => {
          e.stopPropagation();
          const ta = document.createElement('textarea');
          ta.value = note.text || '';
          ta.className = 'note-editor';
          const save = document.createElement('button');
          save.textContent = 'Save';
          save.onclick = () => {
            note.text = ta.value;
            this.renderMarkers();
            this.player_.trigger('notechanged', note);
          };

          mk.innerHTML = '';
          mk.appendChild(ta);
          mk.appendChild(save);
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
        player.noteMarkersProgressBarControl =
          new NoteMarkersProgressBarControl(player, opts);
      });
    }

    addNote(n)        { this.player.noteMarkersProgressBarControl.addNote(n); }
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

  StickyNotes.VERSION = VERSION;
  videojs.registerPlugin('stickyNotes', StickyNotes);
}));
