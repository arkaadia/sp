#!/usr/bin/env bash
set -e

# Prompt user for HOST IP
read -r -p "Enter the HOST IP to bind to (Press Enter for default: 0.0.0.0): " input_host
HOST="${input_host:-0.0.0.0}"

# Prompt user for PORT
read -r -p "Enter the PORT (Press Enter for default: 3000): " input_port
PORT="${input_port:-3000}"

ENV_FILE=".env"

# Ensure .env file exists
if [ ! -f "$ENV_FILE" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

# Write HOST into .env (replace existing or append)
if grep -q "^HOST=" "$ENV_FILE"; then
  sed -i "s|^HOST=.*|HOST=${HOST}|" "$ENV_FILE"
else
  echo "HOST=${HOST}" >> "$ENV_FILE"
fi

# Write PORT into .env (replace existing or append)
if grep -q "^PORT=" "$ENV_FILE"; then
  sed -i "s|^PORT=.*|PORT=${PORT}|" "$ENV_FILE"
else
  echo "PORT=${PORT}" >> "$ENV_FILE"
fi

echo ""
echo "✅ Configuration saved to $ENV_FILE:"
echo "   HOST=${HOST}"
echo "   PORT=${PORT}"
echo ""
echo "Restart the service (e.g., 'npm run dev' or 'npm start') for changes to take effect."
