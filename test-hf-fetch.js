// Quick test script to check HuggingFace data format
import axios from 'axios';

async function testFetch() {
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

    console.log('Response received!');
    console.log('Number of rows:', response.data.rows?.length);

    if (response.data.rows && response.data.rows.length > 0) {
      const firstRow = response.data.rows[0];
      console.log('\nFirst row structure:');
      console.log('- row_idx:', firstRow.row_idx);
      console.log('- row keys:', Object.keys(firstRow.row));

      const rowData = firstRow.row;
      console.log('\nRow data:');
      console.log('- path:', rowData.path);
      console.log('- task_binary type:', typeof rowData.task_binary);
      console.log('- task_binary constructor:', rowData.task_binary?.constructor?.name);

      if (rowData.task_binary) {
        if (typeof rowData.task_binary === 'string') {
          console.log('- task_binary length:', rowData.task_binary.length);
          console.log('- task_binary first 100 chars:', rowData.task_binary.substring(0, 100));
        } else if (Buffer.isBuffer(rowData.task_binary)) {
          console.log('- task_binary is Buffer, size:', rowData.task_binary.length);
        } else if (Array.isArray(rowData.task_binary)) {
          console.log('- task_binary is Array, length:', rowData.task_binary.length);
          console.log('- First few bytes:', rowData.task_binary.slice(0, 10));
        } else if (typeof rowData.task_binary === 'object') {
          console.log('- task_binary is object with keys:', Object.keys(rowData.task_binary));
          console.log('- Full object:', JSON.stringify(rowData.task_binary).substring(0, 200));
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testFetch();
