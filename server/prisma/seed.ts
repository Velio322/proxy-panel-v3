import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // Parse CLI args for custom admin credentials
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const adminUsername = getArg('username') || 'admin';
  const adminPassword = getArg('password') || 'admin123';
  const adminEmail    = getArg('email')    || 'admin@proxpanel.io';

  // ── Create or update SUPER_ADMIN user ──
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { username: adminUsername },
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          username: adminUsername,
          password: hashedPassword,
          email:    adminEmail,
          role:     'SUPER_ADMIN',
          language: 'en',
        },
      });
      console.log(`[Seed] Created SUPER_ADMIN user: ${adminUsername}`);
    } else {
      await prisma.user.update({
        where: { username: adminUsername },
        data:  { password: hashedPassword, email: adminEmail },
      });
      console.log(`[Seed] Updated password for existing user: ${adminUsername}`);
    }
  } catch (e: any) {
    console.error('[Seed] Failed to create/update admin user:', e.message);
    throw e; // admin user is critical — re-throw
  }

  // ── Create default plans ──
  try {
    const plansCount = await prisma.plan.count();
    if (plansCount === 0) {
      await prisma.plan.createMany({
        data: [
          {
            name:         'Basic',
            description:  '30 days, 50GB traffic',
            type:         'USER',
            price:        5,
            currency:     'USD',
            duration:     30,
            trafficLimit: 53687091200n, // 50GB
            protocols:    ['VLESS', 'HYSTERIA2'],
            sortOrder:    1,
          },
          {
            name:         'Standard',
            description:  '30 days, 150GB traffic',
            type:         'USER',
            price:        10,
            currency:     'USD',
            duration:     30,
            trafficLimit: 161061273600n, // 150GB
            protocols:    ['VLESS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU'],
            sortOrder:    2,
          },
          {
            name:         'Premium',
            description:  '30 days, Unlimited traffic',
            type:         'USER',
            price:        20,
            currency:     'USD',
            duration:     30,
            trafficLimit: 0n, // unlimited
            maxSpeed:     1000, // 1Gbps
            protocols:    ['VLESS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU'],
            sortOrder:    3,
          },
          {
            name:         'Reseller Starter',
            description:  'Reseller plan - 100 clients, 1TB',
            type:         'RESELLER',
            price:        50,
            currency:     'USD',
            duration:     30,
            trafficLimit: 1099511627776n, // 1TB
            maxClients:   100,
            protocols:    ['VLESS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU'],
            sortOrder:    4,
          },
        ],
      });
      console.log('[Seed] Created default plans');
    } else {
      console.log(`[Seed] Plans already exist (${plansCount}), skipping`);
    }
  } catch (e: any) {
    console.warn('[Seed] WARNING: Failed to seed plans:', e.message);
    // Non-critical — continue
  }

  // ── Create system settings ──
  try {
    const settingsCount = await prisma.systemSetting.count();
    if (settingsCount === 0) {
      await prisma.systemSetting.createMany({
        data: [
          { key: 'site_name',                  value: 'ProxPanel',   description: 'Site name displayed in UI' },
          { key: 'site_url',                   value: 'https://panel.example.com', description: 'Panel URL' },
          { key: 'registration_enabled',       value: true,          description: 'Allow client self-registration' },
          { key: 'default_protocol',           value: 'VLESS',       description: 'Default protocol for new inbounds' },
          { key: 'max_connections_per_client', value: 5,             description: 'Max simultaneous connections per client' },
          { key: 'traffic_reset_day',          value: 1,             description: 'Day of month to reset traffic counters' },
        ],
      });
      console.log('[Seed] Created default system settings');
    } else {
      console.log(`[Seed] System settings already exist (${settingsCount}), skipping`);
    }
  } catch (e: any) {
    console.warn('[Seed] WARNING: Failed to seed system settings:', e.message);
  }

  // ── Create i18n translations ──
  try {
    const translationsCount = await prisma.translation.count();
    if (translationsCount === 0) {
      await prisma.translation.createMany({
        data: [
          { locale: 'en', key: 'dashboard.title',   value: 'Dashboard' },
          { locale: 'en', key: 'dashboard.clients',  value: 'Clients' },
          { locale: 'en', key: 'dashboard.nodes',    value: 'Nodes' },
          { locale: 'en', key: 'dashboard.traffic',  value: 'Traffic' },
          { locale: 'en', key: 'common.save',        value: 'Save' },
          { locale: 'en', key: 'common.cancel',      value: 'Cancel' },
          { locale: 'en', key: 'common.delete',      value: 'Delete' },
          { locale: 'en', key: 'common.edit',        value: 'Edit' },
          { locale: 'en', key: 'common.create',      value: 'Create' },
          { locale: 'ru', key: 'dashboard.title',    value: 'Панель управления' },
          { locale: 'ru', key: 'dashboard.clients',  value: 'Клиенты' },
          { locale: 'ru', key: 'dashboard.nodes',    value: 'Ноды' },
          { locale: 'ru', key: 'dashboard.traffic',  value: 'Трафик' },
          { locale: 'ru', key: 'common.save',        value: 'Сохранить' },
          { locale: 'ru', key: 'common.cancel',      value: 'Отмена' },
          { locale: 'ru', key: 'common.delete',      value: 'Удалить' },
          { locale: 'ru', key: 'common.edit',        value: 'Редактировать' },
          { locale: 'ru', key: 'common.create',      value: 'Создать' },
          { locale: 'zh', key: 'dashboard.title',    value: '控制面板' },
          { locale: 'zh', key: 'dashboard.clients',  value: '客户' },
          { locale: 'zh', key: 'dashboard.nodes',    value: '节点' },
          { locale: 'zh', key: 'dashboard.traffic',  value: '流量' },
          { locale: 'fa', key: 'dashboard.title',    value: 'داشبورد' },
          { locale: 'fa', key: 'dashboard.clients',  value: 'مشتریان' },
          { locale: 'fa', key: 'dashboard.nodes',    value: 'گره‌ها' },
          { locale: 'fa', key: 'dashboard.traffic',  value: 'ترافیک' },
        ],
      });
      console.log('[Seed] Created i18n translations');
    } else {
      console.log(`[Seed] Translations already exist (${translationsCount}), skipping`);
    }
  } catch (e: any) {
    console.warn('[Seed] WARNING: Failed to seed translations:', e.message);
  }

  console.log('[Seed] Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('[Seed] Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
