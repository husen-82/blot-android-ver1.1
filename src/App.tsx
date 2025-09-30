import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Wifi, WifiOff } from 'lucide-react';
import { AndroidOptimizedVoiceButton } from './components/AndroidOptimizedVoiceButton';
import { CalendarPopup } from './components/CalendarPopup';
import { MemoItem } from './components/MemoItem';
import { useMemos } from './hooks/IndexedDBMemo';
import { useAndroidVoiceRecognition } from './hooks/AndroidVoiceRecognition';
import { useAudioRecording } from './hooks/IndexedDBAudio';
import { sendAudioToBackend } from './hooks/sentBackend';
import { usePWAManager } from './hooks/PWAManager';

function App() {
  const [showCalendar, setShowCalendar] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { memos, sortedMemos, changeSortOrder, addAudioMemo, deleteMemo, updateMemoSizes } = useMemos();
  const { 
    isRecording, 
    audioLevel, 
    error, 
    isInitialized,
    startRecording, 
    stopRecording,
    platformInfo 
  } = useAndroidVoiceRecognition();
  
  const { 
    saveAudioRecording, 
    sendAudioToBackendAndSave,
    isLoading: audioDbLoading
  } = useAudioRecording();
  
  const { isOnline } = usePWAManager();

  const mainRef = useRef<HTMLDivElement>(null);

  // モバイルブラウザのビューポート高さ対応
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  // コンポーネントマウント時に並び順を「古い順」に設定
  useEffect(() => {
    changeSortOrder('oldest-first');
  }, [changeSortOrder]);

  // 30分ごとにメモサイズを更新
  useEffect(() => {
    const intervalId = setInterval(() => {
      updateMemoSizes();
    }, 1800000); // 30分
    
    return () => {
      clearInterval(intervalId);
    };
  }, [updateMemoSizes]);

  // エラー表示
  useEffect(() => {
    if (error) {
      console.error('Voice recognition error:', error);
    }
  }, [error]);

  // 音声入力処理（Android最適化版）
  const handleVoiceInput = async () => {
    try {
      if (!isInitialized) {
        console.error('Voice recording system not initialized');
        return;
      }

      if (isRecording) {
        setIsProcessing(true);
        const audioRecording = await stopRecording();
        
        if (audioRecording) {
          console.log('Audio recording completed:', audioRecording);
          
          // 1. IndexedDBに音声を保存
          await saveAudioRecording(audioRecording);
          console.log('Audio saved to IndexedDB');
          
          // 2. バックエンドに音声を送信
          const backendUrl = 'https://settling-crisp-falcon.ngrok-free.app/api/transcribe';
          const sendSuccess = await sendAudioToBackendAndSave(audioRecording, backendUrl);
          console.log('Backend send result:', sendSuccess);
          
          if (sendSuccess) {
            // 3. メモとして保存（バックエンドから文字起こし結果を取得）
            await addAudioMemo(audioRecording, backendUrl);
            console.log('Audio memo added successfully');
          } else {
            // バックエンド送信失敗時のフォールバック
            const fallbackMemo = {
              id: Date.now(),
              text: 'バックエンドへの送信に失敗しました。音声データは保存されています。',
              audioRecording,
              createdAt: Date.now(),
              currentSize: 1.0,
              type: 'audio' as const
            };
            // 直接メモリストに追加（IndexedDBには保存しない）
            console.warn('Backend send failed, showing fallback message');
          }
        } else {
          console.warn('No audio recording data received');
        }
        setIsProcessing(false);
      } else {
        await startRecording();
      }
    } catch (error) {
      console.error('音声入力エラー:', error);
      setIsProcessing(false);
    }
  };

  // ソートされたメモを取得
  const displayMemos = sortedMemos();

  // プラットフォーム情報の表示
  const getPlatformBadge = () => {
    if (platformInfo.isAndroid) {
      return (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
          Android最適化
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="flex flex-col bg-white font-sans app-container relative"
      style={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        minHeight: '-webkit-fill-available'
      }}
    >
      {/* プラットフォームバッジ */}
      {getPlatformBadge()}

      {/* Header - セーフエリア対応 */}
      <header 
        className="bg-[#f8f9fa] flex items-center justify-between px-4 border-b border-gray-200 relative"
        style={{
          height: 'max(5vh, 60px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          minHeight: '60px',
        }}
      >
        <h1 className="text-4xl md:text-2xl font-bold text-[#333333]">ふせん君</h1>
        
        {/* 接続状態インジケーター */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi size={20} className="text-green-500" />
          ) : (
            <WifiOff size={20} className="text-red-500" />
          )}
        </div>
      </header>

      {/* Main - 可変高さ */}
      <main 
        ref={mainRef}
        className="bg-white overflow-y-auto p-4 flex-1"
        style={{ 
          minHeight: '0',
          paddingBottom: 'max(15vh, 120px)',
        }}
      >
        {/* テキスト化パネル表示切り替えボタン */}
        {/* 音声認識状態表示 */}
        {(isRecording || isProcessing) && (
          <div className="fixed top-20 left-4 right-4 z-40 bg-red-500 text-white p-3 rounded-lg shadow-lg animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {isRecording ? '録音中...' : '処理中...'}
              </span>
              <div className="flex items-center gap-2">
                {isRecording && (
                  <>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm">{Math.round(audioLevel * 100)}%</span>
                  </>
                )}
                {isProcessing && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
            <div className="mt-2 text-sm bg-white bg-opacity-20 p-2 rounded">
              {isRecording && '音声を録音しています...'}
              {isProcessing && 'バックエンドで文字起こし処理中...'}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {displayMemos.length === 0 ? (
            <div className="text-center text-gray-500 mt-16">
              <p className="text-lg">音声入力ボタンをタップして</p>
              <p className="text-lg">メモを作成してください</p>
              {platformInfo.isAndroid && (
                <p className="text-sm mt-2 text-blue-600">Android向けに最適化されています</p>
              )}
            </div>
          ) : (
            displayMemos.map((memo) => (
              <MemoItem 
                key={memo.id} 
                memo={memo} 
                onDelete={() => deleteMemo(memo.id)}
              />
            ))
          )}
        </div>
      </main>

      {/* Footer - セーフエリア対応 */}
      <footer 
        className="bg-transparent flex items-center justify-between px-4 fixed bottom-0 left-0 right-0"
        style={{
          height: 'max(15vh, 120px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
          minHeight: '120px',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div className="flex-1" style={{ pointerEvents: 'none' }}></div>
        
        {/* Calendar Button */}
        <div 
          className="flex-1 flex justify-start"
          style={{ 
            pointerEvents: 'auto',
            position: 'absolute',
            left: '30px',
          }}
        >
          <button
            onClick={() => setShowCalendar(true)}
            className="w-12 h-12 rounded-full bg-[#796baf] text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-95 hover:opacity-80"
            style={{
              minWidth: '90px',
              minHeight: '90px',
              maxWidth: '90px',
              maxHeight: '90px',
            }}
          >
            <Calendar size={50} />
          </button>
        </div>
        
{/* Android最適化音声入力ボタン */}
        <div 
          className="flex-1 flex justify-center"
          style={{ pointerEvents: 'auto' }}
        >
          <AndroidOptimizedVoiceButton
            isRecording={isRecording}
            audioLevel={audioLevel}
            onStartRecording={handleVoiceInput}
            onStopRecording={handleVoiceInput}
            disabled={isProcessing || audioDbLoading || !isInitialized}
          />
          {(!isInitialized || audioDbLoading) && (
            <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
              初期化中...
            </div>
          )}
        </div>
          )}
        </div>

        <div className="flex-1" style={{ pointerEvents: 'none' }}></div>
      </footer>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className="fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-transparent" 
            onClick={() => setShowCalendar(false)}
          />
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '90vw',
              height: '80vh',
              maxWidth: '90vw',
              maxHeight: '80vh',
            }}
          >
            <CalendarPopup onClose={() => setShowCalendar(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;