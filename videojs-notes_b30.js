/*! @name videojs-sticky-notes @version 2.0.0 @license MIT */
/* Renderless sticky-notes plugin for Video.js:
   - Draws markers on the progress bar
   - Emits events for your app to render tooltips/modals externally
   - No framework assumptions (Preact/React/Vue/etc. render the UI outside)
*/
(function (global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    var vjs = require('video.js');
    module.exports = factory(vjs && vjs.default ? vjs.default : vjs);
  } else if (typeof define === 'function' && define.amd) {
    define(['video.js'], function (vjs) {
      return factory(vjs && vjs.default ? vjs.default : vjs);
    });
  } else {
    global.videojsStickyNotes = factory(global.videojs);
  }
}(this, function (videojs) {
  'use strict';

  if (!videojs) throw new Error('video.js is required');

  const Component = videojs.getComponent('Component');
  const Plugin    = videojs.getPlugin('plugin');

  /**
   * Utility: clamp number to [min, max]
   */
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  /**
   * NoteMarkersProgressBarControl
   * - Manages note markers positioned along the progress bar.
   * - Emits events for hover/leave/click with anchor coordinates relative to the player element.
   */
  class NoteMarkersProgressBarControl extends Component {
    constructor(player, options) {
      super(player, options);
      this.player_   = player;
      this.options_  = options || {};
      this.notes     = Array.isArray(this.options_.notes) ? this.options_.notes.slice() : [];
      this.markerMap = new Map(); // id -> marker element

      // Render after metadata is ready so duration is known
      player.ready(() => this.renderMarkers());
      player.on('loadedmetadata', () => this.renderMarkers());

      // If the control bar gets rebuilt, re-render
      player.on('componentresize', () => this.refresh());
      player.on('resize', () => this.refresh());
    }

    /**
     * Return the progress holder element inside the player.
     */
    getProgressHolder() {
      // Works for v7/v8 skins
      return this.player_.el().querySelector('.vjs-progress-holder');
    }

    /**
     * Compute anchor (x,y,width,height) relative to the player root for a given element.
     */
    getAnchorForEl(el) {
      if (!el) return null;
      const playerRect = this.player_.el().getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        x: (r.left - playerRect.left) + (r.width / 2),
        y: (r.top  - playerRect.top),
        width: r.width,
        height: r.height
      };
    }

    /**
     * Public: get anchor for a note id (used by external overlays to reposition on resize).
     */
    getAnchorById(id) {
      const el = this.markerMap.get(id);
      return this.getAnchorForEl(el);
    }

    /**
     * Remove all markers and mapping.
     */
    cleanup() {
      const bar = this.getProgressHolder();
      if (bar) {
        bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());
      }
      this.markerMap.clear();
    }

    /**
     * Re-render without changing the notes array.
     */
    refresh() {
      this.renderMarkers();
    }

    /**
     * Component dispose hook
     */
    dispose() {
      this.cleanup();
      super.dispose();
    }

    /**
     * Data API used by the plugin facade
     */
    addNote(n) {
      if (!n || typeof n.id === 'undefined') return;
      this.notes.push(n);
      this.renderMarkers();
    }

    updateNote(id, patch) {
      const i = this.notes.findIndex(x => x.id === id);
      if (i !== -1) {
        this.notes[i] = Object.assign({}, this.notes[i], patch || {});
        this.renderMarkers();
      }
    }

    removeNote(id) {
      const lenBefore = this.notes.length;
      this.notes = this.notes.filter(x => x.id !== id);
      if (this.notes.length !== lenBefore) this.renderMarkers();
    }

    /**
     * Replace all notes at once.
     */
    setNotes(arr) {
      if (!Array.isArray(arr)) return;
      this.notes = arr.slice();
      this.renderMarkers();
    }

    /**
     * Create markers for all notes based on current duration.
     */
    renderMarkers() {
      this.cleanup();

      const duration = Number(this.player_.duration());
      if (!isFinite(duration) || duration <= 0) {
        // No duration -> cannot place markers yet
        return;
      }

      const bar = this.getProgressHolder();
      if (!bar) return;

      const markerClass = (this.options_.markerClassName || '').trim();

      this.notes.forEach(note => {
        const time = Number(note.time);
        if (!isFinite(time)) return;
        if (time < 0 || time > duration) return;

        const mk = document.createElement('div');
        mk.className = `vjs-note-marker${markerClass ? (' ' + markerClass) : ''}`;
        mk.setAttribute('data-vjs-sticky-note-id', String(note.id));
        mk.setAttribute('role', 'button');
        mk.setAttribute('tabindex', '0');
        mk.setAttribute('aria-label', 'Sticky note marker');

        // Position marker along the bar
        const pct = clamp((time / duration) * 100, 0, 100);
        mk.style.left = pct + '%';

        // Events: hover, leave, click
        const fire = (type, extra = {}) => {
          this.player_.trigger(type, {
            id: note.id,
            note,
            time,
            anchor: this.getAnchorForEl(mk),
            markerEl: mk,
            playerEl: this.player_.el(),
            ...extra
          });
        };

        mk.addEventListener('mouseenter', () => fire('stickyNotes:hover', { open: true }));
        mk.addEventListener('mouseleave', () => fire('stickyNotes:leave'));
        mk.addEventListener('focus',      () => fire('stickyNotes:hover', { open: true }));
        mk.addEventListener('blur',       () => fire('stickyNotes:leave'));
        mk.addEventListener('keydown', (e) => {
          // Enter/Space open modal (same as click)
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            fire('stickyNotes:click');
          }
        });
        mk.addEventListener('click', (e) => {
          // Prevent bar seek on marker click
          e.preventDefault();
          e.stopPropagation();
          fire('stickyNotes:click');
        });

        bar.appendChild(mk);
        this.markerMap.set(note.id, mk);
      });

      this.player_.trigger('stickyNotes:markersChanged', { count: this.notes.length });
    }
  }

  videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

  /**
   * Plugin facade (renderless)
   * - Exposes an API for managing notes and querying anchors.
   * - Emits events that your app should listen to in order to render tooltips/modals.
   */
  class StickyNotes extends Plugin {
    constructor(player, options) {
      super(player, options || {});
      this.options_ = options || {};

      // Create control after metadata so duration is known
      player.one('loadedmetadata', () => {
        player.noteMarkersProgressBarControl =
          new NoteMarkersProgressBarControl(player, this.options_);
      });

      // Clean up on player dispose
      player.one('dispose', () => { this.dispose(); });
    }

    dispose() {
      if (this.player && this.player.noteMarkersProgressBarControl) {
        this.player.noteMarkersProgressBarControl.dispose();
        this.player.noteMarkersProgressBarControl = null;
      }
      super.dispose();
    }

    /**
     * Public API
     */
    addNote(n) {
      this.player.noteMarkersProgressBarControl?.addNote(n);
    }
    updateNote(id, patch) {
      this.player.noteMarkersProgressBarControl?.updateNote(id, patch);
    }
    removeNote(id) {
      this.player.noteMarkersProgressBarControl?.removeNote(id);
    }
    notes(arr) {
      this.player.noteMarkersProgressBarControl?.setNotes(arr);
    }
    refresh() {
      this.player.noteMarkersProgressBarControl?.refresh();
    }
    getAnchorById(id) {
      return this.player.noteMarkersProgressBarControl?.getAnchorById(id) || null;
    }
  }

  StickyNotes.VERSION = '2.0.0';
  videojs.registerPlugin('stickyNotes', StickyNotes);

  return StickyNotes;
}));
