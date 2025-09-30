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

// Android最適化音声録音クラス（改善版）
class AndroidVoiceRecording {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  
  // Android検出
  private isAndroid: boolean = false;
  private isChrome: boolean = false;
  
  // 録音データ
  private audioChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  private isRecordingActive: boolean = false;
  
  // 音声レベル監視
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;
  
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
      // AudioContextの初期化（Android向け設定）
      const audioContextOptions: AudioContextOptions = {
        sampleRate: this.isAndroid ? 16000 : 44100,
        latencyHint: 'interactive'
      };

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)(audioContextOptions);
      
      // AudioContextの状態確認
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('AndroidVoiceRecording initialized successfully', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state
      });
    } catch (error) {
      console.error('AndroidVoiceRecording initialization failed:', error);
      throw new Error('音声録音の初期化に失敗しました');
    }
  }

  // 録音開始
  async startRecording(): Promise<void> {
    try {
      console.log('Starting recording...');
      
      if (this.isRecordingActive) {
        console.warn('Recording already active');
        return;
      }

      // AudioContextの初期化・再開
      if (!this.audioContext) {
        await this.initialize();
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // マイクアクセス許可の取得
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.isAndroid ? 16000 : 44100,
          channelCount: 1, // モノラル録音
          ...(this.isAndroid && {
            // Android固有の最適化
            latency: 0.1,
            volume: 1.0
          })
        }
      };

      console.log('Requesting microphone access with constraints:', constraints);
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Microphone access granted');

      // 音声レベル分析の設定
      if (this.audioContext) {
        this.setupAudioAnalysis();
      }

      // MediaRecorderの設定
      this.setupMediaRecorder();

      // 録音開始
      this.recordingStartTime = Date.now();
      this.audioChunks = [];
      this.isRecordingActive = true;

      // MediaRecorder開始
      if (this.mediaRecorder) {
        this.mediaRecorder.start(100); // 100msごとにデータを取得
        console.log('MediaRecorder started');
      }

      // 音声レベル監視開始
      this.startAudioLevelMonitoring();
      
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange(true);
      }

      console.log('Recording started successfully');

    } catch (error) {
      console.error('Recording start failed:', error);
      this.cleanup();
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error('マイクへのアクセスを許可してください');
        } else if (error.name === 'NotFoundError') {
          throw new Error('マイクが見つかりません');
        } else if (error.name === 'NotReadableError') {
          throw new Error('マイクが他のアプリケーションで使用中です');
        }
      }
      
      throw new Error('録音を開始できませんでした: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // 音声分析の設定
  private setupAudioAnalysis(): void {
    if (!this.audioContext || !this.mediaStream) return;

    try {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      console.log('Audio analysis setup complete');
    } catch (error) {
      console.error('Audio analysis setup failed:', error);
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
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options.mimeType = 'audio/wav';
      }
    } else {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options.mimeType = 'audio/wav';
      }
    }

    console.log('MediaRecorder options:', options);
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        console.log('Audio chunk received:', event.data.size, 'bytes');
      }
    };

    this.mediaRecorder.onstart = () => {
      console.log('MediaRecorder started');
    };

    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped');
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      if (this.onError) {
        this.onError('録音中にエラーが発生しました');
      }
    };
  }

  // 音声レベル監視開始
  private startAudioLevelMonitoring(): void {
    if (!this.analyser || !this.dataArray) return;

    this.audioLevelInterval = setInterval(() => {
      if (!this.analyser || !this.dataArray || !this.isRecordingActive) return;

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // 音声レベル計算
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      const level = average / 255; // 0-1の範囲に正規化

      if (this.onAudioLevel) {
        this.onAudioLevel(level);
      }
    }, 100); // 100msごとに更新
  }

  // 録音停止
  async stopRecording(): Promise<AudioRecording | null> {
    try {
      console.log('Stopping recording...');
      
      if (!this.isRecordingActive) {
        console.warn('Recording not active');
        return null;
      }

      this.isRecordingActive = false;
      const duration = Date.now() - this.recordingStartTime;

      // 音声レベル監視停止
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      // MediaRecorder停止
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        
        // MediaRecorderの停止完了を待つ
        await new Promise<void>((resolve) => {
          if (this.mediaRecorder) {
            this.mediaRecorder.onstop = () => {
              console.log('MediaRecorder stop event received');
              resolve();
            };
          } else {
            resolve();
          }
        });
      }

      // ストリーム停止
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
          console.log('Media track stopped:', track.kind);
        });
        this.mediaStream = null;
      }

      if (this.onRecordingStateChange) {
        this.onRecordingStateChange(false);
      }

      // 録音データの処理
      if (this.audioChunks.length > 0) {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/wav';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        const recording: AudioRecording = {
          id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          audioBlob,
          audioUrl,
          duration
        };

        console.log('Recording completed successfully:', {
          id: recording.id,
          duration: duration,
          blobSize: audioBlob.size,
          mimeType: mimeType
        });

        // リソースクリーンアップ
        this.cleanupRecordingResources();
        
        return recording;
      } else {
        console.warn('No audio chunks recorded');
        this.cleanupRecordingResources();
        return null;
      }

    } catch (error) {
      console.error('Recording stop failed:', error);
      this.cleanupRecordingResources();
      return null;
    }
  }

  // 録音リソースのクリーンアップ
  private cleanupRecordingResources(): void {
    this.audioChunks = [];
    this.mediaRecorder = null;
    this.analyser = null;
    this.dataArray = null;
    
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
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

  // 完全クリーンアップ
  cleanup(): void {
    console.log('Cleaning up AndroidVoiceRecording...');
    
    this.isRecordingActive = false;
    
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.cleanupRecordingResources();
  }

  // プラットフォーム情報取得
  getPlatformInfo(): { isAndroid: boolean; isChrome: boolean } {
    return {
      isAndroid: this.isAndroid,
      isChrome: this.isChrome
    };
  }

  // 録音状態取得
  getRecordingState(): boolean {
    return this.isRecordingActive;
  }
}

// React Hook
export const useAndroidVoiceRecognition = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const voiceRecordingRef = useRef<AndroidVoiceRecording | null>(null);

  // 初期化
  useEffect(() => {
    const initializeRecording = async () => {
      try {
        voiceRecordingRef.current = new AndroidVoiceRecording();
        
        voiceRecordingRef.current.setCallbacks({
          onRecordingStateChange: setIsRecording,
          onError: setError,
          onAudioLevel: setAudioLevel
        });

        await voiceRecordingRef.current.initialize();
        setIsInitialized(true);
        console.log('Voice recording initialized successfully');
      } catch (error) {
        console.error('Voice recording initialization failed:', error);
        setError(error instanceof Error ? error.message : '初期化に失敗しました');
        setIsInitialized(false);
      }
    };

    initializeRecording();

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
      
      if (!isInitialized || !voiceRecordingRef.current) {
        throw new Error('録音システムが初期化されていません');
      }
      
      await voiceRecordingRef.current.startRecording();
    } catch (error) {
      console.error('Start recording failed:', error);
      setError(error instanceof Error ? error.message : '録音開始に失敗しました');
      setIsRecording(false);
    }
  }, [isInitialized]);

  // 録音停止
  const stopRecording = useCallback(async (): Promise<AudioRecording | null> => {
    try {
      if (!voiceRecordingRef.current) {
        throw new Error('録音システムが利用できません');
      }
      
      const recording = await voiceRecordingRef.current.stopRecording();
      setAudioLevel(0); // 音声レベルをリセット
      return recording;
    } catch (error) {
      console.error('Stop recording failed:', error);
      setError(error instanceof Error ? error.message : '録音停止に失敗しました');
      setIsRecording(false);
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
    audioLevel,
    error,
    isInitialized,
    startRecording,
    stopRecording,
    platformInfo
  };
};