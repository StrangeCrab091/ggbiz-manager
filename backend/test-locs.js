const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { getLocations } = require('./src/services/googleBusiness.service');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
    
    // Test getLocations
    const authModel = require('./src/models/auth.model');
    const authInfo = await authModel.findOne({ accountId: 'system' });
    console.log('authInfo in DB:', !!authInfo);
    
    const locs = await getLocations();
    console.log('Success, locs:', JSON.stringify(locs, null, 2));
  } catch (error) {
    console.error('Test Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

test();
process.on('uncaughtException', err => require('fs').writeFileSync('err.txt', err.stack)); process.on('unhandledRejection', err => require('fs').writeFileSync('err.txt', err.stack));
