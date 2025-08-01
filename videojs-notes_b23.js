/*! @name videojs-sticky-notes @version 1.0.7 @license MIT */
(function (global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    var videojsLib = require('video.js');
    var preactLib;
    try { preactLib = require('preact'); } catch (e) { preactLib = global.preact; }
    module.exports = factory(videojsLib, preactLib);
  } else if (typeof define === 'function' && define.amd) {
    define(['video.js','preact'], function(videojsLib, preactLib){
      return factory(videojsLib, preactLib || global.preact);
    });
  } else {
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

      this.notes.forEach(note => {
        if (note.time < 0 || note.time > duration) return;

        const mk = document.createElement('div');
        mk.className = 'vjs-note-marker';
        mk.style.left = (note.time / duration * 100) + '%';

        const tooltip = document.createElement('div');
        tooltip.className = 'note-tooltip-readonly';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.zIndex = '1000';
        tooltip.style.pointerEvents = 'none';
        this.player_.el().appendChild(tooltip);

 let hideTimeout = null;
let isHoveringTooltip = false;

mk.addEventListener('mouseenter', () => {
  const rect = mk.getBoundingClientRect();
  const parentRect = this.player_.el().getBoundingClientRect();
  const topOffset = rect.top - parentRect.top;
  const leftOffset = rect.left - parentRect.left;

  tooltip.style.display = 'block';
  tooltip.style.top = `${topOffset - 12}px`;
  tooltip.style.left = `${leftOffset + rect.width / 2}px`;
  tooltip.style.transform = 'translate(-50%, -100%)';
  tooltip.style.pointerEvents = 'auto';

  const isVNode = typeof note.component === 'object' && note.component !== null && ('type' in note.component || 'props' in note.component);
  if (isVNode) {
    const vnodeWithReadonly = h(note.component.type, { ...note.component.props, readOnly: true });
    render(vnodeWithReadonly, tooltip);
  } else if (typeof note.component === 'function') {
    render(h(note.component, { note, readOnly: true }), tooltip);
  } else {
    tooltip.innerHTML = `<div class="note-tip-read">${note.text || ''}</div>`;
  }

  // תיקון חריגה מהמסך
  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    const buffer = 24;
    let adjustedLeft = leftOffset + rect.width / 2;
    if (tipRect.left < buffer) adjustedLeft += buffer - tipRect.left;
    else if (tipRect.right > window.innerWidth - buffer)
      adjustedLeft -= tipRect.right - (window.innerWidth - buffer);
    tooltip.style.left = `${adjustedLeft}px`;
  });

  // ביטול סגירה אם נכנסים שוב
  clearTimeout(hideTimeout);
});

mk.addEventListener('mouseleave', () => {
  // דיליי של 2 שניות אלא אם העכבר נכנס ל-tooltip
  hideTimeout = setTimeout(() => {
    if (!isHoveringTooltip) {
      tooltip.style.display = 'none';
      tooltip.style.pointerEvents = 'none';
      render(null, tooltip);
    }
  }, 2000);
});

// מעקב האם העכבר בתוך ה-tooltip
tooltip.addEventListener('mouseenter', () => {
  isHoveringTooltip = true;
  clearTimeout(hideTimeout); // עצור סגירה
});

tooltip.addEventListener('mouseleave', () => {
  isHoveringTooltip = false;
  hideTimeout = setTimeout(() => {
    if (!isHoveringTooltip) {
      tooltip.style.display = 'none';
      render(null, tooltip);
    }
  }, 2000);
});

        mk.addEventListener('click', e => {
          e.stopPropagation();
          showNoteModal(note, this.player_);
        });

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

  function showNoteModal(note, player) {
    closeNoteModal();

    if (!player.paused()) player.pause();

    const backdrop = document.createElement('div');
    backdrop.className = 'vjs-note-modal-backdrop';

    const container = document.createElement('div');
    container.className = 'vjs-note-modal';

    player.el().appendChild(backdrop);
    player.el().appendChild(container);

    if (note.component) {
      if (typeof note.component === 'object' && note.component !== null && note.component.type) {
        render(note.component, container);
      } else {
        render(h(note.component, { note, close: closeNoteModal }), container);
      }
    }

    currentModal = { backdrop, container };
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
    updateNote(i, d) { this.player.noteMarkersProgressBarControl.updateNote(i, d); }
    removeNote(i)    { this.player.noteMarkersProgressBarControl.removeNote(i); }
    closeNoteModal() { closeNoteModal(); }
    notes(arr) {
      if (!Array.isArray(arr)) return;
      const ctrl = this.player.noteMarkersProgressBarControl;
      ctrl.notes = arr.slice();
      ctrl.renderMarkers();
    }
  }

  StickyNotes.VERSION = '1.0.7';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
