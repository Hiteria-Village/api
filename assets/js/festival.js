// Festival Page JavaScript
class FestivalPage {
    constructor() {
        this.tracks = {};
        this.selectedTracks = new Set();
        this.currentBackground = 'festival';
        this.currentLayout = 'grid';
        this.gridColumns = 2;
        this.cardSize = 400;
        this.contentScale = 100;
        this.textSize = 100;
        this.gridGap = 30;
        this.gridGapHorizontal = 30;
        this.gridGapVertical = 30;
        this.verticalPosition = 50;
        this.horizontalScroll = 0;
        this.customText = '';
        this.showCustomText = true;
        this.exportWidth = 1280;
        this.exportHeight = 1280;
        this.init();
    }

    async init() {
        await this.loadTracks();
        this.setupEventListeners();
        this.populateTrackSelector();
        this.loadSettings();
        this.renderTracks();
    }

    async loadTracks() {
        try {
            const response = await fetch('data/tracks.json');
            this.tracks = await response.json();
            
            // Select all tracks by default
            Object.keys(this.tracks).forEach(trackId => {
                this.selectedTracks.add(trackId);
            });
        } catch (error) {
            console.error('Error loading tracks:', error);
        }
    }

    setupEventListeners() {
        // Settings panel toggle
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.toggleSettings();
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            this.hideSettings();
        });

        // Background options
        document.querySelectorAll('.bg-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setBackground(e.target.dataset.bg);
            });
        });

        // Layout options
        document.querySelectorAll('.layout-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setLayout(e.target.dataset.layout);
            });
        });

        // Grid size controls
        document.getElementById('columns-slider').addEventListener('input', (e) => {
            this.setGridColumns(parseInt(e.target.value));
        });

        document.getElementById('card-size-slider').addEventListener('input', (e) => {
            this.setCardSize(parseInt(e.target.value));
        });

        document.getElementById('content-scale-slider').addEventListener('input', (e) => {
            this.setContentScale(parseInt(e.target.value));
        });

        document.getElementById('text-size-slider').addEventListener('input', (e) => {
            this.setTextSize(parseInt(e.target.value));
        });

        document.getElementById('grid-gap-horizontal-slider').addEventListener('input', (e) => {
            this.setGridGapHorizontal(parseInt(e.target.value));
        });

        document.getElementById('grid-gap-vertical-slider').addEventListener('input', (e) => {
            this.setGridGapVertical(parseInt(e.target.value));
        });

        document.getElementById('vertical-position-slider').addEventListener('input', (e) => {
            this.setVerticalPosition(parseInt(e.target.value));
        });

        document.getElementById('horizontal-scroll-slider').addEventListener('input', (e) => {
            this.setHorizontalScroll(parseInt(e.target.value));
        });

        // Custom text controls
        document.getElementById('custom-text-input').addEventListener('input', (e) => {
            this.setCustomText(e.target.value);
        });

        document.getElementById('show-custom-text').addEventListener('change', (e) => {
            this.toggleCustomText(e.target.checked);
        });

        // Resolution controls
        document.getElementById('export-width-slider').addEventListener('input', (e) => {
            this.setExportWidth(parseInt(e.target.value));
        });

        document.getElementById('export-height-slider').addEventListener('input', (e) => {
            this.setExportHeight(parseInt(e.target.value));
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const width = parseInt(e.target.dataset.width);
                const height = parseInt(e.target.dataset.height);
                this.setExportResolution(width, height);
                
                // Check if this is the custom preset with additional parameters
                if (e.target.classList.contains('preset-custom')) {
                    const hscroll = parseInt(e.target.dataset.hscroll);
                    const vpos = parseInt(e.target.dataset.vpos);
                    const spacing = parseInt(e.target.dataset.spacing);
                    const scale = parseInt(e.target.dataset.scale);
                    const cardsize = parseInt(e.target.dataset.cardsize);
                    const columns = parseInt(e.target.dataset.columns);
                    
                    // Apply all custom settings
                    this.setHorizontalScroll(hscroll);
                    this.setVerticalPosition(vpos);
                    this.setGridGap(spacing);
                    this.setContentScale(scale);
                    this.setCardSize(cardsize);
                    this.setGridColumns(columns);
                    
                    // Update UI sliders
                    document.getElementById('horizontal-scroll-slider').value = hscroll;
                    document.getElementById('vertical-position-slider').value = vpos;
                    document.getElementById('grid-gap-slider').value = spacing;
                    document.getElementById('content-scale-slider').value = scale;
                    document.getElementById('card-size-slider').value = cardsize;
                    document.getElementById('columns-slider').value = columns;
                }
            });
        });

        // Export controls
        document.getElementById('generate-gif').addEventListener('click', () => {
            this.generateGIF();
        });

        document.getElementById('download-image').addEventListener('click', () => {
            this.downloadImage();
        });

        // Custom background colors
        document.getElementById('bg-color1').addEventListener('change', () => {
            this.updateCustomBackground();
        });

        document.getElementById('bg-color2').addEventListener('change', () => {
            this.updateCustomBackground();
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('track-modal').addEventListener('click', (e) => {
            if (e.target.id === 'track-modal') {
                this.hideModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                this.hideSettings();
            }
        });
    }

    populateTrackSelector() {
        const selector = document.getElementById('track-selector');
        selector.innerHTML = '';

        Object.entries(this.tracks).forEach(([trackId, track]) => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'track-checkbox';
            
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="track-${trackId}" ${this.selectedTracks.has(trackId) ? 'checked' : ''}>
                <label for="track-${trackId}">
                    <strong>${track.title}</strong><br>
                    <small>${track.artist}</small>
                </label>
            `;

            const checkbox = checkboxDiv.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedTracks.add(trackId);
                } else {
                    this.selectedTracks.delete(trackId);
                }
                this.renderTracks();
                this.saveSettings();
            });

            selector.appendChild(checkboxDiv);
        });
    }

    renderTracks() {
        const grid = document.getElementById('track-grid');
        grid.innerHTML = '';
        grid.className = `track-grid layout-${this.currentLayout}`;
        
        // Set CSS custom properties for grid
        document.documentElement.style.setProperty('--grid-columns', this.gridColumns);
        document.documentElement.style.setProperty('--card-size', `${this.cardSize}px`);
        document.documentElement.style.setProperty('--vertical-position', `${(this.verticalPosition - 50) * 2}px`);
        document.documentElement.style.setProperty('--horizontal-scroll', `${this.horizontalScroll}px`);
        document.documentElement.style.setProperty('--grid-gap-horizontal', `${this.gridGapHorizontal}px`);
        document.documentElement.style.setProperty('--grid-gap-vertical', `${this.gridGapVertical}px`);

        this.selectedTracks.forEach(trackId => {
            const track = this.tracks[trackId];
            if (!track) return;

            const trackCard = document.createElement('div');
            trackCard.className = 'track-card';
            trackCard.dataset.trackId = trackId;

            trackCard.innerHTML = `
                <img src="assets/covers/${track.cover}" alt="${track.title}" class="track-cover" onerror="this.src='assets/images/logo.png'">
                <div class="track-info">
                    <h3>${track.title}</h3>
                    <p>${track.artist}</p>
                    <div class="track-meta">
                        <span>${track.duration} | ${track.releaseYear}</span>
                    </div>
                </div>
            `;

            // Apply glow colors from track's modalShadowColors
            if (track.modalShadowColors && track.modalShadowColors.default) {
                const color1 = track.modalShadowColors.default.color1;
                const color2 = track.modalShadowColors.default.color2;
                
                trackCard.style.setProperty('--glow-color1', this.hexToRgba(color1, 0.6));
                trackCard.style.setProperty('--glow-color2', this.hexToRgba(color2, 0.4));
                
                const img = trackCard.querySelector('.track-cover');
                img.classList.add('glow');
            }

            trackCard.addEventListener('click', () => {
                this.showTrackModal(trackId);
            });

            grid.appendChild(trackCard);
        });

        // Update custom text display
        this.updateCustomTextDisplay();
    }

    showTrackModal(trackId) {
        const track = this.tracks[trackId];
        if (!track) return;

        const modal = document.getElementById('track-modal');
        const modalBody = modal.querySelector('.modal-body');

        modalBody.innerHTML = `
            <div class="modal-track-info">
                <img src="assets/images/covers/${track.cover}" alt="${track.title}" class="modal-cover" onerror="this.src='assets/images/covers/default.png'">
                <div class="modal-details">
                    <h2>${track.title}</h2>
                    <p class="modal-artist">${track.artist}</p>
                    <div class="modal-meta">
                        <div class="meta-item">
                            <strong>Album:</strong> ${track.album}
                        </div>
                        <div class="meta-item">
                            <strong>Genre:</strong> ${track.genre}
                        </div>
                        <div class="meta-item">
                            <strong>Duration:</strong> ${track.duration}
                        </div>
                        <div class="meta-item">
                            <strong>BPM:</strong> ${track.bpm}
                        </div>
                        <div class="meta-item">
                            <strong>Charter:</strong> ${track.charter}
                        </div>
                        <div class="meta-item">
                            <strong>Key:</strong> ${track.key}
                        </div>
                        <div class="meta-item">
                            <strong>Release Year:</strong> ${track.releaseYear}
                        </div>
                    </div>
                    
                    <div class="difficulties">
                        <h3>Difficulties</h3>
                        <div class="difficulty-grid">
                            ${Object.entries(track.difficulties).map(([instrument, difficulty]) => {
                                if (difficulty === -1) return '';
                                return `
                                    <div class="difficulty-item">
                                        <span class="instrument">${instrument.charAt(0).toUpperCase() + instrument.slice(1)}</span>
                                        <span class="difficulty-stars">${'★'.repeat(difficulty)}${'☆'.repeat(6-difficulty)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    ${track.previewUrl ? `
                        <div class="audio-preview">
                            <audio controls>
                                <source src="${track.previewUrl}" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('visible');
    }

    hideModal() {
        const modal = document.getElementById('track-modal');
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    toggleSettings() {
        const panel = document.getElementById('settings-panel');
        panel.classList.toggle('visible');
        panel.classList.toggle('hidden');
    }

    hideSettings() {
        const panel = document.getElementById('settings-panel');
        panel.classList.remove('visible');
        panel.classList.add('hidden');
    }

    setBackground(bgType) {
        // Update active button
        document.querySelectorAll('.bg-option').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-bg="${bgType}"]`).classList.add('active');

        // Show/hide custom controls
        const customControls = document.getElementById('custom-bg-controls');
        if (bgType === 'custom') {
            customControls.classList.remove('hidden');
        } else {
            customControls.classList.add('hidden');
        }

        this.currentBackground = bgType;
        this.updateBackground();
        this.saveSettings();
    }

    updateBackground() {
        const bg = document.getElementById('animated-background');
        bg.className = '';
        bg.classList.add(this.currentBackground);

        if (this.currentBackground === 'custom') {
            this.updateCustomBackground();
        }
    }

    updateCustomBackground() {
        const color1 = document.getElementById('bg-color1').value;
        const color2 = document.getElementById('bg-color2').value;
        const bg = document.getElementById('animated-background');
        
        document.documentElement.style.setProperty('--bg-color1', color1);
        document.documentElement.style.setProperty('--bg-color2', color2);
        
        bg.style.background = `linear-gradient(45deg, ${color1}, ${color2})`;
        this.saveSettings();
    }

    setGridColumns(columns) {
        this.gridColumns = columns;
        document.getElementById('columns-value').textContent = columns;
        this.renderTracks();
        this.saveSettings();
    }

    setCardSize(size) {
        this.cardSize = size;
        document.getElementById('card-size-value').textContent = `${size}px`;
        this.renderTracks();
        this.saveSettings();
    }

    setContentScale(scale) {
        this.contentScale = scale;
        document.getElementById('content-scale-value').textContent = `${scale}%`;
        document.documentElement.style.setProperty('--content-scale', scale / 100);
        this.saveSettings();
    }

    setTextSize(size) {
        this.textSize = size;
        document.getElementById('text-size-value').textContent = `${size}%`;
        document.documentElement.style.setProperty('--text-size', size / 100);
        this.saveSettings();
    }

    setGridGap(gap) {
        this.gridGap = gap;
        this.gridGapHorizontal = gap;
        this.gridGapVertical = gap;
        const hSlider = document.getElementById('grid-gap-horizontal-slider');
        const vSlider = document.getElementById('grid-gap-vertical-slider');
        const hValue = document.getElementById('grid-gap-horizontal-value');
        const vValue = document.getElementById('grid-gap-vertical-value');
        
        if (hSlider) hSlider.value = gap;
        if (vSlider) vSlider.value = gap;
        if (hValue) hValue.textContent = `${gap}px`;
        if (vValue) vValue.textContent = `${gap}px`;
        
        document.documentElement.style.setProperty('--grid-gap-horizontal', `${gap}px`);
        document.documentElement.style.setProperty('--grid-gap-vertical', `${gap}px`);
        this.saveSettings();
    }

    setGridGapHorizontal(gap) {
        this.gridGapHorizontal = gap;
        document.getElementById('grid-gap-horizontal-value').textContent = `${gap}px`;
        document.documentElement.style.setProperty('--grid-gap-horizontal', `${gap}px`);
        this.saveSettings();
    }

    setGridGapVertical(gap) {
        this.gridGapVertical = gap;
        document.getElementById('grid-gap-vertical-value').textContent = `${gap}px`;
        document.documentElement.style.setProperty('--grid-gap-vertical', `${gap}px`);
        this.saveSettings();
    }

    setVerticalPosition(position) {
        this.verticalPosition = position;
        document.getElementById('vertical-position-value').textContent = `${position}%`;
        document.documentElement.style.setProperty('--vertical-position', `${(position - 50) * 2}px`);
        this.saveSettings();
    }

    setHorizontalScroll(scroll) {
        this.horizontalScroll = scroll;
        document.getElementById('horizontal-scroll-value').textContent = `${scroll}px`;
        document.documentElement.style.setProperty('--horizontal-scroll', `${scroll}px`);
        this.saveSettings();
    }

    setCustomText(text) {
        this.customText = text;
        this.updateCustomTextDisplay();
        this.saveSettings();
    }

    toggleCustomText(show) {
        this.showCustomText = show;
        this.updateCustomTextDisplay();
        this.saveSettings();
    }

    updateCustomTextDisplay() {
        const display = document.getElementById('custom-text-display');
        
        if (this.showCustomText && this.customText.trim()) {
            display.textContent = this.customText;
            display.classList.add('visible');
            display.classList.remove('hidden');
        } else {
            display.classList.remove('visible');
            display.classList.add('hidden');
        }
    }

    setExportWidth(width) {
        this.exportWidth = width;
        document.getElementById('export-width-value').textContent = `${width}px`;
        this.saveSettings();
    }

    setExportHeight(height) {
        this.exportHeight = height;
        document.getElementById('export-height-value').textContent = `${height}px`;
        this.saveSettings();
    }

    setExportResolution(width, height) {
        this.exportWidth = width;
        this.exportHeight = height;
        document.getElementById('export-width-slider').value = width;
        document.getElementById('export-height-slider').value = height;
        document.getElementById('export-width-value').textContent = `${width}px`;
        document.getElementById('export-height-value').textContent = `${height}px`;
        this.saveSettings();
    }

    async generateGIF() {
        const button = document.getElementById('generate-gif');
        button.disabled = true;
        button.textContent = 'Generating...';

        try {
            // Show loading overlay
            this.showLoadingOverlay('Loading libraries...');

            // Import gif.js library dynamically
            if (!window.GIF) {
                await this.loadGifJS();
            }

            this.updateLoadingOverlay('Preparing capture...');

            // Hide UI elements for capture (but keep layout)
            document.body.classList.add('capture-mode');
            this.hideSettings();

            // Wait a moment for UI to update
            await new Promise(resolve => setTimeout(resolve, 500));

            const gif = new window.GIF({
                workers: 0, // Disable workers to avoid CORS issues
                quality: 30, // Higher quality number = lower quality but much faster processing
                width: this.exportWidth,
                height: this.exportHeight,
                repeat: 0, // Loop infinitely
                debug: false
            });

            // Capture fewer frames for better performance
            const frameDelay = 300; // 300ms per frame
            const forwardFrames = 5; // Only 5 frames forward (1.5 seconds)
            
            const frames = [];

            this.updateLoadingOverlay('Capturing frames...');

            // Capture forward frames
            for (let i = 0; i < forwardFrames; i++) {
                try {
                    this.updateLoadingOverlay(`Capturing frame ${i + 1}/${forwardFrames}...`);
                    const canvas = await this.captureToCanvas();
                    frames.push(canvas);
                    
                    // Small delay between captures
                    if (i < forwardFrames - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error('Error capturing frame:', error);
                    throw new Error(`Failed to capture frame ${i + 1}: ${error.message}`);
                }
            }

            if (frames.length === 0) {
                throw new Error('No frames captured');
            }

            this.updateLoadingOverlay('Processing GIF...');

            // Add forward frames to GIF
            frames.forEach((frame, index) => {
                gif.addFrame(frame, { delay: frameDelay });
            });

            // Add reverse frames (excluding first and last to avoid duplication)
            for (let i = frames.length - 2; i > 0; i--) {
                gif.addFrame(frames[i], { delay: frameDelay });
            }

            // Remove timeout - let it run as long as needed
            gif.on('finished', (blob) => {
                // Restore UI elements
                document.body.classList.remove('capture-mode');
                
                this.hideLoadingOverlay();
                this.downloadBlob(blob, 'hiteria-octave-tracks.gif');
                button.disabled = false;
                button.textContent = 'Generate GIF';
            });

            gif.on('progress', (p) => {
                const percent = Math.round(p * 100);
                this.updateLoadingOverlay(`Generating GIF... ${percent}%`);
            });

            // Start rendering without timeout
            gif.render();

        } catch (error) {
            console.error('Error generating GIF:', error);
            document.body.classList.remove('capture-mode');
            this.hideLoadingOverlay();
            button.disabled = false;
            button.textContent = 'Generate GIF';
            
            // Offer multiple fallback options
            const choice = confirm(`GIF generation failed: ${error.message}\n\nClick OK to try a simple animation, or Cancel to download a static image.`);
            if (choice) {
                this.generateSimpleGIF();
            } else {
                this.downloadImage();
            }
        }
    }

    async downloadImage() {
        const button = document.getElementById('download-image');
        button.disabled = true;
        button.textContent = 'Capturing...';

        try {
            // Hide UI elements for capture (but keep layout)
            document.body.classList.add('capture-mode');
            this.hideSettings();
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await this.captureToCanvas();
            canvas.toBlob((blob) => {
                // Restore UI elements
                document.body.classList.remove('capture-mode');
                
                this.downloadBlob(blob, 'hiteria-octave-tracks.png');
                button.disabled = false;
                button.textContent = 'Download Image';
            });

        } catch (error) {
            console.error('Error capturing image:', error);
            document.body.classList.remove('capture-mode');
            button.disabled = false;
            button.textContent = 'Download Image';
            alert('Error capturing image. Please try again.');
        }
    }

    async captureToCanvas() {
        // Import html2canvas dynamically
        if (!window.html2canvas) {
            await this.loadHtml2Canvas();
        }

        // Temporarily remove transform-based scaling and apply it via actual size changes
        const trackCards = document.querySelectorAll('.track-card');
        const originalTransforms = [];
        
        trackCards.forEach((card, index) => {
            originalTransforms[index] = card.style.transform;
            card.style.transform = 'none';
            
            // Apply scale by changing actual dimensions
            const currentScale = this.contentScale / 100;
            card.style.width = `${parseFloat(getComputedStyle(card).width) * currentScale}px`;
            card.style.height = `${parseFloat(getComputedStyle(card).height) * currentScale}px`;
            
            // Scale children too
            const cover = card.querySelector('.track-cover');
            const info = card.querySelector('.track-info');
            if (cover) {
                cover.style.width = `${120 * currentScale}px`;
                cover.style.height = `${120 * currentScale}px`;
            }
            if (info) {
                info.style.fontSize = `${currentScale}em`;
            }
        });

        // Wait for layout to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Calculate scale to achieve target resolution while maintaining aspect ratio
        const scaleX = this.exportWidth / window.innerWidth;
        const scaleY = this.exportHeight / window.innerHeight;
        const scale = Math.max(scaleX, scaleY); // Use max to ensure it fills the canvas
        
        // Capture the page content at the calculated scale
        const sourceCanvas = await html2canvas(document.body, {
            backgroundColor: '#000000',
            scale: scale,
            useCORS: false,
            allowTaint: true,
            logging: false,
            removeContainer: false,
            foreignObjectRendering: false,
            ignoreElements: (element) => {
                return element.classList.contains('settings-panel') || 
                       element.classList.contains('loading-overlay') ||
                       element.classList.contains('modal') ||
                       element.tagName === 'SCRIPT' ||
                       element.tagName === 'STYLE';
            }
        });

        // Restore original transforms and styles
        trackCards.forEach((card, index) => {
            card.style.transform = originalTransforms[index];
            card.style.width = '';
            card.style.height = '';
            
            const cover = card.querySelector('.track-cover');
            const info = card.querySelector('.track-info');
            if (cover) {
                cover.style.width = '';
                cover.style.height = '';
            }
            if (info) {
                info.style.fontSize = '';
            }
        });

        // Create output canvas with exact export dimensions
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = this.exportWidth;
        outputCanvas.height = this.exportHeight;
        const ctx = outputCanvas.getContext('2d');

        // Calculate crop position to center the content
        const cropX = (sourceCanvas.width - this.exportWidth) / 2;
        const cropY = (sourceCanvas.height - this.exportHeight) / 2;

        // Draw the cropped portion of the source canvas
        ctx.drawImage(sourceCanvas, 
                     cropX, cropY, this.exportWidth, this.exportHeight,
                     0, 0, this.exportWidth, this.exportHeight);

        // Add logo in the top-left corner
        try {
            const logo = document.querySelector('.header-logo');
            if (logo && logo.complete) {
                const logoSize = 60; // Size of logo in pixels
                const logoPadding = 20; // Padding from corner
                
                ctx.drawImage(logo, 
                             logoPadding, logoPadding, 
                             logoSize, logoSize);
            }
        } catch (error) {
            console.warn('Could not add logo to export:', error);
        }

        return outputCanvas;
    }

    async generateSimpleGIF() {
        const button = document.getElementById('generate-gif');
        button.disabled = true;
        button.textContent = 'Creating Images...';

        try {
            this.showLoadingOverlay('Creating image sequence...');

            // Hide UI elements for capture
            document.body.classList.add('capture-mode');
            this.hideSettings();
            await new Promise(resolve => setTimeout(resolve, 300));

            // Just capture one high-quality image instead of trying to make a GIF
            this.updateLoadingOverlay('Capturing high-quality image...');
            const canvas = await this.captureToCanvas();

            // Convert to blob and download
            canvas.toBlob((blob) => {
                document.body.classList.remove('capture-mode');
                this.hideLoadingOverlay();
                this.downloadBlob(blob, 'hiteria-octave-tracks.png');
                button.disabled = false;
                button.textContent = 'Generate GIF';
            }, 'image/png', 1.0);

        } catch (error) {
            console.error('Error generating image:', error);
            document.body.classList.remove('capture-mode');
            this.hideLoadingOverlay();
            button.disabled = false;
            button.textContent = 'Generate GIF';
            alert(`Image generation failed: ${error.message}`);
        }
    }

    async loadGifJS() {
        return new Promise((resolve, reject) => {
            if (window.GIF) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
            script.onload = () => {
                console.log('GIF.js loaded successfully');
                resolve();
            };
            script.onerror = (error) => {
                console.error('Failed to load GIF.js:', error);
                reject(new Error('Failed to load GIF.js library'));
            };
            document.head.appendChild(script);
        });
    }

    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => {
                console.log('html2canvas loaded successfully');
                resolve();
            };
            script.onerror = (error) => {
                console.error('Failed to load html2canvas:', error);
                reject(new Error('Failed to load html2canvas library'));
            };
            document.head.appendChild(script);
        });
    }

    showLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p id="loading-message">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    updateLoadingOverlay(message) {
        const messageElement = document.getElementById('loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    hideLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    saveSettings() {
        const settings = {
            selectedTracks: Array.from(this.selectedTracks),
            background: this.currentBackground,
            layout: this.currentLayout,
            gridColumns: this.gridColumns,
            cardSize: this.cardSize,
            contentScale: this.contentScale,
            textSize: this.textSize,
            gridGap: this.gridGap,
            gridGapHorizontal: this.gridGapHorizontal,
            gridGapVertical: this.gridGapVertical,
            verticalPosition: this.verticalPosition,
            horizontalScroll: this.horizontalScroll,
            customText: this.customText,
            showCustomText: this.showCustomText,
            exportWidth: this.exportWidth,
            exportHeight: this.exportHeight,
            customColors: {
                color1: document.getElementById('bg-color1').value,
                color2: document.getElementById('bg-color2').value
            }
        };
        localStorage.setItem('festivalSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('festivalSettings');
        if (!saved) return;

        try {
            const settings = JSON.parse(saved);
            
            if (settings.selectedTracks) {
                this.selectedTracks = new Set(settings.selectedTracks);
            }
            
            if (settings.background) {
                this.setBackground(settings.background);
            }
            
            if (settings.layout) {
                this.setLayout(settings.layout);
            }

            if (settings.gridColumns) {
                this.gridColumns = settings.gridColumns;
                document.getElementById('columns-slider').value = settings.gridColumns;
                document.getElementById('columns-value').textContent = settings.gridColumns;
            }

            if (settings.cardSize) {
                this.cardSize = settings.cardSize;
                document.getElementById('card-size-slider').value = settings.cardSize;
                document.getElementById('card-size-value').textContent = `${settings.cardSize}px`;
            }

            if (settings.contentScale !== undefined) {
                this.contentScale = settings.contentScale;
                document.getElementById('content-scale-slider').value = settings.contentScale;
                document.getElementById('content-scale-value').textContent = `${settings.contentScale}%`;
                document.documentElement.style.setProperty('--content-scale', settings.contentScale / 100);
            }

            if (settings.textSize !== undefined) {
                this.textSize = settings.textSize;
                document.getElementById('text-size-slider').value = settings.textSize;
                document.getElementById('text-size-value').textContent = `${settings.textSize}%`;
                document.documentElement.style.setProperty('--text-size', settings.textSize / 100);
            }

            if (settings.gridGap !== undefined) {
                this.gridGap = settings.gridGap;
                document.getElementById('grid-gap-slider').value = settings.gridGap;
                document.getElementById('grid-gap-value').textContent = `${settings.gridGap}px`;
                document.documentElement.style.setProperty('--grid-gap', `${settings.gridGap}px`);
            }

            if (settings.gridGapHorizontal !== undefined) {
                this.gridGapHorizontal = settings.gridGapHorizontal;
                const hSlider = document.getElementById('grid-gap-horizontal-slider');
                const hValue = document.getElementById('grid-gap-horizontal-value');
                if (hSlider) hSlider.value = settings.gridGapHorizontal;
                if (hValue) hValue.textContent = `${settings.gridGapHorizontal}px`;
                document.documentElement.style.setProperty('--grid-gap-horizontal', `${settings.gridGapHorizontal}px`);
            }

            if (settings.gridGapVertical !== undefined) {
                this.gridGapVertical = settings.gridGapVertical;
                const vSlider = document.getElementById('grid-gap-vertical-slider');
                const vValue = document.getElementById('grid-gap-vertical-value');
                if (vSlider) vSlider.value = settings.gridGapVertical;
                if (vValue) vValue.textContent = `${settings.gridGapVertical}px`;
                document.documentElement.style.setProperty('--grid-gap-vertical', `${settings.gridGapVertical}px`);
            }
            
            if (settings.verticalPosition !== undefined) {
                this.verticalPosition = settings.verticalPosition;
                document.getElementById('vertical-position-slider').value = settings.verticalPosition;
                document.getElementById('vertical-position-value').textContent = `${settings.verticalPosition}%`;
                document.documentElement.style.setProperty('--vertical-position', `${(settings.verticalPosition - 50) * 2}px`);
            }

            if (settings.horizontalScroll !== undefined) {
                this.horizontalScroll = settings.horizontalScroll;
                document.getElementById('horizontal-scroll-slider').value = settings.horizontalScroll;
                document.getElementById('horizontal-scroll-value').textContent = `${settings.horizontalScroll}px`;
                document.documentElement.style.setProperty('--horizontal-scroll', `${settings.horizontalScroll}px`);
            }
            
            if (settings.customColors) {
                document.getElementById('bg-color1').value = settings.customColors.color1;
                document.getElementById('bg-color2').value = settings.customColors.color2;
            }

            if (settings.customText !== undefined) {
                this.customText = settings.customText;
                document.getElementById('custom-text-input').value = settings.customText;
            }

            if (settings.showCustomText !== undefined) {
                this.showCustomText = settings.showCustomText;
                document.getElementById('show-custom-text').checked = settings.showCustomText;
            }

            if (settings.exportWidth !== undefined) {
                this.exportWidth = settings.exportWidth;
                document.getElementById('export-width-slider').value = settings.exportWidth;
                document.getElementById('export-width-value').textContent = `${settings.exportWidth}px`;
            }

            if (settings.exportHeight !== undefined) {
                this.exportHeight = settings.exportHeight;
                document.getElementById('export-height-slider').value = settings.exportHeight;
                document.getElementById('export-height-value').textContent = `${settings.exportHeight}px`;
            }

            this.updateCustomTextDisplay();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Initialize the festival page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FestivalPage();
});

// Add additional CSS for modal content
const additionalCSS = `
.modal-track-info {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.modal-cover {
    width: 200px;
    height: 200px;
    border-radius: 15px;
    object-fit: cover;
    flex-shrink: 0;
}

.modal-details {
    flex: 1;
}

.modal-details h2 {
    font-size: 2rem;
    margin-bottom: 10px;
    color: #fff;
}

.modal-artist {
    font-size: 1.2rem;
    opacity: 0.8;
    margin-bottom: 20px;
}

.modal-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
}

.meta-item {
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 8px;
}

.difficulties h3 {
    margin-bottom: 15px;
    color: #fff;
}

.difficulty-grid {
    display: grid;
    gap: 8px;
}

.difficulty-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    padding: 8px 12px;
    border-radius: 6px;
}

.instrument {
    text-transform: capitalize;
    font-weight: 500;
}

.difficulty-stars {
    color: #ffd700;
    font-size: 1.1rem;
}

.audio-preview {
    margin-top: 20px;
}

.audio-preview audio {
    width: 100%;
    border-radius: 8px;
}

.layout-list .track-grid {
    grid-template-columns: 1fr;
    max-width: 800px;
}

.layout-list .track-card {
    display: flex;
    align-items: center;
    gap: 20px;
}

.layout-list .track-cover {
    width: 100px;
    height: 100px;
    margin-bottom: 0;
}

.layout-carousel .track-grid {
    display: flex;
    overflow-x: auto;
    gap: 20px;
    padding-bottom: 20px;
}

.layout-carousel .track-card {
    min-width: 300px;
    flex-shrink: 0;
}

@media (max-width: 768px) {
    .modal-track-info {
        flex-direction: column;
        text-align: center;
    }
    
    .modal-cover {
        width: 150px;
        height: 150px;
        margin: 0 auto;
    }
    
    .modal-meta {
        grid-template-columns: 1fr;
    }
}
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);