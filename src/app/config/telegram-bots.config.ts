/** Telegram bot tokens / chat ids — supports legacy env names from `.env.example`. */

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function getCashierTelegramBotToken(): string {
  return env("TELEGRAM_CASHIER_BOT_TOKEN") || env("TELEGRAM_BOT_TOKEN");
}

export function getCashierTelegramChatId(): string {
  return env("TELEGRAM_CASHIER_CHAT_ID") || env("TELEGRAM_CHAT_ID");
}

export function getCustomerTelegramBotToken(): string {
  return (
    env("TELEGRAM_CUSTOMER_BOT_TOKEN") ||
    env("TELEGRAM_WEBAPP_BOT_TOKEN") ||
    env("TELEGRAM_BOT_TOKEN")
  );
}

export function cashierAndCustomerBotsAreSeparated(): boolean {
  const cashier = getCashierTelegramBotToken();
  const customer = getCustomerTelegramBotToken();
  return Boolean(cashier && customer && cashier !== customer);
}
