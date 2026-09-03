#!/bin/bash
IMAGE="tbdavid2019/tg-channel-2-web:latest"

echo "Pulling latest image: $IMAGE..."
docker pull $IMAGE || true

echo "Stopping existing containers..."
docker rm -f broadcastchannel1 broadcastchannel2 broadcastchannel3 watchtower-broadcastchannel 2>/dev/null || true

echo "Starting broadcastchannel1 on port 3333..."
docker run -d --name broadcastchannel1 --restart unless-stopped \
  --label com.centurylinklabs.watchtower.scope=broadcastchannel \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 3333:4321 --env-file .env -v broadcastchannel-data:/app/data \
  $IMAGE

echo "Starting broadcastchannel2 on port 3334..."
docker run -d --name broadcastchannel2 --restart unless-stopped \
  --label com.centurylinklabs.watchtower.scope=broadcastchannel \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 3334:4321 --env-file .env2 -v broadcastchannel-data2:/app/data \
  $IMAGE

echo "Starting broadcastchannel3 on port 3335..."
docker run -d --name broadcastchannel3 --restart unless-stopped \
  --label com.centurylinklabs.watchtower.scope=broadcastchannel \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 3335:4321 --env-file .env3 -v broadcastchannel-data3:/app/data \
  $IMAGE

echo "Starting Watchtower for auto CI/CD updates..."
docker run -d --name watchtower-broadcastchannel --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DOCKER_API_VERSION=1.44 \
  -e WATCHTOWER_CLEANUP=true \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_SCOPE=broadcastchannel \
  containrrr/watchtower:latest \
  broadcastchannel1 broadcastchannel2 broadcastchannel3

echo "All services deployed successfully!"