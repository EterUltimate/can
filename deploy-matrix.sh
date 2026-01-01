#!/bin/bash
# deploy-matrix-desktop-safe.sh

SERVER_IP="192.168.207.128"
ADMIN_USER="matrixadmin"
DB_USER="synapse_user"
DB_NAME="synapse_db"
DB_PASS="SynapseSecurePass_$(date +%s)"
MATRIX_USER="matrix"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run with sudo!" >&2
  read -p "Press Enter to exit..."  # 防止窗口关闭
  exit 1
fi

echo "🔧 Fixing APT sources..."
cat > /etc/apt/sources.list <<'EOF'
deb https://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-backports main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse
EOF

apt update

echo "📦 Installing dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt install -y postgresql curl build-essential libpq-dev python3-dev python3-pip python3-venv

systemctl enable --now postgresql

# Skip UFW on Desktop (optional)
echo "⚠️ Skipping UFW configuration on Desktop (you may configure manually)"

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true

id "$MATRIX_USER" &>/dev/null || adduser --system --no-create-home --group "$MATRIX_USER"

mkdir -p /opt/synapse
chown "$MATRIX_USER":"$MATRIX_USER" /opt/synapse
cd /opt/synapse

sudo -u "$MATRIX_USER" python3 -m venv env
sudo -u "$MATRIX_USER" env/bin/pip install --upgrade pip
sudo -u "$MATRIX_USER" env/bin/pip install --only-binary=psycopg2-binary psycopg2-binary
sudo -u "$MATRIX_USER" env/bin/pip install "matrix-synapse[all]"

if [ ! -f homeserver.yaml ]; then
  sudo -u "$MATRIX_USER" env/bin/python -m synapse.app.homeserver \
    --server-name "$SERVER_IP" \
    --config-path homeserver.yaml \
    --generate-config \
    --report-stats=no
fi

TMP_CONFIG=$(mktemp)
cat > "$TMP_CONFIG" <<EOF
database:
  name: psycopg2
  args:
    user: $DB_USER
    password: "$DB_PASS"
    database: $DB_NAME
    host: localhost
    cp_min: 5
    cp_max: 10
EOF

sudo -u "$MATRIX_USER" python3 -c "
import yaml
with open('homeserver.yaml') as f:
    cfg = yaml.safe_load(f)
cfg.pop('database', None)
with open('$TMP_CONFIG') as t:
    db_cfg = yaml.safe_load(t)
cfg.update(db_cfg)
cfg['bind_addresses'] = ['0.0.0.0']
with open('homeserver.yaml', 'w') as f:
    yaml.dump(cfg, f, default_flow_style=False, indent=2, sort_keys=False)
"
rm -f "$TMP_CONFIG"

cat > /etc/systemd/system/matrix-synapse.service <<EOF
[Unit]
Description=Matrix Synapse Homeserver
After=network.target

[Service]
Type=simple
User=$MATRIX_USER
WorkingDirectory=/opt/synapse
ExecStart=/opt/synapse/env/bin/python -m synapse.app.homeserver --config-path=/opt/synapse/homeserver.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now matrix-synapse

sudo -u "$MATRIX_USER" /opt/synapse/env/bin/register_new_matrix_user \
  -c /opt/synapse/homeserver.yaml \
  -u "$ADMIN_USER" \
  -p "Admin@123" \
  --admin

echo ""
echo "✅ Done! Access: http://192.168.207.128:8008"
echo "👤 Admin: matrixadmin / Admin@123"
read -p "Press Enter to close this window..."  # 关键：防止终端自动关闭