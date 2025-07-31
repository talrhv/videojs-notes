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
      // מעקב אחר tooltips ו-timeouts לניקוי
      this.activeTooltips = new Set();
      this.activeTimeouts = new Set();
      player.ready(() => this.renderMarkers());
    }

    // ניקוי כל ה-tooltips וה-timeouts
    cleanup() {
      // נקה את כל ה-tooltips
      this.activeTooltips.forEach(tooltip => {
        if (tooltip.parentNode) {
          render(null, tooltip);
          tooltip.remove();
        }
      });
      this.activeTooltips.clear();
      
      // נקה את כל ה-timeouts
      this.activeTimeouts.forEach(timeout => {
        clearTimeout(timeout);
      });
      this.activeTimeouts.clear();
      
      // נקה markers
      const bar = this.player_.el().querySelector('.vjs-progress-holder');
      if (bar) {
        bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());
      }
    }

    // הוספת dispose method לניקוי כשהרכיב נהרס
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
      if (note) Object.assign(note,d);
      this.renderMarkers();
    }
    
    removeNote(id) { 
      this.notes = this.notes.filter(x=>x.id!==id); 
      this.renderMarkers(); 
    }

    renderMarkers() {
      // נקה קודם הכל
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
        
        // הוסף לרשימת הניקוי
        this.activeTooltips.add(tooltip);
        this.player_.el().appendChild(tooltip);

        let hideTimeout = null;
        let isHoveringTooltip = false;

        // פונקציות עזר לניהול טוב יותר של האירועים
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
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }
        };

        const hideTooltip = (delay = 2000) => {
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
          }
          
          hideTimeout = setTimeout(() => {
            if (!isHoveringTooltip) {
              tooltip.style.display = 'none';
              tooltip.style.pointerEvents = 'none';
              render(null, tooltip);
            }
            this.activeTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }, delay);
          
          this.activeTimeouts.add(hideTimeout);
        };

        const handleMarkerMouseEnter = () => {
          showTooltip();
        };

        const handleMarkerMouseLeave = () => {
          hideTooltip();
        };

        const handleTooltipMouseEnter = () => {
          isHoveringTooltip = true;
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            this.activeTimeouts.delete(hideTimeout);
            hideTimeout = null;
          }
        };

        const handleTooltipMouseLeave = () => {
          isHoveringTooltip = false;
          hideTooltip();
        };

        const handleMarkerClick = (e) => {
          e.stopPropagation();
          showNoteModal(note, this.player_);
        };

        // הוספת האירועים
        mk.addEventListener('mouseenter', handleMarkerMouseEnter);
        mk.addEventListener('mouseleave', handleMarkerMouseLeave);
        mk.addEventListener('click', handleMarkerClick);
        tooltip.addEventListener('mouseenter', handleTooltipMouseEnter);
        tooltip.addEventListener('mouseleave', handleTooltipMouseLeave);

        // שמירת reference לפונקציות לניקוי עתידי (אם נצטרך)
        mk._stickyNotesHandlers = {
          mouseenter: handleMarkerMouseEnter,
          mouseleave: handleMarkerMouseLeave,
          click: handleMarkerClick
        };
        
        tooltip._stickyNotesHandlers = {
          mouseenter: handleTooltipMouseEnter,
          mouseleave: handleTooltipMouseLeave
        };

        bar.appendChild(mk);
      });
    }
  }

  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  let currentModal = null;

  function closeNoteModal() {
    if (currentModal) {
      // ודא שה-render מנוקה
      try {
        render(null, currentModal.container);
      } catch (e) {
        console.warn('Error cleaning modal render:', e);
      }
      
      // הסר מה-DOM
      if (currentModal.backdrop && currentModal.backdrop.parentNode) {
        currentModal.backdrop.remove();
      }
      if (currentModal.container && currentModal.container.parentNode) {
        currentModal.container.remove();
      }
      
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

    // הוסף event listener לסגירה על לחיצה על הרקע
    backdrop.addEventListener('click', closeNoteModal);
    
    player.el().appendChild(backdrop);
    player.el().appendChild(container);

    try {
      if (note.component) {
        if (typeof note.component === 'object' && note.component !== null && note.component.type) {
          render(note.component, container);
        } else {
          render(h(note.component, { note, close: closeNoteModal }), container);
        }
      }
    } catch (e) {
      console.error('Error rendering modal component:', e);
      closeNoteModal();
      return;
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
      
      // ניקוי כשהנגן נהרס
      player.one('dispose', () => {
        this.dispose();
      });
    }

    dispose() {
      closeNoteModal();
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

  StickyNotes.VERSION = '1.0.7';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
