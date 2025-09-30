# SpikeRecorder Web - Browser-based Neural Signal Recording

A complete web-based implementation of the BYB SpikeRecorder application that replicates all functionality of the original desktop application. This application works with real SpikerBox hardware for recording and analyzing neural signals.

## Features

### Core Functionality
- **Real-time Waveform Display**: View neural signals in real-time with adjustable time scales (0.1ms to dozens of seconds)
- **Multi-channel Support**: Record and display up to 6 channels simultaneously
- **Audio Input**: Connect via microphone/line-in jack using blue laptop or green smartphone cables
- **Serial Connection**: Direct connection to Arduino/SpikerShield via Web Serial API

### Recording & Playback
- **WAV Recording**: Record signals to WAV files with automatic timestamped naming
- **Event Marking**: Mark events during recording with keys 0-9
- **File Playback**: Load and analyze previously recorded experiments
- **Playback Controls**: Play, pause, and navigate through recordings

### Signal Analysis
- **Threshold Detection**: Real-time spike detection with adjustable threshold
- **Spike Averaging**: Average multiple spikes (1-100+ configurable)
- **Spike Analysis View**: Filter and sort detected spikes by voltage range
- **Signal Measurement**: Measure time intervals and RMS values with right-click selection

### Configuration
- **Channel Configuration**: Enable/disable channels and customize colors
- **Audio Settings**: Mute speakers during recording
- **Serial Port Selection**: Connect to Arduino with configurable baud rate
- **Sampling Rate**: Automatic adjustment based on number of channels

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd spike-recorder-web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `https://localhost:5173`

**Note**: You must accept the self-signed certificate warning in your browser for HTTPS access (required for Web Audio and Web Serial APIs).

## Hardware Setup

### Audio Connection
- **PC Laptops**: Use blue laptop cable, connect to line-in (microphone) jack
- **Mac with 2 ports**: Use blue cable, connect to line-in port
- **Single port devices**: Use green smartphone cable (TRRS)

### Arduino/SpikerShield Connection
1. Install Arduino IDE and upload the `MultichannelSpikerShield.ino` sketch
2. Connect Arduino via USB
3. Open Config in SpikeRecorder
4. Select the serial port and click Connect
5. Choose number of channels (1-6)

## Usage Guide

### Basic Operation
1. **Configure Input**: Click the gear icon to open configuration
2. **Select Channels**: Choose active channels and colors
3. **Start Recording**: Click the red record button
4. **Mark Events**: Press keys 0-9 during recording
5. **Stop Recording**: Click record button again to save

### Threshold Mode
1. Click the threshold button (bar chart icon)
2. Adjust threshold level with the yellow handle
3. Set number of spikes to average with the slider
4. View averaged spike waveform in real-time

### Spike Analysis
1. Load a recorded file with the Browse button
2. Click the Analysis button (appears after loading)
3. Adjust voltage filters with red handles
4. Save filtered spike data

### Controls
- **Zoom**: +/- buttons next to each channel
- **Vertical Position**: Drag channel handle up/down
- **Time Scale**: Use bottom slider or scroll
- **Measurement**: Right-click and drag to measure
- **Playback**: Use play/pause and forward buttons

## Keyboard Shortcuts
- **0-9**: Mark events during recording
- **Space**: Play/pause (when file loaded)
- **Escape**: Exit threshold or analysis mode

## File Formats
- **Recordings**: WAV format, 16-bit PCM
- **Events**: Tab-separated text file with timestamps
- **Spikes**: Tab-separated with timestamp, amplitude, channel

## Browser Requirements
- Chrome 89+ or Edge 89+ (for Web Serial API)
- HTTPS connection required
- Microphone permissions for audio input

## Troubleshooting

### No Audio Input
1. Check microphone permissions in browser
2. Verify correct audio cable type
3. Ensure SpikerBox is powered on

### Serial Connection Issues
1. Close Arduino IDE (can't share serial port)
2. Check USB connection
3. Verify sketch is uploaded to Arduino
4. Try different USB port

### Recording Issues
1. Check available disk space
2. Verify microphone isn't muted
3. Adjust gain if signal is too weak/strong

## Development

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Technology Stack
- React 18 with TypeScript
- Vite build system
- Web Audio API for signal processing
- Web Serial API for Arduino communication
- Canvas API for waveform rendering
- Tailwind CSS for styling

## License
This is an educational implementation based on the BYB SpikeRecorder documentation.

## Credits
Based on the Backyard Brains SpikeRecorder application.
Documentation reference: SpikeRecorderDocumentation.2015.01.pdf