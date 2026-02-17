// Music track interface application built on top of fnfestival.co template.
// All credit to fnfestival.co for the base code; extended with additional features.
document.addEventListener('DOMContentLoaded', () => {
  // Preload instrument images
  const instrumentImages = [
    '/assets/images/vocals.png',
    '/assets/images/lead.png',
    '/assets/images/keys.png',
    '/assets/images/bass.png',
    '/assets/images/drums.png'
  ];
  
  instrumentImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  // DOM Elements
  const elements = {
    modal: document.getElementById('trackModal'),
    searchInput: document.getElementById('searchInput'),
    trackCount: document.getElementById('trackCount'),
    content: document.querySelector('.content'),
    logo: document.getElementById('logo'),
    muteButton: document.getElementById('muteButton'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeSliderContainer: document.getElementById('volumeSliderContainer'),
    volumePercentage: document.getElementById('volumePercentage'),
    shareButton: document.getElementById('shareButton'),
    settingsButton: document.getElementById('settingsButton'),
    settingsMenu: document.getElementById('settingsMenu'),
    sortSelect: document.getElementById('sortSelect'),
    videoMenuButton: document.getElementById('videoMenuButton'),
    videoMenu: document.getElementById('videoMenu'),
    videoPopup: document.getElementById('videoPopup'),
    youtubeIframe: document.getElementById('youtubeIframe'),
    videoPopupClose: document.querySelector('#videoPopup .video-popup-close'),
    instrumentList: document.getElementById('instrumentList'),
    videoTrackTitle: document.getElementById('videoTrackTitle'),
    videoTrackArtist: document.getElementById('videoTrackArtist'),
    videoTrackDuration: document.getElementById('videoTrackDuration'),
    videoTrackCover: document.getElementById('videoTrackCover'),
  };

  // Validate DOM elements
  Object.keys(elements).forEach((key) => {
    if (!elements[key]) console.warn(`DOM element ${key} not found`);
  });

  if (elements.modal) {
    elements.modal.style.display = 'none';
  }

  let state = {
    fadeInAudioEnabled: localStorage.getItem('fadeInAudioEnabled') !== 'false',
    gridSize: localStorage.getItem('gridSize') || '4',
    isMuted: localStorage.getItem('isMuted') === 'true',
    textGlowEnabled: localStorage.getItem('textGlowEnabled') !== 'false',
    modalGlowEnabled: localStorage.getItem('modalGlowEnabled') !== 'false',
    modalInfoEnabled: localStorage.getItem('modalInfoEnabled') === 'true', 
    modalInfoPosition: localStorage.getItem('modalInfoPosition') || 'bottom-center', 
    tracksData: [],
    currentFilteredTracks: [],
    loadedTracks: 0,
    currentTrackIndex: -1,
    currentTrack: null,
    currentPreviewUrl: '',
    sawUpdateMessage: false,
    fadeInRequestId: null,
    fadeOutRequestId: null,
    replayTimeoutId: null,
    autoRetryTimeoutId: null,
    isFadingOut: false,
    tracksPerPage: 10,
    initialLoad: 50,
    touchStartX: 0,
  };

  const audio = new Audio();
  // Initialize volume from localStorage or default to 50%
  const storedVolume = localStorage.getItem('audioVolume');
  const initialVolume = storedVolume ? parseInt(storedVolume, 10) : 50;
  audio.volume = initialVolume / 100;
  audio.muted = state.isMuted;

  // Volume Control Functions
  const volumeControl = {
    setVolume: (volume) => {
      const volumeValue = Math.max(0, Math.min(volume / 100, 1));
      audio.volume = volumeValue;
      localStorage.setItem('audioVolume', volume);
      
      // Update volume slider and percentage display
      // Direct mapping: higher slider value = higher volume
      if (elements.volumeSlider) elements.volumeSlider.value = volume;
      if (elements.volumePercentage) elements.volumePercentage.textContent = `${volume}%`;
    },
    
    getStoredVolume: () => {
      const storedVolume = localStorage.getItem('audioVolume');
      return storedVolume ? parseInt(storedVolume, 10) : 50; // Default to 50%
    },
    
    initializeVolume: () => {
      const volume = volumeControl.getStoredVolume();
      volumeControl.setVolume(volume);
    }
  };

  // Initialize volume control
  setTimeout(() => {
    volumeControl.initializeVolume();
  }, 100);

  let player;
  let intersectionObserver;

  // Utility Functions
  const utils = {
    isMobile: () => window.innerWidth <= 768,
    debounce: (fn, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    },
    fetchWithRetry: (url, retries = 3, delay = 1000) =>
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          if (retries > 0) {
            console.warn(`Fetch failed, retrying (${retries} left): ${error}`);
            return new Promise((resolve) =>
              setTimeout(() => resolve(utils.fetchWithRetry(url, retries - 1, delay)), delay)
            );
          }
          throw error;
        }),
    parseDurationToSeconds: (duration) => {
      if (!duration) return 0;
      const match = duration.match(/(\d+)m\s*(\d+)s/);
      if (!match) {
        console.warn(`Invalid duration format: ${duration}`);
        return 0;
      }
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    },
    isValidColor: (color) => {
      if (!color) return false;
      const s = new Option().style;
      s.color = color;
      return s.color !== '';
    },
    hexToRgb: (hex) => {
      if (!hex) return '0, 0, 0';
      hex = hex.replace(/^#/, '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const bigint = parseInt(hex, 16);
      return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
    },
    rgbToRgba: (rgb, opacity) => `rgba(${rgb}, ${opacity})`,
    calculateAverageDifficulty: (track) => {
      const difficulties = track.difficulties || {};
      const validDiffs = Object.values(difficulties).filter(d => typeof d === 'number' && d !== -1);
      if (validDiffs.length === 0) return 0;
      return validDiffs.reduce((sum, d) => sum + d, 0) / validDiffs.length;
    },
  };

  // YouTube Player
  const youtubeModule = {
    init: () => {
      window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('youtubeIframe', {
          height: '315',
          width: '560',
          playerVars: { autoplay: 1 },
          events: {
            onReady: (event) => event.target.playVideo(),
            onError: () => {
              elements.videoPopup.querySelector('.video-popup-content').innerHTML =
                '<p>Failed to load YouTube video</p>';
            },
          },
        });
      };
    },
  };

  // Audio Handling
  const audioModule = {
    fadeInAudio: (audio, targetVolume, duration) => {
      if (state.fadeInRequestId) cancelAnimationFrame(state.fadeInRequestId);
      audio.volume = 0;
      const startTime = performance.now();
      const step = (currentTime) => {
        const elapsed = Math.max(currentTime - startTime, 0);
        const progress = Math.min(elapsed / duration, 1);
        audio.volume = Math.max(0, Math.min(progress * targetVolume, 1));
        if (progress < 1) {
          state.fadeInRequestId = requestAnimationFrame(step);
        } else {
          audio.volume = targetVolume;
          state.fadeInRequestId = null;
        }
      };
      state.fadeInRequestId = requestAnimationFrame(step);
    },
    fadeOutAudio: (audio, duration) => {
      return new Promise((resolve) => {
        if (state.fadeOutRequestId) cancelAnimationFrame(state.fadeOutRequestId);
        const startVolume = audio.volume;
        const startTime = performance.now();
        const step = (currentTime) => {
          const elapsed = Math.max(currentTime - startTime, 0);
          const progress = Math.min(elapsed / duration, 1);
          audio.volume = Math.max(0, startVolume * (1 - progress));
          if (progress < 1) {
            state.fadeOutRequestId = requestAnimationFrame(step);
          } else {
            audio.volume = 0;
            state.fadeOutRequestId = null;
            resolve();
          }
        };
        state.fadeOutRequestId = requestAnimationFrame(step);
      });
    },
    setVolume: (volume) => {
      const volumeValue = Math.max(0, Math.min(volume / 100, 1));
      audio.volume = volumeValue;
      localStorage.setItem('audioVolume', volume);
      
      // Update volume slider and percentage display
      const volumeSlider = document.getElementById('volumeSlider');
      const volumePercentage = document.getElementById('volumePercentage');
      // Direct mapping for rotated slider (rotation handles orientation)
      if (volumeSlider) volumeSlider.value = volume;
      if (volumePercentage) volumePercentage.textContent = `${volume}%`;
    },
    getStoredVolume: () => {
      const storedVolume = localStorage.getItem('audioVolume');
      return storedVolume ? parseInt(storedVolume, 10) : 50; // Default to 50%
    },
    initializeVolume: () => {
      const volume = audioModule.getStoredVolume();
      audioModule.setVolume(volume);
    },
    playPreview: (previewUrl, startTime, endTime) => {
      audio.ontimeupdate = null;
      
      // Clear any existing replay timeout
      if (state.replayTimeoutId) {
        clearTimeout(state.replayTimeoutId);
        state.replayTimeoutId = null;
      }

      const playSegment = () => {
        if (!state.isMuted && elements.videoPopup.style.display !== 'block') {
          // Set start time before playing
          if (startTime && audio.currentTime !== startTime / 1000) {
            audio.currentTime = startTime / 1000;
          }
          
          audio.play()
            .then(() => {
              console.log(`Audio playing: ${previewUrl} from ${startTime || 0}ms`);
              if (state.fadeInAudioEnabled) {
                const targetVolume = audioModule.getStoredVolume() / 100;
                audioModule.fadeInAudio(audio, targetVolume, 3000);
              }
              // Remove any autoplay notice if audio plays successfully
              document.querySelector('.autoplay-notice')?.remove();
              
              // Clear any pending auto-retry
              if (state.autoRetryTimeoutId) {
                clearTimeout(state.autoRetryTimeoutId);
                state.autoRetryTimeoutId = null;
              }
            })
            .catch((error) => {
              console.error('Audio playback failed:', error);
              
              // Auto-retry after 1 second by toggling mute state
              if (!state.autoRetryTimeoutId) {
                state.autoRetryTimeoutId = setTimeout(() => {
                  state.autoRetryTimeoutId = null;
                  
                  // Save original mute state
                  const originalMuteState = state.isMuted;
                  
                  // Toggle mute to opposite state (both state and audio element)
                  state.isMuted = !originalMuteState;
                  audio.muted = !originalMuteState;
                  console.log('Toggled isMuted to:', state.isMuted);
                  
                  setTimeout(() => {
                    // Toggle back to original state (both state and audio element)
                    state.isMuted = originalMuteState;
                    audio.muted = originalMuteState;
                    console.log('Toggled isMuted back to:', state.isMuted);
                    
                    audio.play()
                      .then(() => {
                        console.log('Audio started after auto-retry');
                        if (state.fadeInAudioEnabled) {
                          const targetVolume = audioModule.getStoredVolume() / 100;
                          audioModule.fadeInAudio(audio, targetVolume, 3000);
                        }
                      })
                      .catch(err => {
                        console.error('Auto-retry failed, audio blocked by browser:', err);
                      });
                  }, 10);
                }, 1000);
              }
            });
        }
        
        // Set up end time listener with fade out and replay
        if (endTime) {
          const fadeOutDuration = 2000; // 2 seconds fade out
          const fadeOutStartTime = (endTime / 1000) - (fadeOutDuration / 1000);
          
          audio.ontimeupdate = () => {
            const currentTime = audio.currentTime;
            
            // Start fade out 2 seconds before the end
            if (currentTime >= fadeOutStartTime && currentTime < endTime / 1000 && !state.isFadingOut) {
              state.isFadingOut = true;
              console.log('Starting fade out at', currentTime);
              audioModule.fadeOutAudio(audio, fadeOutDuration).then(() => {
                audio.pause();
                state.isFadingOut = false;
                
                // Wait 5 seconds then replay
                console.log('Waiting 5 seconds before replay...');
                state.replayTimeoutId = setTimeout(() => {
                  if (!state.isMuted && elements.videoPopup.style.display !== 'block') {
                    console.log('Replaying audio...');
                    audio.currentTime = startTime ? startTime / 1000 : 0;
                    audio.play()
                      .then(() => {
                        if (state.fadeInAudioEnabled) {
                          const targetVolume = audioModule.getStoredVolume() / 100;
                          audioModule.fadeInAudio(audio, targetVolume, 3000);
                        }
                      })
                      .catch(err => console.error('Replay failed:', err));
                  }
                }, 5000);
              });
            }
            
            // Fallback: pause if we somehow reach the end time
            if (currentTime >= endTime / 1000) {
              audio.pause();
              audio.ontimeupdate = null;
            }
          };
        }
      };

      if (audio.src !== previewUrl) {
        audio.src = previewUrl;
        state.currentPreviewUrl = previewUrl;
        audio.load();
        // Wait for the audio to be ready to play before setting currentTime
        audio.addEventListener('canplay', playSegment, { once: true });
      } else {
        // If it's the same src, just play it from the new start time
        playSegment();
      }
    },
    toggleMute: () => {
      state.isMuted = !state.isMuted;
      audio.muted = state.isMuted;
      localStorage.setItem('isMuted', state.isMuted);
      uiModule.updateMuteIcon();
      if (state.isMuted) {
        modalModule.stopGlowInterval();
      } else if (state.currentPreviewUrl && elements.videoPopup.style.display !== 'block') {
        audio.play()
          .then(() => {
            console.log('Audio unmuted:', state.currentPreviewUrl);
            if (state.fadeInAudioEnabled) {
              audioModule.fadeInAudio(audio, audio.volume, 3000);
            }
          })
          .catch((error) => console.error('Audio playback failed:', error));
      }
    },
  };

  // Audio Handling
  const uiModule = {
    updateMuteIcon: () => {
      if (!elements.muteButton) return;
      const muteIcon = elements.muteButton.querySelector('.mute-icon');
      const unmuteIcon = elements.muteButton.querySelector('.unmute-icon');
      elements.muteButton.setAttribute('aria-pressed', state.isMuted);
      if (muteIcon) muteIcon.style.display = state.isMuted ? 'block' : 'none';
      if (unmuteIcon) unmuteIcon.style.display = state.isMuted ? 'none' : 'block';
    },
    updateSettingsUI: () => {
      if (!elements.settingsMenu) return;
      const audioFadeItem = elements.settingsMenu.querySelector('li[data-setting="audio-fade"]');
      if (audioFadeItem) {
        audioFadeItem.textContent = `Fade In Audio: ${state.fadeInAudioEnabled ? 'On' : 'Off'}`;
        audioFadeItem.setAttribute('aria-checked', state.fadeInAudioEnabled);
      }
      const preloadItem = elements.settingsMenu.querySelector('li[data-setting="preload"]');
      if (preloadItem) {
        preloadItem.textContent = `Preload Assets: ${state.preloadAssetsEnabled ? 'On' : 'Off'}`;
        preloadItem.setAttribute('aria-checked', state.preloadAssetsEnabled);
      }
      const gridSizeItem = elements.settingsMenu.querySelector('li[data-setting="grid-size"]');
      if (gridSizeItem) {
        gridSizeItem.querySelectorAll('span').forEach((span) => span.classList.remove('active'));
        const activeSpan = gridSizeItem.querySelector(`span[data-grid-size="${state.gridSize}"]`);
        activeSpan?.classList.add('active');
        document.documentElement.style.setProperty('--grid-size', state.gridSize);
      }
      const textGlowItem = elements.settingsMenu.querySelector('li[data-setting="text-glow"]');
      if (textGlowItem) {
        textGlowItem.textContent = `Text Glow: ${state.textGlowEnabled ? 'On' : 'Off'}`;
        textGlowItem.setAttribute('aria-checked', state.textGlowEnabled);
      }
      const modalGlowItem = elements.settingsMenu.querySelector('li[data-setting="modal-glow"]');
      if (modalGlowItem) {
        modalGlowItem.textContent = `Track Glow: ${state.modalGlowEnabled ? 'On' : 'Off'}`;
        modalGlowItem.setAttribute('aria-checked', state.modalGlowEnabled);
      }
      // Modal Info Show/Hide
      const modalInfoItem = elements.settingsMenu.querySelector('li[data-setting="modal-info"]');
      if (modalInfoItem) {
        modalInfoItem.textContent = `Modal Info: ${state.modalInfoEnabled ? 'Show' : 'Hide'}`;
        modalInfoItem.setAttribute('aria-checked', state.modalInfoEnabled);
      }
      // Modal Info Position Dropdown
      const modalInfoPositionSelect = elements.settingsMenu.querySelector('select[data-setting="modal-info-position"]');
      if (modalInfoPositionSelect) {
        modalInfoPositionSelect.value = state.modalInfoPosition;
      }
    },
    updateTodoListUI: () => {
      if (!elements.todoList) {
        console.warn('To-do list element not found');
        return;
      }
      elements.todoList.classList.add('todo-list-loading');
      elements.todoList.innerHTML = '';
      if (state.todoList.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No tasks available';
        li.style.opacity = '0.7';
        elements.todoList.appendChild(li);
      } else {
        state.todoList.forEach((task) => {
          const li = document.createElement('li');
          li.className = task.completed ? 'completed' : '';
          li.innerHTML = `<span class="todo-text" aria-label="To-do task: ${task.text}${task.completed ? ', completed' : ''}">${task.text}</span>`;
          elements.todoList.appendChild(li);
        });
      }
      elements.todoList.classList.remove('todo-list-loading');
    },
  };

  // Modal Handling
  const modalModule = {
    openModal: (track) => {
      state.currentTrackIndex = state.currentFilteredTracks.findIndex(
        (t) => t.title === track.title && t.artist === track.artist
      );
      if (state.currentTrackIndex === -1) {
        console.error('Track not found in filtered tracks:', track);
        return;
      }
      
      // Update URL with track identifier using hash
      if (track.identifier) {
        window.location.hash = track.identifier;
      }
      
      modalModule.renderModal(track);
    },
    renderModal: (track) => {
      if (!elements.modal) return;
      const { title, artist, releaseYear, cover, duration, complete, difficulties, bpm, createdAt, lastFeatured, previewUrl, download, videoUrl, videoPosition, key, youtubeLinks, loading_phrase, videoZoom, glowTimes, modalShadowColors, spotify, preview_time, preview_end_time, genre } = track;
      const positionPercent = videoPosition ?? 50;
      const modalContent = elements.modal.querySelector('.modal-content');
      if (!modalContent) return;

      // Set blurred album art background
      if (cover) {
        modalContent.style.setProperty('--modal-bg-image', `url('/assets/covers/${cover}')`);
        const beforeStyle = document.createElement('style');
        beforeStyle.id = 'modal-bg-style';
        const existingStyle = document.getElementById('modal-bg-style');
        if (existingStyle) existingStyle.remove();
        beforeStyle.textContent = `.modal-content::before { background-image: url('/assets/covers/${cover}'); }`;
        document.head.appendChild(beforeStyle);
      }

      modalContent.style.boxShadow = '';
      modalContent.style.transition = 'box-shadow 0.3s ease';
      modalContent.removeEventListener('mouseenter', modalModule.handleMouseEnter);
      modalContent.removeEventListener('mouseleave', modalModule.handleMouseLeave);
      modalContent.removeEventListener('touchstart', modalModule.handleTouchStart);
      modalContent.removeEventListener('touchend', modalModule.handleTouchEnd);

      let defaultShadow = '0 0 50px rgba(255, 255, 255, 0.52), 0 0 100px rgba(255, 255, 255, 0.49)';
      let glowShadow = '0 0 60px rgb(255, 255, 255), 0 0 120px rgb(255, 255, 255)';

      if (modalShadowColors?.default && modalShadowColors.hover) {
        const { default: defaultColors, hover: hoverColors } = modalShadowColors;
        const isValidDefault = defaultColors.color1 && defaultColors.color2 &&
                              utils.isValidColor(defaultColors.color1) && utils.isValidColor(defaultColors.color2);
        const isValidHover = hoverColors.color1 && hoverColors.color2 &&
                             utils.isValidColor(hoverColors.color1) && utils.isValidColor(hoverColors.color2);

        if (isValidDefault) {
          defaultShadow = `0 0 50px ${utils.rgbToRgba(utils.hexToRgb(defaultColors.color1), 0.3)}, 0 0 100px ${utils.rgbToRgba(utils.hexToRgb(defaultColors.color2), 0.2)}`;
        } else {
          console.warn(`Invalid default modalShadowColors for ${track.title}:`, defaultColors);
        }
        if (isValidHover) {
          glowShadow = `0 0 60px ${utils.rgbToRgba(utils.hexToRgb(hoverColors.color1), 0.5)}, 0 0 120px ${utils.rgbToRgba(utils.hexToRgb(hoverColors.color2), 0.4)}`;
        } else {
          console.warn(`Invalid hover modalShadowColors for ${track.title}:`, hoverColors);
        }
      }

      modalContent.style.boxShadow = defaultShadow;

      const modalRight = modalContent.querySelector('.modal-right');
      if (modalRight) {
        modalRight.querySelectorAll('.modal-video').forEach(v => v.remove());
      }
      modalContent.querySelectorAll('.modal-video').forEach(v => v.remove());
      modalContent.classList.remove('no-video');

      modalModule.stopGlowInterval();
      audio.removeEventListener('play', modalModule.handleAudioPlay);
      audio.removeEventListener('pause', modalModule.stopGlowInterval);

      const modalLeftSection = modalContent.querySelector('.modal-left-section');
      let loadingPhraseElement = modalContent.querySelector('.modal-loading-phrase');
      if (!loadingPhraseElement) {
        loadingPhraseElement = document.createElement('div');
        loadingPhraseElement.classList.add('modal-loading-phrase');
        modalContent.appendChild(loadingPhraseElement);
      } else {
        loadingPhraseElement.classList.remove('glow');
      }
      loadingPhraseElement.innerHTML = `<center><strong></strong> ${loading_phrase || 'Not available'}</p>`;

      if (state.textGlowEnabled && glowTimes?.length && previewUrl) {
        const applyGlowEffect = () => {
          if (!audio.paused && !state.isMuted && elements.videoPopup.style.display !== 'block') {
            const currentTime = audio.currentTime % audio.duration;
            glowTimes.forEach((glowTime) => {
              if (Math.abs(currentTime - glowTime) < 0.1 && !loadingPhraseElement.classList.contains('glow')) {
                loadingPhraseElement.classList.add('glow');
                console.log(`Text glow triggered at ${currentTime}s for ${glowTime}s`);
                const timeout = setTimeout(() => {
                  loadingPhraseElement.classList.remove('glow');
                }, 2000);
                modalModule.glowTimeouts.push(timeout);
              }
            });
          }
        };

        if (!audio.paused && !state.isMuted && elements.videoPopup.style.display !== 'block') {
          modalModule.startGlowInterval(applyGlowEffect);
        }

        modalModule.handleAudioPlay = () => {
          if (!state.isMuted && elements.videoPopup.style.display !== 'block') {
            modalModule.startGlowInterval(applyGlowEffect);
          }
        };
        audio.addEventListener('play', modalModule.handleAudioPlay);
        audio.addEventListener('pause', modalModule.stopGlowInterval);
      }

      if (state.modalGlowEnabled) {
        modalModule.handleMouseEnter = () => {
          modalContent.style.boxShadow = glowShadow;
          console.log(`Modal glow triggered on hover for ${track.title}`);
        };
        modalModule.handleMouseLeave = () => {
          modalContent.style.boxShadow = defaultShadow;
          console.log(`Modal glow removed on hover leave for ${track.title}`);
        };
        modalModule.handleTouchStart = (e) => {
          e.preventDefault();
          modalContent.style.boxShadow = glowShadow;
          console.log(`Modal glow triggered on touch for ${track.title}`);
        };
        modalModule.handleTouchEnd = () => {
          modalContent.style.boxShadow = defaultShadow;
          console.log(`Modal glow removed on touch end for ${track.title}`);
        };
        modalContent.addEventListener('mouseenter', modalModule.handleMouseEnter);
        modalContent.addEventListener('mouseleave', modalModule.handleMouseLeave);
        modalContent.addEventListener('touchstart', modalModule.handleTouchStart, { passive: false });
        modalContent.addEventListener('touchend', modalModule.handleTouchEnd);
      }

      if (previewUrl) {
        // Convert external streaming URLs to local assets/audio files
        let localAudioUrl = previewUrl;
        
        if (previewUrl.includes('208.92.234.17:8000/stream/')) {
          // Extract filename from streaming URL and use local audio file
          const fileName = previewUrl.split('/').pop();
          localAudioUrl = `/assets/audio/${fileName}`;
        } else if (previewUrl.endsWith('.mp3')) {
          // If it's already a .mp3 file, construct local path from filename
          const fileName = previewUrl.split('/').pop();
          localAudioUrl = `/assets/audio/${fileName}`;
        }
        
        audioModule.playPreview(localAudioUrl, preview_time, preview_end_time);
      }

      if (videoUrl) {
        const modalRightSection = modalContent.querySelector('.modal-right-section');
        const videoElement = document.createElement('video');
        videoElement.classList.add('modal-video');
        
        // Detect if mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        // Autoplay video in background on all devices
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true; // Important for iOS - prevents fullscreen
        videoElement.setAttribute('webkit-playsinline', 'true'); // Extra iOS compatibility
        videoElement.setAttribute('playsinline', 'true'); // Ensure inline playback
        videoElement.innerHTML = `<source src="/assets/preview/${videoUrl}" type="video/mp4">`;
        videoElement.style.objectFit = 'cover';
        videoElement.style.objectPosition = `center ${positionPercent}%`;
        videoElement.style.transform = `scale(${videoZoom || 1})`;
        
        // Add zoom functionality for mobile
        if (isMobile) {
          let isZoomed = false;
          videoElement.addEventListener('click', (e) => {
            e.stopPropagation();
            isZoomed = !isZoomed;
            videoElement.classList.toggle('zoomed', isZoomed);
          });
        }
        
        if (modalRightSection) {
          modalRightSection.appendChild(videoElement);
        }
        videoElement.onerror = () => {
          videoElement.remove();
          modalContent.classList.add('no-video');
        };
        videoElement.onloadeddata = () => videoElement.classList.add('loaded');
      }

      const modalCover = elements.modal.querySelector('#modalCover');
      const modalTitle = elements.modal.querySelector('#modalTitle');
      const modalArtist = elements.modal.querySelector('#modalArtist');
      const modalDuration = elements.modal.querySelector('#modalDuration');
      const modalDetails = elements.modal.querySelector('#modalDetails');
      const modalDifficulties = elements.modal.querySelector('#modalDifficulties');

      if (modalCover) modalCover.src = `/assets/covers/${cover}`;
      if (modalTitle) modalTitle.textContent = title;
      if (modalArtist) modalArtist.textContent = artist;
      if (modalDuration) {
        modalDuration.innerHTML = `<span class="year-duration">${releaseYear} | ${duration}</span><br><span class="key-bpm-genre"><strong>Key:</strong> ${key || 'N/A'}<br><strong>BPM:</strong> ${bpm || 'N/A'}<br><strong>Genre:</strong> ${track.genre || 'N/A'}</span>`;
      }
      if (modalDetails) {
        const lastUpdatedDate = lastFeatured && lastFeatured !== 'TBA' && lastFeatured !== 'Not available' 
          ? new Date(lastFeatured).toLocaleDateString() 
          : (lastFeatured || 'Not available');
        
        modalDetails.innerHTML = `
          <div class="modal-details-row">
            <div class="modal-dates">
              <p><strong>Released On:</strong> ${new Date(createdAt).toLocaleDateString()}</p>
              <p><strong>Last Updated:</strong> ${lastUpdatedDate}</p>
            </div>
          </div>
        `;
      }
      if (modalDifficulties) trackModule.generateDifficultyBars(difficulties, modalDifficulties, track);

      elements.modal.style.display = 'block';
      document.body.classList.add('modal-open');

      const prevButton = elements.modal.querySelector('.modal-prev');
      const nextButton = elements.modal.querySelector('.modal-next');
      if (prevButton) prevButton.style.display = state.currentTrackIndex > 0 ? 'block' : 'none';
      if (nextButton) nextButton.style.display = state.currentTrackIndex < state.currentFilteredTracks.length - 1 ? 'block' : 'none';

      if (elements.videoMenuButton) {
        const hasYouTubeLinks = youtubeLinks && Object.values(youtubeLinks).some((url) => url?.trim());
        elements.videoMenuButton.disabled = !hasYouTubeLinks;
      }

      const menuItems = elements.videoMenu?.querySelectorAll('li') || [];
      menuItems.forEach((item) => {
        const instrument = item.getAttribute('data-instrument');
        const youtubeUrl = youtubeLinks?.[instrument];
        item.style.display = youtubeUrl ? 'block' : 'none';
        item.onclick = (event) => {
          event.preventDefault();
          if (youtubeUrl) {
            videoModule.openVideoPopup(track, youtubeUrl, instrument);
            elements.videoMenu.style.display = 'none';
            elements.videoMenuButton?.setAttribute('aria-expanded', 'false');
          }
        };
      });
    },
    closeModal: () => {
      if (!elements.modal) return;
      elements.modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      audio.pause();
      audio.src = '';
      state.currentPreviewUrl = '';
      state.isFadingOut = false;
      
      // Clear the URL hash when closing modal
      if (window.location.hash) {
        history.replaceState(null, null, ' ');
      }
      
      // Clear replay timeout
      if (state.replayTimeoutId) {
        clearTimeout(state.replayTimeoutId);
        state.replayTimeoutId = null;
      }
      
      // Clear auto-retry timeout
      if (state.autoRetryTimeoutId) {
        clearTimeout(state.autoRetryTimeoutId);
        state.autoRetryTimeoutId = null;
      }
      
      // Clear fade animations
      if (state.fadeInRequestId) {
        cancelAnimationFrame(state.fadeInRequestId);
        state.fadeInRequestId = null;
      }
      if (state.fadeOutRequestId) {
        cancelAnimationFrame(state.fadeOutRequestId);
        state.fadeOutRequestId = null;
      }
      
      // Remove any notices
      document.querySelectorAll('.autoplay-notice').forEach(notice => notice.remove());
      
      modalModule.stopGlowInterval();
      
      // Clear hash from URL
      history.replaceState(null, null, ' ');
      
      const modalContent = elements.modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.removeEventListener('mouseenter', modalModule.handleMouseEnter);
        modalContent.removeEventListener('mouseleave', modalModule.handleMouseLeave);
        modalContent.removeEventListener('touchstart', modalModule.handleTouchStart);
        modalContent.removeEventListener('touchend', modalModule.handleTouchEnd);
      }
    },
    navigateModal: (direction) => {
      const newIndex = state.currentTrackIndex + direction;
      if (newIndex >= 0 && newIndex < state.currentFilteredTracks.length) {
        state.currentTrackIndex = newIndex;
        const newTrack = state.currentFilteredTracks[newIndex];
        if (newTrack) {
          modalModule.stopGlowInterval();
          
          // Update URL hash with new track identifier
          if (newTrack.identifier) {
            window.location.hash = newTrack.identifier;
          }
          
          modalModule.renderModal(newTrack);
        } else {
          console.error('No track found at index', newIndex);
        }
      } else {
        console.warn('Cannot navigate: index out of bounds', newIndex);
      }
    },
    glowTimeouts: [],
    glowInterval: null,
    handleAudioPlay: null,
    handleMouseEnter: null,
    handleMouseLeave: null,
    handleTouchStart: null,
    handleTouchEnd: null,
    startGlowInterval: (applyGlowEffect) => {
      if (!modalModule.glowInterval) {
        modalModule.glowInterval = setInterval(applyGlowEffect, 100);
      }
    },
    stopGlowInterval: () => {
      if (modalModule.glowInterval) {
        clearInterval(modalModule.glowInterval);
        modalModule.glowInterval = null;
      }
      modalModule.glowTimeouts.forEach(clearTimeout);
      modalModule.glowTimeouts = [];
      const loadingPhraseElement = elements.modal?.querySelector('.modal-loading-phrase');
      if (loadingPhraseElement) {
        loadingPhraseElement.classList.remove('glow');
      }
      const modalContent = elements.modal?.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.boxShadow = modalContent.style.boxShadow || '0 0 50px rgba(0, 255, 255, 0.3), 0 0 100px rgba(255, 0, 255, 0.2)';
      }
      if (modalModule.handleAudioPlay) {
        audio.removeEventListener('play', modalModule.handleAudioPlay);
        modalModule.handleAudioPlay = null;
      }
      audio.removeEventListener('pause', modalModule.stopGlowInterval);
    },
  };

  // Video Popup
  const videoModule = {
    openVideoPopup: (track, youtubeUrl, instrument) => {
      state.currentTrack = track;
      const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/)?.[1];

      if (!audio.paused || state.currentPreviewUrl) {
        state.isMuted = true;
        audio.muted = true;
        audio.pause();
        localStorage.setItem('isMuted', true);
        uiModule.updateMuteIcon();
        modalModule.stopGlowInterval();
      }

      if (track.previewUrl && !state.currentPreviewUrl) {
        state.currentPreviewUrl = track.previewUrl;
      }

      const videoPopupContent = elements.videoPopup?.querySelector('.video-popup-content');
      const videoSidebar = elements.videoPopup?.querySelector('.video-sidebar');
      if (!videoPopupContent || !elements.videoPopup) return;

      if (utils.isMobile()) {
        videoPopupContent.style.flexDirection = 'column';
        videoPopupContent.style.width = '95%';
        videoPopupContent.style.maxWidth = 'none';
        if (videoSidebar) {
          videoSidebar.style.width = '100%';
          videoSidebar.style.padding = '20px';
        }
        if (elements.videoTrackCover) {
          elements.videoTrackCover.style.width = '100%';
          elements.videoTrackCover.style.height = 'auto';
        }
      } else {
        videoPopupContent.style.flexDirection = 'row';
        videoPopupContent.style.width = '1280px';
        videoPopupContent.style.maxWidth = '90%';
        if (videoSidebar) {
          videoSidebar.style.width = '400px';
          videoSidebar.style.padding = '50px';
        }
        if (elements.videoTrackCover) {
          elements.videoTrackCover.style.width = '300px';
          elements.videoTrackCover.style.height = '300px';
        }
      }

      if (elements.videoTrackCover) elements.videoTrackCover.src = `/assets/covers/${track.cover}`;
      if (elements.videoTrackTitle) elements.videoTrackTitle.textContent = track.title;
      if (elements.videoTrackArtist) elements.videoTrackArtist.textContent = track.artist;
      if (elements.videoTrackDuration) elements.videoTrackDuration.textContent = `${track.releaseYear} | ${track.duration}`;
      videoModule.populateInstrumentList(track, instrument);

      if (videoId && player) {
        player.loadVideoById(videoId);
        player.mute();
        elements.videoPopup.style.display = 'block';
        document.body.classList.add('video-popup-open');
      } else if (videoId) {
        elements.youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        elements.videoPopup.style.display = 'block';
        document.body.classList.add('video-popup-open');
      } else {
        console.error('Invalid YouTube URL:', youtubeUrl);
        videoPopupContent.innerHTML = '<p>Invalid YouTube video URL</p>';
        if (elements.instrumentList) elements.instrumentList.innerHTML = '';
        if (elements.videoTrackCover) elements.videoTrackCover.src = '';
      }
    },
    closeVideoPopup: () => {
      if (!elements.videoPopup) return;
      elements.videoPopup.style.display = 'none';
      document.body.classList.remove('video-popup-open');
      if (player) {
        try {
          player.stopVideo();
          player.clearVideo();
        } catch (error) {
          console.error('Player cleanup failed:', error);
        }
      }
      if (elements.youtubeIframe) elements.youtubeIframe.src = '';
      if (elements.instrumentList) elements.instrumentList.innerHTML = '';
      if (elements.videoTrackCover) elements.videoTrackCover.src = '';
      if (elements.videoTrackTitle) elements.videoTrackTitle.textContent = '';
      if (elements.videoTrackArtist) elements.videoTrackArtist.textContent = '';
      if (elements.videoTrackDuration) elements.videoTrackDuration.textContent = '';
      if (state.currentPreviewUrl) {
        state.isMuted = false;
        audio.muted = false;
        localStorage.setItem('isMuted', false);
        uiModule.updateMuteIcon();
        audioModule.playPreview(state.currentPreviewUrl);
      }
      state.currentTrack = null;
    },
    populateInstrumentList: (track, selectedInstrument) => {
      if (!elements.instrumentList) return;
      elements.instrumentList.innerHTML = '';
      const instruments = ['vocals', 'lead', 'bass', 'drums'];

      instruments.forEach((instrument) => {
        if (track.youtubeLinks?.[instrument]) {
          const li = document.createElement('li');
          li.setAttribute('data-instrument', instrument);
          li.className = instrument === selectedInstrument ? 'active' : '';
          const iconClass = (instrument === 'lead' && track.keys === 'true') ? 'keys' : instrument;
          const displayName = (instrument === 'lead' && track.keys === 'true') ? 'Keys' : instrument.charAt(0).toUpperCase() + instrument.slice(1);
          li.innerHTML = `<span class="instrument-icon ${iconClass}"></span>${displayName}`;
          li.addEventListener('click', () => {
            elements.instrumentList.querySelectorAll('li').forEach((item) => item.classList.remove('active'));
            li.classList.add('active');

            const youtubeUrl = track.youtubeLinks[instrument];
            const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/)?.[1];

            if (videoId) {
              if (player) {
                player.loadVideoById(videoId);
                player.mute();
                console.log(`Loading YouTube video for ${instrument}: ${videoId}`);
              } else {
                elements.youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                console.log(`Fallback: Setting iframe src for ${instrument}: ${videoId}`);
              }
            } else {
              console.error(`Invalid YouTube URL for ${instrument}: ${youtubeUrl}`);
              elements.youtubeIframe.src = '';
              elements.videoPopup.querySelector('.video-popup-content').innerHTML =
                '<p>Invalid YouTube video URL</p>';
            }
          });
          elements.instrumentList.appendChild(li);
        }
      });
    },
  };

  // Track Rendering
  const trackModule = {
    renderTracks: (tracks, clearExisting = true, sortValue = null) => {
      if (!elements.content) return;
      if (clearExisting) elements.content.innerHTML = '';
      
      const shouldGroup = sortValue && sortValue !== 'latest' && sortValue !== 'earliest';
      
      if (shouldGroup) {
        const grouped = {};
        const sortLabels = {
          'longest': (track) => {
            const seconds = utils.parseDurationToSeconds(track.duration);
            if (seconds === 0) return 'Unknown Duration';
            const minutes = Math.floor(seconds / 60);
            return `${minutes}:00-${minutes + 1}:00`;
          },
          'shortest': (track) => {
            const seconds = utils.parseDurationToSeconds(track.duration);
            if (seconds === 0) return 'Unknown Duration';
            const minutes = Math.floor(seconds / 60);
            return `${minutes}:00-${minutes + 1}:00`;
          },
          'fastest': (track) => {
            if (!track.bpm) return 'Unknown BPM';
            const bpmRange = Math.floor(track.bpm / 10) * 10;
            return `${bpmRange}-${bpmRange + 10} BPM`;
          },
          'slowest': (track) => {
            if (!track.bpm) return 'Unknown BPM';
            const bpmRange = Math.floor(track.bpm / 10) * 10;
            return `${bpmRange}-${bpmRange + 10} BPM`;
          },
          'newest': (track) => track.releaseYear || 'Unknown Year',
          'oldest': (track) => track.releaseYear || 'Unknown Year',
          'charter': (track) => track.charter || 'Unknown Charter',
          'charter_za': (track) => track.charter || 'Unknown Charter',
          'hardest': (track) => {
            const avg = utils.calculateAverageDifficulty(track);
            return avg > 0 ? `${avg.toFixed(1)} Difficulty` : 'No Difficulty';
          },
          'easiest': (track) => {
            const avg = utils.calculateAverageDifficulty(track);
            return avg > 0 ? `${avg.toFixed(1)} Difficulty` : 'No Difficulty';
          },
          'genre_az': (track) => track.genre || 'Unknown Genre',
          'genre_za': (track) => track.genre || 'Unknown Genre',
        };
        
        const getLabelFunc = sortLabels[sortValue];
        
        tracks.forEach(track => {
          const label = getLabelFunc ? getLabelFunc(track) : 'Unknown';
          if (!grouped[label]) {
            grouped[label] = [];
          }
          grouped[label].push(track);
        });
        
        let sortedLabels = Object.keys(grouped);
        
        if (sortValue === 'newest' || sortValue === 'oldest') {
          sortedLabels.sort((a, b) => {
            const yearA = parseInt(a) || 0;
            const yearB = parseInt(b) || 0;
            return sortValue === 'newest' ? yearB - yearA : yearA - yearB;
          });
        }
        
        sortedLabels.forEach(label => {
          const separator = document.createElement('div');
          separator.className = 'sort-separator';
          separator.innerHTML = `<span>------------------------- ${label} -------------------------</span>`;
          elements.content.appendChild(separator);
          
          grouped[label].forEach(track => {
            trackModule.renderSingleTrack(track);
          });
        });
      } else {
        tracks.forEach((track) => {
          trackModule.renderSingleTrack(track);
        });
      }
    },
    renderSingleTrack: (track) => {
      if (!elements.content) return;
      const trackElement = document.createElement('div');
      trackElement.classList.add('jam-track');
      trackElement.setAttribute('role', 'button');
      trackElement.setAttribute('aria-label', `Open ${track.title} by ${track.artist}`);

      if (track.borderColor && utils.isValidColor(track.borderColor)) {
        trackElement.style.border = `2px solid ${track.borderColor}`;
      }

      const loadingSpinner = document.createElement('div');
      loadingSpinner.className = 'loading-spinner';
      const img = new Image();
      img.src = `/assets/covers/${track.cover}`;
      img.alt = `${track.title} Cover`;
      img.style.display = 'none';
      img.onload = () => {
        loadingSpinner.remove();
        img.style.display = '';
        img.classList.add('loaded');
      };
      img.onerror = () => {
        console.error(`Failed to load cover: /assets/covers/${track.cover}`);
        img.src = '/assets/covers/fallback.jpg';
        loadingSpinner.remove();
        img.style.display = '';
        img.classList.add('loaded');
      };
      trackElement.innerHTML = `<div><h2>${track.title}</h2><p>${track.artist}</p></div>`;
      trackElement.insertBefore(loadingSpinner, trackElement.firstChild);
      trackElement.insertBefore(img, trackElement.firstChild);
      trackElement.appendChild(trackModule.generateLabels(track));

      trackElement.addEventListener('click', (e) => {
        e.preventDefault();
        modalModule.openModal(track);
        if (utils.isMobile() && track.previewUrl) {
          // Convert external streaming URLs to local assets/audio files
          let localAudioUrl = track.previewUrl;
          
          if (track.previewUrl.includes('208.92.234.17:8000/stream/')) {
            // Extract filename from streaming URL and use local audio file
            const fileName = track.previewUrl.split('/').pop();
            localAudioUrl = `/assets/audio/${fileName}`;
          } else if (track.previewUrl.endsWith('.mp3')) {
            // If it's already a .mp3 file, construct local path from filename
            const fileName = track.previewUrl.split('/').pop();
            localAudioUrl = `/assets/audio/${fileName}`;
          }
          
          audioModule.playPreview(localAudioUrl, track.preview_time, track.preview_end_time);
          trackElement.classList.add('mobile-highlight');
          setTimeout(() => trackElement.classList.remove('mobile-highlight'), 300);
        }
      });

      elements.content.appendChild(trackElement);
    },
    renderMobileList: (tracks) => {
      const mobileList = document.getElementById('mobileTrackList');
      if (!mobileList) {
        console.warn('Mobile track list element not found');
        return;
      }
      
      mobileList.innerHTML = '';
      
      if (!tracks || tracks.length === 0) {
        console.warn('No tracks to render in mobile list');
        return;
      }
      
      // Check if we need to group by categories
      const sortValue = elements.sortSelect?.value;
      const shouldGroup = sortValue && sortValue !== 'latest' && sortValue !== 'earliest';
      
      if (shouldGroup) {
        // Group tracks by category
        const sortLabels = {
          'genre_az': (track) => track.genre || 'Unknown',
          'genre_za': (track) => track.genre || 'Unknown',
          'charter': (track) => track.charter || 'Unknown',
          'charter_za': (track) => track.charter || 'Unknown',
          'oldest': (track) => track.releaseYear?.toString() || 'Unknown',
          'newest': (track) => track.releaseYear?.toString() || 'Unknown',
          'fastest': (track) => track.bpm ? `${Math.floor(track.bpm / 20) * 20}-${Math.floor(track.bpm / 20) * 20 + 19} BPM` : 'Unknown',
          'slowest': (track) => track.bpm ? `${Math.floor(track.bpm / 20) * 20}-${Math.floor(track.bpm / 20) * 20 + 19} BPM` : 'Unknown',
          'longest': (track) => {
            const seconds = utils.parseDurationToSeconds(track.duration);
            return `${Math.floor(seconds / 60)}-${Math.floor(seconds / 60) + 1} min`;
          },
          'shortest': (track) => {
            const seconds = utils.parseDurationToSeconds(track.duration);
            return `${Math.floor(seconds / 60)}-${Math.floor(seconds / 60) + 1} min`;
          },
          'hardest': (track) => {
            const avg = utils.calculateAverageDifficulty(track);
            return `${Math.floor(avg)}-${Math.floor(avg) + 1} Stars`;
          },
          'easiest': (track) => {
            const avg = utils.calculateAverageDifficulty(track);
            return `${Math.floor(avg)}-${Math.floor(avg) + 1} Stars`;
          }
        };
        
        const getLabelFunc = sortLabels[sortValue];
        const grouped = {};
        
        tracks.forEach(track => {
          const label = getLabelFunc ? getLabelFunc(track) : 'Unknown';
          if (!grouped[label]) {
            grouped[label] = [];
          }
          grouped[label].push(track);
        });
        
        // Render grouped tracks with headers
        Object.keys(grouped).forEach(label => {
          // Add category header
          const header = document.createElement('div');
          header.className = 'mobile-category-header';
          header.textContent = label;
          mobileList.appendChild(header);
          
          // Add tracks in this category
          grouped[label].forEach(track => {
            mobileList.appendChild(trackModule.createMobileTrackItem(track));
          });
        });
      } else {
        // No grouping, just render all tracks
        tracks.forEach((track) => {
          mobileList.appendChild(trackModule.createMobileTrackItem(track));
        });
      }
      
      console.log(`Mobile list rendered with ${tracks.length} tracks`);
    },
    
    createMobileTrackItem: (track) => {
      const listItem = document.createElement('div');
      listItem.className = 'mobile-track-item';
      listItem.setAttribute('role', 'button');
      listItem.setAttribute('aria-label', `Open ${track.title} by ${track.artist}`);
      
      listItem.innerHTML = `
        <img src="/assets/covers/${track.cover}" alt="${track.title}" class="mobile-track-cover" onerror="this.src='/assets/covers/fallback.jpg'">
        <div class="mobile-track-info">
          <div class="mobile-track-title">${track.title}</div>
          <div class="mobile-track-artist">${track.artist}</div>
          <div class="mobile-track-meta">
            <span>${track.duration}</span>
            <span>•</span>
            <span>${track.genre}</span>
          </div>
        </div>
        <div class="mobile-track-chevron">›</div>
      `;
      
      listItem.addEventListener('click', (e) => {
        e.preventDefault();
        modalModule.openModal(track);
        if (track.previewUrl) {
          let localAudioUrl = track.previewUrl;
          
          if (track.previewUrl.includes('208.92.234.17:8000/stream/')) {
            const fileName = track.previewUrl.split('/').pop();
            localAudioUrl = `/assets/audio/${fileName}`;
          } else if (track.previewUrl.endsWith('.mp3')) {
            const fileName = track.previewUrl.split('/').pop();
            localAudioUrl = `/assets/audio/${fileName}`;
          }
          
          audioModule.playPreview(localAudioUrl, track.preview_time, track.preview_end_time);
        }
      });
      
      return listItem;
    },
    filterTracks: () => {
      if (!elements.searchInput || !elements.sortSelect || !elements.trackCount) return;
      const query = elements.searchInput.value.toLowerCase().trim();
      const sortValue = elements.sortSelect.value;

      let filteredTracks = state.tracksData.filter(
        (track) =>
          track.title.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query)
      );

      if (sortValue && sortValue !== 'default') {
        const sortMap = {
          'latest': (a, b) => (b.creationIndex || 0) - (a.creationIndex || 0),
          'earliest': (a, b) => (a.creationIndex || 0) - (b.creationIndex || 0),
          'longest': (a, b) => utils.parseDurationToSeconds(b.duration) - utils.parseDurationToSeconds(a.duration),
          'shortest': (a, b) => utils.parseDurationToSeconds(a.duration) - utils.parseDurationToSeconds(b.duration),
          'fastest': (a, b) => (b.bpm || 0) - (a.bpm || 0),
          'slowest': (a, b) => (a.bpm || 0) - (b.bpm || 0),
          'newest': (a, b) => {
            let yearA = a.releaseYear;
            let yearB = b.releaseYear;
            
            if (typeof yearA === 'string') yearA = parseInt(yearA) || 0;
            if (typeof yearB === 'string') yearB = parseInt(yearB) || 0;
            
            yearA = Number(yearA) || 0;
            yearB = Number(yearB) || 0;
            
            return yearB - yearA;
          },
          'oldest': (a, b) => {
            let yearA = a.releaseYear;
            let yearB = b.releaseYear;
            
            if (typeof yearA === 'string') yearA = parseInt(yearA) || 0;
            if (typeof yearB === 'string') yearB = parseInt(yearB) || 0;
            
            yearA = Number(yearA) || 0;
            yearB = Number(yearB) || 0;
            
            return yearA - yearB;
          },
          'charter': (a, b) => (a.charter || '').toLowerCase().localeCompare((b.charter || '').toLowerCase()),
          'charter_za': (a, b) => (b.charter || '').toLowerCase().localeCompare((a.charter || '').toLowerCase()),
          'hardest': (a, b) => utils.calculateAverageDifficulty(b) - utils.calculateAverageDifficulty(a),
          'easiest': (a, b) => utils.calculateAverageDifficulty(a) - utils.calculateAverageDifficulty(b),
          'genre_az': (a, b) => (a.genre || '').toLowerCase().localeCompare((b.genre || '').toLowerCase()),
          'genre_za': (a, b) => (b.genre || '').toLowerCase().localeCompare((a.genre || '').toLowerCase()),
        };

        if (sortMap[sortValue]) {
          filteredTracks.sort(sortMap[sortValue]);
        }
      }

      state.currentFilteredTracks = filteredTracks;
      
      const sortNames = {
        'latest': 'Latest',
        'earliest': 'Earliest',
        'longest': 'Longest',
        'shortest': 'Shortest',
        'fastest': 'Fastest',
        'slowest': 'Slowest',
        'newest': 'Newest',
        'oldest': 'Oldest',
        'charter': 'Charter',
        'charter_za': 'Charter',
        'hardest': 'Hardest',
        'easiest': 'Easiest',
        'genre_az': 'Genre',
        'genre_za': 'Genre',
      };
      
      const sortLabel = sortValue !== 'latest' ? ` | Sorted By: ${sortNames[sortValue] || 'Latest'}` : '';
      elements.trackCount.textContent =
        query || sortValue !== 'latest'
          ? `Found: ${filteredTracks.length}${sortLabel}`
          : `Total: ${state.tracksData.length}`;
      state.loadedTracks = 0;

      if (query || sortValue !== 'latest') {
        trackModule.renderTracks(filteredTracks, true, sortValue);
        trackModule.renderMobileList(filteredTracks);
      } else {
        trackModule.renderTracks(filteredTracks.slice(0, state.initialLoad), true, sortValue);
        trackModule.renderMobileList(filteredTracks);
        if (filteredTracks.length > state.initialLoad) {
          state.loadedTracks = state.initialLoad;
          trackModule.setupInfiniteScroll(filteredTracks);
        }
      }

      const url = new URL(window.location);
      if (query) url.searchParams.set('q', query);
      else url.searchParams.delete('q');
      if (sortValue !== 'latest') url.searchParams.set('sort', sortValue);
      else url.searchParams.delete('sort');
      window.history.replaceState({}, '', url);
    },
    setupInfiniteScroll: (tracks) => {
      if (!elements.content) return;
      if (intersectionObserver) intersectionObserver.disconnect();
      const sentinel = document.createElement('div');
      sentinel.className = 'sentinel';
      sentinel.style.height = '1px';
      elements.content.appendChild(sentinel);
      state.tracksPerPage = utils.isMobile() ? 5 : 10;
      intersectionObserver = new IntersectionObserver((entries) => {
        if (
          entries[0].isIntersecting &&
          !elements.searchInput.value &&
          elements.sortSelect.value === 'latest' &&
          state.loadedTracks < tracks.length
        ) {
          intersectionObserver.unobserve(entries[0].target);
          const nextBatch = tracks.slice(state.loadedTracks, state.loadedTracks + state.tracksPerPage);
          nextBatch.forEach(track => trackModule.renderSingleTrack(track));
          state.loadedTracks += state.tracksPerPage;
          if (state.loadedTracks < tracks.length) {
            const newSentinel = document.createElement('div');
            newSentinel.className = 'sentinel';
            newSentinel.style.height = '1px';
            elements.content.appendChild(newSentinel);
            intersectionObserver.observe(newSentinel);
          }
        }
      });
      intersectionObserver.observe(sentinel);
    },
    generateDifficultyBars: (difficulties, container, track) => {
      if (!container) return;
      container.innerHTML = '';
      const maxBars = 7;
      const excludedInstruments = ['plastic-guitar', 'plastic-drums', 'plastic-bass'];
      Object.entries(difficulties || {}).forEach(([instrument, level]) => {
        if (!excludedInstruments.includes(instrument)) {
          const difficultyElement = document.createElement('div');
          difficultyElement.classList.add('difficulty');
          let barsHTML = '';
          for (let i = 1; i <= maxBars; i++) {
            barsHTML += `<div class="difficulty-bar"><span class="${i <= level + 1 ? 'active' : ''}"></span></div>`;
          }
          const iconClass = (instrument === 'lead' && track && track.keys === 'true') ? 'keys' : instrument;
          difficultyElement.innerHTML = `
            <div class="instrument-icon ${iconClass}"></div>
            <div class="difficulty-bars">${barsHTML}</div>
          `;
          container.appendChild(difficultyElement);
        }
      });
    },
    generateLabels: (track) => {
      const labelContainer = document.createElement('div');
      labelContainer.classList.add('label-container');
      const labels = [
        { condition: track.new, class: 'new-label' },
        { condition: track.finish, class: 'finish-label' },
        { condition: track.featured, class: 'featured-label' },
      ];
      labels.forEach(({ condition, class: className }) => {
        if (condition) {
          const label = document.createElement('span');
          label.classList.add(className);
          label.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"></svg>';
          labelContainer.appendChild(label);
        }
      });
      return labelContainer;
    },
  };

  // Settings Menu
  const settingsModule = {
    toggleSettingsMenu: () => {
      if (!elements.settingsMenu || !elements.settingsButton) return;
      const isOpen = elements.settingsMenu.style.display === 'block';
      elements.settingsMenu.style.display = isOpen ? 'none' : 'block';
      elements.settingsButton.setAttribute('aria-expanded', !isOpen);
    },
    handleSettingsMenuClick: () => {
      if (!elements.settingsMenu) return;
      elements.settingsMenu.addEventListener('click', (e) => {
        const item = e.target.closest('li[data-setting]');
        if (!item) return;
        const setting = item.getAttribute('data-setting');
        if (setting === 'audio-fade') {
          state.fadeInAudioEnabled = !state.fadeInAudioEnabled;
          localStorage.setItem('fadeInAudioEnabled', state.fadeInAudioEnabled);
          uiModule.updateSettingsUI();
        } else if (setting === 'grid-size') {
          const gridSizeSpan = e.target.closest('span[data-grid-size]');
          if (gridSizeSpan) {
            state.gridSize = gridSizeSpan.getAttribute('data-grid-size');
            localStorage.setItem('gridSize', state.gridSize);
            uiModule.updateSettingsUI();
          }
        } else if (setting === 'text-glow') {
          state.textGlowEnabled = !state.textGlowEnabled;
          localStorage.setItem('textGlowEnabled', state.textGlowEnabled);
          uiModule.updateSettingsUI();
        } else if (setting === 'modal-glow') {
          state.modalGlowEnabled = !state.modalGlowEnabled;
          localStorage.setItem('modalGlowEnabled', state.modalGlowEnabled);
          uiModule.updateSettingsUI();
        } else if (setting === 'modal-info') {
          state.modalInfoEnabled = !state.modalInfoEnabled;
          localStorage.setItem('modalInfoEnabled', state.modalInfoEnabled);
          uiModule.updateSettingsUI();
          if (elements.modal.style.display === 'block' && state.currentTrackIndex >= 0) {
            modalModule.renderModal(state.currentFilteredTracks[state.currentTrackIndex]);
          }
        } else if (setting === 'reset') {
          localStorage.clear();
          location.reload();
        }
        settingsModule.toggleSettingsMenu();
      });
      
      // Handle modal info position dropdown change
      const modalInfoPositionSelect = elements.settingsMenu.querySelector('select[data-setting="modal-info-position"]');
      if (modalInfoPositionSelect) {
        modalInfoPositionSelect.addEventListener('change', (e) => {
          state.modalInfoPosition = e.target.value;
          localStorage.setItem('modalInfoPosition', state.modalInfoPosition);
          uiModule.updateSettingsUI();
          if (elements.modal.style.display === 'block' && state.currentTrackIndex >= 0) {
            modalModule.renderModal(state.currentFilteredTracks[state.currentTrackIndex]);
          }
        });
      }
    },
  };

  // Modal Events
  const eventModule = {
    init: () => {
      if (!elements.modal) return;
      elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) modalModule.closeModal();
      });
      const modalClose = elements.modal.querySelector('.modal-close');
      if (modalClose) modalClose.addEventListener('click', modalModule.closeModal);
      const modalPrev = elements.modal.querySelector('.modal-prev');
      if (modalPrev) modalPrev.addEventListener('click', () => modalModule.navigateModal(-1));
      const modalNext = elements.modal.querySelector('.modal-next');
      if (modalNext) modalNext.addEventListener('click', () => modalModule.navigateModal(1));
      
      // Handle hash changes (for direct URL access and browser navigation)
      window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (hash && hash.trim() !== '' && state.tracksData.length > 0) {
          const track = state.tracksData.find(t => 
            t.identifier && t.identifier.toLowerCase() === hash.toLowerCase()
          );
          if (track) {
            // Unmute audio for direct links (but not on mobile)
            if (!isMobile) {
              state.isMuted = false;
              audio.muted = false;
              localStorage.setItem('isMuted', 'false');
              uiModule.updateMuteIcon();
            }
            
            // Update the filtered tracks index
            state.currentTrackIndex = state.currentFilteredTracks.findIndex(
              (t) => t.title === track.title && t.artist === track.artist
            );
            if (state.currentTrackIndex === -1) {
              state.currentTrackIndex = 0;
            }
            modalModule.renderModal(track);
          }
        } else {
          // No hash or empty hash, close modal if open
          if (elements.modal.style.display === 'block') {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            audio.pause();
            audio.src = '';
            state.currentPreviewUrl = '';
            modalModule.stopGlowInterval();
          }
        }
      });
      
      document.addEventListener('keydown', (e) => {
        if (elements.modal.style.display === 'block') {
          switch (e.key) {
            case 'ArrowLeft':
              modalModule.navigateModal(-1);
              break;
            case 'ArrowRight':
              modalModule.navigateModal(1);
              break;
            case 'Escape':
              modalModule.closeModal();
              break;
            case 'm':
              audioModule.toggleMute();
              break;
          }
        }
        if (elements.settingsMenu?.style.display === 'block' && e.key === 'Escape') {
          settingsModule.toggleSettingsMenu();
          elements.settingsButton?.focus();
        }
        if (elements.videoPopup?.style.display === 'block' && e.key === 'Escape') {
          videoModule.closeVideoPopup();
          state.isMuted = false;
          audio.muted = false;
          uiModule.updateMuteIcon();
        }
      });

      if (elements.logo) elements.logo.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/';
      });
      if (elements.searchInput) elements.searchInput.addEventListener('input', utils.debounce(trackModule.filterTracks, 300));
      if (elements.sortSelect) elements.sortSelect.addEventListener('change', trackModule.filterTracks);
      if (elements.muteButton) elements.muteButton.addEventListener('click', audioModule.toggleMute);
      
      // Volume slider event listener
      if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', (e) => {
          // Direct mapping: slider value = volume (up = higher volume)
          const volume = parseInt(e.target.value, 10);
          audioModule.setVolume(volume);
        });
      }
      if (elements.shareButton) {
        elements.shareButton.addEventListener('click', () => {
          const hash = window.location.hash.slice(1);
          if (hash) {
            const shareUrl = `https://hiteriavillage.github.io/songs/${hash}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
              // Show feedback - change SVG to checkmark
              const svg = elements.shareButton.querySelector('svg');
              const originalPath = svg.innerHTML;
              svg.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
              elements.shareButton.title = 'Link copied!';
              setTimeout(() => {
                svg.innerHTML = originalPath;
                elements.shareButton.title = 'Share Link';
              }, 2000);
            }).catch(err => {
              console.error('Failed to copy link:', err);
              alert('Failed to copy link. Please try again.');
            });
          }
        });
      }
      if (elements.settingsButton) {
        elements.settingsButton.addEventListener('click', settingsModule.toggleSettingsMenu);
        elements.settingsButton.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            settingsModule.toggleSettingsMenu();
          }
        });
      }
      if (elements.settingsMenu) {
        elements.settingsMenu.addEventListener('keydown', (e) => {
          const items = elements.settingsMenu.querySelectorAll('li');
          const current = document.activeElement;
          const index = Array.from(items).indexOf(current);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(index + 1) % items.length].focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(index - 1 + items.length) % items.length].focus();
          } else if (e.key === 'Escape') {
            settingsModule.toggleSettingsMenu();
            elements.settingsButton?.focus();
          }
        });
      }
      if (elements.videoMenuButton) {
        elements.videoMenuButton.addEventListener('click', () => {
          const isOpen = elements.videoMenu?.style.display === 'block';
          if (elements.videoMenu) elements.videoMenu.style.display = isOpen ? 'none' : 'block';
          elements.videoMenuButton.setAttribute('aria-expanded', !isOpen);
        });
      }
      if (elements.videoPopupClose) elements.videoPopupClose.addEventListener('click', videoModule.closeVideoPopup);
      if (elements.videoPopup) {
        elements.videoPopup.addEventListener('click', (e) => {
          if (e.target === elements.videoPopup) videoModule.closeVideoPopup();
        });
      }
      if (elements.instrumentList) {
        elements.instrumentList.addEventListener('keydown', (e) => {
          const items = elements.instrumentList.querySelectorAll('li');
          const current = document.activeElement;
          const index = Array.from(items).indexOf(current);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(index + 1) % items.length].focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(index - 1 + items.length) % items.length].focus();
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            current.click();
          }
        });
      }
      document.addEventListener('click', (e) => {
        if (elements.settingsButton && elements.settingsMenu && !elements.settingsButton.contains(e.target) && !elements.settingsMenu.contains(e.target)) {
          elements.settingsMenu.style.display = 'none';
          elements.settingsButton.setAttribute('aria-expanded', 'false');
        }
        if (elements.videoMenuButton && elements.videoMenu && !elements.videoMenuButton.contains(e.target) && !elements.videoMenu.contains(e.target)) {
          elements.videoMenu.style.display = 'none';
          elements.videoMenuButton.setAttribute('aria-expanded', 'false');
        }
      });

      // Enhanced swipe navigation for mobile with swipe-down to exit
      let touchStartX = 0;
      let touchStartY = 0;
      let touchCurrentX = 0;
      let touchCurrentY = 0;
      let isDragging = false;
      let swipeDirection = null; // 'horizontal' or 'vertical'
      const modalContent = elements.modal.querySelector('.modal-content');
      
      elements.modal.addEventListener('touchstart', (e) => {
        // Don't interfere with video zoom
        if (e.target.classList.contains('modal-video')) {
          return;
        }
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchCurrentX = touchStartX;
        touchCurrentY = touchStartY;
        isDragging = false;
        swipeDirection = null;
      }, { passive: true });
      
      elements.modal.addEventListener('touchmove', (e) => {
        if (!touchStartX) return;
        
        touchCurrentX = e.touches[0].clientX;
        touchCurrentY = e.touches[0].clientY;
        const deltaX = touchCurrentX - touchStartX;
        const deltaY = touchCurrentY - touchStartY;
        
        // Determine swipe direction on first significant movement
        if (!swipeDirection && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            swipeDirection = 'horizontal';
          } else {
            swipeDirection = 'vertical';
          }
        }
        
        if (swipeDirection === 'horizontal' && Math.abs(deltaX) > 10) {
          isDragging = true;
          
          // Apply smooth transform during horizontal drag
          if (modalContent) {
            const opacity = 1 - Math.abs(deltaX) / 400;
            modalContent.style.transform = `translateX(${deltaX}px)`;
            modalContent.style.opacity = Math.max(0.5, opacity);
            modalContent.style.transition = 'none';
            modalContent.style.zIndex = '10000'; // Bring to front during swipe
          }
        } else if (swipeDirection === 'vertical' && deltaY > 10) {
          isDragging = true;
          
          // Apply smooth transform during vertical drag (only downward)
          if (modalContent) {
            const opacity = 1 - deltaY / 300;
            const scale = 1 - deltaY / 1000;
            modalContent.style.transform = `translateY(${deltaY}px) scale(${Math.max(0.8, scale)})`;
            modalContent.style.opacity = Math.max(0.3, opacity);
            modalContent.style.transition = 'none';
            modalContent.style.zIndex = '10000'; // Bring to front during swipe
          }
        }
      }, { passive: true });
      
      elements.modal.addEventListener('touchend', (e) => {
        if (!touchStartX) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Reset transform
        if (modalContent) {
          modalContent.style.transition = 'transform 0.3s ease, opacity 0.3s ease, z-index 0s';
          modalContent.style.transform = '';
          modalContent.style.opacity = '';
          
          // Reset z-index after transition
          setTimeout(() => {
            if (modalContent) {
              modalContent.style.zIndex = '';
            }
          }, 300);
        }
        
        if (isDragging) {
          if (swipeDirection === 'horizontal' && Math.abs(deltaX) > 80) {
            // Horizontal swipe - navigate tracks
            setTimeout(() => {
              if (deltaX < 0) {
                // Swipe left - next track
                modalModule.navigateModal(1);
              } else {
                // Swipe right - previous track
                modalModule.navigateModal(-1);
              }
            }, 100);
          } else if (swipeDirection === 'vertical' && deltaY > 100) {
            // Vertical swipe down - close modal
            setTimeout(() => {
              modalModule.closeModal();
            }, 100);
          }
        }
        
        touchStartX = 0;
        touchStartY = 0;
        touchCurrentX = 0;
        touchCurrentY = 0;
        isDragging = false;
        swipeDirection = null;
      }, { passive: true });
    },
  };

  // Initialization
  const init = () => {
    youtubeModule.init();
    settingsModule.handleSettingsMenuClick();
    eventModule.init();
    uiModule.updateSettingsUI();
    
    // Initialize volume from localStorage
    audioModule.initializeVolume();
    
    utils.fetchWithRetry(`data/tracks.json?_=${Date.now()}`)
      .then((data) => {
        state.tracksData = Object.entries(data).map(([identifier, track], index) => ({
          ...track,
          identifier: identifier,
          creationIndex: index
        }));
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('q')) elements.searchInput.value = urlParams.get('q');
        if (urlParams.get('sort')) {
          elements.sortSelect.value = urlParams.get('sort');
        } else {
          elements.sortSelect.value = 'latest';
        }
        trackModule.filterTracks();
        
        const hash = window.location.hash.slice(1);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (hash && (!isMobile || hash.trim() !== '')) {
          const track = state.tracksData.find(t => 
            t.identifier && t.identifier.toLowerCase() === hash.toLowerCase()
          );
          
          if (track) {
            state.isMuted = false;
            audio.muted = false;
            localStorage.setItem('isMuted', 'false');
            uiModule.updateMuteIcon();
            
            setTimeout(() => {
              modalModule.openModal(track);
              
              if (!state.isMuted) {
                setTimeout(() => {
                  const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  document.body.dispatchEvent(clickEvent);
                  
                  if (!audio.paused) {
                    console.log('Audio already playing');
                  } else {
                    audio.play()
                      .then(() => {
                        console.log('Audio started after simulated interaction');
                        if (state.fadeInAudioEnabled) {
                          audioModule.fadeInAudio(audio, 0.25, 3000);
                        } else {
                          audio.volume = 0.25;
                        }
                      })
                      .catch(err => console.log('Simulated interaction play failed:', err));
                  }
                }, 200);
              }
            }, 100);
          }
        }
      })
      .catch((error) => {
        console.error('Failed to load tracks:', error);
        if (elements.content) elements.content.innerHTML = '<p>Error loading tracks. Please try again later.</p>';
      });

    window.addEventListener('unload', () => {
      if (intersectionObserver) intersectionObserver.disconnect();
      if (player) player.destroy();
    });
  };

  init();
});