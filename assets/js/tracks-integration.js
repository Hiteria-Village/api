/**
 * Integration script for Spotify-like corner player
 * This provides the corner audio player functionality for hiteriavillage.github.io
 * Play buttons have been removed from track grid - only corner player remains
 */

// Wait for the existing scripts to load and DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the existing scripts to initialize
    setTimeout(() => {
        initializeTrackPlayButtons();
    }, 1000);
});

function initializeTrackPlayButtons() {
    console.log('Track play buttons disabled - no buttons will be added to grid');
    // Play buttons have been removed from track grid objects
    // Only the corner Spotify player remains available
}

function addPlayButtonsToTracks() {
    // Function disabled - no play buttons added to track grid
    console.log('Play buttons disabled for track grid');
}

function createPlayButton(trackIndex) {
    const playButton = document.createElement('button');
    playButton.className = 'spotify-play-btn';
    playButton.title = 'Play with Spotify Player';
    playButton.setAttribute('aria-label', 'Play song in Spotify player');
    
    playButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 16 16" fill="white">
            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
        </svg>
    `;
    
    // Add styles
    playButton.style.cssText = `
        background: rgba(30, 215, 96, 0.8);
        border: none;
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
        box-shadow: 0 2px 8px rgba(30, 215, 96, 0.3);
    `;
    
    // Add hover effect
    playButton.addEventListener('mouseenter', () => {
        playButton.style.background = 'rgba(30, 215, 96, 1)';
        playButton.style.transform = 'scale(1.05)';
        playButton.style.boxShadow = '0 4px 12px rgba(30, 215, 96, 0.5)';
    });
    
    playButton.addEventListener('mouseleave', () => {
        playButton.style.background = 'rgba(30, 215, 96, 0.8)';
        playButton.style.transform = 'scale(1)';
        playButton.style.boxShadow = '0 2px 8px rgba(30, 215, 96, 0.3)';
    });
    
    // Add click handler
    playButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get song info from the streaming server
        playTrackFromStreaming(trackIndex);
    });
    
    return playButton;
}

async function playTrackFromStreaming(trackIndex) {
    try {
        // Get songs from the spotify player
        const songs = window.spotifyPlayer.getSongs();
        
        if (songs && songs.length > trackIndex) {
            // Play the song with delay
            window.spotifyPlayer.playSong(trackIndex, true);
            
            // Close any open modal
            const modal = document.getElementById('trackModal');
            if (modal && modal.style.display === 'block') {
                // Find and click the close button
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.click();
                }
            }
            
            console.log(`Playing track ${trackIndex} from streaming server`);
        } else {
            console.error('Track not found in streaming server');
            
            // Fallback: try to play from existing track data
            playTrackFallback(trackIndex);
        }
    } catch (error) {
        console.error('Error playing track:', error);
        playTrackFallback(trackIndex);
    }
}

function playTrackFallback(trackIndex) {
    // Try to get track info from the existing page data
    const trackElements = document.querySelectorAll('.jam-track');
    
    if (trackIndex < trackElements.length) {
        const trackElement = trackElements[trackIndex];
        
        // Extract track info from the DOM
        const titleElement = trackElement.querySelector('h2');
        const artistElement = trackElement.querySelector('p');
        
        const title = titleElement ? titleElement.textContent : 'Unknown Track';
        const artist = artistElement ? artistElement.textContent : 'Unknown Artist';
        
        // Construct streaming server URL from title
        const fileName = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '') // Remove spaces
            .replace(/-+/g, ''); // Remove hyphens
        
        const streamUrl = `/api/assets/audio/${fileName}.mp3`;
        
        // Play using the spotify player
        window.spotifyPlayer.playFromUrl(streamUrl, title, artist);
        
        console.log(`Fallback: Playing ${title} by ${artist} from ${streamUrl}`);
    }
}

function setupTrackObserver() {
    // Observer disabled - no play buttons added to dynamically loaded tracks
    console.log('Track observer disabled - no play buttons will be added');
}

function addPlayButtonToTrack(trackElement) {
    // Function disabled - no play buttons added to individual tracks
    console.log('Play button addition disabled for individual tracks');
}

// Add some additional CSS for better integration (play buttons disabled)
const additionalStyles = `
    <style id="spotify-integration-styles">
        .button-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Play button styles disabled - no longer used in grid
        .spotify-play-btn:focus {
            outline: 2px solid rgba(30, 215, 96, 0.5);
            outline-offset: 2px;
        }
        
        .spotify-play-btn:active {
            transform: scale(0.95) !important;
        }
        
        @media (max-width: 768px) {
            .spotify-play-btn {
                width: 36px !important;
                height: 36px !important;
            }
            
            .spotify-play-btn svg {
                width: 16px;
                height: 16px;
            }
        }
        */
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);