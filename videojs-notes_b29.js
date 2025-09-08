// בתחתית הקובץ ישאר StickyNotes.VERSION ורישום הפלאגין כרגיל.

// === הוספות בראש המחלקה ===
class NoteMarkersProgressBarControl extends Component {
  constructor(player, options) {
    super(player, options);
    this.player_ = player;
    this.notes   = options.notes || [];
    this.markerMap = new Map(); // id -> marker element
    player.ready(() => this.renderMarkers());
  }

  getAnchorForEl(el) {
    const playerRect = this.player_.el().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - playerRect.left) + r.width/2, // יחסית ל-player
      y: (r.top  - playerRect.top),
      width: r.width,
      height: r.height
    };
  }

  getAnchorById(id) {
    const el = this.markerMap.get(id);
    return el ? this.getAnchorForEl(el) : null;
  }

  cleanup() {
    // נקה מרקרים וישויות
    const bar = this.player_.el().querySelector('.vjs-progress-holder');
    if (bar) bar.querySelectorAll('.vjs-note-marker').forEach(el => el.remove());
    this.markerMap.clear();
  }

  dispose() { this.cleanup(); super.dispose(); }

  addNote(n) { this.notes.push(n); this.renderMarkers(); }
  updateNote(id, d) {
    const i = this.notes.findIndex(x=>x.id===id);
    if (i !== -1) this.notes[i] = { ...this.notes[i], ...d };
    this.renderMarkers();
  }
  removeNote(id) { this.notes = this.notes.filter(x=>x.id!==id); this.renderMarkers(); }

  // === העיקר: יצירת מרקרים + שיגור אירועים בלבד ===
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

      // אירועים
      const fire = (type, extra={}) => {
        this.player_.trigger(type, {
          id: note.id,
          note,
          time: note.time,
          anchor: this.getAnchorForEl(mk),
          markerEl: mk,
          playerEl: this.player_.el(),
          ...extra
        });
      };

      mk.addEventListener('mouseenter', () => fire('stickyNotes:hover', { open: true }));
      mk.addEventListener('mouseleave', () => fire('stickyNotes:leave'));
      mk.addEventListener('click', (e) => {
        e.stopPropagation();
        fire('stickyNotes:click');
      });

      bar.appendChild(mk);
      this.markerMap.set(note.id, mk);
    });

    // ידיעה שימושית למעלה (לא חובה)
    this.player_.trigger('stickyNotes:markersChanged');
  }
}

videojs.registerComponent('NoteMarkersProgressBarControl', NoteMarkersProgressBarControl);

class StickyNotes extends Plugin {
  constructor(player, options) {
    super(player, options || {});
    player.one('loadedmetadata', () => {
      player.noteMarkersProgressBarControl = new NoteMarkersProgressBarControl(player, options || {});
    });
    player.one('dispose', () => { this.dispose(); });
  }

  dispose() {
    if (this.player && this.player.noteMarkersProgressBarControl) {
      this.player.noteMarkersProgressBarControl.dispose();
    }
    super.dispose();
  }

  // API קיים
  addNote(n){ this.player.noteMarkersProgressBarControl?.addNote(n); }
  updateNote(i,d){ this.player.noteMarkersProgressBarControl?.updateNote(i,d); }
  removeNote(i){ this.player.noteMarkersProgressBarControl?.removeNote(i); }
  notes(arr){
    const ctrl = this.player.noteMarkersProgressBarControl;
    if (ctrl && Array.isArray(arr)) { ctrl.notes = arr.slice(); ctrl.renderMarkers(); }
  }

  // חדש: קבלת עוגן ע״פ id (לריסייז/סקיילינג)
  getAnchorById(id){
    return this.player.noteMarkersProgressBarControl?.getAnchorById(id) || null;
  }
}
