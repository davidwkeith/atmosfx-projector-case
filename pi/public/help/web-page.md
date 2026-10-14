# Web page

## Password

Anyone on your network can use this page unless you set a password. It uses basic authentication over plain HTTP, with any user name, so it keeps casual visitors out but does not protect against someone watching the network. The password is stored as a hash and never shown. Changing or removing it needs the current password.

Without a password the page also lets anyone download a backup, which contains the Matter pairing keys.

## Who can reach the page

The page answers only private network addresses. It also checks the host name used, to block DNS rebinding. If you reach the Pi by a name of your own, such as a local DNS record, add it under **Extra host names**.

## Uploads

**Largest upload** caps the size of one uploaded file.

## Pairing code

**Hide the Matter pairing code once paired** keeps the QR code off this page after pairing.

Read more: [Web page security](../../docs/security.md#web-page-security)
