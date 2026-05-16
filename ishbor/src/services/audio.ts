let audioCtx: AudioContext | null = null;

export async function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

export async function playAudioFromBase64(base64: string): Promise<void> {
  // Check if string contains JSON error structure
  if (base64.length < 100 || base64.includes('{"error"')) {
    console.error("Invalid audio data. Likely error response:", base64);
    throw new Error("Invalid audio data");
  }

  // Detect if it is MP3 (Narakeet) or PCM (Gemini)
  // Simple detection: MP3 files often start with ID3 or some other non-PCM pattern
  // Actually, Gemini responses are PCM, they won't look like MP3s.
  // A better check: Narakeet responses are MP3. 
  // Let's try to play as MP3 first via Audio element if it looks like it's NOT just raw bytes.
  
  // Revised approach: Use AudioContext for everything if possible
  // Or keep PCM path for PCM, and use Audio element for MP3.
  
  // Let's check for MP3 signature (starts with ID3 or FF FB)
  const isMp3 = base64.startsWith('SUQz') || base64.startsWith('//'); // ID3 is SUQz in base64
  
  if (isMp3) {
      return new Promise((resolve) => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(e => {
          console.error("Audio playback error:", e);
          URL.revokeObjectURL(url);
          resolve();
        });
      });
  }

  const ctx = await initAudioContext();

  // Gemini TTS returns Int16 PCM at 24000Hz (mono)
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // FIX: Ensure correct buffer alignment for Int16Array
    const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const float32Data = new Float32Array(pcmData.length);
    
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.copyToChannel(float32Data, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  } catch (err) {
    console.error("Audio playback error:", err);
    throw err;
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private onSilence: (() => void) | null = null;

  async start(onSilence?: () => void) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.onSilence = onSilence || null;

    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start();

    if (onSilence) {
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSilence = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average < 10) { // Silence threshold
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              if (this.onSilence) this.onSilence();
            }, 1000); // 1 second of silence
          }
        } else {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        }
        requestAnimationFrame(checkSilence);
      };
      checkSilence();
    }
  }

  async stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve("");
      
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
      if (this.audioCtx) this.audioCtx.close();
      this.audioCtx = null;
      this.analyser = null;

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64 || "");
        };
        reader.readAsDataURL(blob);
        
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
      };
      this.mediaRecorder.stop();
    });
  }
}
