docker build -t broadcastchannel .
docker stop broadcastchannel1
docker stop broadcastchannel2
docker rm broadcastchannel1
docker rm broadcastchannel2
docker run -d --name broadcastchannel1 -p 3333:4321 --env-file .env -v broadcastchannel-data:/app/data broadcastchannel
docker run -d --name broadcastchannel2 -p 3334:4321 --env-file .env2 -v broadcastchannel-data2:/app/data broadcastchannel
