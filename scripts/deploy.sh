#!/bin/bash

set -eo pipefail

mkdir -p .ssh && echo -e "${PRIVATE_KEY//_/\\n}" > .ssh/id_rsa && chmod og-rwx .ssh/id_rsa

# cp ./ansible.cfg /etc/ansible/ansible.cfg
export ANSIBLE_CONFIG=./ansible.cfg

ansible-playbook --verbose \
    --inventory=ansible/hosts \
    ansible/deployment.yml

rm -rf .ssh/id_rsa
