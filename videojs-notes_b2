/*! @name videojs-sticky-notes @version 1.0.1 @license MIT */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory(require('video.js'))
    : typeof define === 'function' && define.amd
      ? define(['video.js'], factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         factory(global.videojs));
}(this, function (videojs) {
  'use strict';

  /* ====== קבועים ====== */
  const VERSION = '1.0.1';
  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

  /* ====== Tooltip root יחיד ====== */
  const tipRoot = document.createElement('div');
  tipRoot.id = 'vjs-sticky-tip-root';
  tipRoot.style.cssText = 'position:fixed;z-index:10000;display:none;';
  document.body.appendChild(tipRoot);

  function closeTip() {
    tipRoot.style.display = 'none';
    tipRoot.innerHTML = '';
    document.removeEventListener('click', outsideClose);
  }
  function outsideClose(e) {
    if (!tipRoot.contains(e.target)) closeTip();
  }

  /* =======================================================
     Component: NoteMarkersProgressBarControl
  ======================================================= */
  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes   = options.notes || [];
      player.ready(() => this.renderMarkers());
    }

    /* ------------- API ציבוריים ------------- */
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

    /* ------------- ציור הפסים על ה‑progress bar ------------- */
    renderMarkers() {
      const duration = this.player_.duration();
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (!bar) return;

      /* ניקוי קודם */
      bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';
        mk.dataset.id = note.id;

        /* Tooltip קצר */
        mk.addEventListener('mouseenter', () => this.openTooltip(note, mk, false));
        mk.addEventListener('mouseleave', () => {
          if (!tipRoot.dataset.sticky) closeTip();
        });

        /* קליק -> עורך מלא */
        mk.addEventListener('click', e => {
          e.stopPropagation();
          this.openTooltip(note, mk, true);
        });

        bar.appendChild(mk);
      });
    }

    /* ------------- Tooltip / Editor ------------- */
    openTooltip(note, markerEl, sticky) {
      const r = markerEl.getBoundingClientRect();
      tipRoot.style.top  = (r.top - 12) + 'px';
      tipRoot.style.left = r.left + 'px';
      tipRoot.style.display = 'block';
      tipRoot.dataset.sticky = sticky ? '1' : '';

      if (!sticky) {
        tipRoot.innerHTML = `<div class="note-tip-read">${note.text || ''}</div>`;
        document.addEventListener('click', outsideClose);
        return;
      }

      /* עורך */
      tipRoot.innerHTML = `
        <div class="note-tip-edit">
          <textarea class="note-ta">${note.text || ''}</textarea>
          <div class="note-act">
            <button class="note-save">Save</button>
            <button class="note-cancel">Cancel</button>
          </div>
        </div>
      `;
      tipRoot.querySelector('.note-cancel').onclick = closeTip;
      tipRoot.querySelector('.note-save').onclick   = () => {
        note.text = tipRoot.querySelector('.note-ta').value;
        this.renderMarkers();
        closeTip();
        this.player_.trigger('notechanged', note);      // אירוע חיצוני
      };
    }
  }
  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  /* =======================================================
     Plugin Wrapper
  ======================================================= */
class StickyNotes extends Plugin {
  constructor(player, options) {
    super(player, options);
    const opts = options || {};

    player.one('loadedmetadata', () => {
      player.noteMarkersProgressBarControl =
        new NoteMarkersProgressBarControl(player, opts);
    });
  }

  /* ------------- API ------------- */
  addNote(n)          { this.player.noteMarkersProgressBarControl.addNote(n); }
  updateNote(id, d)   { this.player.noteMarkersProgressBarControl.updateNote(id, d); }
  removeNote(id)      { this.player.noteMarkersProgressBarControl.removeNote(id); }
  notes(arr) {                      // ⬅️ כאן הייתה השגיאה
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
