import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { mainWindow } from '../main';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SpeechClient, protos } from '@google-cloud/speech';
import { exec } from 'child_process';

interface TranscriptionResult {
    results: Array<{
        alternatives: Array<{
            transcript: string;
        }>;
        isFinal: boolean;
    }>;
}

export class AudioService {
    private recordProcess: ChildProcess | null = null;
    private audioBuffer: Buffer[] = [];
    private isCapturing: boolean = false;
    private streamClosed: boolean = false;
    private isStoppingCapture: boolean = false;
    private tempFile: string = path.join(os.tmpdir(), 'captured_audio.wav');
    private speechClient: SpeechClient | null = null;
    private recognizeStream: any = null;
    private hasGoogleCredentials: boolean = false;

    constructor() {
        this.audioBuffer = [];
        this.initializeSpeechClient();
    }

    private async initializeSpeechClient() {
        try {
            this.speechClient = new SpeechClient();
            // Test the credentials by making a simple API call
            await this.speechClient.initialize();
            this.hasGoogleCredentials = true;
            console.log('Google Cloud Speech client initialized successfully');
        } catch (error) {
            console.warn('Failed to initialize Google Cloud Speech client:', error);
            this.hasGoogleCredentials = false;
            this.speechClient = null;
        }
    }

    private sendToRenderer(channel: string, ...args: any[]) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, ...args);
        }
    }

    private async checkSoxInstallation(): Promise<void> {
        try {
            await exec('which sox');
        } catch (error) {
            console.error('Sox is not installed:', error);
            this.sendToRenderer('audio-error', 'Sox is not installed. Please install it using "brew install sox"');
            throw error;
        }
    }

    private setupTranscriptionStream() {
        if (!this.hasGoogleCredentials || !this.speechClient) {
            console.log('Skipping transcription setup - Google Cloud credentials not available');
            return null;
        }

        const request = {
            config: {
                encoding: 'LINEAR16' as const,
                sampleRateHertz: 44100,
                languageCode: 'en-US',
                enableAutomaticPunctuation: true,
                model: 'default',
            },
            interimResults: true,
        };

        this.streamClosed = false;
        this.recognizeStream = this.speechClient
            .streamingRecognize(request)
            .on('error', (error: Error) => {
                console.error('Transcription error:', error);
                this.streamClosed = true;
                this.handleTranscriptionError(error);
            })
            .on('data', (data: TranscriptionResult) => {
                const transcript = data.results[0]?.alternatives[0]?.transcript || '';
                const isFinal = data.results[0]?.isFinal || false;

                console.log('Transcription received:', { transcript, isFinal });
                this.handleTranscriptionData({ transcript, isFinal });
            })
            .on('end', () => {
                console.log('Transcription stream ended');
                this.streamClosed = true;
            })
            .on('close', () => {
                console.log('Transcription stream closed');
                this.streamClosed = true;
            });

        return this.recognizeStream;
    }

    private writeToStream(data: Buffer) {
        if (!this.hasGoogleCredentials || this.isStoppingCapture) {
            return;
        }

        if (!this.recognizeStream || this.streamClosed) {
            console.log('Stream is not available or closed, skipping write');
            return;
        }

        try {
            if (!this.recognizeStream.destroyed) {
                const writeResult = this.recognizeStream.write(data);
                if (!writeResult && this.recognizeStream) {
                    this.recognizeStream.once('drain', () => {
                        if (!this.isStoppingCapture) {
                            console.log('Stream drained, continuing');
                        }
                    });
                }
            }
        } catch (error) {
            if (!this.isStoppingCapture) {
                console.error('Error writing to stream:', error);
            }
        }
    }

    public async startCapture(): Promise<void> {
        if (this.isCapturing || this.isStoppingCapture) return;

        try {
            await this.checkSoxInstallation();

            // Clear any existing temp file
            if (fs.existsSync(this.tempFile)) {
                fs.unlinkSync(this.tempFile);
            }

            this.isCapturing = true;
            this.isStoppingCapture = false;
            this.audioBuffer = [];
            this.streamClosed = false;

            // Setup transcription stream if credentials are available
            if (this.hasGoogleCredentials) {
                const stream = this.setupTranscriptionStream();
                if (!stream) {
                    console.warn('Failed to setup transcription stream');
                }
            } else {
                console.log('Google Cloud credentials not available - recording audio only');
            }

            // Use rec command (part of sox) for recording
            this.recordProcess = spawn('rec', [
                '-q',                    // Quiet mode
                '-t', 'raw',             // Output raw audio
                '-r', '44100',           // Sample rate
                '-b', '16',              // Bits per sample
                '-c', '1',               // Mono audio
                '-e', 'signed-integer',  // Signed integers
                '-',                     // Output to stdout
                'gain', '-3',            // Reduce gain slightly to prevent clipping
            ]);

            if (!this.recordProcess.stdout) {
                throw new Error('Failed to create recording process stdout');
            }

            this.recordProcess.stdout.on('data', (data: Buffer) => {
                if (this.isCapturing) {
                    if (this.hasGoogleCredentials) {
                        this.writeToStream(data);
                    }
                    this.audioBuffer.push(data);
                }
            });

            if (!this.recordProcess.stderr) {
                throw new Error('Failed to create recording process stderr');
            }

            this.recordProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('Recording stderr:', output);
                if (output.includes('error') || output.includes('failed')) {
                    this.handleAudioError(new Error(output));
                }
            });

            this.recordProcess.on('error', (error: Error) => {
                console.error('Recording process error:', error);
                this.isCapturing = false;
                this.handleAudioError(error);
            });

            this.recordProcess.on('close', (code: number) => {
                console.log('Recording process closed with code:', code);
                this.isCapturing = false;
                if (code !== 0 && code !== null) {
                    const error = new Error(`Recording process exited with code ${code}`);
                    this.handleAudioError(error);
                }
            });

            // Wait a bit to ensure recording has started
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            this.isCapturing = false;
            this.isStoppingCapture = false;
            console.error('Error in startCapture:', error);
            this.handleAudioError(error as Error);
            throw error;
        }
    }

    public async stopCapture(): Promise<void> {
        if (!this.isCapturing || this.isStoppingCapture) return;

        try {
            this.isStoppingCapture = true;
            this.isCapturing = false;

            // Close the transcription stream gracefully
            if (this.recognizeStream && !this.streamClosed) {
                console.log('Closing transcription stream');
                try {
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // End the stream and wait for it to close
                    this.recognizeStream.end();
                    this.streamClosed = true;

                    // Give it a moment to finish processing
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error('Error closing transcription stream:', error);
                } finally {
                    this.recognizeStream = null;
                }
            }

            // Stop the recording process
            if (this.recordProcess && !this.recordProcess.killed) {
                console.log('Stopping recording process');
                try {
                    // Send SIGTERM to the process
                    this.recordProcess.kill('SIGTERM');

                    // Wait for the process to exit
                    await new Promise<void>((resolve) => {
                        const cleanup = () => {
                            this.recordProcess = null;
                            resolve();
                        };

                        this.recordProcess?.once('exit', cleanup);
                        // Add a timeout in case the exit event doesn't fire
                        setTimeout(cleanup, 1000);
                    });
                } catch (error) {
                    console.error('Error stopping recording process:', error);
                }
            }

            // Save the audio buffer to file for playback
            if (this.audioBuffer.length > 0) {
                try {
                    await this.saveAudioBuffer();
                } catch (error) {
                    console.error('Error saving audio buffer:', error);
                    throw error;
                }
            }

            console.log('Audio capture stopped successfully');
        } catch (error) {
            console.error('Error in stopCapture:', error);
            this.handleAudioError(error as Error);
            throw error;
        } finally {
            // Ensure cleanup happens even if there's an error
            this.isCapturing = false;
            this.isStoppingCapture = false;
            this.recordProcess = null;
            this.recognizeStream = null;
            this.streamClosed = true;
        }
    }

    private async saveAudioBuffer(): Promise<void> {
        console.log('Saving audio buffer to file');
        const rawData = Buffer.concat(this.audioBuffer);

        const soxProcess = spawn('sox', [
            '-t', 'raw',             // Input format is raw
            '-r', '44100',           // Sample rate
            '-b', '16',              // Bits per sample
            '-c', '1',               // Mono audio
            '-e', 'signed-integer',  // Signed integers
            '-',                     // Input from stdin
            '-t', 'wav',             // Output format is WAV
            this.tempFile            // Output file
        ]);

        return new Promise<void>((resolve, reject) => {
            if (!soxProcess.stdin) {
                reject(new Error('Sox process stdin is not available'));
                return;
            }

            soxProcess.on('error', (error) => {
                console.error('Sox process error:', error);
                reject(error);
            });

            soxProcess.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Sox process exited with code ${code}`));
                }
            });

            try {
                const stdin = soxProcess.stdin;
                stdin.write(rawData);
                stdin.end();
            } catch (error) {
                console.error('Error writing to sox process:', error);
                reject(error);
            }
        });
    }

    public async playCapturedAudio(): Promise<void> {
        try {
            if (!fs.existsSync(this.tempFile)) {
                throw new Error('No captured audio available');
            }

            console.log('Playing captured audio...');
            const playProcess = spawn('play', [
                '-q',                // Quiet mode
                this.tempFile        // Input file
            ]);

            return new Promise<void>((resolve, reject) => {
                playProcess.on('error', (error) => {
                    console.error('Error playing audio:', error);
                    reject(error);
                });

                playProcess.on('exit', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Play process exited with code ${code}`));
                    }
                });
            });
        } catch (error) {
            console.error('Error playing captured audio:', error);
            this.handleAudioError(error as Error);
            throw error;
        }
    }

    private handleTranscriptionData(result: { transcript: string, isFinal: boolean }) {
        console.log('Sending transcription result to renderer:', result);
        this.sendToRenderer('transcription-result', result);
    }

    private handleTranscriptionError(error: any) {
        console.error('Transcription error:', error);
        this.sendToRenderer('transcription-error', error.message || 'Unknown transcription error');
    }

    private handleAudioError(error: any) {
        console.error('Audio error:', error);
        this.sendToRenderer('audio-error', error.message || 'Unknown audio error');
    }
}

export const audioService = new AudioService(); 