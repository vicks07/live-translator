import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { mainWindow } from '../main';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class AudioService {
    private recordProcess: any;
    private isCapturing: boolean = false;
    private audioBuffer: Buffer[] = [];
    private tempFile: string;

    constructor() {
        this.audioBuffer = [];
        this.tempFile = path.join(os.tmpdir(), 'temp_audio.wav');
    }

    private async checkSoxInstallation(): Promise<void> {
        return new Promise((resolve, reject) => {
            const check = spawn('which', ['rec']);
            check.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error('Sox is not installed. Please run: brew install sox'));
                }
                resolve();
            });
        });
    }

    async startCapture() {
        if (this.isCapturing) return { success: true };

        try {
            await this.checkSoxInstallation();

            if (fs.existsSync(this.tempFile)) {
                fs.unlinkSync(this.tempFile);
            }

            this.isCapturing = true;
            this.audioBuffer = [];

            // Use rec command (part of sox) for recording
            this.recordProcess = spawn('/opt/homebrew/bin/rec', [
                '-q',                    // Quiet mode
                this.tempFile,           // Output file
                'rate', '44100',         // Sample rate
                'channels', '1',         // Mono audio
                'gain', '-3',            // Reduce gain slightly to prevent clipping
            ]);

            this.recordProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('Recording stderr:', output);
                if (output.includes('error') || output.includes('failed')) {
                    mainWindow?.webContents.send('audio-error', output);
                }
            });

            this.recordProcess.stdout.on('data', (data: Buffer) => {
                console.log('Recording stdout:', data.toString());
            });

            this.recordProcess.on('error', (error: Error) => {
                console.error('Recording process error:', error);
                this.isCapturing = false;
                mainWindow?.webContents.send('audio-error', error.message);
                throw error;
            });

            this.recordProcess.on('close', (code: number) => {
                console.log('Recording process closed with code:', code);
                this.isCapturing = false;
                if (code !== 0 && code !== null) {
                    const error = new Error(`Recording process exited with code ${code}`);
                    mainWindow?.webContents.send('audio-error', error.message);
                    throw error;
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            if (!this.recordProcess || this.recordProcess.killed) {
                throw new Error('Failed to start audio capture');
            }

            return { success: true };
        } catch (error: any) {
            this.isCapturing = false;
            console.error('Error in startCapture:', error);
            mainWindow?.webContents.send('audio-error', error.message);
            throw error;
        }
    }

    stopCapture() {
        if (!this.isCapturing) return;

        try {
            this.isCapturing = false;
            if (this.recordProcess) {
                this.recordProcess.kill('SIGTERM');
                this.recordProcess = null;
            }
        } catch (error) {
            console.error('Error stopping capture:', error);
        }
    }

    async playCapturedAudio() {
        if (!fs.existsSync(this.tempFile)) {
            throw new Error('No audio captured to play');
        }

        try {
            console.log('Playing captured audio file:', this.tempFile);

            // Use play command (part of sox) for playback
            const playProcess = spawn('/opt/homebrew/bin/play', [
                '-q',                    // Quiet mode
                this.tempFile,           // Input file
            ]);

            playProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('Playback stderr:', output);
                if (output.includes('error') || output.includes('failed')) {
                    mainWindow?.webContents.send('audio-error', output);
                }
            });

            return new Promise((resolve, reject) => {
                playProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true });
                    } else {
                        const error = new Error(`Playback process exited with code ${code}`);
                        mainWindow?.webContents.send('audio-error', error.message);
                        reject(error);
                    }
                });

                playProcess.on('error', (error) => {
                    console.error('Playback process error:', error);
                    mainWindow?.webContents.send('audio-error', error.message);
                    reject(error);
                });
            });
        } catch (error: any) {
            console.error('Error in playCapturedAudio:', error);
            mainWindow?.webContents.send('audio-error', error.message);
            throw error;
        }
    }
}

export const audioService = new AudioService(); 