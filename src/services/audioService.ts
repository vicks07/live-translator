import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { mainWindow } from '../main';

class AudioService {
    private ffmpegProcess: any;
    private isCapturing: boolean = false;
    private audioBuffer: Buffer[] = [];

    constructor() {
        this.audioBuffer = [];
    }

    async startCapture() {
        if (this.isCapturing) return;

        this.isCapturing = true;
        this.audioBuffer = [];

        const ffmpegPath = process.platform === 'darwin'
            ? '/opt/homebrew/bin/ffmpeg'
            : 'ffmpeg';

        try {
            // List available input devices first
            const devices = await this.listAudioDevices();
            console.log('Available audio devices:', devices);

            // On macOS, use the default input device
            this.ffmpegProcess = spawn(ffmpegPath, [
                '-f', 'avfoundation',
                '-list_devices', 'true',
                '-i', '',
            ]);

            // Handle process events
            this.ffmpegProcess.stdout.on('data', (data: Buffer) => {
                console.log('FFmpeg stdout:', data.toString());
                this.audioBuffer.push(data);
            });

            this.ffmpegProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('FFmpeg stderr:', output);
                // This is normal for ffmpeg to output device info to stderr
                if (!output.includes('Input/output error')) {
                    mainWindow?.webContents.send('ffmpeg-error', output);
                }
            });

            this.ffmpegProcess.on('error', (error: Error) => {
                console.error('FFmpeg process error:', error);
                throw error;
            });

            this.ffmpegProcess.on('close', (code: number) => {
                console.log('FFmpeg process closed with code:', code);
                this.isCapturing = false;
                if (code !== 0 && code !== null) {
                    throw new Error(`FFmpeg process exited with code ${code}`);
                }
            });

            return { success: true };
        } catch (error: any) {
            this.isCapturing = false;
            console.error('Error in startCapture:', error);
            throw error;
        }
    }

    private async listAudioDevices(): Promise<string> {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', [
                '-f', 'avfoundation',
                '-list_devices', 'true',
                '-i', ''
            ]);

            let output = '';

            ffmpeg.stderr.on('data', (data) => {
                output += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0 || code === 255) { // 255 is normal for device listing
                    resolve(output);
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', reject);
        });
    }

    stopCapture() {
        if (!this.isCapturing) return;

        this.isCapturing = false;
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill();
            this.ffmpegProcess = null;
        }
    }

    async playCapturedAudio() {
        if (this.audioBuffer.length === 0) {
            throw new Error('No audio captured to play');
        }

        const ffmpegPath = process.platform === 'darwin'
            ? '/opt/homebrew/bin/ffmpeg'
            : 'ffmpeg';

        try {
            const ffplay = spawn(ffmpegPath, [
                '-f', 's16le',
                '-ar', '44100',
                '-ac', '2',
                '-i', '-',
                '-f', 'wav',
                '-'
            ]);

            // Write all captured audio to ffplay
            for (const chunk of this.audioBuffer) {
                ffplay.stdin.write(chunk);
            }
            ffplay.stdin.end();

            ffplay.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('FFplay stderr:', output);
                if (output.includes('Error')) {
                    mainWindow?.webContents.send('ffmpeg-error', output);
                }
            });

            return new Promise((resolve, reject) => {
                ffplay.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true });
                    } else {
                        reject(new Error(`FFplay exited with code ${code}`));
                    }
                });

                ffplay.on('error', (error) => {
                    console.error('FFplay process error:', error);
                    reject(error);
                });
            });
        } catch (error: any) {
            console.error('Error in playCapturedAudio:', error);
            throw error;
        }
    }
}

export const audioService = new AudioService();

// Set up IPC handlers
ipcMain.handle('start-audio-capture', async () => {
    try {
        return await audioService.startCapture();
    } catch (error: any) {
        console.error('Error starting audio capture:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-audio-capture', async () => {
    try {
        audioService.stopCapture();
        return { success: true };
    } catch (error: any) {
        console.error('Error stopping audio capture:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('play-captured-audio', async () => {
    try {
        return await audioService.playCapturedAudio();
    } catch (error: any) {
        console.error('Error playing captured audio:', error);
        return { success: false, error: error.message };
    }
}); 