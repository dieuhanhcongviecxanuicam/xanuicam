#!/bin/bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Run: sudo bash $0" >&2
  exit 1
fi

cat >/usr/local/bin/safe-reboot <<'EOF'
#!/bin/bash
LOG=/var/log/safe-reboot.log
echo "$(date -Iseconds) safe-reboot invoked by $(whoami) PID $$" >> "$LOG"
read -p "Type 'YES REBOOT' to confirm reboot: " CONFIRM
if [ "$CONFIRM" = "YES REBOOT" ]; then
  echo "$(date -Iseconds) confirmed by $(whoami)" >> "$LOG"
  /sbin/reboot
else
  echo "Canceled" >&2
  echo "$(date -Iseconds) canceled by $(whoami)" >> "$LOG"
  exit 1
fi
EOF

chmod 0755 /usr/local/bin/safe-reboot

# Ensure log exists with safe perms
touch /var/log/safe-reboot.log
chown root:root /var/log/safe-reboot.log
chmod 0640 /var/log/safe-reboot.log

echo "/usr/local/bin/safe-reboot installed. To use for non-root users, add an alias like:\n  alias reboot=\"sudo /usr/local/bin/safe-reboot\"\ninto their ~/.bashrc or profile."
exit 0
