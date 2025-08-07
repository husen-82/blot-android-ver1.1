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
  transcript: string;
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
}

// Android最適化音声認識クラス
class AndroidVoiceRecognition {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private speechRecognition: any = null;
  
  // Android検出
  private isAndroid: boolean = false;
  private isChrome: boolean = false;
  
  // 録音データ
  private audioChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  
  // コールバック
  private onTranscriptUpdate?: (transcript: string) => void;
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
      // モバイル環境での初期化を簡素化
      if (this.isAndroid) {
        console.log('Android environment detected - using simplified initialization');
        return;
      }
      
      // AudioContextの初期化
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.isAndroid ? 16000 : 44100, // Android向け最適化
        latencyHint: 'interactive'
      });

      // AudioWorkletの読み込み（エラーハンドリング強化）
      try {
        await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      } catch (error) {
        console.warn('AudioWorklet loading failed, using fallback:', error);
        // AudioWorkletが使用できない場合はフォールバック
      }
      
      console.log('AndroidVoiceRecognition initialized successfully');
    } catch (error) {
      console.error('AndroidVoiceRecognition initialization failed:', error);
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
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
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
      
      // AudioWorkletNodeの作成（エラーハンドリング追加）
      try {
        if (this.audioContext && !this.isAndroid) {
          this.audioWorkletNode = new AudioWorkletNode(
            this.audioContext,
            'android-audio-processor'
          );

          // AudioWorkletメッセージハンドラー
          this.audioWorkletNode.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch (type) {
              case 'recording-started':
                console.log('AudioWorklet recording started');
                break;
              case 'recording-complete':
                this.handleAudioWorkletComplete(event.data);
                break;
              /*case 'audio-level':
                if (this.onAudioLevel) {
                  this.onAudioLevel(data.rms);
                }
                break;*/
              case 'silence-detected':
                console.log('Silence detected:', data);
                break;
              case 'buffer-overflow':
                console.warn('Audio buffer overflow:', data.message);
                this.stopRecording();
                break;
            }
          };

          // 音声ストリームをAudioWorkletに接続
          const source = this.audioContext.createMediaStreamSource(this.mediaStream);
          source.connect(this.audioWorkletNode);
          this.audioWorkletNode.connect(this.audioContext.destination);
        }
      } catch (error) {
        console.warn('AudioWorklet setup failed, using MediaRecorder only:', error);
      }

      // MediaRecorderの設定（フォールバック用）
      this.setupMediaRecorder();

      // Web Speech APIの設定（利用可能な場合）
      this.setupSpeechRecognition();

      // 録音開始
      this.recordingStartTime = Date.now();
      this.audioChunks = [];

      // AudioWorkletに録音開始を通知
      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({
          command: 'start',
          data: {
            sampleRate: this.isAndroid ? 16000 : 44100,
            noiseGate: 0.005,
            silenceThreshold: 0.01
          }
        });
      }

      // MediaRecorder開始
      if (this.mediaRecorder) {
        this.mediaRecorder.start(100);
      }

      // Speech Recognition開始
      if (this.speechRecognition) {
        this.speechRecognition.start();
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

  // Web Speech APIの設定
  private setupSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech Recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognition = new SpeechRecognition();

    // Android向け設定最適化
    this.speechRecognition.lang = 'ja-JP';
    this.speechRecognition.continuous = !this.isAndroid; // Androidでは連続認識を無効
    this.speechRecognition.interimResults = true;
    this.speechRecognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';

    this.speechRecognition.onresult = (event: any) => {
      finalTranscript = '';
      interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combinedTranscript = finalTranscript + interimTranscript;
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(combinedTranscript);
      }
    };

    /*this.speechRecognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);*/
      
      // Android向けエラーハンドリング
      if (this.isAndroid && event.error === 'no-speech') {
        // Androidでは無音エラーを無視
        return;
      }
      
      if (this.onError) {
        this.onError(`音声認識エラー: ${event.error}`);
      }
    };

    this.speechRecognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Android向け自動再起動
      if (this.isAndroid && this.mediaStream) {
        setTimeout(() => {
          if (this.speechRecognition && this.mediaStream) {
            try {
              this.speechRecognition.start();
            } catch (error) {
              console.log('Speech recognition restart failed:', error);
            }
          }
        }, 100);
      }
    };
  }

  // AudioWorklet完了処理
  private handleAudioWorkletComplete(data: any): void {
    console.log('AudioWorklet recording complete:', data);
    // 必要に応じて高品質音声データの処理を実装
  }

  // 録音停止
  async stopRecording(): Promise<AudioRecording | null> {
    try {
      const duration = Date.now() - this.recordingStartTime;

      // AudioWorklet停止
      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({ command: 'stop' });
        this.audioWorkletNode.disconnect();
        this.audioWorkletNode = null;
      }

      // MediaRecorder停止
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // Speech Recognition停止
      if (this.speechRecognition) {
        this.speechRecognition.stop();
        this.speechRecognition = null;
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
          transcript: '', // 最終的な文字起こし結果
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
      return null; // エラーでもnullを返して継続
    }
  }

  // コールバック設定
  setCallbacks(callbacks: {
    onTranscriptUpdate?: (transcript: string) => void;
    onRecordingStateChange?: (isRecording: boolean) => void;
    onError?: (error: string) => void;
    onAudioLevel?: (level: number) => void;
  }): void {
    this.onTranscriptUpdate = callbacks.onTranscriptUpdate;
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
    
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioChunks = [];
    this.speechRecognition = null;
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
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const voiceRecognitionRef = useRef<AndroidVoiceRecognition | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  // 初期化
  useEffect(() => {
    voiceRecognitionRef.current = new AndroidVoiceRecognition();
    
    voiceRecognitionRef.current.setCallbacks({
      onTranscriptUpdate: (newTranscript) => {
        accumulatedTranscriptRef.current = newTranscript;
        setTranscript(newTranscript);
      },
      onRecordingStateChange: setIsRecording,
      onError: setError,
      onAudioLevel: setAudioLevel
    });

    return () => {
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.cleanup();
      }
    };
  }, []);

  // 録音開始
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      accumulatedTranscriptRef.current = '';
      setTranscript('');
      
      if (voiceRecognitionRef.current) {
        await voiceRecognitionRef.current.startRecording();
      }
    } catch (error) {
      console.error('Start recording failed:', error);
      setError(error instanceof Error ? error.message : '録音開始に失敗しました');
    }
  }, []);

  // 録音停止
  const stopRecording = useCallback(async (): Promise<AudioRecording | null> => {
    try {
      if (voiceRecognitionRef.current) {
        const recording = await voiceRecognitionRef.current.stopRecording();
        
        if (recording && accumulatedTranscriptRef.current) {
          recording.transcript = accumulatedTranscriptRef.current;
        }
        
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
  const platformInfo = voiceRecognitionRef.current?.getPlatformInfo() || {
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