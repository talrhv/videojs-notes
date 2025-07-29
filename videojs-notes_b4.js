/*! @name videojs-sticky-notes @version 1.0.2 @license MIT */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory(require('video.js'))
    : typeof define === 'function' && define.amd
      ? define(['video.js'], factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         factory(global.videojs));
}(this, function (videojs) {
  'use strict';

  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

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

      // נקה כל הסימנים הקודמים
      bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        // צור את ה-marker
        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';

        // הוספת tooltip קריאה (note-tip-read)
        const tip = document.createElement('span');
        tip.className = 'note-tip-read';
        tip.textContent = note.text || '';
        mk.appendChild(tip);

        // קליק: פותח inline editor עם הקלאסים המתאימים
        mk.addEventListener('click', e => {
          e.stopPropagation();
          mk.innerHTML = ''; // נקה קודם

          const editor = document.createElement('div');
          editor.className = 'note-tip-edit';

          const ta = document.createElement('textarea');
          ta.className = 'note-ta';
          ta.value = note.text || '';

          const actions = document.createElement('div');
          actions.className = 'note-act';

          const saveBtn = document.createElement('button');
          saveBtn.className = 'note-save';
          saveBtn.textContent = 'Save';
          saveBtn.onclick = () => {
            note.text = ta.value;
            this.renderMarkers();
            this.player_.trigger('notechanged', note);
          };

          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'note-cancel';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.onclick = () => {
            this.renderMarkers();
          };

          actions.appendChild(saveBtn);
          actions.appendChild(cancelBtn);
          editor.appendChild(ta);
          editor.appendChild(actions);
          mk.appendChild(editor);
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
    updateNote(id,d)  { this.player.noteMarkersProgressBarControl.updateNote(id,d); }
    removeNote(id)    { this.player.noteMarkersProgressBarControl.removeNote(id); }
    notes(arr) {
      if (Array.isArray(arr)) {
        const ctrl = this.player.noteMarkersProgressBarControl;
        ctrl.notes = arr.slice();
        ctrl.renderMarkers();
      }
    }
  }
  StickyNotes.VERSION = '1.0.2';
  videojs.registerPlugin('stickyNotes', StickyNotes);
}));
