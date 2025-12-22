/**
 * Demo: Full Auth Flow
 * 
 * Показывает как работает авторизация владельца Logos:
 * 1. Расшифровка owner key паролем
 * 2. Запрос challenge
 * 3. Подпись challenge
 * 4. Верификация и получение сессии
 * 5. Чат с Logos (с сессией)
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

const API = 'http://localhost:3001';
const HANDLE = '8LXJXM';
const PASSWORD = 'TestPassword123!';

// Зашифрованный ключ из localStorage (скопировать)
const ENCRYPTED_KEY = process.argv[2];

async function decryptKey(encryptedBase64, password) {
  // Decode base64
  const data = Buffer.from(encryptedBase64, 'base64');
  
  // Extract salt (16 bytes), iv (12 bytes), encrypted data
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);
  
  // Derive key using PBKDF2
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  
  // Decrypt using AES-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  // AES-GCM auth tag is last 16 bytes
  const authTag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, null, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function main() {
  console.log('\n🔐 LOGOS AUTH FLOW DEMO\n');
  console.log('='.repeat(60));
  
  if (!ENCRYPTED_KEY) {
    console.log(`
Использование: node demo-auth.js "<ENCRYPTED_KEY>"

Скопируй значение logos_owner_key из localStorage браузера
и передай как аргумент в кавычках.

Пример:
node demo-auth.js "RtEzD2DUHuTS/G6FOfzhWR7..."
`);
    return;
  }

  try {
    // Step 1: Decrypt owner key
    console.log('\n📦 Step 1: Расшифровка owner key...');
    const privateKey = await decryptKey(ENCRYPTED_KEY, PASSWORD);
    console.log(`   Private Key: ${privateKey.substring(0, 10)}...${privateKey.slice(-6)}`);
    
    // Create wallet
    const wallet = new ethers.Wallet(privateKey);
    console.log(`   Public Key:  ${wallet.address}`);
    
    // Step 2: Request challenge
    console.log('\n🎯 Step 2: Запрос challenge...');
    const challengeRes = await fetch(`${API}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: HANDLE })
    });
    const challengeData = await challengeRes.json();
    console.log(`   Challenge ID: ${challengeData.challengeId}`);
    console.log(`   Message: "${challengeData.challenge.split('\n')[0]}..."`);
    
    // Step 3: Sign challenge
    console.log('\n✍️  Step 3: Подпись challenge owner key...');
    const signature = await wallet.signMessage(challengeData.challenge);
    console.log(`   Signature: ${signature.substring(0, 30)}...`);
    
    // Step 4: Verify and get session
    console.log('\n🔑 Step 4: Верификация подписи...');
    const verifyRes = await fetch(`${API}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challengeData.challengeId,
        signature
      })
    });
    const sessionData = await verifyRes.json();
    
    if (!verifyRes.ok) {
      console.log(`   ❌ Ошибка: ${sessionData.error}`);
      if (sessionData.recovered && sessionData.expected) {
        console.log(`   Recovered: ${sessionData.recovered}`);
        console.log(`   Expected:  ${sessionData.expected}`);
      }
      return;
    }
    
    console.log(`   ✅ Авторизован!`);
    console.log(`   Session ID: ${sessionData.sessionId}`);
    console.log(`   Handle: ${sessionData.handle}`);
    console.log(`   DID: ${sessionData.did}`);
    
    // Step 5: Chat with Logos
    console.log('\n💬 Step 5: Чат с Logos (с авторизацией)...');
    const chatRes = await fetch(`${API}/api/logos/${HANDLE}/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionData.sessionId
      },
      body: JSON.stringify({ message: 'Привет! Кто ты?' })
    });
    const chatData = await chatRes.json();
    console.log(`   User: "Привет! Кто ты?"`);
    console.log(`   ${HANDLE}: "${chatData.response.substring(0, 100)}..."`);
    
    // Step 6: Try accessing another Logos (should fail)
    console.log('\n🚫 Step 6: Попытка доступа к чужому Logos...');
    const otherRes = await fetch(`${API}/api/logos/4DTOCH/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionData.sessionId
      },
      body: JSON.stringify({ message: 'Hello' })
    });
    const otherData = await otherRes.json();
    console.log(`   Status: ${otherRes.status}`);
    console.log(`   Response: ${otherData.error || 'OK'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTH FLOW COMPLETE!\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

