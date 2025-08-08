import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface AudioRecording {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
}

// Android最適化音声録音クラス（WebSpeechAPI削除版）
class AndroidVoiceRecording {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  
  // Android検出
  private isAndroid: boolean = false;
  private isChrome: boolean = false;
  
  // 録音データ
  private audioChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  
  // コールバック
  private onRecordingStateChange?: (isRecording: boolean) => void;
  private onError?: (error: string) => void;
  private onAudioLevel?: (level: number) => void;

  constructor() {
    this.detectPlatform();
  }

  // プラットフォーム検出
  private detectPlatform(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    this.isAndroid = userAgent.includes('android');
    this.isChrome = userAgent.includes('chrome');
    
    console.log('Platform detected:', {
      isAndroid: this.isAndroid,
      isChrome: this.isChrome,
      userAgent: userAgent
    });
  }

  // 初期化
  async initialize(): Promise<void> {
    try {
      // AudioContextの初期化
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.isAndroid ? 16000 : 44100,
        latencyHint: 'interactive'
      });
      
      console.log('AndroidVoiceRecording initialized successfully');
    } catch (error) {
      console.error('AndroidVoiceRecording initialization failed:', error);
      console.warn('Using fallback initialization for mobile compatibility');
    }
  }

  // 録音開始
  async startRecording(): Promise<void> {
    try {
      if (!this.audioContext) {
        await this.initialize();
      }

      // AudioContextの再開
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // マイクアクセス
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.isAndroid ? 16000 : 44100,
          channelCount: 1, // モノラル録音でパフォーマンス向上
          ...(this.isAndroid && {
            // Android固有の最適化
            latency: 0.1,
            volume: 1.0
          })
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // MediaRecorderの設定
      this.setupMediaRecorder();

      // 録音開始
      this.recordingStartTime = Date.now();
      this.audioChunks = [];

      // MediaRecorder開始
      if (this.mediaRecorder) {
        this.mediaRecorder.start(100);
      }
      
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange(true);
      }

      console.log('Recording started successfully');

    } catch (error) {
      console.error('Recording start failed:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error('マイクへのアクセスを許可してください');
        } else if (error.name === 'NotFoundError') {
          throw new Error('マイクが見つかりません');
        }
      }
      
      throw new Error('録音を開始できませんでした');
    }
  }

  // MediaRecorderの設定
  private setupMediaRecorder(): void {
    if (!this.mediaStream) return;

    const options: MediaRecorderOptions = {};
    
    // Android向けコーデック最適化
    if (this.isAndroid) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }
    } else {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      }
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped');
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
    };
  }

  // 録音停止
  async stopRecording(): Promise<AudioRecording | null> {
    try {
      const duration = Date.now() - this.recordingStartTime;

      // MediaRecorder停止
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // ストリーム停止
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.onRecordingStateChange) {
        this.onRecordingStateChange(false);
      }

      // 録音データの処理
      if (this.audioChunks.length > 0) {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder?.mimeType || 'audio/wav' 
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        const recording: AudioRecording = {
          id: Date.now().toString(),
          timestamp: new Date(),
          audioBlob,
          audioUrl,
          duration
        };

        console.log('Recording completed successfully');
        return recording;
      }

      return null;

    } catch (error) {
      console.error('Recording stop failed:', error);
      return null;
    }
  }

  // コールバック設定
  setCallbacks(callbacks: {
    onRecordingStateChange?: (isRecording: boolean) => void;
    onError?: (error: string) => void;
    onAudioLevel?: (level: number) => void;
  }): void {
    this.onRecordingStateChange = callbacks.onRecordingStateChange;
    this.onError = callbacks.onError;
    this.onAudioLevel = callbacks.onAudioLevel;
  }

  // クリーンアップ
  cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioChunks = [];
    this.mediaRecorder = null;
  }

  // プラットフォーム情報取得
  getPlatformInfo(): { isAndroid: boolean; isChrome: boolean } {
    return {
      isAndroid: this.isAndroid,
      isChrome: this.isChrome
    };
  }
}

// React Hook
export const useAndroidVoiceRecognition = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(''); // 空文字列で初期化（バックエンドから取得）
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const voiceRecordingRef = useRef<AndroidVoiceRecording | null>(null);

  // 初期化
  useEffect(() => {
    voiceRecordingRef.current = new AndroidVoiceRecording();
    
    voiceRecordingRef.current.setCallbacks({
      onRecordingStateChange: setIsRecording,
      onError: setError,
      onAudioLevel: setAudioLevel
    });

    return () => {
      if (voiceRecordingRef.current) {
        voiceRecordingRef.current.cleanup();
      }
    };
  }, []);

  // 録音開始
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      
      if (voiceRecordingRef.current) {
        await voiceRecordingRef.current.startRecording();
      }
    } catch (error) {
      console.error('Start recording failed:', error);
      setError(error instanceof Error ? error.message : '録音開始に失敗しました');
    }
  }, []);

  // 録音停止
  const stopRecording = useCallback(async (): Promise<AudioRecording | null> => {
    try {
      if (voiceRecordingRef.current) {
        const recording = await voiceRecordingRef.current.stopRecording();
        return recording;
      }
      return null;
    } catch (error) {
      console.error('Stop recording failed:', error);
      setError(error instanceof Error ? error.message : '録音停止に失敗しました');
      return null;
    }
  }, []);

  // プラットフォーム情報
  const platformInfo = voiceRecordingRef.current?.getPlatformInfo() || {
    isAndroid: false,
    isChrome: false
  };

  return {
    isRecording,
    transcript,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    platformInfo
  };
};