import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                invoke: (channel: string, ...args: any[]) => Promise<any>;
                on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
                removeAllListeners: (channel: string) => void;
            };
        }
    }
}

function App() {
    const [isRecording, setIsRecording] = useState(false);
    const [originalText, setOriginalText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [interimTranscript, setInterimTranscript] = useState('');

    const handleTranscriptionResult = useCallback((data: { transcript: string, isFinal: boolean }) => {
        console.log('Received transcription:', data);
        if (data.isFinal) {
            setOriginalText(prev => {
                const newText = prev + (prev ? ' ' : '') + data.transcript;
                console.log('Updated original text:', newText);
                return newText;
            });
            setInterimTranscript('');
        } else {
            // Keep the previous final text and add interim text
            setInterimTranscript(prev => {
                const newInterim = data.transcript;
                console.log('Updated interim text:', newInterim);
                return newInterim;
            });
        }
    }, []);

    const handleError = useCallback((errorMessage: string) => {
        console.error('Error received:', errorMessage);
        setError(errorMessage);
        setIsRecording(false);
    }, []);

    useEffect(() => {
        // Set up transcription result handler
        const transcriptionHandler = (_: any, data: { transcript: string, isFinal: boolean }) => {
            console.log('Transcription event received:', data);
            handleTranscriptionResult(data);
        };

        // Set up error handlers
        const transcriptionErrorHandler = (_: any, error: string) => {
            console.log('Transcription error received:', error);
            handleError(error);
        };

        const audioErrorHandler = (_: any, error: string) => {
            console.log('Audio error received:', error);
            handleError(error);
        };

        // Add event listeners
        window.electron.ipcRenderer.on('transcription-result', transcriptionHandler);
        window.electron.ipcRenderer.on('transcription-error', transcriptionErrorHandler);
        window.electron.ipcRenderer.on('audio-error', audioErrorHandler);

        return () => {
            // Clean up by stopping any ongoing recording and removing listeners
            if (isRecording) {
                window.electron.ipcRenderer.invoke('stop-audio-capture').catch(console.error);
            }
            window.electron.ipcRenderer.removeAllListeners('transcription-result');
            window.electron.ipcRenderer.removeAllListeners('transcription-error');
            window.electron.ipcRenderer.removeAllListeners('audio-error');
        };
    }, [handleTranscriptionResult, handleError, isRecording]);

    const handleStartTranslation = async () => {
        try {
            setError(null);
            setIsRecording(true);
            await window.electron.ipcRenderer.invoke('start-audio-capture');
            console.log('Audio capture started');
        } catch (error) {
            console.error('Failed to start translation:', error);
            setError(`Failed to start translation: ${error}`);
            setIsRecording(false);
        }
    };

    const handleStopTranslation = async () => {
        try {
            setIsRecording(false);
            await window.electron.ipcRenderer.invoke('stop-audio-capture');
            console.log('Audio capture stopped');
        } catch (error) {
            console.error('Failed to stop translation:', error);
            setError(`Failed to stop translation: ${error}`);
        }
    };

    const handlePlayAudio = async () => {
        try {
            setError(null);
            await window.electron.ipcRenderer.invoke('play-captured-audio');
        } catch (error) {
            console.error('Failed to play audio:', error);
            setError(`Failed to play audio: ${error}`);
        }
    };

    return (
        <div className="container">
            <div className="header">
                <h1>Live Audio Translator</h1>
                <div className="controls">
                    <button
                        onClick={isRecording ? handleStopTranslation : handleStartTranslation}
                        className={isRecording ? 'stop' : 'start'}
                    >
                        {isRecording ? 'Stop Translation' : 'Start Translation'}
                    </button>
                    <button onClick={handlePlayAudio} disabled={isRecording}>
                        Play Captured Audio
                    </button>
                </div>
                {error && <div className="error">{error}</div>}
            </div>
            <div className="content">
                <div className="text-section">
                    <h2>Original Text</h2>
                    <div className="text-content">
                        <div className="final-text">{originalText}</div>
                        {interimTranscript && (
                            <div className="interim-text">{interimTranscript}</div>
                        )}
                    </div>
                </div>
                <div className="text-section">
                    <h2>Translated Text</h2>
                    <div className="text-content">
                        {translatedText}
                    </div>
                </div>
            </div>
        </div>
    );
}

const container = document.getElementById('root');
if (!container) {
    throw new Error('Failed to find the root container');
}
const root = createRoot(container);
root.render(<App />); 