#!/bin/bash
curl -H "X-Forwarded-For: 127.0.0.1" http://localhost:8081/ip.json

