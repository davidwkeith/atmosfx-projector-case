# Security and guests

## Guest access

With no password set, the page shows a warning: anyone on your network can control VideoFX and download its pairing keys.

- Set a password, and keep the Pi off networks that guests can reach. On UniFi that means a separate guest network with **Network Isolation** on (Settings > Networks) and, on its SSID, **Client Device Isolation**, as in Ubiquiti's [Guest WiFi best practices](https://help.ui.com/hc/en-us/articles/23948850278295-Best-Practices-Guest-WiFi). Keep VideoFX on your own network with the home hub, since it must share one with Matter.
- Once paired, the page hides the Matter pairing code (Settings > Web page > **Hide the Matter pairing code once paired**, on by default).
- "LAN only" means the usual private ranges plus anything on one of the Pi's own subnets. The second part is for IPv6: on a network with a routed prefix every device has a global address, and iPhones and Macs use it for `videofx-xxxx.local`.
- Password guessing is slowed down: five new guesses, then one a second, counted per device address, so one device guessing doesn't lock you out. On top of that, all devices together get twenty, then two a second, so switching between many IPv6 addresses in the Pi's subnet doesn't buy more guesses (though during such an attack your own login may have to wait a moment). A tab that keeps polling with an old password doesn't use them up.
- The service can't write to the home folder apart from the media folder (`ProtectHome=read-only`). If you move the media folder elsewhere under `/home` with `VIDEOFX_MEDIA_DIR`, add a matching `ReadWritePaths=` to the unit.

## Web page security

- The page answers only private, link-local and ULA addresses.
- The Host header must be an IP, `localhost`, `videofx-xxxx(.local)`, the device name or an extra host name (case-insensitive). This blocks DNS rebinding.
- Every write needs an `X-VideoFX: 1` header (CSRF). The optional password uses basic auth, over plain HTTP unless HTTPS is on.
- HTTPS (Settings > Web page) serves the same page on port 443 (`VIDEOFX_HTTPS_PORT`) with an uploaded certificate or a self-signed one made with `openssl` (P-256, 825 days, the Pi's names and addresses in the SAN). The certificate and key live in `/var/lib/videofx/tls/`, mode 0600, and are not part of a backup. With **Send plain HTTP to HTTPS** on, port 80 answers only with a 308 redirect, sent before the password is asked for. There is no HSTS header: a browser would then refuse a self-signed certificate it has not been told to trust, and a removed certificate would lock the page.
- Uploads: file names are checked, the size is capped, extensions are limited, and media is never served back.
