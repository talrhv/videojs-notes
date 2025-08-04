/*! @name videojs-sticky-notes @version 1.1.0 @license MIT */
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
      this.activeTooltips = new Set();
      this.activeTimeouts = new Set();
      player.ready(() => this.renderMarkers());
    }

    cleanup() {
      this.activeTooltips.forEach(t => t.remove());
      this.activeTooltips.clear();
      this.activeTimeouts.forEach(t => clearTimeout(t));
      this.activeTimeouts.clear();
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

        const tooltip = document.createElement('div');
        tooltip.className = 'note-tooltip-readonly';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.zIndex = '1000';
        tooltip.style.pointerEvents = 'none';

        if (note.tooltipElement instanceof HTMLElement) {
          tooltip.appendChild(note.tooltipElement);
        } else if (note.text) {
          tooltip.innerHTML = `<div class="note-tip-read">${note.text}</div>`;
        }

        this.activeTooltips.add(tooltip);
        this.player_.el().appendChild(tooltip);

        let hideTimeout = null;
        let isHoveringTooltip = false;

        const showTooltip = () => {
          const rect = mk.getBoundingClientRect();
          const parentRect = this.player_.el().getBoundingClientRect();
          const topOffset = rect.top - parentRect.top;
          const leftOffset = rect.left - parentRect.left;

          tooltip.style.display = 'block';
          tooltip.style.top = `${topOffset - 12}px`;
          tooltip.style.left = `${leftOffset + rect.width / 2}px`;
          tooltip.style.transform = 'translate(-50%, -100%)';
          tooltip.style.pointerEvents = 'auto';

          requestAnimationFrame(() => {
            const tipRect = tooltip.getBoundingClientRect();
            const buffer = 24;
            let adjustedLeft = leftOffset + rect.width / 2;
            if (tipRect.left < buffer) adjustedLeft += buffer - tipRect.left;
            else if (tipRect.right > window.innerWidth - buffer)
              adjustedLeft -= tipRect.right - (window.innerWidth - buffer);
            tooltip.style.left = `${adjustedLeft}px`;
          });

          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }
        };

        const hideTooltip = (delay = 2000) => {
          if (hideTimeout) clearTimeout(hideTimeout);
          hideTimeout = setTimeout(() => {
            if (!isHoveringTooltip) {
              tooltip.style.display = 'none';
              tooltip.style.pointerEvents = 'none';
              tooltip.innerHTML = '';
            }
            this.activeTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }, delay);
          this.activeTimeouts.add(hideTimeout);
        };

        mk.addEventListener('mouseenter', showTooltip);
        mk.addEventListener('mouseleave', hideTooltip);
        tooltip.addEventListener('mouseenter', () => isHoveringTooltip = true);
        tooltip.addEventListener('mouseleave', () => {
          isHoveringTooltip = false;
          hideTooltip();
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
      if (currentModal.backdrop?.parentNode) currentModal.backdrop.remove();
      if (currentModal.container?.parentNode) currentModal.container.remove();
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

    backdrop.addEventListener('click', closeNoteModal);
    player.el().appendChild(backdrop);
    player.el().appendChild(container);

    if (note.modalElement instanceof HTMLElement) {
      container.appendChild(note.modalElement);
    } else if (note.text) {
      container.innerHTML = `<div class="note-modal-read">${note.text}</div>`;
    }

    currentModal = { backdrop, container };
  }

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
      closeNoteModal();
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

    closeNoteModal() {
      closeNoteModal();
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

  StickyNotes.VERSION = '1.1.0';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
