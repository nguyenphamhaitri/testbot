import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';
import {
  getWallet,
  createWallet,
  importWallet,
  removeWallet,
  getBalance,
  withdraw,
} from './wallet';
import { ethers } from 'ethers';

const bot = new TelegramBot(config.telegramToken, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to CryptoLottoBot!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Wallets', callback_data: 'wallets' }],
        [{ text: 'Lottery', callback_data: 'lottery' }],
      ],
    },
  });
});

bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Main Menu:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Wallets', callback_data: 'wallets' }],
        [{ text: 'Lottery', callback_data: 'lottery' }],
      ],
    },
  });
});

bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
  const chatId = query.message!.chat.id;
  const data = query.data!;

  switch (data) {
    case 'wallets':
      const wallet = getWallet(chatId);
      let message = '';
      let buttons: TelegramBot.InlineKeyboardButton[][] = [];

      if (!wallet) {
        message = 'No wallet found.';
        buttons = [
          [{ text: 'Create Wallet', callback_data: 'create_wallet' }],
          [{ text: 'Import Wallet', callback_data: 'import_wallet' }],
        ];
      } else {
        message = `Your wallet: ${wallet.address}`;
        buttons = [
          [{ text: 'Check Balance', callback_data: 'check_balance' }],
          [{ text: 'Deposit', callback_data: 'deposit' }],
          [{ text: 'Withdraw', callback_data: 'withdraw' }],
          [{ text: 'Remove Wallet', callback_data: 'remove_wallet' }],
        ];
      }

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        reply_markup: { inline_keyboard: buttons },
      });
      break;

    case 'create_wallet':
      const newWallet = createWallet(chatId);
      bot.editMessageText(
        `New wallet created!\nAddress: ${newWallet.address}\nPrivate Key: ${newWallet.privateKey}\nKeep it safe!`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Check Balance', callback_data: 'check_balance' }],
              [{ text: 'Deposit', callback_data: 'deposit' }],
              [{ text: 'Withdraw', callback_data: 'withdraw' }],
              [{ text: 'Remove Wallet', callback_data: 'remove_wallet' }],
            ],
          },
        },
      );
      break;

    case 'import_wallet':
      bot.sendMessage(chatId, 'Please reply with your private key (e.g., 0x123...):', {
        reply_markup: { force_reply: true },
      });
      break;

    case 'check_balance':
      const walletForBalance = getWallet(chatId);
      if (walletForBalance) {
        try {
          const balance = await getBalance(walletForBalance.address);
          bot.editMessageText(`Balance for ${walletForBalance.address}: ${balance} BNB`, {
            chat_id: chatId,
            message_id: query.message!.message_id,
            reply_markup: {
              inline_keyboard: [[{ text: 'Back to Wallet', callback_data: 'wallets' }]],
            },
          });
        } catch (error) {
          bot.sendMessage(chatId, (error as Error).message);
        }
      }
      break;

    case 'deposit':
      const walletForDeposit = getWallet(chatId);
      if (walletForDeposit) {
        bot.editMessageText(
          `Send BNB to: ${walletForDeposit.address}\nCheck with "Check Balance" after depositing.`,
          {
            chat_id: chatId,
            message_id: query.message!.message_id,
            reply_markup: {
              inline_keyboard: [[{ text: 'Back to Wallet', callback_data: 'wallets' }]],
            },
          },
        );
      }
      break;

    case 'withdraw':
      bot.sendMessage(chatId, 'Please reply with: amount address\nExample: 0.1 0x123...', {
        reply_markup: { force_reply: true },
      });
      break;

    case 'remove_wallet':
      const removed = removeWallet(chatId);
      bot.editMessageText(
        removed ? 'Wallet removed. Create or import a new one.' : 'No wallet to remove.',
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Create Wallet', callback_data: 'create_wallet' }],
              [{ text: 'Import Wallet', callback_data: 'import_wallet' }],
            ],
          },
        },
      );
      break;

    case 'lottery':
      bot.editMessageText('Lottery feature coming soon!', {
        chat_id: chatId,
        message_id: query.message!.message_id,
        reply_markup: {
          inline_keyboard: [[{ text: 'Back to Menu', callback_data: 'menu' }]],
        },
      });
      break;

    case 'menu':
      bot.editMessageText('Main Menu:', {
        chat_id: chatId,
        message_id: query.message!.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Wallets', callback_data: 'wallets' }],
            [{ text: 'Lottery', callback_data: 'lottery' }],
          ],
        },
      });
      break;

    default:
      bot.sendMessage(chatId, 'Unknown action.');
      break;
  }

  bot.answerCallbackQuery(query.id);
});

bot.on('message', async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  // Withdrawal flow
  if (
    msg.reply_to_message?.text &&
    msg.reply_to_message.text.includes('Please reply with: amount address')
  ) {
    if (!msg.text || typeof msg.text !== 'string' || msg.text.trim() === '') {
      bot.sendMessage(
        chatId,
        'Please provide a valid input. Use: amount address\nExample: 0.1 0x123...',
      );
      return;
    }
    const [amount, toAddress, ...extra] = msg.text.trim().split(/\s+/);
    if (!amount || !toAddress || extra.length > 0) {
      bot.sendMessage(chatId, 'Invalid format. Use exactly: amount address\nExample: 0.1 0x123...');
      return;
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      bot.sendMessage(chatId, 'Amount must be a positive number.');
      return;
    }
    if (!ethers.isAddress(toAddress)) {
      // Changed from ethers.utils.isAddress
      bot.sendMessage(chatId, 'Invalid address format.');
      return;
    }
    try {
      const txHash = await withdraw(chatId, toAddress, amount);
      bot.sendMessage(chatId, `Withdrawal sent! Tx: https://bscscan.com/tx/${txHash}`);
    } catch (error) {
      bot.sendMessage(chatId, (error as Error).message);
    }
  }
  // Import wallet flow
  else if (
    msg.reply_to_message?.text &&
    msg.reply_to_message.text.includes('Please reply with your private key')
  ) {
    if (!msg.text || typeof msg.text !== 'string' || msg.text.trim() === '') {
      bot.sendMessage(chatId, 'Please provide a valid private key.');
      return;
    }
    const privateKey = msg.text.trim();
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      // Basic length check for 32-byte hex key
      bot.sendMessage(
        chatId,
        'Invalid private key format. It should be a 64-character hex string starting with 0x.',
      );
      return;
    }
    try {
      const wallet = importWallet(chatId, privateKey);
      bot.sendMessage(chatId, `Wallet imported!\nAddress: ${wallet.address}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Check Balance', callback_data: 'check_balance' }],
            [{ text: 'Deposit', callback_data: 'deposit' }],
            [{ text: 'Withdraw', callback_data: 'withdraw' }],
            [{ text: 'Remove Wallet', callback_data: 'remove_wallet' }],
          ],
        },
      });
    } catch (error) {
      bot.sendMessage(chatId, (error as Error).message);
    }
  }
});

console.log('CryptoLottoBot is running...');
