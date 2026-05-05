const fs = require('fs');
const { createClient, chains, createAccount } = require('genlayer-js');
const { http } = require('viem');

async function main() {
  const contractCode = fs.readFileSync('./contracts/smart_vault.py', 'utf8');
  const privateKey = process.env.GL_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('GL_PRIVATE_KEY missing in .env.local');
  }

  const account = createAccount(privateKey);
  const client = createClient({
    chain: chains.studionet,
    transport: http('https://studio.genlayer.com:7183'),
    account,
  });

  console.log('Deploying SmartVault.py to GenLayer Studionet...');
  
  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
  });
  
  console.log('Tx submitted:', txHash);
  
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  console.log('Deployed successfully! Contract Address:', receipt.contract_address);
}

main().catch(console.error);
