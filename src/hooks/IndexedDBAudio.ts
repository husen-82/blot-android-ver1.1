import { useState, useRef, useCallback, useEffect } from 'react';
import { sendAudioToBackend } from './sentBackend';

export interface AudioRecording {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
}

// IndexedDB管理クラス（音声データ専用）
class AudioIndexedDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'AudioRecordingDB';
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
        }
      };
    });
  }

  async saveAudio(recording: AudioRecording): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readwrite');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.put(recording);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAudio(id: string): Promise<AudioRecording | null> {
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

  async getAllAudio(): Promise<AudioRecording[]> {
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

  async deleteAudio(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readwrite');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.audioStore], 'readwrite');
      const store = transaction.objectStore(this.audioStore);
      
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// React Hook for Audio Recording with Backend Integration
export const useAudioRecording = () => {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const dbRef = useRef<AudioIndexedDB>(new AudioIndexedDB());

  // 初期化
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      await dbRef.current.init();
      const savedRecordings = await dbRef.current.getAllAudio();
      setRecordings(savedRecordings);
      console.log('Audio recordings loaded:', savedRecordings.length);
    } catch (error) {
      console.error('Audio DB initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  //追加Hook初回マウント時に自動初期化
  useEffect(() => {
    initialize();
  },[]); //空の依存配列で一度だけ実行

  // 音声録音を保存
  const saveAudioRecording = useCallback(async (recording: AudioRecording): Promise<void> => {
    try {
      await dbRef.current.saveAudio(recording);
      setRecordings(prev => [recording, ...prev]);
      console.log('Audio recording saved:', recording.id);
    } catch (error) {
      console.error('Failed to save audio recording:', error);
      throw error;
    }
  }, []);

  // バックエンドに音声を送信
  const sendAudioToBackendAndSave = useCallback(async (
    recording: AudioRecording, 
    backendUrl: string = 'https://settling-crisp-falcon.ngrok-free.app/api/transcribe'
  ): Promise<boolean> => {
    try {
      setIsSending(true);
      
      // バックエンドに送信
      const success = await sendAudioToBackend(recording, backendUrl);
      
      if (success) {
        console.log('Audio sent to backend successfully:', recording.id);
        return true;
      } else {
        console.error('Failed to send audio to backend');
        return false;
      }
    } catch (error) {
      console.error('Error sending audio to backend:', error);
      return false;
    } finally {
      setIsSending(false);
    }
  }, []);

  // 音声録音を削除
  const deleteAudioRecording = useCallback(async (id: string): Promise<void> => {
    try {
      const recording = recordings.find(r => r.id === id);
      if (recording) {
        URL.revokeObjectURL(recording.audioUrl);
      }

      await dbRef.current.deleteAudio(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      console.log('Audio recording deleted:', id);
    } catch (error) {
      console.error('Failed to delete audio recording:', error);
      throw error;
    }
  }, [recordings]);

  // 全ての音声録音を削除
  const clearAllAudioRecordings = useCallback(async (): Promise<void> => {
    try {
      // URLを解放
      recordings.forEach(recording => {
        URL.revokeObjectURL(recording.audioUrl);
      });

      await dbRef.current.clearAll();
      setRecordings([]);
      console.log('All audio recordings cleared');
    } catch (error) {
      console.error('Failed to clear audio recordings:', error);
      throw error;
    }
  }, [recordings]);

  // 音声再生
  const playAudio = useCallback((recording: AudioRecording): HTMLAudioElement => {
    const audio = new Audio(recording.audioUrl);
    
    audio.onerror = () => {
      console.error('Audio playback failed');
    };

    return audio;
  }, []);

  // 音声ダウンロード
  const downloadAudio = useCallback((recording: AudioRecording): void => {
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = `audio_${recording.timestamp.toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // 時間フォーマット
  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    recordings,
    isLoading,
    isSending,
    initialize,
    saveAudioRecording,
    sendAudioToBackendAndSave,
    deleteAudioRecording,
    clearAllAudioRecordings,
    playAudio,
    downloadAudio,
    formatDuration
  };
};