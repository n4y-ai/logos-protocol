/**
 * Demo: Auth Flow for GUVUIK
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

const API = 'http://localhost:3001';
const HANDLE = 'GUVUIK';
const PASSWORD = 'SecurePass2024!';
const ENCRYPTED_KEY = '+msdXyUfrFb3nJWbQFgkaUdOUM5MUHYC52XNaWL0txFvjopet+AF8b6PVpHii+NEiLphB9xG+Z1PBYXtTeF5wGcfRdjLlpDshl4KCb/81WBQVr5MoytLw5tbnsk64ro+e52ro0G67U9fh7CHG40=';

async function decryptKey(encryptedBase64, password) {
  const data = Buffer.from(encryptedBase64, 'base64');
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);
  
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  const authTag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, null, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function main() {
  console.log('\n🔐 LOGOS AUTH FLOW - GUVUIK\n');
  console.log('='.repeat(60));

  // Step 1: Decrypt owner key
  console.log('\n📦 Step 1: Расшифровка owner key...');
  const privateKey = await decryptKey(ENCRYPTED_KEY, PASSWORD);
  console.log(`   ✅ Ключ расшифрован`);
  
  const wallet = new ethers.Wallet(privateKey);
  console.log(`   Public Key: ${wallet.address}`);
  
  // Step 2: Request challenge
  console.log('\n🎯 Step 2: Запрос challenge...');
  const challengeRes = await fetch(`${API}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: HANDLE })
  });
  const challengeData = await challengeRes.json();
  console.log(`   Challenge ID: ${challengeData.challengeId.substring(0, 20)}...`);
  
  // Step 3: Sign challenge
  console.log('\n✍️  Step 3: Подпись challenge...');
  const signature = await wallet.signMessage(challengeData.challenge);
  console.log(`   ✅ Подписано`);
  
  // Step 4: Verify
  console.log('\n🔑 Step 4: Верификация...');
  const verifyRes = await fetch(`${API}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: challengeData.challengeId, signature })
  });
  const sessionData = await verifyRes.json();
  
  if (!verifyRes.ok) {
    console.log(`   ❌ Ошибка: ${sessionData.error}`);
    console.log(`   Recovered: ${sessionData.recovered}`);
    console.log(`   Expected:  ${sessionData.expected}`);
    return;
  }
  
  console.log(`   ✅ АВТОРИЗОВАН!`);
  console.log(`   Session: ${sessionData.sessionId.substring(0, 20)}...`);
  console.log(`   Handle: ${sessionData.handle}`);
  console.log(`   DID: ${sessionData.did}`);
  
  // Step 5: Chat
  console.log('\n💬 Step 5: Чат с Logos...');
  const chatRes = await fetch(`${API}/api/logos/${HANDLE}/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Session-Id': sessionData.sessionId
    },
    body: JSON.stringify({ message: 'Привет! Расскажи о себе.' })
  });
  const chatData = await chatRes.json();
  console.log(`   User: "Привет! Расскажи о себе."`);
  console.log(`   ${HANDLE}: "${chatData.response.split('\n')[0]}"`);
  if (chatData.signature) {
    console.log(`   ✅ Ответ подписан Agent Key`);
  }
  
  // Step 6: Access denied test
  console.log('\n🚫 Step 6: Попытка доступа к 4DTOCH (чужой Logos)...');
  const otherRes = await fetch(`${API}/api/logos/4DTOCH/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Session-Id': sessionData.sessionId
    },
    body: JSON.stringify({ message: 'test' })
  });
  const otherData = await otherRes.json();
  console.log(`   Status: ${otherRes.status} ${otherRes.status === 403 ? '(Access Denied)' : ''}`);
  console.log(`   Error: ${otherData.error}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ AUTH FLOW COMPLETE!\n');
}

main().catch(console.error);

