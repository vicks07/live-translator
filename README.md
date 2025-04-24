# Live Audio Translator

A real-time audio translation application built with Electron and React. This application can capture system audio, transcribe it, and translate it to your desired language.

## Features

- Real-time audio capture from system audio
- Speech-to-text conversion
- Language translation
- Modern, responsive UI
- Support for multiple languages

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

To run the application in development mode:

```bash
npm run dev
```

This will start the application with hot-reloading enabled.

## Building

To build the application for production:

```bash
npm run build
```

Then start the application:

```bash
npm start
```

## Usage

1. Select the source language (the language being spoken)
2. Select the target language (the language you want to translate to)
3. Click "Start Translation" to begin capturing and translating audio
4. The application will display both the original text and its translation
5. Click "Stop Translation" to stop the process

## Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)
- Russian (ru)
- Arabic (ar)

## Notes

- The application requires an internet connection for speech recognition and translation
- Audio quality and background noise may affect transcription accuracy
- The translation quality depends on the translation service used

## License

This project is open source and available under the ISC License. 