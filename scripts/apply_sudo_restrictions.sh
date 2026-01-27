#!/bin/bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Run: sudo bash $0" >&2
  exit 1
fi

TMP=/etc/sudoers.d/xanuicam_no_reboot.tmp
cat >"$TMP" <<'EOF'
# Xanuicam: prevent accidental reboot/poweroff via sudo for user nttsu
# Deny specific dangerous commands for the user 'nttsu'.
Cmnd_Alias NO_REBOOT = \
    /sbin/reboot, /usr/sbin/reboot, /bin/reboot, /usr/bin/reboot, \
    /sbin/shutdown, /usr/sbin/shutdown, /bin/shutdown, /usr/bin/shutdown, \
    /bin/systemctl reboot, /usr/bin/systemctl reboot, /bin/systemctl poweroff, /usr/bin/systemctl poweroff

nttsu ALL=(ALL) ALL, !NO_REBOOT
EOF

# Validate the temp file
visudo -c -f "$TMP" >/dev/null 2>&1 || { echo "visudo check failed; not installing" >&2; rm -f "$TMP"; exit 1; }

mv "$TMP" /etc/sudoers.d/xanuicam_no_reboot
chmod 0440 /etc/sudoers.d/xanuicam_no_reboot
chown root:root /etc/sudoers.d/xanuicam_no_reboot

echo "/etc/sudoers.d/xanuicam_no_reboot installed and validated"
exit 0
