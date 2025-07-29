import { useState, useRef, useCallback } from 'react';

declare global {
  interface Window {
    Module: EmscriptenModule & {
      //index.htmlから特定されたAPI
      init: (modelName: string) => number; //モデル名を文字列で受け取り、コンテキストポインタを変えす
      full_default: (
        instancePtr: number,
        audioDatePtr: number,
        language: string,
        nthreads: number,
        translate: coolean
      ) => string; //文字起こし結果の文字列を返すことを期待

      //Emscriptenが提供する一般的なユーティリティー関数
      _malloc: (size: number) => number;
      _free: (ptr: number) => void;
      HEAPF32: Float32Array;
      UTF8ToString: (ptr: number) => string;
      // stringToUTF8: (str: string, outPtr: number, maxBytes: number) => void; // 必要に応じて追加
      // FS: any; // ファイルシステム操作用 (もし必要なら)
      calledRun: boolean; // ランタイムが実行されたかどうか
    };
  }
}

interface EmscriptenModule{
  onRuntimeInitialized?: () => void;
  // その他定義
  calledRun?: boolen;
}

export interface AudioRecording {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
  transcription?: string;
  isTranscribed: boolean;
}

export interface TranscriptionProgress {
  stage: 'preparing' | 'loading' | 'converting' | 'transcribing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

// IndexedDB管理クラス
class WhisperTranscriptionDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'WhisperTranscriptionDB';
  private readonly version = 1;
  private readonly audioStore = 'audioRecordings';

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.audioStore)) {
          const store = db.createObjectStore(this.audioStore, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('isTranscribed', 'isTranscribed', { unique: false });
        }
      };
    });
  }

  async saveRecording(recording: AudioRecording): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readwrite');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.put(recording);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecording(id: string): Promise<AudioRecording | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readonly');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Blob URLを再生成
          result.audioUrl = URL.createObjectURL(result.audioBlob);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecordings(): Promise<AudioRecording[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readonly');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.map((item: AudioRecording) => ({
          ...item,
          audioUrl: URL.createObjectURL(item.audioBlob)
        }));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readwrite');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Whisper.wasm管理クラス
class WhisperTranscriber {
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private whisperContextPtr: number | null = null; //Whisperコンテキストへのポインタ

  async loadWhisper(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise((resolve, reject) => {
      // libmain.jsを動的に読み込み
      const script = document.createElement('script');
      script.src = 'https://whisper-wasm-demo.netlify.app/libmain.js';
      script.onload = () => {
        // Moduleの設定
        window.Module = window.Module || {};
        window.Module.locateFile = (path: string, prefix: string) => {

          const BASE_WASM_URL = 'https://whisper-wasm-demo.netlify.app/';
          
          if (path.endsWith('.wasm')) {
            return BASE_WASM_URL + 'whisper.wasm';
          }
          if (path.endsWith('.bin')) {
            return BASE_WASM_URL + 'ggml-tiny.en.bin';
          }
          // libmain.js が他のJSファイルを参照する場合（例: helpers.js など）
          // libmain.jsと同じ場所に置いていれば、prefixだけでOK
          if (path.endsWith('.js') && !path.startsWith('http')) {
              return BASE_WASM_URL + path; // 例：helpers.js など
          }
          return prefix + path;
        };

        // Moduleの初期化完了を待つ
        if (window.Module.calledRun) { // calledRunはEmscriptenがランタイムが実行されたかを示すフラグ
            this.isLoaded = true;
            resolve();
        } else {
            window.Module.onRuntimeInitialized = () => {
                this.isLoaded = true;
                resolve();
            };
        }
      };
      script.onerror = () => reject(new Error('Whisper.wasmの読み込みに失敗しました'));
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  // Whisperコンテキストの初期化メソッドを追加
  private async initializeWhisperContext(): Promise<void> {
    if (this.whisperContextPtr !== null) {
      console.log("Whisper context already initialized.");
      return;
    }

    await this.loadWhisper(); // WASMとグルーコードがロードされるのを待つ

    if (!window.Module || typeof window.Module.init !== 'function') {
      throw new Error("Whisper Module or init function not available after loading.");
    }

    try {
      console.log("Initializing Whisper context with ggml-tiny.en.bin...");
      // Module.init を呼び出してコンテキストを取得
      this.whisperContextPtr = window.Module.init('ggml-tiny.en.bin');

      if (!this.whisperContextPtr) {
        throw new Error("Module.init returned null/0. Failed to get Whisper context.");
      }
      console.log("Whisper context initialized successfully. Pointer:", this.whisperContextPtr);
    } catch (error) {
      console.error("Error initializing Whisper context:", error);
      this.whisperContextPtr = null;
      throw error;
    }
  }

  async transcribeAudio(
    audioBlob: Blob, 
    onProgress: (progress: TranscriptionProgress) => void
  ): Promise<string> {
    try {
      // Whisper.wasmの読み込み
      onProgress({
        stage: 'loading',
        progress: 10,
        message: 'Whisper.wasmを読み込み中...'
      });

      await this.loadWhisper();// libmain.js と WASM がロードされるのを待つ

      //コンテキストの初期化
      //transcribeAudioが呼ばれるたび初期化でなく、アプリのライフサイクルで一度のみ
      await this.initializeWhisperContext();

      // 音声データの変換
      onProgress({
        stage: 'converting',
        progress: 30,
        message: '音声データを変換中...'
      });

      const audioData = await this.convertAudioForWhisper(audioBlob);

      // 文字起こし実行
      onProgress({
        stage: 'transcribing',
        progress: 60,
        message: '音声を文字起こし中...'
      });

      // Whisperによる文字起こし（実際のAPIに合わせて調整が必要）
      const result = await this.performTranscription(audioData);

      onProgress({
        stage: 'complete',
        progress: 100,
        message: '文字起こし完了'
      });

      return result;

    } catch (error) {
      onProgress({
        stage: 'error',
        progress: 0,
        message: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      });
      throw error;
    }
  }

  private async convertAudioForWhisper(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // 16kHz, モノラルに変換
    const targetSampleRate = 16000;
    const audioData = audioBuffer.getChannelData(0);
    
    if (audioBuffer.sampleRate !== targetSampleRate) {
      return this.resampleAudio(audioData, audioBuffer.sampleRate, targetSampleRate);
    }
    
    return audioData;
  }

  private resampleAudio(
    audioData: Float32Array, 
    originalSampleRate: number, 
    targetSampleRate: number
  ): Float32Array {
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const index = Math.floor(i * ratio);
      result[i] = audioData[index];
    }
    
    return result;
  }

  private async performTranscription(audioData: Float32Array): Promise<string> {
    if (!this.whisperContextPtr) {
      throw new Error("Whisper context not initialized. Call initializeWhisperContext() first.");
    }
    if (!window.Module || typeof window.Module.full_default !== 'function') {
      throw new Error("Whisper Module API (full_default) not available.");
    }

    //wasm ヒープに音声データ割り当ててコピー
     const n_samples = audioData.length;
    const audioPtr = window.Module._malloc(n_samples * Float32Array.BYTES_PER_ELEMENT);
    window.Module.HEAPF32.set(audioData, audioPtr / Float32Array.BYTES_PER_ELEMENT);

    let result: string = '';

   try {
      console.log("Starting Whisper.wasm transcription...");
      // Module.full_default を呼び出す
      // 引数の順序と型に注意: instance, audioDataPtr, language, nthreads, translate
      // 言語は 'en' (英語) をデフォルトとしますが、必要に応じて引数で渡せるようにする
      const language = "en"; // または引数から受け取る
      const nthreads = 4; // または引数から受け取る
      const translate = false; // または引数から受け取る

      const ret = window.Module.full_default(
        this.whisperContextPtr,
        audioPtr,
        language,
        nthreads,
        translate
      );

     // full_default の戻り値が直接文字列であると仮定
      result = ret; 
      console.log("Transcription completed. Result:", result);

    } catch (error) {
      console.error("Error during Whisper.wasm transcription:", error);
      result = `文字起こし中にエラーが発生しました: ${error.message || error}`;
      throw error; // エラーを再スロー
    } finally {
      // WASM ヒープからメモリを解放
      if (audioPtr) {
        window.Module._free(audioPtr);
      }
      // Whisper コンテキスト自体は再利用するのでここでは解放しない
    }

    return result; 
  } 

  // Whisper コンテキストを解放するメソッド (アプリケーション終了時など、必要であれば)
  // libmain.js や C++ コードで _whisper_free_context のような関数が公開されているか確認
  public freeWhisperContext(): void {
      if (this.whisperContextPtr && window.Module && typeof window.Module._whisper_free_context === 'function') { // 仮の関数名
          window.Module._whisper_free_context(this.whisperContextPtr);
          this.whisperContextPtr = null;
          console.log("Whisper context freed.");
      } else {
          console.warn("Whisper context free function not found or context not initialized.");
      }
  }
}
  


export const useWhisperTranscription = () => {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const dbRef = useRef<WhisperTranscriptionDB>(new WhisperTranscriptionDB());
  const transcriberRef = useRef<WhisperTranscriber>(new WhisperTranscriber());

  // 初期化
  const initialize = useCallback(async () => {
    try {
      await dbRef.current.init();
      const savedRecordings = await dbRef.current.getAllRecordings();
      setRecordings(savedRecordings);

      await transcriberRef.current.initializeWhisperContext();
      
    } catch (error) {
      console.error('初期化エラー:', error);
      setTranscriptionProgress({
        stage: 'error',
        progress: 0,
        message: `初期化エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      });
      }
  }, []);

  // 録音開始
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1 // モノラル録音
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/wav'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

    } catch (error) {
      console.error('録音開始エラー:', error);
      throw new Error('マイクへのアクセスを許可してください');
    }
  }, []);

  // 録音停止
  const stopRecording = useCallback((): Promise<AudioRecording> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        reject(new Error('録音が開始されていません'));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          const duration = Date.now() - recordingStartTimeRef.current;
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorderRef.current?.mimeType || 'audio/wav' 
          });
          const audioUrl = URL.createObjectURL(audioBlob);

          const recording: AudioRecording = {
            id: Date.now().toString(),
            audioBlob,
            audioUrl,
            duration,
            timestamp: new Date(),
            isTranscribed: false
          };

          // IndexedDBに保存
          await dbRef.current.saveRecording(recording);
          
          setRecordings(prev => [recording, ...prev]);
          resolve(recording);

        } catch (error) {
          reject(error);
        } finally {
          // リソースクリーンアップ
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  // 文字起こし実行
  const transcribeAudio = useCallback(async (recordingId: string): Promise<void> => {
    try {
      setIsTranscribing(true);
      setTranscriptionProgress({
        stage: 'preparing',
        progress: 0,
        message: '準備中...'
      });

      const recording = recordings.find(r => r.id === recordingId);
      if (!recording) {
        throw new Error('録音データが見つかりません');
      }

      await transcriberRef.current.initializeWhisperContext();(
        recording.audioBlob,
        setTranscriptionProgress
      );

      // 結果を更新
      const updatedRecording = {
        ...recording,
        transcription,
        isTranscribed: true
      };

      await dbRef.current.saveRecording(updatedRecording);
      
      setRecordings(prev => 
        prev.map(r => 
          r.id === recordingId ? updatedRecording : r
        )
      );

    } catch (error) {
      console.error('文字起こしエラー:', error);
      setTranscriptionProgress({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '文字起こしに失敗しました'
      });
    } finally {
      setIsTranscribing(false);
      setTimeout(() => {
        setTranscriptionProgress(null);
      }, 3000);
    }
  }, [recordings]);

  // 録音削除
  const deleteRecording = useCallback(async (recordingId: string) => {
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (recording) {
        URL.revokeObjectURL(recording.audioUrl);
      }

      await dbRef.current.deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    } catch (error) {
      console.error('削除エラー:', error);
    }
  }, [recordings]);

  // 時間フォーマット
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    recordings,
    isRecording,
    isTranscribing,
    transcriptionProgress,
    initialize,
    startRecording,
    stopRecording,
    transcribeAudio,
    deleteRecording,
    formatDuration
  };
}; 