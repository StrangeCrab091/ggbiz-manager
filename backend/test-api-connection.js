require('dotenv').config();
const { google } = require('googleapis');
const mongoose = require('mongoose');
const fs = require('fs');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

async function test() {
  const result = {};
  
  await mongoose.connect(process.env.MONGO_URI);
  result.step1_mongo = 'OK';
  
  const Auth = mongoose.model('Auth', new mongoose.Schema({}, { strict: false }));
  const authData = await Auth.findOne({ accountId: 'system' });
  
  result.step1_hasTokens = !!(authData && authData.tokens);
  result.step1_hasRefreshToken = !!(authData?.tokens?.refresh_token);
  result.step1_expiryDate = authData?.tokens?.expiry_date ? new Date(authData.tokens.expiry_date).toISOString() : null;
  result.step1_isExpired = authData?.tokens?.expiry_date ? authData.tokens.expiry_date < Date.now() : null;
  
  if (authData && authData.tokens) {
    oauth2Client.setCredentials(authData.tokens);
  }

  // Step 2: Accounts
  try {
    const accRes = await oauth2Client.request({
      url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    });
    result.step2_status = 200;
    result.step2_accounts = (accRes.data.accounts || []).map(a => ({ name: a.name, accountName: a.accountName }));
  } catch (error) {
    result.step2_status = error.response?.status || 'error';
    result.step2_errorCode = error.response?.data?.error?.status || error.message;
  }

  // Step 3: Locations
  const accId = result.step2_accounts?.[0]?.name;
  if (accId) {
    try {
      const locUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${accId}/locations?readMask=name,title`;
      result.step3_url = locUrl;
      const locRes = await oauth2Client.request({ url: locUrl });
      result.step3_status = 200;
      result.step3_locations = locRes.data.locations || [];
    } catch (error) {
      result.step3_status = error.response?.status || 'error';
      result.step3_errorCode = error.response?.data?.error?.status || error.message;
      result.step3_errorMessage = error.response?.data?.error?.message || error.message;
    }
  }

  // Step 4: DB locations
  const Location = mongoose.model('Location', new mongoose.Schema({}, { strict: false }), 'locations');
  const dbLocs = await Location.find({});
  result.step4_dbLocations = dbLocs.map(l => ({ locationId: l.locationId, title: l.title }));

  fs.writeFileSync('api-result.json', JSON.stringify(result, null, 2), 'utf8');
  
  await mongoose.disconnect();
  process.exit(0);
}

test().catch(e => {
  fs.writeFileSync('api-result.json', JSON.stringify({ fatal: e.message }), 'utf8');
  process.exit(1);
});
