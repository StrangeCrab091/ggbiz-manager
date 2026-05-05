const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
  try {
    const uri = process.env.MONGO_URI;
    console.log('Testing connection to:', uri.replace(/\/\/.*@/, '//****:****@'));
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connection SUCCESS!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection FAILED:', err.message);
    process.exit(1);
  }
};

testConnection();
