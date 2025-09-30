import React from 'react';
import { ViewMode } from '../types';

interface ToolbarProps {
  viewMode: ViewMode;
  isRecording: boolean;
  onConfigClick: () => void;
  onThresholdClick: () => void;
  onRecordClick: () => void;
  onBrowseClick: () => void;
  onAnalysisClick?: () => void;
  showAnalysis?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  isRecording,
  onConfigClick,
  onThresholdClick,
  onRecordClick,
  onBrowseClick,
  onAnalysisClick,
  showAnalysis = false
}) => {
  return (
    <div className="flex items-center justify-between bg-gray-900 p-2 border-b border-gray-700">
      <div className="flex items-center space-x-2">
        {/* Config button */}
        <button
          onClick={onConfigClick}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
          title="Configuration"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        </button>

        {/* Threshold button */}
        <button
          onClick={onThresholdClick}
          className={`p-2 rounded ${
            viewMode === 'threshold'
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title="Threshold Mode"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </button>

        {/* Analysis button (only shown when file is loaded) */}
        {showAnalysis && onAnalysisClick && (
          <button
            onClick={onAnalysisClick}
            className={`p-2 rounded ${
              viewMode === 'analysis'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Spike Analysis"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100 4h2a1 1 0 100 2 2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
            </svg>
          </button>
        )}
      </div>

      <div className="text-center flex-1">
        <h1 className="text-lg font-mono">BYB Spike Recorder</h1>
      </div>

      <div className="flex items-center space-x-2">
        {/* Record button */}
        <button
          onClick={onRecordClick}
          className={`p-3 rounded-full ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? (
            <div className="w-4 h-4 bg-white rounded-sm" />
          ) : (
            <div className="w-4 h-4 bg-red-500 rounded-full" />
          )}
        </button>

        {/* Browse button */}
        <button
          onClick={onBrowseClick}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
          title="Browse Experiments"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v12H6V4z" />
          </svg>
        </button>
      </div>
    </div>
  );
};