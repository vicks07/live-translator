import './types/electron';

const startButton = document.getElementById('start-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const playAudioButton = document.getElementById('play-audio-button') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLDivElement;

function updateStatus(message: string) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateButtonStates(isCapturing: boolean) {
    if (startButton) startButton.disabled = isCapturing;
    if (stopButton) stopButton.disabled = !isCapturing;
    if (playAudioButton) playAudioButton.disabled = isCapturing;
}

// Handle Start Translation button
if (startButton) {
    startButton.addEventListener('click', async () => {
        try {
            updateStatus('Starting audio capture...');
            const result = await window.electron.ipcRenderer.invoke('start-audio-capture');
            if (result.success) {
                updateStatus('Audio capture in progress...');
                updateButtonStates(true);
            } else {
                updateStatus('Failed to start audio capture: ' + result.error);
            }
        } catch (error) {
            console.error('Error starting audio capture:', error);
            updateStatus('Error starting audio capture');
        }
    });
}

// Handle Stop Translation button
if (stopButton) {
    stopButton.addEventListener('click', async () => {
        try {
            updateStatus('Stopping audio capture...');
            const result = await window.electron.ipcRenderer.invoke('stop-audio-capture');
            if (result.success) {
                updateStatus('Audio capture stopped');
                updateButtonStates(false);
                if (playAudioButton) playAudioButton.disabled = false;
            } else {
                updateStatus('Failed to stop audio capture: ' + result.error);
            }
        } catch (error) {
            console.error('Error stopping audio capture:', error);
            updateStatus('Error stopping audio capture');
        }
    });
}

// Handle Play Captured Audio button
if (playAudioButton) {
    playAudioButton.addEventListener('click', async () => {
        try {
            updateStatus('Playing captured audio...');
            const result = await window.electron.ipcRenderer.invoke('play-captured-audio');
            if (result.success) {
                updateStatus('Audio playback completed');
            } else {
                updateStatus('Failed to play audio: ' + result.error);
            }
        } catch (error) {
            console.error('Error playing captured audio:', error);
            updateStatus('Error playing captured audio');
        }
    });
} 