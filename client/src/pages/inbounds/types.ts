export const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'] as const;
export const TRANSPORTS = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'h2', 'kcp'] as const;
export const SECURITIES = ['none', 'tls', 'reality'] as const;
export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', 'qq', 'random', 'randomized'] as const;
export const FLOWS = ['', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443', 'xtls-rprx-direct'] as const;
export const ALPN_OPTIONS = ['', 'h2,http/1.1', 'h3', 'h3,h2', 'h3,h2,http/1.1', 'h2', 'http/1.1'] as const;
export const SS_METHODS = ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305'] as const;
