// Indstillinger for web-appen.
// proxy: adressen på din Cloudflare Worker (se VEJLEDNING.md, trin 2), fx 'https://koran-proxy.dit-navn.workers.dev'.
// Uden proxy virker alt undtagen tafsir fra altafsir.com, klassisk sharh fra Shamela og Bukhari-oplæsningen.
window.APP_CONFIG = {
    proxy: 'https://koran-proxy.loaidk.workers.dev'
};
