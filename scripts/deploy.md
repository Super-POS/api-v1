#!/bin/bash
set -eo pipefail

mkdir -p .ssh && echo -e "${PRIVATE_KEY//_/\\n}" > .ssh/id_rsa && chmod og-rwx .ssh/id_rsa

cp ./ansible.cfg /etc/ansible/ansible.cfg

cat <<EOF > /tmp/vault-passphrase
${MPWT_VAULT_PASSPHRASE}
EOF

ansible-playbook --verbose \
    --inventory=ansible/hosts \
    ansible/deployment.yml \
    --vault-password-file /tmp/vault-passphrase

rm /tmp/vault-passphrase
rm -rf .ssh/id_rsa
