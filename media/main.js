// FocusTube webview script
// Runs inside the VS Code sidebar webview (isolated browser context).
(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ─── State ────────────────────────────────────────────────────────────────
  let player = null; // YT.Player instance
  let currentVideoId = null;
  let currentUrl = null;
  let isMiniMode = false;
  let clips = [];
  let ytReady = false; // YouTube IFrame API loaded
  let pendingLoad = null; // { videoId, startTime } queued before API ready

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const urlInput = $("url-input");
  const loadBtn = $("load-btn");
  const urlError = $("url-error");
  const playerSec = $("player-section");
  const playerWrap = $("player-wrap");
  const videoLabel = $("video-label");
  const miniBtn = $("mini-btn");
  const closeBtn = $("close-btn");
  const noteInput = $("note-input");
  const saveTsBtn = $("save-ts-btn");
  const clipsList = $("clips-list");
  const clearAllBtn = $("clear-all-btn");

  // ─── YouTube IFrame API callback (global, called by YouTube's script) ──────
  window.onYouTubeIframeAPIReady = function () {
    ytReady = true;
    if (pendingLoad) {
      createOrLoadPlayer(pendingLoad.videoId, pendingLoad.startTime);
      pendingLoad = null;
    }
  };

  // ─── URL parsing ──────────────────────────────────────────────────────────

  /**
   * Extracts { videoId, startTime } from any common YouTube URL format.
   * Returns null if the URL is not a recognised YouTube video link.
   */
  function parseYouTubeUrl(raw) {
    let url;
    try {
      url = new URL(raw.trim());
    } catch (_) {
      return null;
    }

    let videoId = null;
    let startTime = 0;
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") {
        // https://www.youtube.com/watch?v=VIDEO_ID&t=60
        videoId = url.searchParams.get("v");
        startTime = parseT(url.searchParams.get("t") || "0");
      } else if (url.pathname.startsWith("/embed/")) {
        // https://www.youtube.com/embed/VIDEO_ID?start=60
        videoId = url.pathname.split("/")[2] || null;
        startTime = parseT(url.searchParams.get("start") || "0");
      } else if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/")[2] || null;
      } else if (url.pathname.startsWith("/live/")) {
        videoId = url.pathname.split("/")[2] || null;
      }
    } else if (host === "youtu.be") {
      // https://youtu.be/VIDEO_ID?t=60
      videoId = url.pathname.slice(1).split("?")[0];
      startTime = parseT(url.searchParams.get("t") || "0");
    }

    // Validate 11-char video ID
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { videoId, startTime };
    }
    return null;
  }

  /**
   * Parses the ?t= parameter which can be seconds ("90"), or "1h2m3s" form.
   */
  function parseT(t) {
    if (!t) return 0;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    let s = 0;
    const h = t.match(/(\d+)h/);
    if (h) s += parseInt(h[1], 10) * 3600;
    const m = t.match(/(\d+)m/);
    if (m) s += parseInt(m[1], 10) * 60;
    const sec = t.match(/(\d+)s/);
    if (sec) s += parseInt(sec[1], 10);
    return s;
  }

  // ─── Player management ────────────────────────────────────────────────────

  function loadUrl() {
    const raw = urlInput.value.trim();
    if (!raw) {
      showError("Please enter a YouTube URL.");
      return;
    }

    const parsed = parseYouTubeUrl(raw);
    if (!parsed) {
      showError(
        "Invalid YouTube URL. Accepted formats:\nyoutube.com/watch?v=… · youtu.be/… · /shorts/ · /embed/",
      );
      return;
    }

    // YouTube Shorts cannot be embedded in iframe
    if (raw.includes("/shorts/")) {
      showError(
        "YouTube Shorts cannot be embedded.\nTry a regular video: youtube.com/watch?v=VIDEO_ID",
      );
      return;
    }

    clearError();
    currentUrl = raw;
    currentVideoId = parsed.videoId;

    if (!ytReady) {
      pendingLoad = parsed;
      showPlayerSection();
      setVideoLabel("Loading player…");
      return;
    }

    showPlayerSection();
    createOrLoadPlayer(parsed.videoId, parsed.startTime);
  }

  function createOrLoadPlayer(videoId, startTime) {
    setVideoLabel("");
    if (player) {
      // Reuse existing player instance — just swap the video
      player.loadVideoById({ videoId, startSeconds: startTime });
      return;
    }

    // First-time init or retry: recreate the target div (destroyed on close)
    resetPlayerDiv();

    player = new YT.Player("yt-player", {
      videoId,
      playerVars: {
        rel: 0,
        autoplay: 1,
        start: startTime,
        iv_load_policy: 3,
        fs: 1,
        playsinline: 1,
        enablejsapi: 1,
      },
      events: {
        onReady: (e) => {
          const data = e.target.getVideoData();
          if (data && data.title) setVideoLabel(data.title);
        },
        onError: (err) => onPlayerError(err, videoId, startTime),
      },
    });
  }

  function onPlayerError(e, videoId, startTime) {
    const errorCode = e.data;
    const msgs = {
      2: "Invalid video ID.",
      5: "This video cannot be played in an embedded player.",
      100: "Video not found or is private.",
      101: "The video owner has disabled embedding.",
      150: "The video owner has disabled embedding.",
      153: "Video player configuration error.",
    };
    showError(msgs[errorCode] || `Playback error (code ${errorCode}).`);
  }

  function resetPlayerDiv() {
    playerWrap.innerHTML = '<div id="yt-player"></div>';
  }

  function showPlayerSection() {
    playerSec.classList.remove("hidden");
  }

  function closePlayer() {
    if (player) {
      player.stopVideo();
      player.destroy();
      player = null;
    }
    resetPlayerDiv();
    playerSec.classList.add("hidden");
    setVideoLabel("");
    currentVideoId = null;
    currentUrl = null;
    isMiniMode = false;
    document.getElementById("app").classList.remove("mini");
    miniBtn.textContent = "⊡";
    miniBtn.title = "Toggle mini mode";
  }

  function setVideoLabel(text) {
    videoLabel.textContent = text;
    videoLabel.title = text;
  }

  // ─── Mini mode ────────────────────────────────────────────────────────────

  function toggleMini() {
    isMiniMode = !isMiniMode;
    document.getElementById("app").classList.toggle("mini", isMiniMode);
    miniBtn.textContent = isMiniMode ? "⊞" : "⊡";
    miniBtn.title = isMiniMode ? "Exit mini mode" : "Toggle mini mode";
  }

  // ─── Timestamp saving ─────────────────────────────────────────────────────

  function saveTimestamp() {
    if (!player || !currentVideoId) {
      showError("Load a video first.");
      return;
    }
    let time;
    try {
      time = player.getCurrentTime();
    } catch (_) {
      showError("Cannot read current time — is the video playing?");
      return;
    }
    const note = noteInput.value.trim();
    vscode.postMessage({
      command: "saveTimestamp",
      data: { url: currentUrl, videoId: currentVideoId, timestamp: time, note },
    });
    noteInput.value = "";
    saveTsBtn.textContent = "✓ Saved!";
    setTimeout(() => {
      saveTsBtn.textContent = "⚑ Save Timestamp";
    }, 1600);
  }

  // ─── Clips rendering ──────────────────────────────────────────────────────

  function renderClips() {
    if (!clips.length) {
      clipsList.innerHTML = '<p class="empty-hint">No saved clips yet.</p>';
      clearAllBtn.classList.add("hidden");
      return;
    }

    clearAllBtn.classList.remove("hidden");
    clipsList.innerHTML = clips
      .map(
        (c) => `
      <div class="clip" data-id="${c.id}">
        <button
          class="clip-body"
          data-video="${c.videoId}"
          data-time="${c.timestamp}"
          data-url="${esc(c.url)}"
          title="Jump to ${fmtTime(c.timestamp)}"
        >
          <span class="clip-ts">${fmtTime(c.timestamp)}</span>
          <span class="clip-meta">
            <span class="clip-note">${c.note ? esc(c.note) : "<em>No note</em>"}</span>
            <span class="clip-date">${fmtDate(c.savedAt)}</span>
          </span>
        </button>
        <button class="btn btn-icon btn-del" data-id="${c.id}" title="Delete clip">✕</button>
      </div>
    `,
      )
      .join("");

    // Jump-to handler
    clipsList.querySelectorAll(".clip-body").forEach((btn) => {
      btn.addEventListener("click", () => {
        const videoId = btn.dataset.video;
        const time = parseInt(btn.dataset.time, 10);
        const url = btn.dataset.url;
        currentUrl = url;
        currentVideoId = videoId;
        urlInput.value = url;
        showPlayerSection();
        if (ytReady) {
          createOrLoadPlayer(videoId, time);
        } else {
          pendingLoad = { videoId, startTime: time };
        }
        // Scroll up to player
        playerSec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // Delete handler
    clipsList.querySelectorAll(".btn-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        vscode.postMessage({ command: "deleteClip", id: btn.dataset.id });
      });
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function fmtTime(sec) {
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showError(msg) {
    urlError.textContent = msg;
    urlError.style.display = "block";
    clearTimeout(showError._t);
    showError._t = setTimeout(() => {
      urlError.style.display = "none";
    }, 5000);
  }

  function clearError() {
    urlError.textContent = "";
    urlError.style.display = "none";
  }

  // ─── Event listeners ──────────────────────────────────────────────────────

  loadBtn.addEventListener("click", loadUrl);

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadUrl();
  });

  // Paste-and-auto-load: if user pastes a full URL, load immediately
  urlInput.addEventListener("paste", () => {
    setTimeout(() => {
      const val = urlInput.value.trim();
      if (parseYouTubeUrl(val)) loadUrl();
    }, 50);
  });

  miniBtn.addEventListener("click", toggleMini);
  closeBtn.addEventListener("click", closePlayer);
  saveTsBtn.addEventListener("click", saveTimestamp);

  clearAllBtn.addEventListener("click", () => {
    if (!clips.length) return;
    vscode.postMessage({ command: "clearAllClips" });
  });

  // Keyboard shortcut: Ctrl+Enter saves timestamp when note input is focused
  noteInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveTimestamp();
  });

  // ─── Messages from extension host ─────────────────────────────────────────

  window.addEventListener("message", (e) => {
    const msg = e.data;
    switch (msg.command) {
      case "updateClips":
        clips = msg.clips || [];
        renderClips();
        break;

      case "requestTimestamp":
        saveTimestamp();
        break;

      case "scrollToClips":
        $("clips-section").scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        break;
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  vscode.postMessage({ command: "getClips" });
  urlInput.focus();
})();
