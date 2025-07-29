import React, { useState, useRef } from 'react';
import { Play, Pause, Trash2, FileText, Mic, MicOff, Download, MessageSquare } from 'lucide-react';
import { AudioRecording, TranscriptionProgress } from '../hooks/useWhisperTranscription';

interface WhisperTranscriptionPanelProps {
  recordings: AudioRecording[];
  isRecording: boolean;
  isTranscribing: boolean;
  transcriptionProgress: TranscriptionProgress | null;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<AudioRecording>;
  onTranscribe: (recordingId: string) => Promise<void>;
  onDelete: (recordingId: string) => Promise<void>;
  formatDuration: (ms: number) => string;
}

export const WhisperTranscriptionPanel: React.FC<WhisperTranscriptionPanelProps> = ({
  recordings,
  isRecording,
  isTranscribing,
  transcriptionProgress,
  onStartRecording,
  onStopRecording,
  onTranscribe,
  onDelete,
  formatDuration
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 音声再生
  const playAudio = (recording: AudioRecording) => {
    if (playingId === recording.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(recording.audioUrl);
    audioRef.current = audio;

    audio.onplay = () => setPlayingId(recording.id);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
      alert('音声の再生に失敗しました');
    };

    audio.play().catch(error => {
      console.error('音声再生エラー:', error);
      setPlayingId(null);
      audioRef.current = null;
    });
  };

  // 録音ボタン
  const handleRecordingToggle = async () => {
    try {
      if (isRecording) {
        await onStopRecording();
      } else {
        await onStartRecording();
      }
    } catch (error) {
      console.error('録音エラー:', error);
      alert(error instanceof Error ? error.message : '録音に失敗しました');
    }
  };

  // 進捗バーの色を取得
  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'preparing': return 'bg-blue-500';
      case 'loading': return 'bg-purple-500';
      case 'converting': return 'bg-yellow-500';
      case 'transcribing': return 'bg-orange-500';
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // テキスト展開/折りたたみ
  const toggleExpanded = (recordingId: string) => {
    setExpandedId(expandedId === recordingId ? null : recordingId);
  };

  // 音声ダウンロード
  const downloadAudio = (recording: AudioRecording) => {
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = `whisper_audio_${recording.timestamp.toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare size={24} />
          Whisper音声文字起こし
        </h2>
        
        {/* 録音ボタン */}
        <button
          onClick={handleRecordingToggle}
          disabled={isTranscribing}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } ${isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          {isRecording ? '録音停止' : '録音開始'}
        </button>
      </div>

      {/* 録音中の表示 */}
      {isRecording && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="font-medium">録音中...</span>
          </div>
          <p className="text-sm text-red-600 mt-1">
            録音停止ボタンを押すと、文字起こしボタンが表示されます
          </p>
        </div>
      )}

      {/* 進捗表示 */}
      {transcriptionProgress && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {transcriptionProgress.message}
            </span>
            <span className="text-sm text-gray-500">
              {transcriptionProgress.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(transcriptionProgress.stage)}`}
              style={{ width: `${transcriptionProgress.progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {transcriptionProgress.stage === 'loading' && 'Whisper.wasmライブラリを読み込んでいます...'}
            {transcriptionProgress.stage === 'converting' && '音声データを16kHz/モノラルに変換しています...'}
            {transcriptionProgress.stage === 'transcribing' && 'AIが音声を解析しています...'}
          </div>
        </div>
      )}

      {/* 録音データリスト */}
      <div className="space-y-3">
        {recordings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Mic size={48} className="mx-auto mb-2 opacity-50" />
            <p>録音ボタンを押して音声を録音してください</p>
            <p className="text-sm mt-1">録音完了後、文字起こしボタンが表示されます</p>
          </div>
        ) : (
          recordings.map((recording) => (
            <div
              key={recording.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* 音声情報ヘッダー */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => playAudio(recording)}
                    className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    {playingId === recording.id ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  
                  <div>
                    <p className="text-sm text-gray-600">
                      {recording.timestamp.toLocaleString('ja-JP')}
                    </p>
                    <p className="text-xs text-gray-500">
                      長さ: {formatDuration(recording.duration)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* 文字起こしボタン */}
                  <button
                    onClick={() => onTranscribe(recording.id)}
                    disabled={isTranscribing || recording.isTranscribed}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                      recording.isTranscribed
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : isTranscribing
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    <MessageSquare size={14} />
                    {recording.isTranscribed ? '変換済み' : 'Whisper変換'}
                  </button>

                  {/* ダウンロードボタン */}
                  <button
                    onClick={() => downloadAudio(recording)}
                    className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                    title="音声をダウンロード"
                  >
                    <Download size={16} />
                  </button>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => onDelete(recording.id)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 文字起こし結果表示 */}
              {recording.isTranscribed && recording.transcription && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-700 flex items-center gap-1">
                      <MessageSquare size={14} />
                      Whisper変換結果:
                    </span>
                    <button
                      onClick={() => toggleExpanded(recording.id)}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      {expandedId === recording.id ? '折りたたむ' : '全文表示'}
                    </button>
                  </div>
                  <p className={`text-gray-800 ${
                    expandedId === recording.id 
                      ? 'whitespace-pre-wrap' 
                      : 'line-clamp-3 overflow-hidden'
                  }`}>
                    {recording.transcription}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 使用方法の説明 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">使用方法:</h3>
        <ol className="text-xs text-blue-700 space-y-1">
          <li>1. 「録音開始」ボタンで音声録音を開始</li>
          <li>2. 「録音停止」ボタンで録音を終了</li>
          <li>3. 「Whisper変換」ボタンで文字起こしを実行</li>
          <li>4. 変換結果が表示されます（Whisper.wasm使用）</li>
        </ol>
      </div>
    </div>
  );
};