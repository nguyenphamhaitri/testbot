import { ethers } from 'ethers';
import { config } from './config';

const provider = new ethers.JsonRpcProvider(config.bscProviderUrl);
const userWallets: {
  [userId: number]: { address: string; privateKey: string; created: boolean };
} = {};

export function getWallet(
  userId: number,
): { address: string; privateKey: string; created: boolean } | null {
  return userWallets[userId] || null;
}

export function createWallet(userId: number): {
  address: string;
  privateKey: string;
  created: boolean;
} {
  const wallet = ethers.Wallet.createRandom();
  userWallets[userId] = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    created: true,
  };
  return userWallets[userId];
}

export function importWallet(
  userId: number,
  privateKey: string,
): { address: string; privateKey: string; created: boolean } {
  try {
    const wallet = new ethers.Wallet(privateKey);
    userWallets[userId] = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      created: true,
    };
    return userWallets[userId];
  } catch (error) {
    throw new Error('Invalid private key');
  }
}

export function removeWallet(userId: number): boolean {
  if (userWallets[userId]) {
    delete userWallets[userId];
    return true;
  }
  return false;
}

export async function getBalance(address: string): Promise<string> {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance); // Changed from ethers.utils.formatEther
  } catch (error) {
    throw new Error(`Failed to fetch balance: ${(error as Error).message}`);
  }
}

export async function withdraw(userId: number, toAddress: string, amount: string): Promise<string> {
  const walletData = userWallets[userId];
  if (!walletData) throw new Error('No wallet found for this user');

  const wallet = new ethers.Wallet(walletData.privateKey, provider);
  try {
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount), // Changed from ethers.utils.parseEther
    });
    return tx.hash;
  } catch (error) {
    throw new Error(`Withdrawal failed: ${(error as Error).message}`);
  }
}
