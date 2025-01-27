#!/bin/bash
mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/private
sudo openssl genpkey -algorithm RSA -out /etc/ssl/private/stripeapp.key
sudo openssl req -new -key /etc/ssl/private/stripeapp.key -out /etc/ssl/certs/stripeapp.csr
sudo openssl x509 -req -in /etc/ssl/certs/stripeapp.csr -signkey /etc/ssl/private/stripeapp.key -out /etc/ssl/certs/stripeapp.crt
sudo chmod 666 /etc/ssl/private/stripeapp.key 
