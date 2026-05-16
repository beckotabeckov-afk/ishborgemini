import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // API Route for TTS
  app.post('/api/tts', async (req, res) => {
    console.log('=== TTS REQUEST v3 ===');
    const { text } = req.body;
    const apiKey = process.env.YANDEX_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'YANDEX_API_KEY is not defined' });
    }

    try {
      const requestBody = {
        text: text,
        hints: [
          { voice: 'madi', lang: 'uz-UZ' }
        ],
        outputAudioSpec: {
          containerAudio: {
            containerAudioType: 'MP3'
          }
        }
      };

      console.log('Sending v3 request:', JSON.stringify(requestBody));

      const response = await fetch('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Yandex v3 response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Yandex v3 error:', errorText);
        return res.status(500).json({ error: `Yandex TTS v3 error: ${response.status}: ${errorText}` });
      }

      // Читаем тело как текст - это будут несколько JSON объектов
      const responseText = await response.text();

      // Разбиваем на отдельные JSON объекты и собираем аудио чанки
      const chunks: Buffer[] = [];
      const lines = responseText.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result?.audioChunk?.data) {
            chunks.push(Buffer.from(parsed.result.audioChunk.data, 'base64'));
          }
        } catch (e) {
          // пропускаем невалидные строки
        }
      }

      if (chunks.length === 0) {
        console.error('No audio chunks received');
        return res.status(500).json({ error: 'No audio data received' });
      }

      const audioBuffer = Buffer.concat(chunks);
      // Сохрани для отладки
      fs.writeFileSync('/tmp/test_audio.mp3', audioBuffer);
      console.log('Audio saved to /tmp/test_audio.mp3');

      console.log('Total chunks:', chunks.length);
      console.log('Total bytes:', audioBuffer.length);
      console.log('First 20 bytes hex:', audioBuffer.slice(0, 20).toString('hex'));
      console.log('Response Content-Type:', response.headers.get('content-type'));

      const audioBase64 = audioBuffer.toString('base64');
      res.json({ audioContent: audioBase64 });

    } catch (error) {
      console.error('TTS Error:', error);
      res.status(500).json({ error: 'Failed to synthesize speech' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
