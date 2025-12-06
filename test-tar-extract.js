// Test tar extraction
import axios from 'axios';
import * as tar from 'tar';
import { Readable } from 'stream';

async function testExtract() {
  try {
    console.log('Fetching from HuggingFace...');
    const response = await axios.get('https://datasets-server.huggingface.co/rows', {
      params: {
        dataset: 'DCAgent/selfinstruct-naive-sandboxes-1',
        config: 'default',
        split: 'train',
        offset: 0,
        length: 1,
      },
    });

    const rowData = response.data.rows[0].row;
    const taskBinary = rowData.task_binary;

    console.log('Task binary type:', typeof taskBinary);
    console.log('Task binary length:', taskBinary.length);
    console.log('First 50 chars:', taskBinary.substring(0, 50));

    // Convert base64 to buffer
    const buffer = Buffer.from(taskBinary, 'base64');
    console.log('Buffer size:', buffer.length, 'bytes');

    // Check if it's gzip compressed
    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
    console.log('Is gzip compressed:', isGzip);

    // Try to extract
    console.log('\nExtracting tar...');
    const files = [];
    const stream = Readable.from(buffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(tar.t({
          onentry: (entry) => {
            console.log('Found file:', entry.path, 'type:', entry.type, 'size:', entry.size);
            files.push({
              path: entry.path,
              type: entry.type,
              size: entry.size,
            });
          },
        }))
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log('\nTotal files extracted:', files.length);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testExtract();
