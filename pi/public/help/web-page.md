# Web page

## Password

Anyone on your network can use this page unless you set a password. It uses basic authentication, with any user name. Over plain HTTP that keeps casual visitors out but does not protect against someone watching the network; turn on HTTPS (below) to encrypt it. The password is stored as a hash and never shown. Changing or removing it needs the current password.

Without a password the page also lets anyone download a backup, which contains the Matter pairing keys.

## HTTPS

**HTTPS** also serves this page on port 443. It needs a certificate, set under **HTTPS certificate** at the bottom of this group:

- **Make self-signed certificate** makes one for this Pi's names and its current addresses, valid for 825 days. Browsers warn about it the first time; check the SHA-256 shown here against the browser's certificate details, then accept it. Make a new one if the Pi's address or name changes.
- **Upload certificate and key** takes a PEM certificate (with its chain, if any) and its private key without a passphrase, for example one from your own certificate authority or a local DNS name you have a certificate for.

A new certificate is used at once, without a restart. **Send plain HTTP to HTTPS** then redirects every http:// visit, so the password never crosses the network in the clear. Plain HTTP stays open when HTTPS is off or has no certificate, so you cannot lock yourself out.

## Who can reach the page

The page answers only private network addresses. It also checks the host name used, to block DNS rebinding. If you reach the Pi by a name of your own, such as a local DNS record, add it under **Extra host names**.

## Uploads

**Largest upload** caps the size of one uploaded file.

## Pairing code

**Hide the Matter pairing code once paired** keeps the QR code off this page after pairing.

Read more: [Web page security](../../docs/security.md#web-page-security)
