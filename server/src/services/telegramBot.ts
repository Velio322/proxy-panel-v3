import { Telegraf } from 'telegraf';
import { config } from '../config';
import { getPrisma, serializeBigInt } from '../lib/prisma';

let bot: Telegraf | null = null;

export function initTelegramBot() {
  if (!config.telegram.botToken) {
    console.log('[Telegram] Bot token not configured, skipping');
    return;
  }

  bot = new Telegraf(config.telegram.botToken);

  bot.start(async (ctx) => {
    const prisma = getPrisma();
    const telegramId = ctx.from.id;

    await prisma.telegramUser.upsert({
      where: { telegramId },
      update: {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
      create: {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
    });

    await ctx.reply(
      'Welcome to ProxPanel Bot!\n\n' +
      'Commands:\n' +
      '/status - Check your subscription\n' +
      '/plans - Available plans\n' +
      '/help - Show help\n' +
      '/lang - Change language'
    );
  });

  bot.command('status', async (ctx) => {
    const prisma = getPrisma();
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: ctx.from.id },
    });

    if (!user) {
      return ctx.reply('Please /start the bot first');
    }

    const client = await prisma.client.findFirst({
      where: { telegramId: ctx.from.id },
    });

    if (!client) {
      return ctx.reply('No subscription found. Contact admin to get access.');
    }

    const trafficUsed = Number(client.usedTraffic);
    const trafficLimit = Number(client.trafficLimit);
    const trafficPercent = trafficLimit > 0 ? ((trafficUsed / trafficLimit) * 100).toFixed(1) : '0';

    const expireText = client.expireAt
      ? new Date(client.expireAt).toLocaleDateString()
      : 'Unlimited';

    await ctx.reply(
      `Subscription Status\n\n` +
      `Username: ${client.username}\n` +
      `Traffic: ${formatBytes(trafficUsed)} / ${trafficLimit > 0 ? formatBytes(trafficLimit) : 'Unlimited'} (${trafficPercent}%)\n` +
      `Expires: ${expireText}\n` +
      `Status: ${client.banned ? 'Banned' : 'Active'}`
    );
  });

  bot.command('plans', async (ctx) => {
    const prisma = getPrisma();
    const plans = await prisma.plan.findMany({
      where: { active: true, type: 'USER' },
      orderBy: { price: 'asc' },
    });

    if (plans.length === 0) {
      return ctx.reply('No plans available at the moment.');
    }

    const text = plans.map((p) =>
      `${p.name} - ${p.price} ${p.currency}\n` +
      `Duration: ${p.duration} days | Traffic: ${formatBytes(Number(p.trafficLimit))}` +
      (p.description ? `\n${p.description}` : '')
    ).join('\n\n');

    await ctx.reply(`Available Plans:\n\n${text}`);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'ProxPanel Bot Help\n\n' +
      '/start - Register with the bot\n' +
      '/status - Check subscription status\n' +
      '/plans - View available plans\n' +
      '/lang - Change language (en/ru/zh/fa)\n' +
      '/help - Show this message\n\n' +
      'For support, contact admin.'
    );
  });

  bot.command('lang', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Usage: /lang <code>\n\nAvailable: en, ru, zh, fa');
    }

    const lang = args[1].toLowerCase();
    if (!['en', 'ru', 'zh', 'fa'].includes(lang)) {
      return ctx.reply('Unsupported language. Available: en, ru, zh, fa');
    }

    const prisma = getPrisma();
    await prisma.telegramUser.update({
      where: { telegramId: ctx.from.id },
      data: { language: lang },
    });

    await ctx.reply(`Language set to ${lang}`);
  });

  bot.launch();
  console.log('[Telegram] Bot started');
}

export function stopTelegramBot() {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('[Telegram] Bot stopped');
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
