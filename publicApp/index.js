require('dotenv').config();
const express = require('express');
const request = require('request-promise-native');
const NodeCache = require('node-cache');
const session = require('express-session');
const open = require('open');
const os = require('os');
const fs = require('fs');
const https = require('https');
//const open = require('open').default
//const { default: open } = require('open');
const app = express();
const PORT = 3000;

const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variable.')
}
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
//const REDIRECT_MACHINE = process.env.CLIENT_MACHINE
const hostname = os.hostname();
app.set('trust proxy', 1); 

console.log('The HostName is ' , hostname);
console.log(' ');

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
//let SCOPES = ['crm.objects.deals.read,crm.objects.deals.write,crm.objects.contacts.read'];
let SCOPES=[];
if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}


// On successful install, users will be redirected to /oauth-callback

var REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;

//===========================================================================//

// Use a session to keep track of client ID
app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: true
}));
 
//================================//
//   Running the OAuth 2.0 Flow   //
//================================//

// Step 1
// Build the authorization URL to redirect a user
// to when they choose to install the app

// Redirect the user from the installation page to
// the authorization URL
app.get('/install', (req, res) => {
  console.log('');
  console.log('=== Initiating OAuth 2.0 flow with HubSpot ===');
  const publicIp = req.headers['host'].split(':')[0]; // To remove the port if present
  console.log('Public IP of the EC2 instance:', publicIp);

  //const ip = (req.headers && req.headers['x-forwarded-for'])
  //          || req.ip 
  //          || req._remoteAddress 
  //          || (req.connection && req.connection.remoteAddress);
  // console.log('headers ADDRESS =========>', req.headers);
  // console.log('IP ADDRESS =========>', req.ip);
  // console.log('remote  ADDRESS =========>', req._remoteAddress);
  // console.log('connection  =========>', req.connection);
  // console.log('IP ADDRESS =========>', ip);

  REDIRECT_URI = `https://${publicIp}:${PORT}/oauth-callback`;
  console.log('');
  console.log("Scopes =====>", SCOPES);
  console.log("===> Step 1: Redirecting user to your app's OAuth URL");
  const authUrl =
 	 'https://app.hubspot.com/oauth/authorize' +
  	`?client_id=${encodeURIComponent(CLIENT_ID)}` + // app's client ID
  	`&scope=${encodeURIComponent(SCOPES)}` + // scopes being requested by the app
  	`&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; // where to send the user after the consent page
  res.redirect(authUrl);
  console.log('===> Step 2: User is being prompted for consent by HubSpot');
});

// Step 2
// The user is prompted to give the app access to the requested
// resources. This is all done by HubSpot, so no work is necessary
// on the app's end

// Step 3
// Receive the authorization code from the OAuth 2.0 Server,
// and process it based on the query parameters that are passed
app.get('/oauth-callback', async (req, res) => {
  console.log('===> Step 3: Handling the request sent by the server');

  // Received a user authorization code, so now combine that with the other
  // required values and exchange both for an access token and a refresh token
//  if (req.query.code) {
//    console.log('       > Received an authorization token');
//
//    const authCodeProof = {
//      grant_type: 'authorization_code',
//      client_id: CLIENT_ID,
//      client_secret: CLIENT_SECRET,
//      redirect_uri: REDIRECT_URI,
//      code: req.query.code
//    };
//
//    // Step 4
//    // Exchange the authorization code for an access token and refresh token
//    console.log('===> Step 4: Exchanging authorization code for an access token and refresh token');
//    const token = await exchangeForTokens(req.sessionID, authCodeProof);
//    if (token.message) {
//      return res.redirect(`/error?msg=${token.message}`);
//    }
//
//    // Once the tokens have been retrieved, use them to make a query
//    // to the HubSpot API
//    res.redirect(`/`);
//  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (userId, exchangeProof) => {
  try {
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    // Usually, this token data should be persisted in a database and associated with
    // a user identity.
    const tokens = JSON.parse(responseBody);
    refreshTokenStore[userId] = tokens.refresh_token;
    accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));

    console.log('       > Received an access token and refresh token');
    return tokens.access_token;
  } catch (e) {
    console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
    return JSON.parse(e.response.body);
  }
};

const refreshAccessToken = async (userId) => {
  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshTokenStore[userId]
  };
  return await exchangeForTokens(userId, refreshTokenProof);
};

const getAccessToken = async (userId) => {
  // If the access token has expired, retrieve
  // a new one using the refresh token
  if (!accessTokenCache.get(userId)) {
    console.log('Refreshing expired access token');
    await refreshAccessToken(userId);
  }
  return accessTokenCache.get(userId);
};

const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

//====================================================//
//   Using an Access Token to Query the HubSpot API   //
//====================================================//

const getContact = async (accessToken) => {
  console.log('');
  console.log('=== Retrieving a contact from HubSpot using the access token ===');
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    console.log('===> Replace the following request.get() to test other API calls');
    console.log('===> request.get(\'https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1\')');
    const result = await request.get('https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1', {
      headers: headers
    });

    return JSON.parse(result).contacts[0];
  } catch (e) {
    console.error('  > Unable to retrieve contact');
    return JSON.parse(e.response.body);
  }
};

//========================================//
//   Displaying information to the user   //
//========================================//

const displayContactName = (res, contact) => {
  if (contact.status === 'error') {
    res.write(`<p>Unable to retrieve contact! Error Message: ${contact.message}</p>`);
    return;
  }
  const { firstname, lastname } = contact.properties;
  res.write(`<p>Contact name: ${firstname.value} ${lastname.value}</p>`);
};

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const contact = await getContact(accessToken);
    res.write(`<h4>Access token: ${accessToken}</h4>`);
    displayContactName(res, contact);
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});

app.get('/error', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
});

// Define paths to your SSL certificate and private key (adjust the paths if you're using Let's Encrypt or self-signed cert)
const options = {
  key: fs.readFileSync('/etc/ssl/private/stripeapp.key'),
  cert: fs.readFileSync('/etc/ssl/certs/stripeapp.crt'),
  //ca: fs.readFileSync('/etc/ssl/certs/yourdomain-chain.crt'),  // Only needed if using an intermediate CA
};

// Start the HTTPS server instead of the HTTP one
https.createServer(options, app).listen(PORT, () => {
  console.log(`=== Starting your app on https://localhost:${PORT} ===`);
  open(`https://localhost:${PORT}`);  // Automatically open in the browser
});

//app.listen(PORT, () => console.log(`=== Starting your app on http://localhost:${PORT} ===`));
//open(`http://localhost:${PORT}`);
//(async () => {
//    await open(`http://localhost:${PORT}`);
//})();

// Define the content of the file
const fileContent = {
  name: "Hubspot Stripe Refund 0129",
  uid: "get-started-public-app",
  description: "An example to demonstrate how to build a public app with developer projects.",
  allowedUrls: [
    "https://api.hubapi.com",
    "https://6c67eb7e-ee23-440c-9c55-243cc7befe27.trayapp.io/",
    "https://api.zippopotam.us/us/33162",
    "https://faux-api.com/api/v1/stripepostcall_47310498837966186",
    "https://api.restful-api.dev/objects"
  ],
  auth: {
    redirectUrls: ["http://localhost:3000/oauth-callback"],
    requiredScopes: [
      "crm.objects.deals.read",
      "crm.objects.deals.write",
      "crm.objects.contacts.read",
      "crm.objects.contacts.write"
    ],
    optionalScopes: [],
    conditionallyRequiredScopes: []
  },
  support: {
    supportEmail: "support@example.com",
    documentationUrl: "https://example.com/docs",
    supportUrl: "https://example.com/support",
    supportPhone: "+18005555555"
  },
  extensions: {
    crm: {
      cards: [
        {
          file: "./extensions/example-card.json"
        }
      ]
    }
  },
  webhooks: {
    file: "./webhooks/webhooks.json"
  }
};

// Write the content to a JSON file
fs.writeFile('config.json', JSON.stringify(fileContent, null, 2), (err) => {
  if (err) {
    console.error('Error writing file:', err);
    return;
  }
  console.log('File created successfully as config.json');
});

