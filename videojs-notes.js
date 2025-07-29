/*! @name videojs-sticky-notes @version 1.0.0 @license MIT */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory(require('video.js'))
    : typeof define === 'function' && define.amd
      ? define(['video.js'], factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         factory(global.videojs));
}(this, function (videojs) {
  'use strict';

  var VERSION = '1.0.0';
  var Component = videojs.getComponent('Component');
  var Plugin    = videojs.getPlugin('plugin');

  /* ---------- Tooltip root (one per page) ---------- */
  var tipRoot = document.createElement('div');
  tipRoot.id = 'vjs-sticky-tip-root';
  tipRoot.style.cssText = 'position:fixed;z-index:10000;display:none;';
  document.body.appendChild(tipRoot);

  function closeTip() {
    tipRoot.style.display = 'none';
    tipRoot.innerHTML     = '';
    document.removeEventListener('click', outsideClose);
  }
  function outsideClose(e) {
    if (!tipRoot.contains(e.target)) closeTip();
  }

  /* ---------- Component: NoteMarkersProgressBar ---------- */
  var NoteMarkers = videojs.extend(Component, {
    constructor: function (player, opts) {
      Component.call(this, player, opts);
      this.player_ = player;
      this.notes   = opts.notes || [];
      player.ready(this.renderMarkers.bind(this));
    },

    /* APIs */
    addNote:    function (n){ this.notes.push(n); this.renderMarkers(); },
    updateNote: function (id, data){
      var n = this.notes.find(function(x){return x.id===id;});
      if(n) Object.assign(n,data), this.renderMarkers();
    },
    removeNote: function (id){
      this.notes = this.notes.filter(function(x){return x.id!==id;});
      this.renderMarkers();
    },

    renderMarkers: function () {
      var player   = this.player_;
      var duration = player.duration();
      var bar      = player.el().querySelector('.vjs-progress-holder');
      if(!bar) return;

      /* clear old */
      Array.prototype.forEach.call(
        bar.querySelectorAll('.vjs-note-marker'),
        function(el){ el.remove(); }
      );

      var self = this;
      this.notes.forEach(function (note) {
        if (note.time < 0 || note.time > duration) return;

        var mk = document.createElement('div');
        mk.className    = 'vjs-note-marker';
        mk.style.left   = (note.time / duration * 100) + '%';
        mk.dataset.note = JSON.stringify(note);

        mk.addEventListener('mouseenter', function(){
          self.openTooltip(note, mk, false);
        });
        mk.addEventListener('mouseleave', function(){
          if(!tipRoot.dataset.sticky) closeTip();
        });
        mk.addEventListener('click', function(e){
          e.stopPropagation();
          self.openTooltip(note, mk, true);
        });

        bar.appendChild(mk);
      });
    },

    /* -------- tooltip / editor ---------- */
    openTooltip: function (note, markerEl, sticky) {
      var r = markerEl.getBoundingClientRect();
      tipRoot.style.top  = (r.top - 12) + 'px';
      tipRoot.style.left = r.left + 'px';
      tipRoot.style.display = 'block';
      tipRoot.dataset.sticky = sticky ? '1' : '';

      if (!sticky) {
        tipRoot.innerHTML =
          '<div class="note-tip-read">'+(note.text||'')+'</div>';
        document.addEventListener('click', outsideClose);
        return;
      }

      /* editor */
      tipRoot.innerHTML = [
        '<div class="note-tip-edit">',
          '<textarea class="note-ta">'+(note.text||'')+'</textarea>',
          '<div class="note-act">',
            '<button class="note-save">Save</button>',
            '<button class="note-cancel">Cancel</button>',
          '</div>',
        '</div>'
      ].join('');

      tipRoot.querySelector('.note-cancel').onclick = closeTip;
      tipRoot.querySelector('.note-save').onclick = (function(){
        var ta = tipRoot.querySelector('.note-ta');
        note.text = ta.value;
        this.renderMarkers();
        closeTip();
        this.player_.trigger('notechanged', note);   /* אינדיקציה חיצונית */
      }).bind(this);
    }
  });
  videojs.registerComponent('NoteMarkers', NoteMarkers);

  /* ---------- Plugin Wrapper ---------- */
  var StickyNotes = videojs.extend(Plugin, {
    constructor: function(player, options){
      Plugin.call(this, player, options);
      var opts = options || {};
      player.one('loadedmetadata', function(){
        player.noteMarkers = new NoteMarkers(player, opts);
      });
    },
    /* API shortcuts */
    addNote:    function(n){ this.player_.noteMarkers.addNote(n); },
    updateNote: function(id,d){ this.player_.noteMarkers.updateNote(id,d); },
    removeNote: function(id){ this.player_.noteMarkers.removeNote(id); }
  });
StickyNotes.prototype.notes = function(arr){
  var inst = this.player_.noteMarkers;
  inst.notes = Array.isArray(arr) ? arr.slice() : [];
  inst.renderMarkers();
};

  StickyNotes.VERSION = VERSION;
  videojs.registerPlugin('stickyNotes', StickyNotes);
}));
