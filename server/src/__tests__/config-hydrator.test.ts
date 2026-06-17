/**
 * Unit Tests: Config Hydrator
 * Tests for Xray config generation, edge cases, conflict resolution.
 */

import { ConfigHydrator } from '../worker/config-hydrator';
import { InboundConfig } from '../worker/types';
import fs from 'fs';
import path from 'path';

const CONFIG_DIR = '/tmp/proxpanel-test-configs';
const hydrator = new ConfigHydrator(CONFIG_DIR);

// ──── Helpers ────

function makeInbound(overrides: Partial<InboundConfig> = {}): InboundConfig {
  return {
    id: 'test-id',
    protocol: 'VLESS',
    tag: 'test-vless',
    port: 443,
    listen: '0.0.0.0',
    enable: true,
    remark: 'test',
    sniffing: { enabled: true, destOverride: ['http', 'tls'], metadataOnly: false, routeOnly: false, domainsExcluded: [] },
    settings: { id: 'test-uuid-1234-5678-abcd-ef0123456789', flow: 'xtls-rprx-vision' },
    stream: { security: 'reality', network: 'tcp', sni: 'www.microsoft.com', fingerprint: 'chrome', publicKey: 'abc123', shortId: 'def456', spiderX: '', dest: 'www.microsoft.com:443', serverNames: ['www.microsoft.com'] },
    portShares: [],
    ...overrides,
  };
}

function cleanup() {
  if (fs.existsSync(CONFIG_DIR)) {
    fs.rmSync(CONFIG_DIR, { recursive: true });
  }
}

// ──── Tests ────

describe('ConfigHydrator', () => {
  beforeAll(() => cleanup());
  afterAll(() => cleanup());

  describe('generateXrayConfig', () => {
    test('generates valid Xray config for VLESS Reality', () => {
      const inbound = makeInbound();
      const config = hydrator.generateXrayConfig([inbound]);

      expect(config).toBeDefined();
      expect(config.log).toBeDefined();
      expect(config.log.loglevel).toBe('warning');
      expect(config.stats).toBeDefined();
      expect(config.api.tag).toBe('api');
      expect(config.routing).toBeDefined();
      expect(config.routing.rules.length).toBeGreaterThan(0);
      expect(config.inbounds.length).toBe(2); // + api inbound

      const vlessInbound = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vlessInbound).toBeDefined();
      expect(vlessInbound.port).toBe(443);
      expect(vlessInbound.settings.users[0].id).toBe('test-uuid-1234-5678-abcd-ef0123456789');
      expect(vlessInbound.settings.users[0].flow).toBe('xtls-rprx-vision');
      expect(vlessInbound.streamSettings.security).toBe('reality');
      expect(vlessInbound.streamSettings.realitySettings.serverName).toBe('www.microsoft.com');
      expect(vlessInbound.streamSettings.realitySettings.publicKey).toBe('abc123');
      expect(vlessInbound.streamSettings.realitySettings.shortId).toBe('def456');
    });

    test('generates config for VLESS over TLS', () => {
      const inbound = makeInbound({
        stream: { security: 'tls', network: 'ws', sni: 'example.com', fingerprint: 'firefox', alpn: 'h2,http/1.1', wsSettings: { path: '/ws', headers: {} } },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.streamSettings.security).toBe('tls');
      expect(vless.streamSettings.tlsSettings.serverName).toBe('example.com');
      expect(vless.streamSettings.tlsSettings.fingerprint).toBe('firefox');
      expect(vless.streamSettings.network).toBe('ws');
      expect(vless.streamSettings.wsSettings.path).toBe('/ws');
    });

    test('generates config for VMess', () => {
      const inbound = makeInbound({
        protocol: 'VMESS',
        tag: 'test-vmess',
        settings: { id: 'vmess-uuid-1234', alterId: 0 },
        stream: { security: 'none', network: 'tcp' },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vmess = config.inbounds.find((i: any) => i.protocol === 'vmess');
      expect(vmess).toBeDefined();
      expect(vmess.settings.users[0].id).toBe('vmess-uuid-1234');
      expect(vmess.settings.users[0].alterId).toBe(0);
    });

    test('generates config for Trojan', () => {
      const inbound = makeInbound({
        protocol: 'TROJAN',
        tag: 'test-trojan',
        settings: { password: 'trojan-pass-123' },
        stream: { security: 'tls', network: 'tcp', sni: 'trojan.com', fingerprint: 'chrome' },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const trojan = config.inbounds.find((i: any) => i.protocol === 'trojan');
      expect(trojan).toBeDefined();
      expect(trojan.settings.password).toBe('trojan-pass-123');
      expect(trojan.streamSettings.security).toBe('tls');
    });

    test('generates config for Shadowsocks', () => {
      const inbound = makeInbound({
        protocol: 'SHADOWSOCKS',
        tag: 'test-ss',
        settings: { method: 'aes-256-gcm', password: 'ss-pass-123', network: 'tcp,udp' },
        stream: { security: 'none', network: 'tcp' },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const ss = config.inbounds.find((i: any) => i.protocol === 'shadowsocks');
      expect(ss).toBeDefined();
      expect(ss.settings.method).toBe('aes-256-gcm');
      expect(ss.settings.password).toBe('ss-pass-123');
    });

    test('handles multiple inbounds', () => {
      const inbounds = [
        makeInbound({ tag: 'vless-1', port: 443 }),
        makeInbound({ tag: 'vless-2', port: 443, settings: { id: 'uuid-2' } }),
      ];
      const config = hydrator.generateXrayConfig(inbounds);
      // 2 vless + 1 api = 3
      expect(config.inbounds.length).toBe(3);
    });

    test('handles conflicting sniffing settings', () => {
      const inbound = makeInbound({
        sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic', 'dns', 'bittorrent'], metadataOnly: true, routeOnly: true, domainsExcluded: ['*.google.com'] },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.sniffing.enabled).toBe(true);
      expect(vless.sniffing.destOverride).toContain('http');
      expect(vless.sniffing.destOverride).toContain('tls');
      expect(vless.sniffing.destOverride).toContain('quic');
      expect(vless.sniffing.destOverride).toContain('dns');
      expect(vless.sniffing.destOverride).toContain('bittorrent');
      expect(vless.sniffing.metadataOnly).toBe(true);
      expect(vless.sniffing.routeOnly).toBe(true);
    });

    test('handles Reality with empty keys gracefully', () => {
      const inbound = makeInbound({
        stream: { security: 'reality', network: 'tcp', sni: 'test.com', fingerprint: 'chrome', publicKey: '', shortId: '', spiderX: '', dest: 'test.com:443', serverNames: ['test.com'] },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.streamSettings.realitySettings.publicKey).toBe('');
      expect(vless.streamSettings.realitySettings.shortId).toBe('');
    });

    test('generates config with custom routing rules', () => {
      const routing = [
        { type: 'field', ip: ['geoip:private'], outboundTag: 'block' },
        { type: 'field', protocol: ['bittorrent'], outboundTag: 'block' },
      ];
      const config = hydrator.generateXrayConfig([makeInbound()], routing);
      const ruleCount = config.routing.rules.length;
      expect(ruleCount).toBeGreaterThanOrEqual(3); // api + private + bittorrent
    });

    test('handles gRPC transport settings', () => {
      const inbound = makeInbound({
        stream: { security: 'tls', network: 'grpc', sni: 'grpc.com', fingerprint: 'chrome', grpcSettings: { serviceName: 'my-grpc-service', multiMode: true } },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.streamSettings.network).toBe('grpc');
      expect(vless.streamSettings.grpcSettings.serviceName).toBe('my-grpc-service');
      expect(vless.streamSettings.grpcSettings.multiMode).toBe(true);
    });

    test('handles HTTP/2 transport settings', () => {
      const inbound = makeInbound({
        stream: { security: 'tls', network: 'h2', sni: 'h2.com', fingerprint: 'chrome', httpSettings: { path: '/h2path', host: 'h2.com' } },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.streamSettings.network).toBe('h2');
      expect(vless.streamSettings.httpSettings.path).toBe('/h2path');
      expect(vless.streamSettings.httpSettings.host).toEqual(['h2.com']);
    });

    test('handles KCP transport settings', () => {
      const inbound = makeInbound({
        stream: { security: 'none', network: 'kcp', kcpSettings: { headerType: 'wechat-video', seed: 'seed123' } },
      });
      const config = hydrator.generateXrayConfig([inbound]);
      const vless = config.inbounds.find((i: any) => i.protocol === 'vless');
      expect(vless.streamSettings.network).toBe('kcp');
      expect(vless.streamSettings.kcpSettings.header.type).toBe('wechat-video');
      expect(vless.streamSettings.kcpSettings.seed).toBe('seed123');
    });
  });

  describe('generateSingboxConfig', () => {
    test('generates valid sing-box config for Hysteria2', () => {
      const inbound = makeInbound({
        protocol: 'HYSTERIA2',
        tag: 'hy2-test',
        settings: { password: 'hy2-pass', sni: 'hy2.com', obfs: { type: 'salamander', password: 'obfs-pass' }, bandwidth: { up: '100 mbps', down: '100 mbps' }, maxClient: 32 },
        stream: {},
      });
      const config = hydrator.generateSingboxConfig([inbound]);
      expect(config.inbounds.length).toBe(1);
      const hy2 = config.inbounds[0];
      expect(hy2.type).toBe('hysteria2');
      expect(hy2.users[0].password).toBe('hy2-pass');
      expect(hy2.obfs.type).toBe('salamander');
      expect(hy2.obfs.password).toBe('obfs-pass');
      expect(hy2.tls.server_name).toBe('hy2.com');
      expect(hy2.max_client).toBe(32);
    });

    test('generates sing-box config for TUIC', () => {
      const inbound = makeInbound({
        protocol: 'TUIC',
        tag: 'tuic-test',
        settings: { id: 'tuic-uuid', password: 'tuic-pass', congestion_control: 'bbr' },
        stream: {},
      });
      const config = hydrator.generateSingboxConfig([inbound]);
      expect(config.inbounds.length).toBe(1);
      expect(config.inbounds[0].type).toBe('tuic');
      expect(config.inbounds[0].congestion_control).toBe('bbr');
    });
  });

  describe('writeConfig', () => {
    test('writes config files to disk', () => {
      const config = hydrator.generateXrayConfig([makeInbound()]);
      const configPath = hydrator.writeXrayConfig(config);
      expect(fs.existsSync(configPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.inbounds).toBeDefined();
    });

    test('writes sing-box config', () => {
      const config = hydrator.generateSingboxConfig([makeInbound({
        protocol: 'HYSTERIA2', tag: 'hy2', settings: { password: 'pass', sni: 'test.com' }, stream: {},
      })]);
      const configPath = hydrator.writeSingboxConfig(config);
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });
});
