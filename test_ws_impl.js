import { WebSocket } from 'ws';
import AdmZip from 'adm-zip';

// Create a mock DRG
const zip = new AdmZip();
zip.addFile('manifest.json', Buffer.from(JSON.stringify({
  steps: [
    { name: 'step1', param: '{{param1}}' },
    { name: 'step2', param: '{{param2}}' }
  ]
})));
const buffer = zip.toBuffer();

const ws = new WebSocket('ws://127.0.0.1:5175');

ws.on('open', () => {
  console.log('Connected to WS');
  ws.send(JSON.stringify({
    drgContent: buffer.toString('base64'),
    parameters: {
      param1: 'value1',
      param2: 'value2'
    }
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  const json = JSON.parse(data.toString());
  if (json.type === 'DONE') {
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('WS error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout!');
  process.exit(1);
}, 5000);
