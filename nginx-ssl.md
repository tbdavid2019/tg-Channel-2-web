# Nginx & SSL Configuration Guide

## 1. Nginx Configuration
To configure a new domain (e.g., `new.example.com`) to proxy to a local port (e.g., `3334`), create a new configuration file in `/etc/nginx/conf.d/`.

### template.conf
```nginx
server {
    server_name new.example.com;

    location / {
        proxy_pass http://127.0.0.1:3334; # Change port as needed
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Apply Configuration
```bash
# Check syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 2. SSL Setup (Certbot)
Use `certbot` to automatically obtain an SSL certificate and configure HTTPS.

```bash
# syntax: sudo certbot --nginx -d [your_domain]
sudo certbot --nginx -d new.example.com
```

### Steps:
1.  Run the command.
2.  If prompted, enter your email (first time only) and agree to TOS.
3.  Certbot will ask if you want to redirect HTTP to HTTPS. Choose **2 (Redirect)** for better security.
4.  Certbot will verify ownership, generate the certificate, and update your Nginx config automatically.

## 3. Verification
```bash
# Check if HTTPS is working
curl -I https://new.example.com
```

## Troubleshooting
-   **Port Conflicts**: Ensure no other service is using port 80/443.
-   **Firewall**: Ensure ports 80 and 443 are open (`sudo ufw status`).
-   **Nginx Errors**: Check logs with `sudo tail -f /var/log/nginx/error.log`.
