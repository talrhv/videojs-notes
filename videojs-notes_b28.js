/*! @name videojs-sticky-notes @version 1.0.8 @license MIT */
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

  const h = preact && preact.h;
  const preactRender = preact && preact.render;
  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

  // === NEW: generic renderer that returns a disposer ===
  function renderInto(container, view, fallbackHtml) {
    // DOM Node (HTMLElement/DocumentFragment)
    if (view && (view.nodeType === 1 || view.nodeType === 11)) {
      container.appendChild(view);
      return () => {
        if (view.parentNode === container) container.removeChild(view);
      };
    }
    // View adapter: { mount(container), unmount() }
    if (view && typeof view.mount === 'function') {
      view.mount(container);
      return () => {
        try { view.unmount && view.unmount(); } catch(e) { /* noop */ }
        // לא מוחקים כאן את container עצמו
      };
    }
    // Backward-compat: Preact vnode / function-component
    const isVNode =
      preact && view &&
      typeof view === 'object' &&
      (('type' in view) || ('props' in view));

    if (preactRender && (isVNode || typeof view === 'function')) {
      const vnode = isVNode ? view : h(view, {});
      preactRender(vnode, container);
      return () => {
        try { preactRender(null, container); } catch (e) {}
      };
    }

    // String or nothing -> fallback to HTML/text
    container.innerHTML = (fallbackHtml || '');
    return () => { container.innerHTML = ''; };
  }

  // מנהל גלובלי לכל ה-tooltips הפעילים
  let globalActiveTooltips = new Set();
  let globalActiveTimeouts = new Set();

  // פונקציה גלובלית לסגירת כל ה-tooltips
  function hideAllTooltips() {
    globalActiveTooltips.forEach(({ el, dispose }) => {
      if (!el) return;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      try { dispose && dispose(); } catch(e){}
    });
    globalActiveTimeouts.forEach(timeout => clearTimeout(timeout));
    globalActiveTimeouts.clear();
  }

  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_ = player;
      this.notes   = options.notes || [];
      // מעקב אחר tooltips / timeouts / disposers
      this.activeTooltips = new Set();     // {el, dispose}
      this.activeTimeouts = new Set();
      player.ready(() => this.renderMarkers());
    }

    cleanup() {
      // ניקוי tooltips + renderers
      this.activeTooltips.forEach(({ el, dispose }) => {
        if (dispose) { try { dispose(); } catch(e){} }
        if (el && el.parentNode) el.remove();
        globalActiveTooltips.forEach(item => {
          if (item.el === el) globalActiveTooltips.delete(item);
        });
      });
      this.activeTooltips.clear();

      this.activeTimeouts.forEach(timeout => {
        globalActiveTimeouts.delete(timeout);
        clearTimeout(timeout);
      });
      this.activeTimeouts.clear();

      // נקה markers
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
      const note = this.notes.find(x=>x.id===id);
      if (note) Object.assign(note, d);
      this.renderMarkers();
    }
    removeNote(id) {
      this.notes = this.notes.filter(x=>x.id!==id);
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

        // לכל tooltip יש disposer משלו
        let disposeTooltipContent = null;

        // רישום לניקוי
        const record = { el: tooltip, dispose: () => {
          if (disposeTooltipContent) { try { disposeTooltipContent(); } catch(e){} }
        }};
        this.activeTooltips.add(record);
        globalActiveTooltips.add(record);

        this.player_.el().appendChild(tooltip);

        let hideTimeout = null;
        let isHoveringTooltip = false;

        const showTooltip = () => {
          hideAllTooltips();

          const rect = mk.getBoundingClientRect();
          const parentRect = this.player_.el().getBoundingClientRect();
          const topOffset = rect.top - parentRect.top;
          const leftOffset = rect.left - parentRect.left;

          tooltip.style.display = 'block';
          tooltip.style.top = `${topOffset - 12}px`;
          tooltip.style.left = `${leftOffset + rect.width / 2}px`;
          tooltip.style.transform = 'translate(-50%, -100%)';
          tooltip.style.pointerEvents = 'auto';

          // רינדור התוכן (framework-agnostic)
          if (disposeTooltipContent) { try { disposeTooltipContent(); } catch(e){} }
          disposeTooltipContent = renderInto(
            tooltip,
            note.view || note.component,   // component (legacy) או view (חדש)
            `<div class="note-tip-read">${note.text || ''}</div>`
          );

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
            globalActiveTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }
        };

        const hideTooltip = (delay = 2000) => {
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
            globalActiveTimeouts.delete(hideTimeout);
          }
          hideTimeout = setTimeout(() => {
            if (!isHoveringTooltip) {
              tooltip.style.display = 'none';
              tooltip.style.pointerEvents = 'none';
              if (disposeTooltipContent) { try { disposeTooltipContent(); } catch(e){} }
              disposeTooltipContent = null;
            }
            this.activeTimeouts.delete(hideTimeout);
            globalActiveTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }, delay);
          this.activeTimeouts.add(hideTimeout);
          globalActiveTimeouts.add(hideTimeout);
        };

        const handleMarkerMouseEnter = () => { showTooltip(); };
        const handleMarkerMouseLeave = () => { hideTooltip(); };
        const handleTooltipMouseEnter = () => {
          isHoveringTooltip = true;
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
            globalActiveTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }
        };
        const handleTooltipMouseLeave = () => { isHoveringTooltip = false; hideTooltip(); };

        const handleMarkerClick = (e) => {
          e.stopPropagation();
          showNoteModal(note, this.player_);
        };

        mk.addEventListener('mouseenter', handleMarkerMouseEnter);
        mk.addEventListener('mouseleave', handleMarkerMouseLeave);
        mk.addEventListener('click', handleMarkerClick);
        tooltip.addEventListener('mouseenter', handleTooltipMouseEnter);
        tooltip.addEventListener('mouseleave', handleTooltipMouseLeave);

        mk._stickyNotesHandlers = { mouseenter: handleMarkerMouseEnter, mouseleave: handleMarkerMouseLeave, click: handleMarkerClick };
        tooltip._stickyNotesHandlers = { mouseenter: handleTooltipMouseEnter, mouseleave: handleTooltipMouseLeave };

        bar.appendChild(mk);
      });
    }
  }
  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  let currentModal = null;

  function closeNoteModal() {
    if (currentModal) {
      try { currentModal.dispose && currentModal.dispose(); } catch(e){}
      if (currentModal.backdrop && currentModal.backdrop.parentNode) currentModal.backdrop.remove();
      if (currentModal.container && currentModal.container.parentNode) currentModal.container.remove();
      currentModal = null;
    }
  }

  function showNoteModal(note, player) {
    closeNoteModal();
    hideAllTooltips();

    if (!player.paused()) player.pause();

    const backdrop = document.createElement('div');
    backdrop.className = 'vjs-note-modal-backdrop';

    const container = document.createElement('div');
    container.className = 'vjs-note-modal';

    backdrop.addEventListener('click', closeNoteModal);
    player.el().appendChild(backdrop);
    player.el().appendChild(container);

    // רינדור תוכן המודל (framework-agnostic)
    let disposeModalContent = null;
    try {
      disposeModalContent = renderInto(
        container,
        // עדיפות לשדה החדש "view"; נשמר "component" לתאימות לאחור
        (note.modalView || note.view || note.component && note.component),
        '' // אין fallback HTML כשיש modalView אמיתי
      );
    } catch (e) {
      console.error('Error rendering modal content:', e);
      closeNoteModal();
      return;
    }

    currentModal = {
      backdrop,
      container,
      dispose: () => { try { disposeModalContent && disposeModalContent(); } catch(e){} }
    };
  }

  class StickyNotes extends Plugin {
    constructor(player, options) {
      super(player, options);
      const opts = options || {};

      player.one('loadedmetadata', () => {
        player.noteMarkersProgressBarControl =
          new NoteMarkersProgressBarControl(player, opts);
      });

      player.one('dispose', () => { this.dispose(); });
    }

    dispose() {
      closeNoteModal();
      hideAllTooltips();
      if (this.player && this.player.noteMarkersProgressBarControl) {
        this.player.noteMarkersProgressBarControl.dispose();
      }
      super.dispose();
    }

    addNote(n) {
      if (this.player.noteMarkersProgressBarControl) {
        this.player.noteMarkersProgressBarControl.addNote(n);
      }
    }
    updateNote(i, d) {
      if (this.player.noteMarkersProgressBarControl) {
        this.player.noteMarkersProgressBarControl.updateNote(i, d);
      }
    }
    removeNote(i) {
      if (this.player.noteMarkersProgressBarControl) {
        this.player.noteMarkersProgressBarControl.removeNote(i);
      }
    }

    closeNoteModal() { closeNoteModal(); }
    hideAllTooltips() { hideAllTooltips(); }

    notes(arr) {
      if (!Array.isArray(arr)) return;
      const ctrl = this.player.noteMarkersProgressBarControl;
      if (ctrl) {
        ctrl.notes = arr.slice();
        ctrl.renderMarkers();
      }
    }
  }

  StickyNotes.VERSION = '1.0.8';
  videojs.registerPlugin('stickyNotes', StickyNotes);
  return StickyNotes;
}));
