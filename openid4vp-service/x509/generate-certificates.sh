#!/usr/bin/env bash
# Generates the x509_hash test chain: root-ca-cert.pem (trusted by the wallet, not sent in x5c),
# verifier-cert.pem (x5c[0]) and verifier-key.pem (signs with ES256). Test material only.
set -euo pipefail

cd "$(dirname "$0")"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

openssl ecparam -name prime256v1 -genkey -noout -out "$work_dir/root-ca-key.pem"
openssl req -x509 -new -sha256 -days 3650 \
  -key "$work_dir/root-ca-key.pem" \
  -subj "/C=IN/O=Inji Mock Services/CN=Inji Mock Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -out root-ca-cert.pem

openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out verifier-key.pem
openssl req -new -key verifier-key.pem \
  -subj "/C=IN/O=Inji Mock Services/CN=Inji Mock Verifier" \
  -out "$work_dir/verifier.csr"

cat > "$work_dir/verifier-extensions.cnf" <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
subjectAltName=DNS:verifier.mock.inji.example
EOF

openssl x509 -req -sha256 -days 1825 \
  -in "$work_dir/verifier.csr" \
  -CA root-ca-cert.pem -CAkey "$work_dir/root-ca-key.pem" \
  -set_serial "0x$(openssl rand -hex 16)" \
  -extfile "$work_dir/verifier-extensions.cnf" \
  -out verifier-cert.pem

echo "client_id: x509_hash:$(openssl x509 -in verifier-cert.pem -outform DER | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '=')"
