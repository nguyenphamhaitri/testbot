import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegramToken: process.env.TELEGRAM_TOKEN as string,
  bscProviderUrl: (process.env.BSC_PROVIDER_URL || 'https://bsc-dataseed1.binance.org') as string,
};
