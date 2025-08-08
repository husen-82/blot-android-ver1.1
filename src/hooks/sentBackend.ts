import { AudioRecording } from './IndexedDBAudio';

// バックエンドに音声データを送信する関数
// 音声データはAudioRecording型で、audioBlobとtranscriptを含む
export const sendAudioToBackend = async (
  audio: AudioRecording,
  backendUrl: string = 'https://settling-crisp-falcon.ngrok-free.app/api/transcribe' // 開発環境のバックエンドURL
): Promise<boolean> => {
  try {
    console.log('Sending audio to backend:', backendUrl);
    
    const formData = new FormData();
    formData.append('audio', audio.audioBlob, 'audio.wav');
    formData.append('timestamp', audio.timestamp.toISOString());
    formData.append('duration', audio.duration.toString());
    formData.append('audioId', audio.id);

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      headers: {
        // Content-Typeは自動設定されるため、FormDataの場合は設定しない
      }
    });

    if (response.ok) {
      console.log('Audio sent successfully to backend');
      return true;
    } else {
      console.error('Backend response error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('バックエンド送信エラー:', error);
    return false;
  }
};