// ================================================================>> Core Library
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

// ================================================================>> Third Party Library
import * as TelegramBot from 'node-telegram-bot-api';

import {
  cashierAndCustomerBotsAreSeparated,
  getCashierTelegramBotToken,
  getCashierTelegramChatId,
  getCustomerTelegramBotToken,
} from '@app/config/telegram-bots.config';

const NO_POLL: TelegramBot.ConstructorOptions = { polling: false };

@Injectable()
export class TelegramService implements OnModuleInit {
  /** Staff group / cashier alerts (cashier bot token). */
  private readonly cashierBot: TelegramBot;
  /** Customer DMs — must be the bot they open in the Mini App (customer bot token). */
  private readonly customerBot: TelegramBot;
  private readonly cashierChatId: string;
  private readonly logger = new Logger(TelegramService.name);

  constructor() {
    const cashierToken = getCashierTelegramBotToken() || 'cashier_bot_token_unset';
    const customerToken = getCustomerTelegramBotToken() || cashierToken;

    this.cashierChatId = getCashierTelegramChatId() || 'cashier_chat_id_unset';
    this.cashierBot = new TelegramBot(cashierToken, NO_POLL);
    this.customerBot =
      customerToken === cashierToken
        ? this.cashierBot
        : new TelegramBot(customerToken, NO_POLL);
  }

  onModuleInit(): void {
    const cashier = getCashierTelegramBotToken();
    const customer = getCustomerTelegramBotToken();
    const chatId = getCashierTelegramChatId();

    if (!cashier) {
      this.logger.warn(
        'TELEGRAM_CASHIER_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) is not set — cashier order alerts will fail.',
      );
    }
    if (!customer) {
      this.logger.warn(
        'TELEGRAM_CUSTOMER_BOT_TOKEN (or TELEGRAM_WEBAPP_BOT_TOKEN) is not set — ' +
          'customer DMs and Mini App auth may use the cashier bot token as fallback.',
      );
    } else if (cashier && customer === cashier) {
      this.logger.warn(
        'Cashier and customer Telegram bots use the SAME token. Create a second bot in @BotFather: ' +
          'one for staff notifications (TELEGRAM_CASHIER_BOT_TOKEN + TELEGRAM_CHAT_ID), ' +
          'one for customers (TELEGRAM_CUSTOMER_BOT_TOKEN = telegram-mini-app BOT_TOKEN).',
      );
    } else if (cashierAndCustomerBotsAreSeparated()) {
      this.logger.log(
        'Telegram: cashier bot → staff channel; customer bot → Mini App + shopper DMs.',
      );
    }
    if (!chatId) {
      this.logger.warn(
        'TELEGRAM_CASHIER_CHAT_ID (or TELEGRAM_CHAT_ID) is not set — cashier channel messages will fail.',
      );
    }
  }

  /** Post order / ops alerts to the cashier Telegram group. */
  async sendHTMLMessage(htmlText: string) {
    const messageOptions: TelegramBot.SendMessageOptions = {
      parse_mode: 'HTML' as TelegramBot.ParseMode,
    };

    try {
      await this.cashierBot.sendMessage(this.cashierChatId, htmlText, messageOptions);
    } catch (error) {
      this.handleSendMessageError(error);
    }
  }

  /** DM a customer (must use the customer bot they signed in with). */
  async sendHTMLToChat(chatId: number | string, htmlText: string) {
    const messageOptions: TelegramBot.SendMessageOptions = {
      parse_mode: 'HTML' as TelegramBot.ParseMode,
      disable_web_page_preview: true,
    };
    try {
      await this.customerBot.sendMessage(String(chatId), htmlText, messageOptions);
    } catch (error) {
      this.handleSendMessageError(error);
    }
  }

  async sendDocument(fileBuffer: Buffer, fileName: string, caption?: string) {
    try {
      const documentOptions: TelegramBot.SendDocumentOptions = {
        caption: caption || null,
      };

      await this.cashierBot.sendDocument(
        this.cashierChatId,
        fileBuffer,
        documentOptions,
        { filename: fileName },
      );

      this.logger.log('Document sent successfully.');
    } catch (error) {
      this.handleSendDocumentError(error);
    }
  }

  private handleSendDocumentError(error: Error | unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`Error sending document to Telegram: ${msg}`);
  }

  private handleSendMessageError(error: Error | unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`Error sending message to Telegram: ${msg}`);
  }
}
