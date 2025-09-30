import React, { useState, useEffect } from 'react';
import type { Channel, AudioConfig, SerialConfig } from '../types';
import { SerialHandler } from '../utils/serialHandler';

interface ConfigModalProps {
  isOpen: boolean;
  channels: Channel[];
  audioConfig: AudioConfig;
  serialConfig: SerialConfig;
  onClose: () => void;
  onUpdateChannel: (channel: Channel) => void;
  onUpdateAudioConfig: (config: AudioConfig) => void;
  onUpdateSerialConfig: (config: SerialConfig) => void;
  onConnectSerial: () => void;
  availableDevices: MediaDeviceInfo[];
}

const COLORS = [
  { name: 'Yellow', value: '#CCCC00' },
  { name: 'Green', value: '#00CC00' },
  { name: 'Orange', value: '#FF9933' },
  { name: 'Cyan', value: '#00CCCC' },
  { name: 'Magenta', value: '#CC00CC' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black (Off)', value: '#000000' }
];

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  channels,
  audioConfig,
  serialConfig,
  onClose,
  onUpdateChannel,
  onUpdateAudioConfig,
  onUpdateSerialConfig,
  onConnectSerial,
  availableDevices
}) => {
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      SerialHandler.getAvailablePorts().then(setAvailablePorts);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Config</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Mute speakers option */}
        <div className="mb-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={audioConfig.muteSpeakers}
              onChange={(e) => onUpdateAudioConfig({
                ...audioConfig,
                muteSpeakers: e.target.checked
              })}
              className="form-checkbox"
            />
            <span>Mute Speakers while recording</span>
          </label>
        </div>

        {/* Audio Input Channels */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Audio Input Channels</h3>
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center space-x-4 mb-2">
              <div className="flex-1">
                <span>{channel.name}</span>
              </div>
              <select
                value={channel.color}
                onChange={(e) => onUpdateChannel({
                  ...channel,
                  color: e.target.value,
                  enabled: e.target.value !== '#000000'
                })}
                className="bg-gray-800 text-white px-2 py-1 rounded"
              >
                {COLORS.map(color => (
                  <option key={color.value} value={color.value}>
                    {color.name}
                  </option>
                ))}
              </select>
              <div
                className="w-8 h-8 rounded"
                style={{ backgroundColor: channel.color }}
              />
            </div>
          ))}
        </div>

        {/* Serial Port Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Select Port</h3>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <select
                className="bg-gray-800 text-white px-3 py-2 rounded flex-1"
                value={serialConfig.port || ''}
                onChange={(e) => onUpdateSerialConfig({
                  ...serialConfig,
                  port: e.target.value
                })}
              >
                <option value="">Select a serial port...</option>
                {availablePorts.map((port, index) => (
                  <option key={index} value={port.path || index}>
                    {port.path || `Port ${index + 1}`}
                  </option>
                ))}
              </select>

              <button
                onClick={onConnectSerial}
                className={`px-4 py-2 rounded ${
                  serialConfig.connected
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {serialConfig.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            {serialConfig.connected && (
              <div className="space-y-2">
                <label>Number of channels:</label>
                <select
                  value={serialConfig.numberOfChannels}
                  onChange={(e) => onUpdateSerialConfig({
                    ...serialConfig,
                    numberOfChannels: parseInt(e.target.value)
                  })}
                  className="bg-gray-800 text-white px-3 py-2 rounded w-full"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                </select>
                <div className="text-sm text-gray-400">
                  Sample rate per channel: {Math.floor(10000 / serialConfig.numberOfChannels)} Hz
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio Device Selection */}
        {availableDevices.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Audio Input Device</h3>
            <select
              className="bg-gray-800 text-white px-3 py-2 rounded w-full"
              value={audioConfig.deviceId || ''}
              onChange={(e) => onUpdateAudioConfig({
                ...audioConfig,
                deviceId: e.target.value || undefined
              })}
            >
              <option value="">Default Audio Input</option>
              {availableDevices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Audio Input ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};