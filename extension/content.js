// Spotify Dynamic Island Content Script for open.spotify.com
(() => {
  let ws = null;
  let isConnected = false;
  let reconnectInterval = 3000;
  let lastSentState = '';

  function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg/')) return 'Microsoft Edge';
    if (userAgent.includes('Brave')) return 'Brave';
    if (userAgent.includes('Chrome')) return 'Google Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    return 'Web Browser';
  }

  function scrapeSpotifyState() {
    try {
      // Title
      const titleElem = document.querySelector('[data-testid="context-item-info-title"] a, [data-testid="context-item-info-title"] span, [data-testid="now-playing-widget"] [data-testid="context-item-info-title"]');
      const title = titleElem ? titleElem.textContent.trim() : '';

      if (!title) {
        // Fallback: document.title usually is "Song • Artist"
        const docTitle = document.title;
        if (docTitle && docTitle.includes('•') && !docTitle.startsWith('Spotify')) {
          const parts = docTitle.split('•');
          return {
            title: parts[0]?.trim() || '',
            artist: parts[1]?.trim() || '',
            isPlaying: true
          };
        }
        return null;
      }

      // Artist(s)
      const artistElems = document.querySelectorAll('[data-testid="context-item-info-artist"] a, [data-testid="context-item-info-subartists"] a');
      let artist = '';
      if (artistElems && artistElems.length > 0) {
        artist = Array.from(artistElems).map(el => el.textContent.trim()).filter(Boolean).join(', ');
      } else {
        const singleArtist = document.querySelector('[data-testid="context-item-info-artist"], [data-testid="context-item-info-subartists"]');
        artist = singleArtist ? singleArtist.textContent.trim() : '';
      }

      // Cover Art
      const imgElem = document.querySelector('[data-testid="cover-art-image"], [data-testid="now-playing-widget"] img');
      const artworkUrl = imgElem ? (imgElem.currentSrc || imgElem.src || '') : '';

      // Play / Pause status
      const playPauseBtn = document.querySelector('button[data-testid="control-button-playpause"]');
      const ariaLabel = playPauseBtn ? playPauseBtn.getAttribute('aria-label') : '';
      // In Spotify, aria-label is "Pause" when currently playing, "Play" when paused
      const isPlaying = ariaLabel ? ariaLabel.toLowerCase().includes('pause') : false;

      // Position and Duration
      const posElem = document.querySelector('[data-testid="playback-position"]');
      const durElem = document.querySelector('[data-testid="playback-duration"]');
      const position = posElem ? parseTime(posElem.textContent) : 0;
      const duration = durElem ? parseTime(durElem.textContent) : 0;

      // Shuffle
      const shuffleBtn = document.querySelector('button[data-testid="control-button-shuffle"]');
      const shuffle = shuffleBtn ? shuffleBtn.getAttribute('aria-checked') === 'true' : false;

      // Repeat
      const repeatBtn = document.querySelector('button[data-testid="control-button-repeat"]');
      const repeat = repeatBtn ? (repeatBtn.getAttribute('aria-checked') === 'true' ? 'context' : 'off') : 'off';

      return {
        id: `${title}-${artist}`,
        title,
        artist,
        album: '',
        artworkUrl,
        isPlaying,
        position,
        duration,
        browser: `${getBrowserName()} • Spotify Web`,
        shuffle,
        repeat
      };
    } catch (e) {
      return null;
    }
  }

  function sendCurrentState() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const data = scrapeSpotifyState();
    if (!data || !data.title) return;

    const serialized = JSON.stringify(data);
    if (serialized === lastSentState) return;

    lastSentState = serialized;
    ws.send(JSON.stringify({
      type: 'spotify-state',
      data
    }));
  }

  function handleCommand(cmd) {
    if (!cmd) return;

    if (typeof cmd === 'string') {
      if (cmd === 'toggle' || cmd === 'play' || cmd === 'pause') {
        const btn = document.querySelector('button[data-testid="control-button-playpause"]');
        if (btn) btn.click();
      } else if (cmd === 'next') {
        const btn = document.querySelector('button[data-testid="control-button-skip-forward"]');
        if (btn) btn.click();
      } else if (cmd === 'previous' || cmd === 'prev') {
        const btn = document.querySelector('button[data-testid="control-button-skip-back"]');
        if (btn) btn.click();
      } else if (cmd === 'toggleShuffle') {
        const btn = document.querySelector('button[data-testid="control-button-shuffle"]');
        if (btn) btn.click();
      } else if (cmd === 'toggleRepeat') {
        const btn = document.querySelector('button[data-testid="control-button-repeat"]');
        if (btn) btn.click();
      }
    } else if (cmd.type === 'seek') {
      const progressBar = document.querySelector('[data-testid="playback-progressbar"]');
      if (progressBar && cmd.position >= 0) {
        const rect = progressBar.getBoundingClientRect();
        const state = scrapeSpotifyState();
        if (state && state.duration > 0) {
          const ratio = Math.min(1, Math.max(0, cmd.position / state.duration));
          const clientX = rect.left + (rect.width * ratio);
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: rect.top + rect.height / 2
          });
          progressBar.dispatchEvent(evt);
        }
      }
    }

    setTimeout(sendCurrentState, 150);
  }

  function connect() {
    try {
      ws = new WebSocket('ws://localhost:9876');

      ws.onopen = () => {
        console.log('[Spotify Dynamic Island] Connected to desktop app');
        isConnected = true;
        sendCurrentState();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'command') {
            handleCommand(msg.command);
          }
        } catch {}
      };

      ws.onclose = () => {
        isConnected = false;
        setTimeout(connect, reconnectInterval);
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {
      setTimeout(connect, reconnectInterval);
    }
  }

  // Monitor DOM for dynamic track updates
  const observer = new MutationObserver(() => {
    sendCurrentState();
  });

  const nowPlayingBar = document.querySelector('[data-testid="now-playing-bar"]') || document.body;
  observer.observe(nowPlayingBar, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });

  // Also periodic check every 800ms
  setInterval(sendCurrentState, 800);

  // Initialize
  connect();
})();
