import { AudioRecording } from './IndexedDBAudio';

// バックエンドに音声データを送信する関数
// 音声データはAudioRecording型で、audioBlobとtranscriptを含む
export const sendAudioToBackend = async (
  audio: AudioRecording,
  backendUrl: string = '' // 開発環境のバックエンドURL ngrokでトンネリングしたwhisper.backendのURL
): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append('audio', audio.audioBlob, 'audio.wav');
    formData.append('transcript', audio.transcript);    
　　
    // 追加のメタデータが必要な場合はここに追加
    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
    });

    return response.ok;
  } catch (error) {
    console.error('バックエンド送信エラー:', error);
    return false;
  }
};