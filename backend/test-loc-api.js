const http = require('http');
const fs = require('fs');

http.get('http://localhost:5000/api/locations', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('api-loc-result.json', data, 'utf8');
    console.log('Saved to api-loc-result.json');
    console.log('Status:', res.statusCode);
    process.exit(0);
  });
}).on('error', e => {
  console.error('Error:', e.message);
  process.exit(1);
});
