import{AudioRecording} from './IndexedDBAudio';

// バックエンドから文字起こし結果を取得する関数
export const fetchTranscribedText = async (
  audioId: string,
  backendUrl: string = 'https://settling-crisp-falcon.ngrok-free.app/api/transcribe'
): Promise<{ transcript: string; confidence?: number } | null> => {
  try {
    console.log('Fetching transcribed text for audio ID:', audioId);
    
    // GETリクエストで文字起こし結果を取得
    const response = await fetch(`${backendUrl}/${audioId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // serverが200okを返した場合のみ、jsonを解析
    if (response.status === 200) {
      const data = await response.json();
    
      if (data.transcript) {
        console.log('Transcribed text received:', data.transcript);
        return {
          transcript: data.transcript,
          confidence: data.confidence || undefined
        };
      }
    } else if (response.status === 404) {
      // 404（処理中）は結果なしとして処理を継続
      console.log('Transcription result not yet ready or ID not found (404).');
      return null;
    } else {
      console.error('Backend response error:', response.status, response.statusText);
      return null;
    }

    return null;
   
  } catch (error) {
    console.error('文字起こし結果取得エラー：', error);
    return null;
  }
};

// ポーリングで文字起こし結果を取得する関数
export const pollTranscribedText = async (
  audioId: string,
  backendUrl: string = 'https://settling-crisp-falcon.ngrok-free.app/api/transcribe',
  maxAttempts: number = 30,
  interval: number = 2000
): Promise<{ transcript: string; confidence?: number } | null> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fetchTranscribedText(audioId, backendUrl);
      
      if (result) {
        return result;
      }
      
      // 結果がまだない場合は待機
      if (attempt < maxAttempts - 1) {
        console.log(`Waiting for transcription... (${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error(`Polling attempt ${attempt + 1} failed:`, error);
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
  
  console.error('Max polling attempts reached, transcription failed');
  return null;
};