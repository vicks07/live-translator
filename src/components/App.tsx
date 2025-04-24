import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    padding: 2rem;
    background-color: #1a1a1a;
    color: white;
`;

const Title = styled.h1`
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: white;
`;

const Controls = styled.div`
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
`;

interface ButtonProps {
    $isActive?: boolean;
}

const Button = styled.button<ButtonProps>`
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background-color: ${(props: ButtonProps) => props.$isActive ? '#4CAF50' : '#2196F3'};
    color: white;
    transition: all 0.3s ease;

    &:hover {
        opacity: 0.9;
    }

    &:disabled {
        background-color: #666;
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

const LanguageSection = styled.div`
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
`;

const LanguageSelect = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const Label = styled.label`
    font-size: 1rem;
    color: #888;
`;

const Select = styled.select`
    padding: 0.5rem;
    font-size: 1rem;
    border-radius: 4px;
    background-color: #333;
    color: white;
    border: 1px solid #444;
`;

const TranslationContainer = styled.div`
    display: flex;
    gap: 2rem;
    width: 100%;
    max-width: 1200px;
`;

const TextBox = styled.div`
    flex: 1;
    padding: 1rem;
    background-color: #333;
    border-radius: 8px;
    min-height: 200px;

    h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: #888;
    }

    p {
        margin: 0;
        color: white;
    }
`;

const Status = styled.div`
    margin-top: 1rem;
    color: #888;
    font-size: 0.9rem;
`;

export const App: React.FC = () => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [status, setStatus] = useState('');
    const [sourceLanguage, setSourceLanguage] = useState('en');
    const [targetLanguage, setTargetLanguage] = useState('es');
    const [originalText, setOriginalText] = useState('No text captured yet...');
    const [translation, setTranslation] = useState('No translation yet...');

    useEffect(() => {
        // Listen for ffmpeg errors
        window.electron.ipcRenderer.on('ffmpeg-error', (_event: any, error: string) => {
            console.error('FFmpeg error:', error);
            setStatus(`FFmpeg error: ${error}`);
            setIsCapturing(false);
        });

        return () => {
            // Clean up listeners
            window.electron.ipcRenderer.removeAllListeners('ffmpeg-error');
        };
    }, []);

    const handleStartCapture = async () => {
        try {
            setStatus('Starting audio capture...');
            const result = await window.electron.ipcRenderer.invoke('start-audio-capture');
            if (result.success) {
                setIsCapturing(true);
                setStatus('Audio capture in progress...');
            } else {
                setStatus('Failed to start audio capture: ' + result.error);
                setIsCapturing(false);
            }
        } catch (error) {
            console.error('Error starting audio capture:', error);
            setStatus('Error starting audio capture');
            setIsCapturing(false);
        }
    };

    const handleStopCapture = async () => {
        try {
            setStatus('Stopping audio capture...');
            const result = await window.electron.ipcRenderer.invoke('stop-audio-capture');
            if (result.success) {
                setIsCapturing(false);
                setStatus('Audio capture stopped');
            } else {
                setStatus('Failed to stop audio capture: ' + result.error);
            }
        } catch (error) {
            console.error('Error stopping audio capture:', error);
            setStatus('Error stopping audio capture');
        }
    };

    const handlePlayAudio = async () => {
        try {
            setStatus('Playing captured audio...');
            const result = await window.electron.ipcRenderer.invoke('play-captured-audio');
            if (result.success) {
                setStatus('Audio playback completed');
            } else {
                setStatus('Failed to play audio: ' + result.error);
            }
        } catch (error) {
            console.error('Error playing audio:', error);
            setStatus('Error playing audio');
        }
    };

    return (
        <Container>
            <Title>Live Audio Translator</Title>

            <Controls>
                <Button
                    onClick={handleStartCapture}
                    disabled={isCapturing}
                    $isActive={isCapturing}
                >
                    Start Translation
                </Button>
                <Button
                    onClick={handleStopCapture}
                    disabled={!isCapturing}
                >
                    Stop Translation
                </Button>
                <Button
                    onClick={handlePlayAudio}
                    disabled={isCapturing}
                >
                    Play Captured Audio
                </Button>
            </Controls>

            <LanguageSection>
                <LanguageSelect>
                    <Label>Source Language</Label>
                    <Select
                        value={sourceLanguage}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSourceLanguage(e.target.value)}
                    >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                    </Select>
                </LanguageSelect>

                <LanguageSelect>
                    <Label>Target Language</Label>
                    <Select
                        value={targetLanguage}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetLanguage(e.target.value)}
                    >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                    </Select>
                </LanguageSelect>
            </LanguageSection>

            <TranslationContainer>
                <TextBox>
                    <h2>Original Text</h2>
                    <p>{originalText}</p>
                </TextBox>
                <TextBox>
                    <h2>Translation</h2>
                    <p>{translation}</p>
                </TextBox>
            </TranslationContainer>

            <Status>{status}</Status>
        </Container>
    );
}; 