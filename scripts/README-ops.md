Operational scripts for safe reboot and sudo hardening

Files:
- scripts/apply_sudo_restrictions.sh  — installs /etc/sudoers.d/xanuicam_no_reboot to deny reboot/poweroff for user `nttsu`.
- scripts/install_safe_reboot.sh     — installs /usr/local/bin/safe-reboot which requires typing 'YES REBOOT' to proceed and logs attempts.
- scripts/fix_docker_permissions.sh  — adds `nttsu` to `docker` group and restarts Docker.

Usage (run as root):

sudo bash scripts/apply_sudo_restrictions.sh
sudo bash scripts/install_safe_reboot.sh
sudo bash scripts/fix_docker_permissions.sh

Recommended next steps (run after the above):
- Add an alias for non-admin shells to map `reboot` to the safe wrapper:
  echo "alias reboot='sudo /usr/local/bin/safe-reboot'" >> ~/.bashrc
  source ~/.bashrc

- After group change: log out and log back in to pick up new docker group membership.
- When ready, perform a controlled reboot and then finish deployment cleanup:
  sudo reboot
  # After reboot completes and you reconnect:
  sudo docker rm -f xanuicam_backend_1 || true
  docker-compose up -d
  docker ps  # verify new backend is bound to 0.0.0.0:5000

Caveats:
- These scripts must be executed as root. They validate sudoers syntax before installing.
- If you have additional sudoers rules that conflict, review /etc/sudoers and /etc/sudoers.d/* before applying.
- If you prefer to limit the restriction to a group instead of a single user, edit the script accordingly.
