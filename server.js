const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { createCanvas } = require('canvas');

const PORT = 8080;
const WIDTH = 320;
const HEIGHT = 240;

const server = http.createServer(); // No website

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📷 ESP32-CAM connected');

  ws.on('message', (data) => {
    console.log(`📥 Received frame (${data.length} bytes)`);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(WIDTH, HEIGHT);

    for (let i = 0, j = 0; i < data.length; i += 2, j += 4) {
      const value = data.readUInt16BE(i);
      const r = ((value >> 11) & 0x1F) * 255 / 31;
      const g = ((value >> 5) & 0x3F) * 255 / 63;
      const b = (value & 0x1F) * 255 / 31;

      imgData.data[j] = r;
      imgData.data[j + 1] = g;
      imgData.data[j + 2] = b;
      imgData.data[j + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    const out = fs.createWriteStream('output.png');
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => {
      console.log('💾 Saved image as output.png');
    });
  });

  ws.on('close', () => {
    console.log('❌ ESP32-CAM disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
