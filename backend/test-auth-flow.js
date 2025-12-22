/**
 * Test Auth Flow
 * 
 * Демонстрация полного flow аутентификации владельца Logos
 * 
 * Usage: node test-auth-flow.js <OWNER_PRIVATE_KEY>
 * 
 * Пример: node test-auth-flow.js 0x1234...abcd
 */

const { ethers } = require('ethers');

const API_URL = 'http://localhost:3001';
const HANDLE = '4DTOCH';

async function testAuthFlow(ownerPrivateKey) {
  console.log('\n🔐 Testing Logos Auth Flow\n');
  console.log('='.repeat(60));
  
  // Create wallet from private key
  const ownerWallet = new ethers.Wallet(ownerPrivateKey);
  console.log(`\n👤 Owner Address: ${ownerWallet.address}`);
  
  // Step 1: Request challenge
  console.log('\n📝 Step 1: Requesting auth challenge...');
  const challengeRes = await fetch(`${API_URL}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: HANDLE })
  });
  
  const challengeData = await challengeRes.json();
  
  if (!challengeRes.ok) {
    console.error('❌ Challenge failed:', challengeData);
    return;
  }
  
  console.log(`   Challenge ID: ${challengeData.challengeId}`);
  console.log(`   Challenge: ${challengeData.challenge.substring(0, 50)}...`);
  
  // Step 2: Sign challenge with owner key
  console.log('\n✍️  Step 2: Signing challenge with owner key...');
  const signature = await ownerWallet.signMessage(challengeData.challenge);
  console.log(`   Signature: ${signature.substring(0, 30)}...`);
  
  // Step 3: Verify signature and get session
  console.log('\n🔑 Step 3: Verifying signature...');
  const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challengeData.challengeId,
      signature
    })
  });
  
  const sessionData = await verifyRes.json();
  
  if (!verifyRes.ok) {
    console.error('❌ Verification failed:', sessionData);
    return;
  }
  
  console.log('   ✅ Authentication successful!');
  console.log(`   Session ID: ${sessionData.sessionId}`);
  console.log(`   Handle: ${sessionData.handle}`);
  console.log(`   DID: ${sessionData.did}`);
  
  // Step 4: Test authenticated endpoint
  console.log('\n🧪 Step 4: Testing authenticated endpoint (/api/auth/me)...');
  const meRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { 'X-Session-Id': sessionData.sessionId }
  });
  
  const meData = await meRes.json();
  console.log('   Response:', JSON.stringify(meData, null, 2));
  
  // Step 5: Chat with Logos
  console.log('\n💬 Step 5: Chatting with Logos...');
  const chatRes = await fetch(`${API_URL}/api/logos/${HANDLE}/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Session-Id': sessionData.sessionId 
    },
    body: JSON.stringify({ message: 'Привет! Как дела?' })
  });
  
  const chatData = await chatRes.json();
  console.log('   Response:', JSON.stringify(chatData, null, 2));
  
  // Step 6: Try accessing different Logos (should fail)
  console.log('\n🚫 Step 6: Try accessing different Logos (should fail)...');
  const otherRes = await fetch(`${API_URL}/api/logos/MARAT/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Session-Id': sessionData.sessionId 
    },
    body: JSON.stringify({ message: 'Hello' })
  });
  
  const otherData = await otherRes.json();
  console.log(`   Status: ${otherRes.status}`);
  console.log('   Response:', JSON.stringify(otherData, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Auth Flow Test Complete!\n');
}

// Get private key from command line
const privateKey = process.argv[2];

if (!privateKey) {
  console.log(`
Usage: node test-auth-flow.js <OWNER_PRIVATE_KEY>

Пример: node test-auth-flow.js 0x1234567890abcdef...

⚠️  Используй приватный ключ owner'a Logos 4DTOCH
   (тот ключ, который был сгенерирован при создании Logos в браузере)
`);
  process.exit(1);
}

testAuthFlow(privateKey).catch(console.error);

