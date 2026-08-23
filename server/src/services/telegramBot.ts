import { Telegraf, Context } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { getPrisma } from '../lib/prisma';

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrisma();
  }

  async start(): Promise<void> {
    if (!config.telegram.botToken) {
      console.log('[Telegram] Bot token not configured, skipping');
      return;
    }

    try {
      this.bot = new Telegraf(config.telegram.botToken);

      this.registerHandlers();

      await this.bot.launch();
      console.log('[Telegram] Bot started successfully');

      process.once('SIGINT', () => this.bot?.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
    } catch (error: any) {
      console.error(`[Telegram] Failed to start bot: ${error.message}`);
    }
  }

  stop(): void {
    if (this.bot) {
      this.bot.stop('Shutdown');
      this.bot = null;
    }
  }

  async sendAdminAlert(message: string, parseMode: 'HTML' | 'MarkdownV2' = 'HTML'): Promise<void> {
    if (!this.bot || config.telegram.adminIds.length === 0) return;

    for (const adminId of config.telegram.adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, message, { parse_mode: parseMode });
      } catch (error: any) {
        console.error(`[Telegram] Failed to send alert to ${adminId}: ${error.message}`);
      }
    }
  }

  async sendToUser(telegramId: number, message: string, parseMode: 'HTML' | 'MarkdownV2' = 'HTML'): Promise<boolean> {
    if (!this.bot) return false;

    try {
      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: parseMode });
      return true;
    } catch (error: any) {
      console.error(`[Telegram] Failed to send message to ${telegramId}: ${error.message}`);
      return false;
    }
  }

  async sendSubscriptionQR(telegramId: number, subUrl: string, label: string): Promise<void> {
    if (!this.bot) return;

    try {
      const qrBuffer = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
          <rect width="100%" height="100%" fill="white"/>
          <text x="150" y="150" text-anchor="middle" font-size="12" fill="black">${subUrl}</text>
        </svg>`
      );

      await this.bot.telegram.sendPhoto(telegramId, 
        { source: qrBuffer },
        { caption: `📱 ${label}\n\n🔗 ${subUrl}`, parse_mode: 'HTML' }
      );
    } catch (error: any) {
      console.error(`[Telegram] Failed to send QR: ${error.message}`);
      await this.sendToUser(telegramId, `📱 ${label}\n\n🔗 ${subUrl}`);
    }
  }

  async checkExpiringSubscriptions(): Promise<void> {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.client.findMany({
      where: {
        banned: false,
        expireAt: { not: null, gte: now, lte: in7d },
        telegramId: { not: null },
      },
    });

    for (const client of expiring) {
      if (!client.telegramId) continue;

      const hoursLeft = Math.floor((client.expireAt!.getTime() - now.getTime()) / (1000 * 60 * 60));
      const daysLeft = Math.floor(hoursLeft / 24);

      let message: string;
      if (hoursLeft < 24) {
        message = `⚠️ <b>Subscription Expiring Soon!</b>\n\n` +
          `Client: ${client.username}\n` +
          `Expires in: ${hoursLeft} hours\n` +
          `Traffic: ${formatBytes(Number(client.usedTraffic))} / ${client.trafficLimit > 0 ? formatBytes(Number(client.trafficLimit)) : '∞'}`;
      } else {
        message = `📅 <b>Subscription Reminder</b>\n\n` +
          `Client: ${client.username}\n` +
          `Expires in: ${daysLeft} days\n` +
          `Traffic: ${formatBytes(Number(client.usedTraffic))} / ${client.trafficLimit > 0 ? formatBytes(Number(client.trafficLimit)) : '∞'}`;
      }

      await this.sendToUser(Number(client.telegramId), message);
    }

    console.log(`[Telegram] Checked ${expiring.length} expiring subscriptions`);
  }

  async checkOfflineNodes(): Promise<void> {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);

    const offlineNodes = await this.prisma.node.findMany({
      where: {
        status: 'ONLINE',
        lastSeen: { lt: threshold },
      },
    });

    if (offlineNodes.length === 0) return;

    await this.prisma.node.updateMany({
      where: { id: { in: offlineNodes.map((n) => n.id) } },
      data: { status: 'OFFLINE' },
    });

    const nodeList = offlineNodes.map((n) => `• ${n.name} (${n.host})`).join('\n');
    const message = `🔴 <b>Node Offline Alert</b>\n\n${offlineNodes.length} node(s) are offline:\n${nodeList}\n\nPlease check the nodes immediately.`;

    await this.sendAdminAlert(message);
    console.log(`[Telegram] Alerted about ${offlineNodes.length} offline nodes`);
  }

  async checkTrafficLimits(): Promise<void> {
    const exceededClients: any[] = await this.prisma.$queryRaw`
      SELECT id, username, "usedTraffic", "trafficLimit", "telegramId"
      FROM "Client"
      WHERE banned = false 
        AND "trafficLimit" > 0 
        AND "usedTraffic" >= "trafficLimit"
    `;

    for (const client of exceededClients) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: { banned: true },
      });

      if (client.telegramId) {
        await this.sendToUser(
          Number(client.telegramId),
          `🚫 <b>Traffic Limit Exceeded</b>\n\n` +
          `Client: ${client.username}\n` +
          `Used: ${formatBytes(Number(client.usedTraffic))}\n` +
          `Limit: ${formatBytes(Number(client.trafficLimit))}\n\n` +
          `Your account has been suspended. Contact support to renew.`
        );
      }

      await this.sendAdminAlert(
        `🚫 <b>Traffic Limit Exceeded</b>\n\n` +
        `Client: ${client.username}\n` +
        `Used: ${formatBytes(Number(client.usedTraffic))} / ${formatBytes(Number(client.trafficLimit))}\n` +
        `Auto-banned: Yes`
      );
    }
  }

  private registerHandlers(): void {
    if (!this.bot) return;

    this.bot.start(async (ctx: Context) => {
      const prisma = getPrisma();
      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      await prisma.telegramUser.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: {
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
        },
        create: {
          telegramId: BigInt(telegramId),
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
        },
      });

      await ctx.reply(
        `👋 Welcome to ProxPanel!\n\n` +
        `📱 <b>Commands:</b>\n` +
        `/link <username> — Link panel account\n` +
        `/status — Check your subscription\n` +
        `/sub — Get subscription link\n` +
        `/qr — Get QR code\n` +
        `/plans — View available plans\n` +
        `/lang — Change language\n` +
        `/help — Show this message`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('link', async (ctx: Context) => {
      const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
      if (args.length < 2) {
        await ctx.reply('Usage: /link <username>\n\nLink your Telegram account to your panel username.', { parse_mode: 'HTML' });
        return;
      }

      const prisma = getPrisma();
      const username = args[1];
      const telegramId = ctx.from?.id;

      const client = await prisma.client.findFirst({ where: { username } });
      if (!client) {
        await ctx.reply('❌ Client not found. Check your username.');
        return;
      }

      const existing = await prisma.client.findFirst({
        where: { telegramId: BigInt(telegramId!), id: { not: client.id } },
      });
      if (existing) {
        await ctx.reply(`❌ This Telegram account is already linked to <b>${existing.username}</b>.`, { parse_mode: 'HTML' });
        return;
      }

      await prisma.client.update({
        where: { id: client.id },
        data: { telegramId: BigInt(telegramId!) },
      });

      await ctx.reply(`✅ Linked to <b>${client.username}</b>!`, { parse_mode: 'HTML' });
    });

    this.bot.command('status', async (ctx: Context) => {
      const prisma = getPrisma();
      const telegramId = ctx.from?.id;

      const client = await prisma.client.findFirst({
        where: { telegramId: BigInt(telegramId!) },
      });

      if (!client) {
        await ctx.reply('No linked account. Use /link <username> to link your panel account.', { parse_mode: 'HTML' });
        return;
      }

      const now = new Date();
      const isExpired = client.expireAt && client.expireAt < now;
      const isNearLimit = client.trafficLimit > 0 && Number(client.usedTraffic) > Number(client.trafficLimit) * 0.9;

      const statusEmoji = client.banned ? '🔴' : isExpired ? '🟡' : isNearLimit ? '🟠' : '🟢';

      await ctx.reply(
        `${statusEmoji} <b>Subscription Status</b>\n\n` +
        `👤 <b>Username:</b> ${client.username}\n` +
        `📊 <b>Traffic:</b> ${formatBytes(Number(client.usedTraffic))} / ${client.trafficLimit > 0 ? formatBytes(Number(client.trafficLimit)) : '∞'}\n` +
        `📅 <b>Expires:</b> ${client.expireAt ? client.expireAt.toLocaleDateString() : 'Never'}\n` +
        `🔒 <b>Status:</b> ${client.banned ? 'Banned' : 'Active'}\n` +
        `📡 <b>Last Active:</b> ${client.lastActiveAt ? client.lastActiveAt.toLocaleString() : 'Never'}`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('sub', async (ctx: Context) => {
      const prisma = getPrisma();
      const telegramId = ctx.from?.id;

      const client = await prisma.client.findFirst({
        where: { telegramId: BigInt(telegramId!) },
      });

      if (!client) {
        await ctx.reply('No linked account. Use /link <username> first.', { parse_mode: 'HTML' });
        return;
      }

      const subUrl = `${config.master.apiUrl}/api/v1/client/${client.subToken}/sub`;
      const subUrlClash = `${config.master.apiUrl}/api/v1/client/${client.subToken}/sub?flag=clash`;

      await ctx.reply(
        `📱 <b>Your Subscription</b>\n\n` +
        `🔗 <b>Base64:</b>\n<code>${subUrl}</code>\n\n` +
        `🔗 <b>Clash:</b>\n<code>${subUrlClash}</code>\n\n` +
        `📋 Copy the link and paste it into your client app.`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('qr', async (ctx: Context) => {
      const prisma = getPrisma();
      const telegramId = ctx.from?.id;

      const client = await prisma.client.findFirst({
        where: { telegramId: BigInt(telegramId!) },
      });

      if (!client) {
        await ctx.reply('No linked account. Use /link first.', { parse_mode: 'HTML' });
        return;
      }

      const subUrl = `${config.master.apiUrl}/api/v1/client/${client.subToken}/sub`;
      await this.sendSubscriptionQR(Number(telegramId!), subUrl, `${client.username} subscription`);
    });

    this.bot.command('lang', async (ctx: Context) => {
      const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
      if (args.length < 2) {
        await ctx.reply('Usage: /lang <code\n\nAvailable: en, ru, zh, fa');
        return;
      }

      const lang = args[1].toLowerCase();
      if (!['en', 'ru', 'zh', 'fa'].includes(lang)) {
        await ctx.reply('Unsupported language. Available: en, ru, zh, fa');
        return;
      }

      const prisma = getPrisma();
      await prisma.telegramUser.update({
        where: { telegramId: BigInt(ctx.from?.id!) },
        data: { language: lang },
      });

      const langNames: Record<string, string> = { en: 'English', ru: 'Русский', zh: '中文', fa: 'فارسی' };
      await ctx.reply(`✅ Language set to ${langNames[lang]}`);
    });

    this.bot.command('help', async (ctx: Context) => {
      await ctx.reply(
        `📖 <b>ProxPanel Bot Help</b>\n\n` +
        `/start — Register with the bot\n` +
        `/link <username> — Link panel account\n` +
        `/status — Check subscription status\n` +
        `/sub — Get subscription link\n` +
        `/qr — Get QR code for subscription\n` +
        `/plans — View available plans\n` +
        `/lang <code> — Change language (en/ru/zh/fa)\n` +
        `/help — Show this message\n\n` +
        `For support, contact your administrator.`,
        { parse_mode: 'HTML' }
      );
    });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let botInstance: TelegramBotService | null = null;

export function initTelegramBot(): void {
  botInstance = new TelegramBotService();
  botInstance.start().catch(console.error);
}

export function stopTelegramBot(): void {
  if (botInstance) {
    botInstance.stop();
    botInstance = null;
  }
}