/* Progreasy - reproductor compartido SoundCloud */

let activePlayer = null;
let activeTrackEl = null;
let progressInterval = null;
const players = {};

function stopActive() {
  if (activePlayer) { activePlayer.pause(); activePlayer = null; }
  if (activeTrackEl) {
    activeTrackEl.classList.remove('playing');
    const s = activeTrackEl.querySelector('.track-status');
    const b = activeTrackEl.querySelector('.progress-bar');
    const ip = activeTrackEl.querySelector('.icon-play');
    const ipa = activeTrackEl.querySelector('.icon-pause');
    if (s) s.textContent = '';
    if (b) b.style.width = '0%';
    if (ip) ip.style.display = 'block';
    if (ipa) ipa.style.display = 'none';
    activeTrackEl = null;
  }
  clearInterval(progressInterval);
}

function buildScIframe(url, id) {
  const iframe = document.createElement('iframe');
  iframe.className = 'sc-iframe';
  iframe.id = 'sc-' + id;
  iframe.allow = 'autoplay; encrypted-media';
  iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
    '&auto_play=false&buying=false&sharing=false&show_artwork=false&show_comments=false&show_user=false&show_reposts=false&visual=false';
  document.body.appendChild(iframe);
  return iframe;
}

function seekTo(player, pct) {
  player.getDuration(dur => { player.seekTo(dur * pct); });
}

function playTrack(trackEl, url, id) {
  if (activeTrackEl === trackEl) { stopActive(); return; }
  stopActive();
  activeTrackEl = trackEl;
  trackEl.classList.add('playing');

  const statusEl = trackEl.querySelector('.track-status');
  const barEl = trackEl.querySelector('.progress-bar');
  const wrapEl = trackEl.querySelector('.progress-wrap');
  const iconPlay = trackEl.querySelector('.icon-play');
  const iconPause = trackEl.querySelector('.icon-pause');

  if (iconPlay) iconPlay.style.display = 'none';
  if (iconPause) iconPause.style.display = 'block';
  if (statusEl) statusEl.textContent = 'cargando...';

  if (wrapEl && !wrapEl.dataset.bound) {
    wrapEl.dataset.bound = '1';
    const getSeekPct = (e) => {
      const rect = wrapEl.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    const doSeek = (e) => {
      e.stopPropagation();
      if (!activePlayer || activeTrackEl !== trackEl) return;
      const pct = getSeekPct(e);
      barEl.style.width = (pct * 100).toFixed(1) + '%';
      seekTo(activePlayer, pct);
    };
    wrapEl.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (!activePlayer || activeTrackEl !== trackEl) return;
      wrapEl.classList.add('dragging');
      doSeek(e);
      const onMove = ev => doSeek(ev);
      const onUp = () => {
        wrapEl.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    wrapEl.addEventListener('touchstart', e => {
      e.stopPropagation();
      if (!activePlayer || activeTrackEl !== trackEl) return;
      wrapEl.classList.add('dragging');
      const apply = (t) => {
        const p = getSeekPct(t);
        barEl.style.width = (p * 100).toFixed(1) + '%';
        seekTo(activePlayer, p);
      };
      apply(e.touches[0]);
      const onTouchMove = ev => apply(ev.touches[0]);
      const onTouchEnd = () => {
        wrapEl.classList.remove('dragging');
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
      };
      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('touchend', onTouchEnd);
    }, { passive: true });
  }

  if (players[id]) {
    activePlayer = players[id];
    activePlayer.play();
    return;
  }

  const iframe = buildScIframe(url, id);
  const player = SC.Widget(iframe);
  players[id] = player;
  activePlayer = player;

  player.bind(SC.Widget.Events.READY, () => { player.play(); });
  player.bind(SC.Widget.Events.PLAY, () => {
    if (statusEl) statusEl.textContent = '';
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      player.getPosition(pos => {
        player.getDuration(dur => {
          if (!dur) return;
          barEl.style.width = ((pos / dur) * 100).toFixed(1) + '%';
        });
      });
    }, 300);
  });
  player.bind(SC.Widget.Events.FINISH, () => { stopActive(); });
}

/* Crea un elemento de track.
   trackData: { name, sc?, genre?, locked? }
   id: identificador unico para el player */
function createTrack(trackData, displayNum, id) {
  const hasAudio = !!trackData.sc;
  const locked = !!trackData.locked;
  const div = document.createElement('div');
  div.className = 'track' + (hasAudio ? ' has-audio' : '') + (locked ? ' locked' : '');

  const num = String(displayNum).padStart(2, '0');

  let btnHtml;
  if (hasAudio) {
    btnHtml = `<button class="play-btn" aria-label="Reproducir ${trackData.name}">
        <svg viewBox="0 0 12 12" fill="currentColor">
          <polygon points="3,1 11,6 3,11" class="icon-play"/>
          <g class="icon-pause" style="display:none">
            <rect x="1.5" y="1" width="3" height="10" rx="1"/>
            <rect x="7.5" y="1" width="3" height="10" rx="1"/>
          </g>
        </svg>
      </button>`;
  } else {
    btnHtml = `<div class="lock-btn"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg></div>`;
  }

  div.innerHTML = `
    <div class="track-row">
      <span class="track-num">${num}</span>
      ${btnHtml}
      <span class="track-name">${trackData.name}</span>
      <span class="track-genre">${trackData.genre || 'progressive'}</span>
      ${hasAudio ? `<span class="track-status"></span>` : ''}
    </div>
    ${hasAudio ? `<div class="progress-row"><div class="progress-wrap"><div class="progress-track"><div class="progress-bar"><div class="progress-thumb"></div></div></div></div></div>` : ''}
  `;

  if (hasAudio) {
    const btn = div.querySelector('.play-btn');
    const toggle = () => playTrack(div, trackData.sc, id);
    btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    div.addEventListener('click', e => {
      if (e.target.closest('.progress-wrap')) return;
      toggle();
    });
  }

  return div;
}
