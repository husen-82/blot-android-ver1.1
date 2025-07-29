export const fetchTranscribedText = async (
  audioBlob: Blob,
  transcript: string,
  backendUrl: string = 'http://localhost:5000/api/transcribe'
): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('transcript', transcript);

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.transcript ?? null;
  } catch (error) {
    console.error('バックエンド取得エラー:', error);
    return null;
  }
};