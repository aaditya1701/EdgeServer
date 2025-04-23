const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { createCanvas } = require('canvas');
const { exec } = require('child_process');  // Use exec to run YOLOv5 from command line

const PORT = 8080;
const WIDTH = 320;
const HEIGHT = 240;

const server = http.createServer(); // No website

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📷 ESP32-CAM connected');

  ws.on('message', (data) => {
    console.log(`📥 Received frame (${data.length} bytes)`);

    // Extract MAC address (first 17 bytes)
    const macAddress = data.slice(0, 17).toString();
    console.log(`🔑 MAC Address: ${macAddress}`);

    // Ensure MAC address is valid and replace null bytes
    const sanitizedMacAddress = macAddress.replace(/\x00/g, '').replace(/:/g, '-');

    // The remaining data contains the image
    const imageData = data.slice(17);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(WIDTH, HEIGHT);

    for (let i = 0, j = 0; i < imageData.length; i += 2, j += 4) {
      const value = imageData.readUInt16BE(i);
      const r = ((value >> 11) & 0x1F) * 255 / 31;
      const g = ((value >> 5) & 0x3F) * 255 / 63;
      const b = (value & 0x1F) * 255 / 31;

      imgData.data[j] = r;
      imgData.data[j + 1] = g;
      imgData.data[j + 2] = b;
      imgData.data[j + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    // Save the image with sanitized MAC address
    const out = fs.createWriteStream(`output_${sanitizedMacAddress}.png`);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => {
      console.log(`💾 Saved image as output_${sanitizedMacAddress}.png`);

      // Step 1: Run YOLOv5 on the saved image
      const yolov5Path = 'E:\\yolov5\\yolov5'; // Update this to the actual path of your YOLOv5 repo
      const yoloCommand = `python ${yolov5Path}/detect.py --source output_${sanitizedMacAddress}.png --weights ${yolov5Path}/best.pt --img-size 640 --conf 0.25 --save-txt`;

      exec(yoloCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing YOLOv5: ${error}`);
          return;
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }

        console.log(`stdout: ${stdout}`);

        // Step 2: Read the detection output file to count vehicles
        const resultsFile = `runs/detect/exp/labels/output_${sanitizedMacAddress}.txt`;
        fs.readFile(resultsFile, 'utf8', (err, data) => {
          if (err) {
            console.error('Error reading YOLOv5 output:', err);
            return;
          }

          // Count the number of 'car' detections
          const vehicleCount = data.split('\n').filter(line => line.includes('car')).length;
          console.log(`🚗 Vehicle Count: ${vehicleCount}`);
        });
      });
    });
  });

  ws.on('close', () => {
    console.log('❌ ESP32-CAM disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
