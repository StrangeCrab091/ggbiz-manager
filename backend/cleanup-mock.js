require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Location = mongoose.model('Location', new mongoose.Schema({}, { strict: false }), 'locations');
  const del = await Location.deleteMany({ locationId: /^mock_/ });
  console.log('Deleted mock locations: ' + del.deletedCount);
  
  const remaining = await Location.find({});
  console.log('Remaining locations: ' + remaining.length);
  remaining.forEach((l, i) => console.log((i+1) + '. ' + l.locationId + ' - ' + l.title));
  
  await mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
